"""
DuarteOS MCP Server: Redis Session Manager
Gerencia sessoes de trabalho persistentes no Redis.
Salva contexto, decisoes e progresso entre sessoes do Claude Code.
Gestao automatica de storage para respeitar limite de 30MB (free tier).
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
    "redis-session",
    instructions="Gerenciador de sessoes Redis — salva, restaura e gerencia contexto entre sessoes",
)

# --- Constants ---
MAX_STORAGE_BYTES = 25_000_000  # 25MB soft limit (30MB hard on free tier)
WARNING_THRESHOLD_PCT = 80
SESSION_TTL = 604800  # 7 days
SUMMARY_TTL = 7776000  # 90 days
MAX_INDEX_SIZE = 50
MAX_SESSION_BYTES = 51200  # 50KB per session
DEFAULT_SUMMARIZE_DAYS = 3
DEFAULT_PURGE_DAYS = 30


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


def _get_git_info():
    """Retorna (branch, commit_hash) ou ('', '') se nao for git repo."""
    branch = ""
    commit = ""
    try:
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"], text=True, timeout=3, stderr=subprocess.DEVNULL
        ).strip()
        commit = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], text=True, timeout=3, stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        pass
    return branch, commit


def _key(project, *parts):
    """Monta chave Redis: duarteos:{project}:{parts}."""
    return f"duarteos:{project}:{':'.join(parts)}"


def _now():
    """Retorna datetime UTC atual."""
    return datetime.now(timezone.utc)


def _session_id():
    """Gera ID de sessao: sess_YYYYMMDD_HHMMSS."""
    return f"sess_{_now().strftime('%Y%m%d_%H%M%S')}"


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


def _load_index(r, project):
    """Carrega lista de IDs de sessoes ativas."""
    return _load_json(r, _key(project, "sessions", "index"), [])


def _save_index(r, project, index):
    """Salva lista de IDs de sessoes."""
    _save_json(r, _key(project, "sessions", "index"), index[:MAX_INDEX_SIZE])


def _load_meta(r, project):
    """Carrega metadata do projeto."""
    default = {
        "project": project,
        "total_sessions": 0,
        "total_summaries": 0,
        "estimated_bytes": 0,
        "last_cleanup": _now().isoformat(),
    }
    return _load_json(r, _key(project, "meta"), default)


def _save_meta(r, project, meta):
    """Salva metadata do projeto."""
    _save_json(r, _key(project, "meta"), meta)


def _estimate_storage(r, project):
    """Estima bytes usados por este projeto no Redis."""
    total = 0
    index = _load_index(r, project)
    for sid in index:
        session = _load_json(r, _key(project, "session", sid))
        if session:
            total += session.get("size_bytes", 0)
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    total += len(json.dumps(summaries, ensure_ascii=False).encode("utf-8"))
    meta = _load_meta(r, project)
    total += len(json.dumps(meta, ensure_ascii=False).encode("utf-8"))
    return total


def _truncate_session(session):
    """Garante que sessao nao exceda 50KB."""
    data = json.dumps(session, ensure_ascii=False).encode("utf-8")
    if len(data) <= MAX_SESSION_BYTES:
        return session
    if len(session.get("files_modified", [])) > 20:
        session["files_modified"] = session["files_modified"][-20:]
    if len(session.get("decisions", [])) > 15:
        session["decisions"] = session["decisions"][-15:]
    if len(session.get("context_notes", "")) > 2000:
        session["context_notes"] = session["context_notes"][:2000] + "..."
    if len(session.get("pending_items", [])) > 20:
        session["pending_items"] = session["pending_items"][-20:]
    if len(session.get("errors_encountered", [])) > 10:
        session["errors_encountered"] = session["errors_encountered"][-10:]
    return session


def _auto_cleanup(r, project, level=1):
    """Limpeza progressiva baseada no nivel."""
    result = {"level": level, "freed_bytes": 0, "actions": []}
    index = _load_index(r, project)
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    now = _now()

    if level >= 1:
        # Summarize sessions older than 2 days
        to_summarize = []
        keep = []
        for sid in index:
            session = _load_json(r, _key(project, "session", sid))
            if not session:
                continue
            created = datetime.fromisoformat(session["created_at"])
            if (now - created).days >= 2:
                to_summarize.append(session)
            else:
                keep.append(sid)
        for session in to_summarize:
            summary_entry = {
                "id": session["id"],
                "date": session["created_at"][:10],
                "summary": session.get("summary", "")[:300],
                "key_decisions": [d.get("topic", "") for d in session.get("decisions", [])[:5]],
                "original_size": session.get("size_bytes", 0),
                "summarized_at": now.isoformat(),
            }
            summaries.append(summary_entry)
            r.delete(_key(project, "session", session["id"]))
            result["freed_bytes"] += session.get("size_bytes", 0)
        _save_index(r, project, keep)
        result["actions"].append(f"Resumidas {len(to_summarize)} sessoes antigas")

    if level >= 2:
        # Delete summaries older than 15 days
        cutoff = now - timedelta(days=15)
        before = len(summaries)
        summaries = [
            s for s in summaries
            if datetime.fromisoformat(s.get("summarized_at", now.isoformat())) > cutoff
        ]
        removed = before - len(summaries)
        result["actions"].append(f"Removidos {removed} resumos antigos (>15 dias)")

    if level >= 3:
        # Emergency: keep only 5 sessions + 10 summaries
        index = _load_index(r, project)
        if len(index) > 5:
            for sid in index[5:]:
                r.delete(_key(project, "session", sid))
            _save_index(r, project, index[:5])
            result["actions"].append(f"Mantidas apenas 5 sessoes ativas")
        if len(summaries) > 10:
            summaries = summaries[-10:]
            result["actions"].append(f"Mantidos apenas 10 resumos recentes")

    _save_json(r, _key(project, "sessions", "summaries"), summaries, ttl=SUMMARY_TTL)

    # Update meta
    meta = _load_meta(r, project)
    meta["estimated_bytes"] = _estimate_storage(r, project)
    meta["total_summaries"] = len(summaries)
    meta["total_sessions"] = len(_load_index(r, project))
    meta["last_cleanup"] = now.isoformat()
    _save_meta(r, project, meta)

    return result


def _parse_json_param(param, default=None):
    """Parseia parametro JSON string, retorna default se invalido."""
    if not param:
        return default if default is not None else []
    if isinstance(param, list):
        return param
    try:
        return json.loads(param)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else []


# --- MCP Tools ---


@mcp.tool()
def save_session(
    summary: str,
    decisions: str = "[]",
    pending_items: str = "[]",
    files_modified: str = "[]",
    context_notes: str = "",
    errors_encountered: str = "[]",
) -> str:
    """Salva o contexto da sessao atual no Redis.
    summary: resumo do que foi feito nesta sessao
    decisions: JSON array de decisoes [{"topic": "...", "decision": "...", "rationale": "..."}]
    pending_items: JSON array de items pendentes ["item1", "item2"]
    files_modified: JSON array de arquivos modificados ["path/file1.ts", "path/file2.ts"]
    context_notes: notas adicionais (branch, deploy status, etc)
    errors_encountered: JSON array de erros encontrados ["erro1", "erro2"]
    """
    try:
        r = _get_redis_client()
        r.ping()
    except redis.ConnectionError:
        return json.dumps({"error": "Redis indisponivel. Verifique REDIS_URL no .env"})
    except redis.AuthenticationError:
        return json.dumps({"error": "Falha de autenticacao Redis. Verifique senha no REDIS_URL"})
    except Exception as e:
        return json.dumps({"error": f"Erro de conexao: {str(e)}"})

    project = _get_project_name()
    branch, commit = _get_git_info()
    now = _now()
    sid = _session_id()

    session = {
        "id": sid,
        "project": project,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "status": "active",
        "summary": summary,
        "decisions": _parse_json_param(decisions),
        "pending_items": _parse_json_param(pending_items),
        "files_modified": _parse_json_param(files_modified),
        "errors_encountered": _parse_json_param(errors_encountered),
        "context_notes": context_notes,
        "git_branch": branch,
        "git_last_commit": commit,
        "size_bytes": 0,
    }

    session = _truncate_session(session)
    data_str = json.dumps(session, ensure_ascii=False)
    session["size_bytes"] = len(data_str.encode("utf-8"))

    # Save session
    _save_json(r, _key(project, "session", sid), session, ttl=SESSION_TTL)

    # Update latest pointer
    r.set(_key(project, "session", "latest"), sid)

    # Update index
    index = _load_index(r, project)
    index.insert(0, sid)
    _save_index(r, project, index[:MAX_INDEX_SIZE])

    # Update meta
    meta = _load_meta(r, project)
    meta["total_sessions"] = len(index)
    meta["estimated_bytes"] = _estimate_storage(r, project)
    _save_meta(r, project, meta)

    # Check storage and auto-cleanup if needed
    storage_warning = None
    pct = (meta["estimated_bytes"] / MAX_STORAGE_BYTES) * 100
    if pct >= 95:
        cleanup = _auto_cleanup(r, project, level=3)
        storage_warning = f"EMERGENCIA: storage em {pct:.0f}%. Cleanup nivel 3 executado: {cleanup['actions']}"
    elif pct >= 90:
        cleanup = _auto_cleanup(r, project, level=2)
        storage_warning = f"ALERTA: storage em {pct:.0f}%. Cleanup nivel 2 executado: {cleanup['actions']}"
    elif pct >= WARNING_THRESHOLD_PCT:
        storage_warning = f"AVISO: storage em {pct:.0f}%. Considere rodar summarize_old_sessions() ou cleanup_storage()."

    result = {
        "saved": sid,
        "project": project,
        "size_bytes": session["size_bytes"],
        "total_sessions": meta["total_sessions"],
        "storage_pct": round(pct, 1),
    }
    if storage_warning:
        result["storage_warning"] = storage_warning

    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
def restore_session(session_id: str = "") -> str:
    """Restaura contexto de uma sessao. Sem session_id, restaura a mais recente.
    session_id: ID da sessao (opcional — vazio = mais recente)
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()

    if not session_id:
        session_id = r.get(_key(project, "session", "latest")) or ""

    if not session_id:
        return json.dumps({"error": "Nenhuma sessao encontrada. Use save_session() primeiro."})

    # Try active session
    session = _load_json(r, _key(project, "session", session_id))
    if session:
        return json.dumps(session, indent=2, ensure_ascii=False)

    # Try in summaries
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    for s in summaries:
        if s.get("id") == session_id:
            s["status"] = "summarized"
            return json.dumps(s, indent=2, ensure_ascii=False)

    return json.dumps({"error": f"Sessao '{session_id}' nao encontrada (pode ter expirado)."})


