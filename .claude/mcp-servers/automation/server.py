"""
DuarteOS MCP Server: Automation
Automacao de tarefas do sistema, file processing, scheduling.
Requer: pip install fastmcp watchdog schedule
"""

from fastmcp import FastMCP
import json
import os
import subprocess
import hashlib
from datetime import datetime

mcp = FastMCP("automation", instructions="Automacao de sistema, file processing e tarefas agendadas")


@mcp.tool()
def find_duplicates(directory: str, extensions: str = "") -> str:
    """Encontra arquivos duplicados em um diretorio (por hash MD5).
    extensions: filtro opcional separado por virgula (ex: '.py,.js')
    """
    hashes = {}
    ext_filter = [e.strip() for e in extensions.split(",")] if extensions else []

    for root, _, files in os.walk(directory):
        for fname in files:
            if ext_filter and not any(fname.endswith(e) for e in ext_filter):
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "rb") as f:
                    h = hashlib.md5(f.read()).hexdigest()
                hashes.setdefault(h, []).append(fpath)
            except (PermissionError, OSError):
                continue

    duplicates = {h: paths for h, paths in hashes.items() if len(paths) > 1}
    return json.dumps(duplicates, indent=2)


@mcp.tool()
def disk_usage(directory: str = ".") -> str:
    """Analisa uso de disco de um diretorio, ordenado por tamanho."""
    items = []
    for entry in os.scandir(directory):
        try:
            if entry.is_file():
                items.append({"path": entry.path, "size_mb": entry.stat().st_size / 1024 / 1024, "type": "file"})
            elif entry.is_dir():
                total = sum(
                    f.stat().st_size
                    for f in os.scandir(entry.path)
                    if f.is_file()
                )
                items.append({"path": entry.path, "size_mb": total / 1024 / 1024, "type": "dir"})
        except (PermissionError, OSError):
            continue

    items.sort(key=lambda x: x["size_mb"], reverse=True)
    return json.dumps(items[:50], indent=2)


@mcp.tool()
def batch_rename(directory: str, pattern: str, replacement: str, dry_run: bool = True) -> str:
    """Renomeia arquivos em lote. pattern: regex para match. dry_run=True para preview."""
    import re

    results = []
    for fname in os.listdir(directory):
        new_name = re.sub(pattern, replacement, fname)
        if new_name != fname:
            old_path = os.path.join(directory, fname)
            new_path = os.path.join(directory, new_name)
            results.append({"old": fname, "new": new_name})
            if not dry_run:
                os.rename(old_path, new_path)

    return json.dumps({"dry_run": dry_run, "changes": results}, indent=2)


@mcp.tool()
def run_and_capture(command: str, timeout: int = 60) -> str:
    """Executa um comando e captura stdout + stderr + exit code."""
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return json.dumps(
            {
                "exit_code": result.returncode,
                "stdout": result.stdout[:10000],
                "stderr": result.stderr[:5000],
                "command": command,
            },
            indent=2,
        )
    except subprocess.TimeoutExpired:
        return json.dumps({"error": f"Timeout after {timeout}s", "command": command})


@mcp.tool()
def file_stats(directory: str, extensions: str = "") -> str:
    """Estatisticas de arquivos: contagem por extensao, linhas de codigo, etc."""
    ext_filter = [e.strip() for e in extensions.split(",")] if extensions else []
    stats = {}

    for root, _, files in os.walk(directory):
        if ".git" in root or "node_modules" in root or "__pycache__" in root:
            continue
        for fname in files:
            ext = os.path.splitext(fname)[1] or "(no ext)"
            if ext_filter and ext not in ext_filter:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", errors="ignore") as f:
                    lines = sum(1 for _ in f)
                stats.setdefault(ext, {"count": 0, "total_lines": 0})
                stats[ext]["count"] += 1
                stats[ext]["total_lines"] += lines
            except (PermissionError, OSError, UnicodeDecodeError):
                continue

    sorted_stats = dict(sorted(stats.items(), key=lambda x: x[1]["total_lines"], reverse=True))
    return json.dumps(sorted_stats, indent=2)


if __name__ == "__main__":
    mcp.run()
