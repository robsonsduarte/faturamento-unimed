#!/bin/bash
# DuarteOS: MCP Package Warmup
# Pre-downloads all MCP packages so startup is instant when running `claude`

set -e

echo "DuarteOS MCP Warmup"
echo "==================="
echo ""

OK=0
FAIL=0

# --- Python MCPs (uv cache) ---
echo "Python MCPs (uv run cache)..."
if command -v uv &> /dev/null; then
    if uv run --with "fastmcp,pandas,numpy,matplotlib,seaborn,requests,beautifulsoup4,lxml,watchdog,pyyaml,redis" \
        python -c "import fastmcp; print('  OK: fastmcp', fastmcp.__version__)" 2>/dev/null; then
        OK=$((OK + 8))
        echo "  8 Python MCPs em cache"
    else
        echo "  FALHA: uv run --with falhou"
        FAIL=$((FAIL + 8))
    fi
else
    echo "  SKIP: uv nao encontrado (instale: curl -LsSf https://astral.sh/uv/install.sh | sh)"
    FAIL=$((FAIL + 8))
fi

# --- Node MCPs (npx cache) ---
echo ""
echo "Node MCPs (npx cache)..."

warmup_npx() {
    local name="$1"
    local pkg="$2"
    if npx -y "$pkg" --help >/dev/null 2>&1; then
        echo "  OK: $name"
        OK=$((OK + 1))
    else
        # Some MCP servers don't support --help, try just installing
        if npm cache ls "$pkg" >/dev/null 2>&1; then
            echo "  OK: $name (cached)"
            OK=$((OK + 1))
        else
            echo "  WARN: $name (download pode ocorrer no startup)"
            FAIL=$((FAIL + 1))
        fi
    fi
}

# Zero-config MCPs
warmup_npx "Context7" "@upstash/context7-mcp@latest"
warmup_npx "YouTube Transcript" "@kimtaeyoon83/mcp-server-youtube-transcript"
warmup_npx "Memory" "@modelcontextprotocol/server-memory"
warmup_npx "Sequential Thinking" "@modelcontextprotocol/server-sequential-thinking"

# API key MCPs
warmup_npx "EXA" "exa-mcp-server"
warmup_npx "Apify" "@apify/actors-mcp-server"
warmup_npx "E2B Sandbox" "@e2b/mcp-server"
warmup_npx "Obsidian" "@mauricio.wolff/mcp-obsidian@latest"

# Optional MCPs
warmup_npx "GitHub" "@modelcontextprotocol/server-github"
warmup_npx "CodeRabbit" "coderabbitai-mcp@latest"
warmup_npx "Redis" "@modelcontextprotocol/server-redis"
warmup_npx "REST API" "dkmaker-mcp-rest-api"
warmup_npx "n8n" "n8n-mcp"

# uvx MCPs
echo ""
echo "UVX MCPs..."
if command -v uvx &> /dev/null; then
    if uvx mcp-server-fetch --help >/dev/null 2>&1; then
        echo "  OK: Fetch (mcp-server-fetch)"
        OK=$((OK + 1))
    else
        echo "  WARN: Fetch"
        FAIL=$((FAIL + 1))
    fi
else
    echo "  SKIP: uvx nao encontrado"
    FAIL=$((FAIL + 1))
fi

# Summary
echo ""
echo "==================="
echo "Warmup: $OK OK, $FAIL avisos"
if [ $FAIL -eq 0 ]; then
    echo "Todos os pacotes em cache. Startup do claude sera instantaneo."
else
    echo "Alguns pacotes serao baixados no primeiro startup."
fi