@mcp.tool()
def list_sessions(limit: int = 20) -> str:
    """Lista todas as sessoes armazenadas (ativas + resumidas), das mais recentes para as mais antigas.
    limit: numero maximo de sessoes a retornar (padrao: 20)
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()
    results = []

    # Active sessions
    index = _load_index(r, project)
    for sid in index:
        session = _load_json(r, _key(project, "session", sid))
        if session:
            results.append({
                "id": session["id"],
                "created_at": session["created_at"],
                "status": session.get("status", "active"),
                "summary": session.get("summary", "")[:150],
                "git_branch": session.get("git_branch", ""),
            })

    # Summarized sessions
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    for s in summaries:
        results.append({
            "id": s["id"],
            "created_at": s.get("date", ""),
            "status": "summarized",
            "summary": s.get("summary", "")[:150],
            "git_branch": "",
        })

    # Sort by date descending
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    meta = _load_meta(r, project)
    return json.dumps({
        "project": project,
        "total_active": len(index),
        "total_summarized": len(summaries),
        "storage_bytes": meta.get("estimated_bytes", 0),
        "storage_pct": round((meta.get("estimated_bytes", 0) / MAX_STORAGE_BYTES) * 100, 1),
        "sessions": results[:limit],
    }, indent=2, ensure_ascii=False)


@mcp.tool()
def update_session(
    session_id: str = "",
    append_decisions: str = "[]",
    append_pending: str = "[]",
    append_files: str = "[]",
    append_notes: str = "",
    new_summary: str = "",
) -> str:
    """Atualiza uma sessao existente (adiciona decisoes, pendencias, arquivos, etc).
    session_id: ID da sessao (vazio = mais recente)
    append_decisions: JSON array de novas decisoes a adicionar
    append_pending: JSON array de novos items pendentes
    append_files: JSON array de novos arquivos modificados
    append_notes: texto a concatenar nas notas de contexto
    new_summary: novo resumo (substitui o anterior se fornecido)
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()

    if not session_id:
        session_id = r.get(_key(project, "session", "latest")) or ""

    if not session_id:
        return json.dumps({"error": "Nenhuma sessao ativa encontrada."})

    session = _load_json(r, _key(project, "session", session_id))
    if not session:
        return json.dumps({"error": f"Sessao '{session_id}' nao encontrada."})

    # Merge data
    new_decisions = _parse_json_param(append_decisions)
    new_pending = _parse_json_param(append_pending)
    new_files = _parse_json_param(append_files)

    if new_decisions:
        session["decisions"] = session.get("decisions", []) + new_decisions
    if new_pending:
        session["pending_items"] = session.get("pending_items", []) + new_pending
    if new_files:
        existing = set(session.get("files_modified", []))
        session["files_modified"] = list(existing | set(new_files))
    if append_notes:
        current = session.get("context_notes", "")
        session["context_notes"] = f"{current}\n{append_notes}".strip()
    if new_summary:
        session["summary"] = new_summary

    session["updated_at"] = _now().isoformat()
    branch, commit = _get_git_info()
    if branch:
        session["git_branch"] = branch
    if commit:
        session["git_last_commit"] = commit

    session = _truncate_session(session)
    data_str = json.dumps(session, ensure_ascii=False)
    session["size_bytes"] = len(data_str.encode("utf-8"))

    _save_json(r, _key(project, "session", session_id), session, ttl=SESSION_TTL)

    return json.dumps({
        "updated": session_id,
        "size_bytes": session["size_bytes"],
    }, ensure_ascii=False)


