"""
DuarteOS MCP Server: Redis Task Manager
Gerencia tasks multi-agente com dependencias, assignment e execucao paralela.
Tasks podem bloquear outras tasks, agentes sao atribuidos a tasks especificas,
e o sistema detecta automaticamente quais tasks estao prontas para execucao.
Requer: pip install fastmcp redis
"""

from fastmcp import FastMCP
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone

try:
    import redis
except ImportError:
    raise ImportError("redis-py nao encontrado. Instale: pip install redis>=5.0.0")

mcp = FastMCP(
    "redis-task-manager",
    instructions="Gerenciador de tasks multi-agente — cria, atribui, bloqueia e executa tasks com dependencias",
)

# --- Constants ---
TASK_TTL = 2592000  # 30 days
ARCHIVE_TTL = 7776000  # 90 days
MAX_INDEX_SIZE = 500
MAX_TASK_BYTES = 20480  # 20KB per task
MAX_STORAGE_BYTES = 25_000_000  # 25MB soft limit
PRIORITY_ORDER = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
VALID_STATUSES = {"pending", "in_progress", "blocked", "completed", "failed"}
VALID_PRIORITIES = {"P1", "P2", "P3", "P4"}
VALID_AGENTS = {
    "pm", "architect", "backend", "frontend", "qa",
    "context-engineer", "devils-advocate", "devops",
    "fullstack", "system-builder", "security-auditor",
    "data-scientist", "python-executor",
}


# --- Helpers ---


def _get_redis_client():
    """Cria conexao Redis a partir de REDIS_URL."""
    url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    return redis.from_url(url, decode_responses=True, socket_timeout=5, socket_connect_timeout=5)


