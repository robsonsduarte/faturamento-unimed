"""
DuarteOS MCP Server: Memory Graph
Grafo de conhecimento persistente entre sessoes.
Armazena decisoes, padroes aprendidos, preferencias e contexto do projeto.
Requer: pip install fastmcp
"""

from fastmcp import FastMCP
import json
import os
from datetime import datetime

mcp = FastMCP("memory-graph", instructions="Grafo de conhecimento persistente — decisoes, padroes, preferencias")

MEMORY_FILE = os.path.join(os.getcwd(), ".claude", "memory.json")


def _load_memory():
    """Carrega o grafo de memoria do disco."""
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"nodes": {}, "edges": [], "metadata": {"created": datetime.now().isoformat(), "version": 1}}


def _save_memory(memory):
    """Salva o grafo de memoria no disco."""
    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    memory["metadata"]["updated"] = datetime.now().isoformat()
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(memory, f, indent=2, ensure_ascii=False)


@mcp.tool()
def remember(category: str, key: str, value: str, tags: str = "") -> str:
    """Armazena um fato/decisao/padrao no grafo de memoria.
    category: decision, pattern, preference, context, learning
    key: identificador unico (ex: 'auth-strategy', 'color-palette')
    value: o que lembrar
    tags: tags separadas por virgula (ex: 'architecture,auth,security')
    """
    memory = _load_memory()

    node_id = f"{category}:{key}"
    memory["nodes"][node_id] = {
        "category": category,
        "key": key,
        "value": value,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "created": datetime.now().isoformat(),
        "access_count": 0,
    }

    _save_memory(memory)
    return json.dumps({"stored": node_id, "total_memories": len(memory["nodes"])})


@mcp.tool()
def recall(query: str, category: str = "", limit: int = 10) -> str:
    """Busca memorias por query (busca em key, value e tags).
    category: filtrar por categoria (opcional)
    """
    memory = _load_memory()

    results = []
    query_lower = query.lower()

    for node_id, node in memory["nodes"].items():
        if category and node["category"] != category:
            continue

        # Score based on matches
        score = 0
        searchable = f"{node['key']} {node['value']} {' '.join(node.get('tags', []))}".lower()

        for word in query_lower.split():
            if word in searchable:
                score += 1
            if word in node["key"].lower():
                score += 2  # Key matches are more important

        if score > 0:
            node["_score"] = score
            node["_id"] = node_id
            # Increment access count
            memory["nodes"][node_id]["access_count"] = node.get("access_count", 0) + 1
            results.append(node)

    results.sort(key=lambda x: x["_score"], reverse=True)
    _save_memory(memory)

    return json.dumps(results[:limit], indent=2, ensure_ascii=False)


@mcp.tool()
def connect(from_key: str, to_key: str, relationship: str) -> str:
    """Cria uma conexao (edge) entre duas memorias.
    relationship: 'depends_on', 'contradicts', 'supports', 'replaces', 'related_to'
    """
    memory = _load_memory()

    edge = {
        "from": from_key,
        "to": to_key,
        "relationship": relationship,
        "created": datetime.now().isoformat(),
    }

    # Check for duplicate
    for existing in memory["edges"]:
        if existing["from"] == from_key and existing["to"] == to_key and existing["relationship"] == relationship:
            return json.dumps({"status": "already_exists"})

    memory["edges"].append(edge)
    _save_memory(memory)

    return json.dumps({"connected": edge, "total_edges": len(memory["edges"])})


@mcp.tool()
def forget(key: str) -> str:
    """Remove uma memoria e suas conexoes."""
    memory = _load_memory()

    removed_nodes = []
    removed_edges = 0

    # Remove matching nodes
    keys_to_remove = [nid for nid in memory["nodes"] if key in nid]
    for nid in keys_to_remove:
        del memory["nodes"][nid]
        removed_nodes.append(nid)

    # Remove connected edges
    original_edge_count = len(memory["edges"])
    memory["edges"] = [
        e for e in memory["edges"]
        if key not in e["from"] and key not in e["to"]
    ]
    removed_edges = original_edge_count - len(memory["edges"])

    _save_memory(memory)

    return json.dumps({
        "removed_nodes": removed_nodes,
        "removed_edges": removed_edges,
        "remaining_memories": len(memory["nodes"]),
    })


@mcp.tool()
def list_memories(category: str = "", limit: int = 50) -> str:
    """Lista todas as memorias, opcionalmente filtradas por categoria."""
    memory = _load_memory()

    nodes = []
    for node_id, node in memory["nodes"].items():
        if category and node["category"] != category:
            continue
        nodes.append({"id": node_id, **node})

    # Sort by most recently created
    nodes.sort(key=lambda x: x.get("created", ""), reverse=True)

    summary = {
        "total": len(memory["nodes"]),
        "categories": {},
        "memories": nodes[:limit],
    }

    for node in memory["nodes"].values():
        cat = node["category"]
        summary["categories"][cat] = summary["categories"].get(cat, 0) + 1

    return json.dumps(summary, indent=2, ensure_ascii=False)


@mcp.tool()
def get_context_summary() -> str:
    """Retorna um resumo do contexto armazenado — util para inicio de sessao."""
    memory = _load_memory()

    # Get most accessed and most recent memories
    all_nodes = list(memory["nodes"].values())

    most_accessed = sorted(all_nodes, key=lambda x: x.get("access_count", 0), reverse=True)[:5]
    most_recent = sorted(all_nodes, key=lambda x: x.get("created", ""), reverse=True)[:5]

    decisions = [n for n in all_nodes if n["category"] == "decision"]
    patterns = [n for n in all_nodes if n["category"] == "pattern"]
    preferences = [n for n in all_nodes if n["category"] == "preference"]

    summary = {
        "total_memories": len(all_nodes),
        "total_connections": len(memory["edges"]),
        "key_decisions": [{"key": d["key"], "value": d["value"][:200]} for d in decisions[:10]],
        "learned_patterns": [{"key": p["key"], "value": p["value"][:200]} for p in patterns[:10]],
        "user_preferences": [{"key": p["key"], "value": p["value"][:200]} for p in preferences[:10]],
        "most_accessed": [{"key": n["key"], "count": n.get("access_count", 0)} for n in most_accessed],
        "most_recent": [{"key": n["key"], "created": n.get("created", "")} for n in most_recent],
    }

    return json.dumps(summary, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    mcp.run()