@mcp.tool()
def summarize_old_sessions(days_threshold: int = 3) -> str:
    """Comprime sessoes mais antigas que N dias em resumos compactos para liberar espaco.
    days_threshold: sessoes mais antigas que este valor serao resumidas (padrao: 3 dias)
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()
    index = _load_index(r, project)
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    now = _now()
    cutoff = now - timedelta(days=days_threshold)

    to_summarize = []
    keep_ids = []
    freed_bytes = 0

    for sid in index:
        session = _load_json(r, _key(project, "session", sid))
        if not session:
            continue
        try:
            created = datetime.fromisoformat(session["created_at"])
        except (ValueError, KeyError):
            keep_ids.append(sid)
            continue
        if created < cutoff:
            to_summarize.append(session)
        else:
            keep_ids.append(sid)

    for session in to_summarize:
        summary_entry = {
            "id": session["id"],
            "date": session["created_at"][:10],
            "summary": session.get("summary", "")[:300],
            "key_decisions": [d.get("topic", "") for d in session.get("decisions", [])[:5]],
            "original_size": session.get("size_bytes", 0),
            "summarized_at": now.isoformat(),
        }
        summaries.append(summary_entry)
        freed_bytes += session.get("size_bytes", 0)
        r.delete(_key(project, "session", session["id"]))

    _save_index(r, project, keep_ids)
    _save_json(r, _key(project, "sessions", "summaries"), summaries, ttl=SUMMARY_TTL)

    # Update meta
    meta = _load_meta(r, project)
    meta["total_sessions"] = len(keep_ids)
    meta["total_summaries"] = len(summaries)
    meta["estimated_bytes"] = _estimate_storage(r, project)
    meta["last_cleanup"] = now.isoformat()
    _save_meta(r, project, meta)

    return json.dumps({
        "summarized": len(to_summarize),
        "freed_bytes": freed_bytes,
        "remaining_active": len(keep_ids),
        "total_summaries": len(summaries),
        "storage_pct": round((meta["estimated_bytes"] / MAX_STORAGE_BYTES) * 100, 1),
    }, ensure_ascii=False)


@mcp.tool()
def cleanup_storage(force: bool = False) -> str:
    """Limpa sessoes obsoletas e libera espaco no Redis.
    force: se True, purga tudo exceto as ultimas 5 sessoes e resumos dos ultimos 15 dias
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()
    meta = _load_meta(r, project)
    estimated = _estimate_storage(r, project)
    pct = (estimated / MAX_STORAGE_BYTES) * 100

    if force:
        result = _auto_cleanup(r, project, level=3)
    elif pct >= 95:
        result = _auto_cleanup(r, project, level=3)
    elif pct >= 90:
        result = _auto_cleanup(r, project, level=2)
    elif pct >= WARNING_THRESHOLD_PCT:
        result = _auto_cleanup(r, project, level=1)
    else:
        return json.dumps({
            "status": "Nenhuma acao necessaria",
            "storage_bytes": estimated,
            "storage_pct": round(pct, 1),
            "limit_bytes": MAX_STORAGE_BYTES,
        }, ensure_ascii=False)

    meta = _load_meta(r, project)
    new_pct = (meta["estimated_bytes"] / MAX_STORAGE_BYTES) * 100

    return json.dumps({
        "status": "Cleanup executado",
        "level_applied": result["level"],
        "actions": result["actions"],
        "freed_bytes": result["freed_bytes"],
        "before_pct": round(pct, 1),
        "after_pct": round(new_pct, 1),
        "remaining_sessions": meta["total_sessions"],
        "remaining_summaries": meta["total_summaries"],
    }, ensure_ascii=False)