def _get_project_name():
    """Detecta nome do projeto via package.json ou nome do diretorio."""
    pkg_path = os.path.join(os.getcwd(), "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
                name = pkg.get("name", "")
                if name:
                    return name
        except Exception:
            pass
    return os.path.basename(os.getcwd())


def _key(project, *parts):
    """Monta chave Redis: duarteos:{project}:{parts}."""
    return f"duarteos:{project}:{':'.join(parts)}"


def _now():
    """Retorna datetime UTC atual."""
    return datetime.now(timezone.utc)


def _load_json(r, key, default=None):
    """Carrega e parseia JSON de uma chave Redis."""
    raw = r.get(key)
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    return default if default is not None else {}


def _save_json(r, key, data, ttl=None):
    """Salva dados como JSON numa chave Redis, com TTL opcional."""
    raw = json.dumps(data, ensure_ascii=False)
    if ttl:
        r.set(key, raw, ex=ttl)
    else:
        r.set(key, raw)
    return len(raw.encode("utf-8"))


def _parse_json_param(param, default=None):
    """Parseia parametro JSON string, retorna default se invalido."""
    if not param:
        return default if default is not None else []
    if isinstance(param, (list, dict)):
        return param
    try:
        return json.loads(param)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else []


def _load_index(r, project):
    """Carrega lista de IDs de tasks ativas."""
    return _load_json(r, _key(project, "tasks", "index"), [])


def _save_index(r, project, index):
    """Salva lista de IDs de tasks."""
    _save_json(r, _key(project, "tasks", "index"), index[:MAX_INDEX_SIZE])


def _load_meta(r, project):
    """Carrega metadata do projeto."""
    default = {
        "project": project,
        "total_tasks": 0,
        "total_completed": 0,
        "total_archived": 0,
        "last_cleanup": _now().isoformat(),
    }
    return _load_json(r, _key(project, "tasks", "meta"), default)


def _save_meta(r, project, meta):
    """Salva metadata do projeto."""
    _save_json(r, _key(project, "tasks", "meta"), meta)


def _next_task_id(r, project):
    """Gera proximo ID de task incrementalmente."""
    counter_key = _key(project, "tasks", "counter")
    count = r.incr(counter_key)
    return f"task_{count:03d}"


def _get_task(r, project, task_id):
    """Carrega uma task pelo ID."""
    return _load_json(r, _key(project, "task", task_id))


def _save_task(r, project, task, ttl=TASK_TTL):
    """Salva uma task no Redis."""
    data_str = json.dumps(task, ensure_ascii=False)
    task["size_bytes"] = len(data_str.encode("utf-8"))
    _save_json(r, _key(project, "task", task["id"]), task, ttl=ttl)


def _make_task(task_id, title, description="", agent="", phase="", priority="P2", blocked_by=None, blocks=None, metadata=None):
    """Cria estrutura de task padrao."""
    now = _now().isoformat()
    has_blockers = bool(blocked_by)
    return {
        "id": task_id,
        "title": title,
        "description": description,
        "agent": agent,
        "phase": phase,
        "status": "blocked" if has_blockers else "pending",
        "priority": priority if priority in VALID_PRIORITIES else "P2",
        "blocked_by": blocked_by or [],
        "blocks": blocks or [],
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "completed_at": None,
        "result": None,
        "error": None,
        "metadata": metadata or {},
        "size_bytes": 0,
    }


def _unblock_dependents(r, project, completed_task_id):
    """Cascata: desbloqueia tasks que dependiam da task completada."""
    task = _get_task(r, project, completed_task_id)
    if not task:
        return []

    unblocked = []
    for dep_id in task.get("blocks", []):
        dep_task = _get_task(r, project, dep_id)
        if not dep_task:
            continue

        # Remove bloqueio
        if completed_task_id in dep_task.get("blocked_by", []):
            dep_task["blocked_by"].remove(completed_task_id)
            dep_task["updated_at"] = _now().isoformat()

            # Se nao tem mais bloqueios e estava bloqueada → pending
            if not dep_task["blocked_by"] and dep_task["status"] == "blocked":
                dep_task["status"] = "pending"
                unblocked.append(dep_id)

            _save_task(r, project, dep_task)

    return unblocked


def _connect():
    """Conecta ao Redis e retorna (client, project) ou (None, error_msg)."""
    try:
        r = _get_redis_client()
        r.ping()
        return r, _get_project_name()
    except redis.ConnectionError:
        return None, "Redis indisponivel. Verifique REDIS_URL no .env"
    except redis.AuthenticationError:
        return None, "Falha de autenticacao Redis. Verifique senha no REDIS_URL"
    except Exception as e:
        return None, f"Erro de conexao: {str(e)}"


def _error(msg):
    """Retorna JSON de erro."""
    return json.dumps({"error": msg}, ensure_ascii=False)


# --- MCP Tools ---


@mcp.tool()
def create_task(
    title: str,
    description: str = "",
    agent: str = "",
    phase: str = "",
    priority: str = "P2",
    blocked_by: str = "[]",
    metadata: str = "{}",
) -> str:
    """Cria uma nova task no gerenciador.
    title: titulo da task (obrigatorio)
    description: descricao detalhada do que precisa ser feito
    agent: agente responsavel (pm, architect, backend, frontend, qa, context-engineer, devils-advocate, devops, fullstack, system-builder, security-auditor, data-scientist, python-executor)
    phase: fase do projeto (ex: foundation, features, polish, delivery)
    priority: prioridade P1 (critica) a P4 (baixa). Default: P2
    blocked_by: JSON array de IDs de tasks que bloqueiam esta ["task_001", "task_003"]
    metadata: JSON object com dados extras {"wave": 1, "notes": "..."}
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    task_id = _next_task_id(r, project)
    blockers = _parse_json_param(blocked_by)
    meta_data = _parse_json_param(metadata, {})

    task = _make_task(
        task_id=task_id,
        title=title,
        description=description,
        agent=agent,
        phase=phase,
        priority=priority,
        blocked_by=blockers,
        metadata=meta_data if isinstance(meta_data, dict) else {},
    )

    # Registrar nos "blocks" das tasks bloqueadoras
    for blocker_id in blockers:
        blocker = _get_task(r, project, blocker_id)
        if blocker:
            if task_id not in blocker.get("blocks", []):
                blocker.setdefault("blocks", []).append(task_id)
                _save_task(r, project, blocker)

    _save_task(r, project, task)

    # Update index
    index = _load_index(r, project)
    index.append(task_id)
    _save_index(r, project, index)

    # Update meta
    meta = _load_meta(r, project)
    meta["total_tasks"] = len(index)
    _save_meta(r, project, meta)

    return json.dumps({
        "created": task_id,
        "title": title,
        "status": task["status"],
        "agent": agent,
        "phase": phase,
        "blocked_by": blockers,
    }, ensure_ascii=False)


@mcp.tool()
def create_tasks_batch(tasks_json: str) -> str:
    """Cria multiplas tasks de uma vez, resolvendo dependencias internas via temp_id.
    tasks_json: JSON array de tasks. Cada task pode ter um "temp_id" (ex: "temp_1") usado
    para referenciar dependencias DENTRO do batch. O server resolve para IDs reais.

    Formato de cada task no array:
    {
        "temp_id": "temp_1",          (opcional — para dependencias internas)
        "title": "Criar schema",      (obrigatorio)
        "description": "...",
        "agent": "backend",
        "phase": "foundation",
        "priority": "P2",
        "blocked_by": ["temp_2"],     (pode usar temp_ids ou task_ids reais)
        "metadata": {}
    }
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    tasks_data = _parse_json_param(tasks_json)
    if not tasks_data or not isinstance(tasks_data, list):
        return _error("tasks_json deve ser um JSON array de tasks")

    # Phase 1: Generate real IDs and build temp→real mapping
    temp_to_real = {}
    created_tasks = []

    for task_data in tasks_data:
        if not isinstance(task_data, dict) or not task_data.get("title"):
            continue

        real_id = _next_task_id(r, project)
        temp_id = task_data.get("temp_id", "")
        if temp_id:
            temp_to_real[temp_id] = real_id

        created_tasks.append({
            "real_id": real_id,
            "data": task_data,
        })

    # Phase 2: Resolve temp_ids in blocked_by and create tasks
    index = _load_index(r, project)
    results = []

    for item in created_tasks:
        real_id = item["real_id"]
        data = item["data"]

        # Resolve blocked_by: temp_ids → real_ids
        raw_blockers = data.get("blocked_by", [])
        if isinstance(raw_blockers, str):
            raw_blockers = _parse_json_param(raw_blockers)
        resolved_blockers = []
        for b in raw_blockers:
            resolved_blockers.append(temp_to_real.get(b, b))

        meta_data = data.get("metadata", {})
        if isinstance(meta_data, str):
            meta_data = _parse_json_param(meta_data, {})

        task = _make_task(
            task_id=real_id,
            title=data["title"],
            description=data.get("description", ""),
            agent=data.get("agent", ""),
            phase=data.get("phase", ""),
            priority=data.get("priority", "P2"),
            blocked_by=resolved_blockers,
            metadata=meta_data if isinstance(meta_data, dict) else {},
        )

        _save_task(r, project, task)
        index.append(real_id)

        results.append({
            "id": real_id,
            "temp_id": data.get("temp_id", ""),
            "title": data["title"],
            "status": task["status"],
            "agent": data.get("agent", ""),
            "blocked_by": resolved_blockers,
        })

    # Phase 3: Update blocks (reverse references)
    for item in created_tasks:
        real_id = item["real_id"]
        task = _get_task(r, project, real_id)
        if not task:
            continue
        for blocker_id in task.get("blocked_by", []):
            blocker = _get_task(r, project, blocker_id)
            if blocker:
                if real_id not in blocker.get("blocks", []):
                    blocker.setdefault("blocks", []).append(real_id)
                    _save_task(r, project, blocker)

    _save_index(r, project, index)

    meta = _load_meta(r, project)
    meta["total_tasks"] = len(index)
    _save_meta(r, project, meta)

    # Stats
    pending = sum(1 for t in results if t.get("status") == "pending")
    blocked = sum(1 for t in results if t.get("status") == "blocked")

    return json.dumps({
        "created": len(results),
        "pending": pending,
        "blocked": blocked,
        "id_mapping": {r_item.get("temp_id"): r_item["id"] for r_item in results if r_item.get("temp_id")},
        "tasks": results,
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def get_task(task_id: str) -> str:
    """Retorna uma task completa pelo ID.
    task_id: ID da task (ex: task_001)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    task = _get_task(r, project, task_id)
    if not task:
        return _error(f"Task '{task_id}' nao encontrada")

    return json.dumps(task, indent=2, ensure_ascii=False)


@mcp.tool()
def list_tasks(
    status: str = "",
    agent: str = "",
    phase: str = "",
    priority: str = "",
    limit: int = 50,
) -> str:
    """Lista tasks com filtros opcionais.
    status: filtrar por status (pending, in_progress, blocked, completed, failed)
    agent: filtrar por agente (backend, frontend, etc)
    phase: filtrar por fase (foundation, features, etc)
    priority: filtrar por prioridade (P1, P2, P3, P4)
    limit: maximo de tasks a retornar (default: 50)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    tasks = []

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue

        if status and task.get("status") != status:
            continue
        if agent and task.get("agent") != agent:
            continue
        if phase and task.get("phase") != phase:
            continue
        if priority and task.get("priority") != priority:
            continue

        tasks.append({
            "id": task["id"],
            "title": task["title"],
            "agent": task.get("agent", ""),
            "phase": task.get("phase", ""),
            "status": task["status"],
            "priority": task.get("priority", "P2"),
            "blocked_by": task.get("blocked_by", []),
            "blocks": task.get("blocks", []),
        })

    # Sort by priority then by ID
    tasks.sort(key=lambda t: (PRIORITY_ORDER.get(t.get("priority", "P2"), 9), t["id"]))

    return json.dumps({
        "project": project,
        "total": len(tasks),
        "filters": {k: v for k, v in {"status": status, "agent": agent, "phase": phase, "priority": priority}.items() if v},
        "tasks": tasks[:limit],
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def update_task(
    task_id: str,
    title: str = "",
    description: str = "",
    agent: str = "",
    phase: str = "",
    priority: str = "",
    add_blocked_by: str = "[]",
    remove_blocked_by: str = "[]",
    metadata: str = "{}",
) -> str:
    """Atualiza campos de uma task existente.
    task_id: ID da task a atualizar
    title: novo titulo (vazio = nao muda)
    description: nova descricao (vazio = nao muda)
    agent: novo agente (vazio = nao muda)
    phase: nova fase (vazio = nao muda)
    priority: nova prioridade (vazio = nao muda)
    add_blocked_by: JSON array de IDs a adicionar como bloqueios
    remove_blocked_by: JSON array de IDs a remover dos bloqueios
    metadata: JSON object com campos a merge no metadata existente
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    task = _get_task(r, project, task_id)
    if not task:
        return _error(f"Task '{task_id}' nao encontrada")

    if title:
        task["title"] = title
    if description:
        task["description"] = description
    if agent:
        task["agent"] = agent
    if phase:
        task["phase"] = phase
    if priority and priority in VALID_PRIORITIES:
        task["priority"] = priority

    # Manage blockers
    add_blockers = _parse_json_param(add_blocked_by)
    remove_blockers = _parse_json_param(remove_blocked_by)

    for blocker_id in add_blockers:
        if blocker_id not in task.get("blocked_by", []):
            task.setdefault("blocked_by", []).append(blocker_id)
            # Register reverse ref
            blocker = _get_task(r, project, blocker_id)
            if blocker:
                if task_id not in blocker.get("blocks", []):
                    blocker.setdefault("blocks", []).append(task_id)
                    _save_task(r, project, blocker)

    for blocker_id in remove_blockers:
        if blocker_id in task.get("blocked_by", []):
            task["blocked_by"].remove(blocker_id)
            # Remove reverse ref
            blocker = _get_task(r, project, blocker_id)
            if blocker and task_id in blocker.get("blocks", []):
                blocker["blocks"].remove(task_id)
                _save_task(r, project, blocker)

    # Update status based on blockers
    if task.get("blocked_by") and task["status"] == "pending":
        task["status"] = "blocked"
    elif not task.get("blocked_by") and task["status"] == "blocked":
        task["status"] = "pending"

    # Merge metadata
    new_meta = _parse_json_param(metadata, {})
    if isinstance(new_meta, dict) and new_meta:
        task.setdefault("metadata", {}).update(new_meta)

    task["updated_at"] = _now().isoformat()
    _save_task(r, project, task)

    return json.dumps({
        "updated": task_id,
        "status": task["status"],
        "blocked_by": task.get("blocked_by", []),
    }, ensure_ascii=False)


@mcp.tool()
def assign_task(task_id: str, agent: str) -> str:
    """Atribui uma task a um agente e inicia execucao (status → in_progress).
    task_id: ID da task
    agent: agente que vai executar (pm, architect, backend, frontend, qa, etc)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    task = _get_task(r, project, task_id)
    if not task:
        return _error(f"Task '{task_id}' nao encontrada")

    if task["status"] == "blocked":
        blockers = task.get("blocked_by", [])
        return _error(f"Task '{task_id}' esta bloqueada por: {blockers}. Complete as dependencias primeiro.")

    if task["status"] == "completed":
        return _error(f"Task '{task_id}' ja esta concluida.")

    if task["status"] == "in_progress" and task.get("agent"):
        return _error(f"Task '{task_id}' ja esta em progresso com agente '{task['agent']}'.")

    task["agent"] = agent
    task["status"] = "in_progress"
    task["started_at"] = _now().isoformat()
    task["updated_at"] = _now().isoformat()
    _save_task(r, project, task)

    return json.dumps({
        "assigned": task_id,
        "agent": agent,
        "title": task["title"],
        "status": "in_progress",
    }, ensure_ascii=False)


@mcp.tool()
def complete_task(task_id: str, result_summary: str = "") -> str:
    """Marca task como concluida e desbloqueia tasks dependentes (cascata).
    task_id: ID da task concluida
    result_summary: resumo do que foi feito/entregue
    """
    conn = _connect()
    if conn[0] is None:
        return _error(conn[1])
    r, project = conn

    task = _get_task(r, project, task_id)
    if not task:
        return _error(f"Task '{task_id}' nao encontrada")

    if task["status"] == "completed":
        return _error(f"Task '{task_id}' ja esta concluida.")

    task["status"] = "completed"
    task["completed_at"] = _now().isoformat()
    task["updated_at"] = _now().isoformat()
    if result_summary:
        task["result"] = result_summary
    _save_task(r, project, task)

    # Cascade: unblock dependents
    unblocked = _unblock_dependents(r, project, task_id)

    # Update meta
    meta = _load_meta(r, project)
    meta["total_completed"] = meta.get("total_completed", 0) + 1
    _save_meta(r, project, meta)

    response = {
        "completed": task_id,
        "title": task["title"],
        "unblocked_tasks": unblocked,
    }

    if unblocked:
        # Show what was unblocked
        unblocked_details = []
        for uid in unblocked:
            ut = _get_task(r, project, uid)
            if ut:
                unblocked_details.append({"id": uid, "title": ut["title"], "agent": ut.get("agent", "")})
        response["unblocked_details"] = unblocked_details

    return json.dumps(response, indent=2, ensure_ascii=False)


@mcp.tool()
def fail_task(task_id: str, error_message: str) -> str:
    """Marca task como falha com motivo do erro.
    task_id: ID da task que falhou
    error_message: descricao do erro/motivo da falha
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    task = _get_task(r, project, task_id)
    if not task:
        return _error(f"Task '{task_id}' nao encontrada")

    task["status"] = "failed"
    task["error"] = error_message
    task["updated_at"] = _now().isoformat()
    _save_task(r, project, task)

    # Show what tasks are now stuck (blocked by this failed task)
    stuck = []
    for dep_id in task.get("blocks", []):
        dep = _get_task(r, project, dep_id)
        if dep and dep["status"] == "blocked":
            stuck.append({"id": dep_id, "title": dep["title"]})

    return json.dumps({
        "failed": task_id,
        "title": task["title"],
        "error": error_message,
        "stuck_tasks": stuck,
        "action_needed": f"Corrija o erro e use assign_task('{task_id}', 'agente') para reiniciar" if stuck else "",
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def get_next_tasks(agent: str = "", limit: int = 20) -> str:
    """Retorna tasks prontas para execucao (fronteira): pending + sem bloqueios.
    Agrupa por agente para facilitar spawn paralelo.
    agent: filtrar por agente especifico (vazio = todos)
    limit: maximo de tasks (default: 20)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    ready = []

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue
        if task["status"] != "pending":
            continue
        if task.get("blocked_by"):
            continue
        if agent and task.get("agent") != agent:
            continue

        ready.append({
            "id": task["id"],
            "title": task["title"],
            "agent": task.get("agent", ""),
            "phase": task.get("phase", ""),
            "priority": task.get("priority", "P2"),
            "blocks": task.get("blocks", []),
        })

    # Sort by priority
    ready.sort(key=lambda t: (PRIORITY_ORDER.get(t.get("priority", "P2"), 9), t["id"]))
    ready = ready[:limit]

    # Group by agent
    by_agent = {}
    for t in ready:
        ag = t.get("agent", "unassigned") or "unassigned"
        by_agent.setdefault(ag, []).append(t)

    return json.dumps({
        "project": project,
        "total_ready": len(ready),
        "by_agent": by_agent,
        "tasks": ready,
        "hint": "Use assign_task(id, agent) para iniciar cada task. Agents do mesmo grupo podem rodar em paralelo.",
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def get_blocked_tasks(limit: int = 50) -> str:
    """Lista tasks bloqueadas e o que as bloqueia.
    limit: maximo de tasks (default: 50)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    blocked = []

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue
        if task["status"] != "blocked":
            continue

        # Show status of each blocker
        blocker_details = []
        for bid in task.get("blocked_by", []):
            bt = _get_task(r, project, bid)
            if bt:
                blocker_details.append({
                    "id": bid,
                    "title": bt["title"],
                    "status": bt["status"],
                    "agent": bt.get("agent", ""),
                })

        blocked.append({
            "id": task["id"],
            "title": task["title"],
            "agent": task.get("agent", ""),
            "phase": task.get("phase", ""),
            "blocked_by": blocker_details,
        })

    return json.dumps({
        "project": project,
        "total_blocked": len(blocked),
        "tasks": blocked[:limit],
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def get_phase_status(phase: str) -> str:
    """Status agregado de uma fase do projeto.
    phase: nome da fase (ex: foundation, features, polish, delivery)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    counts = {"pending": 0, "in_progress": 0, "blocked": 0, "completed": 0, "failed": 0}
    agents_involved = set()
    tasks_in_phase = []

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue
        if task.get("phase") != phase:
            continue

        status = task["status"]
        counts[status] = counts.get(status, 0) + 1
        if task.get("agent"):
            agents_involved.add(task["agent"])
        tasks_in_phase.append({
            "id": task["id"],
            "title": task["title"],
            "status": status,
            "agent": task.get("agent", ""),
            "priority": task.get("priority", "P2"),
        })

    total = sum(counts.values())
    progress_pct = round((counts["completed"] / total * 100), 1) if total > 0 else 0

    return json.dumps({
        "phase": phase,
        "progress_pct": progress_pct,
        "total": total,
        "counts": counts,
        "agents": sorted(agents_involved),
        "tasks": tasks_in_phase,
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def get_project_board() -> str:
    """Visao geral tipo Kanban: todas tasks agrupadas por status, com stats."""
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    board = {"pending": [], "in_progress": [], "blocked": [], "completed": [], "failed": []}
    phases = set()
    agents_active = set()

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue

        status = task["status"]
        entry = {
            "id": task["id"],
            "title": task["title"],
            "agent": task.get("agent", ""),
            "phase": task.get("phase", ""),
            "priority": task.get("priority", "P2"),
        }

        if status == "blocked":
            entry["blocked_by"] = task.get("blocked_by", [])
        if status == "in_progress" and task.get("agent"):
            agents_active.add(task["agent"])

        board.setdefault(status, []).append(entry)

        if task.get("phase"):
            phases.add(task["phase"])

    total = sum(len(v) for v in board.values())
    completed = len(board.get("completed", []))
    progress_pct = round((completed / total * 100), 1) if total > 0 else 0

    return json.dumps({
        "project": project,
        "progress_pct": progress_pct,
        "total_tasks": total,
        "counts": {k: len(v) for k, v in board.items()},
        "phases": sorted(phases),
        "agents_active": sorted(agents_active),
        "board": board,
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def cleanup_completed(days_threshold: int = 7) -> str:
    """Arquiva tasks completas mais antigas que N dias para liberar espaco.
    days_threshold: tasks completas mais antigas que este valor serao arquivadas (default: 7 dias)
    """
    result = _connect()
    if result[0] is None:
        return _error(result[1])
    r, project = result

    index = _load_index(r, project)
    archive = _load_json(r, _key(project, "tasks", "archive"), [])
    now = _now()
    cutoff = now - timedelta(days=days_threshold)

    keep_ids = []
    archived_count = 0

    for tid in index:
        task = _get_task(r, project, tid)
        if not task:
            continue

        if task["status"] == "completed" and task.get("completed_at"):
            try:
                completed_at = datetime.fromisoformat(task["completed_at"])
                if completed_at < cutoff:
                    # Archive summary
                    archive.append({
                        "id": task["id"],
                        "title": task["title"],
                        "agent": task.get("agent", ""),
                        "phase": task.get("phase", ""),
                        "completed_at": task["completed_at"],
                        "result": (task.get("result") or "")[:200],
                        "archived_at": now.isoformat(),
                    })
                    r.delete(_key(project, "task", tid))
                    archived_count += 1
                    continue
            except (ValueError, TypeError):
                pass

        keep_ids.append(tid)

    # Cap archive at 100 entries
    archive = archive[-100:]
    _save_json(r, _key(project, "tasks", "archive"), archive, ttl=ARCHIVE_TTL)
    _save_index(r, project, keep_ids)

    meta = _load_meta(r, project)
    meta["total_tasks"] = len(keep_ids)
    meta["total_archived"] = len(archive)
    meta["last_cleanup"] = now.isoformat()
    _save_meta(r, project, meta)

    return json.dumps({
        "archived": archived_count,
        "remaining_active": len(keep_ids),
        "total_archive": len(archive),
    }, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()