@mcp.tool()
def storage_status() -> str:
    """Mostra o uso de armazenamento Redis — tamanho total, sessoes, alertas."""
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()
    meta = _load_meta(r, project)
    estimated = _estimate_storage(r, project)
    pct = (estimated / MAX_STORAGE_BYTES) * 100

    index = _load_index(r, project)
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])

    status = {
        "project": project,
        "active_sessions": len(index),
        "summarized_sessions": len(summaries),
        "storage_bytes": estimated,
        "storage_human": f"{estimated / 1024:.1f} KB" if estimated < 1_000_000 else f"{estimated / 1_000_000:.1f} MB",
        "storage_pct": round(pct, 1),
        "limit_bytes": MAX_STORAGE_BYTES,
        "limit_human": "25 MB (soft) / 30 MB (hard)",
        "last_cleanup": meta.get("last_cleanup", "nunca"),
    }

    if pct >= 95:
        status["alert"] = "CRITICO: storage quase cheio. Rode cleanup_storage(force=True) AGORA."
    elif pct >= 90:
        status["alert"] = "ALERTA: storage alto. Rode cleanup_storage() para liberar espaco."
    elif pct >= WARNING_THRESHOLD_PCT:
        status["alert"] = "AVISO: storage acima de 80%. Considere rodar summarize_old_sessions()."
    else:
        status["alert"] = "OK: storage dentro do limite."

    return json.dumps(status, indent=2, ensure_ascii=False)


@mcp.tool()
def delete_session(session_id: str) -> str:
    """Remove uma sessao especifica do Redis.
    session_id: ID da sessao a remover
    """
    try:
        r = _get_redis_client()
        r.ping()
    except Exception as e:
        return json.dumps({"error": f"Redis indisponivel: {str(e)}"})

    project = _get_project_name()

    # Try deleting active session
    deleted = r.delete(_key(project, "session", session_id))
    if deleted:
        index = _load_index(r, project)
        index = [s for s in index if s != session_id]
        _save_index(r, project, index)

        # Update latest if needed
        latest = r.get(_key(project, "session", "latest"))
        if latest == session_id:
            r.set(_key(project, "session", "latest"), index[0] if index else "")

        meta = _load_meta(r, project)
        meta["total_sessions"] = len(index)
        meta["estimated_bytes"] = _estimate_storage(r, project)
        _save_meta(r, project, meta)

        return json.dumps({
            "deleted": session_id,
            "remaining_sessions": len(index),
        }, ensure_ascii=False)

    # Try deleting from summaries
    summaries = _load_json(r, _key(project, "sessions", "summaries"), [])
    before = len(summaries)
    summaries = [s for s in summaries if s.get("id") != session_id]
    if len(summaries) < before:
        _save_json(r, _key(project, "sessions", "summaries"), summaries, ttl=SUMMARY_TTL)
        meta = _load_meta(r, project)
        meta["total_summaries"] = len(summaries)
        _save_meta(r, project, meta)
        return json.dumps({"deleted": session_id, "source": "summaries"}, ensure_ascii=False)

    return json.dumps({"error": f"Sessao '{session_id}' nao encontrada."})


if __name__ == "__main__":
    mcp.run()
