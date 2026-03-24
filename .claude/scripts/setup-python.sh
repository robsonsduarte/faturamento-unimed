#!/bin/bash
# DuarteOS: Python Environment Setup
# Validates and installs Python, uv, and MCP server dependencies

set -e

echo "🐍 DuarteOS Python Setup"
echo "========================"
echo ""

ERRORS=0
WARNINGS=0

# Check Python
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PY_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
    PY_MAJOR=$(echo $PY_VERSION | cut -d. -f1)
    PY_MINOR=$(echo $PY_VERSION | cut -d. -f2)
    echo "  ✓ Python $(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
    if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
        echo "  ⚠ Python 3.10+ recomendado (encontrado $PY_VERSION)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  ✗ Python3 nao encontrado"
    echo "    Instale: https://python.org/downloads/"
    ERRORS=$((ERRORS + 1))
fi

# Check uv (recommended)
echo ""
echo "Checking uv (package manager)..."
if command -v uv &> /dev/null; then
    echo "  ✓ uv $(uv --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
else
    echo "  ⚠ uv nao encontrado (recomendado para MCPs)"
    echo "    Instalar agora? [Y/n]"
    read -r INSTALL_UV
    if [ "$INSTALL_UV" != "n" ] && [ "$INSTALL_UV" != "N" ]; then
        echo "  → Instalando uv..."
        curl -LsSf https://astral.sh/uv/install.sh | sh
        echo "  ✓ uv instalado"
    else
        WARNINGS=$((WARNINGS + 1))
    fi
fi

# Check pip
echo ""
echo "Checking pip..."
if python3 -m pip --version &> /dev/null; then
    echo "  ✓ pip $(python3 -m pip --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')"
else
    echo "  ⚠ pip nao encontrado"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Node.js
echo ""
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo "  ✓ Node.js $NODE_VERSION"
    NODE_MAJOR=$(echo $NODE_VERSION | grep -oE '[0-9]+' | head -1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo "  ⚠ Node.js 18+ recomendado"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  ✗ Node.js nao encontrado"
    echo "    Instale: https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Check npx
echo ""
echo "Checking npx..."
if command -v npx &> /dev/null; then
    echo "  ✓ npx disponivel"
else
    echo "  ✗ npx nao encontrado (vem com Node.js)"
    ERRORS=$((ERRORS + 1))
fi

# Check git
echo ""
echo "Checking git..."
if command -v git &> /dev/null; then
    echo "  ✓ git $(git --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
else
    echo "  ✗ git nao encontrado"
    ERRORS=$((ERRORS + 1))
fi

# Install Python MCP dependencies
echo ""
if [ -f ".claude/mcp-servers/requirements.txt" ] && [ $ERRORS -eq 0 ]; then
    echo "Instalando dependencias Python dos MCP Servers..."
    if command -v uv &> /dev/null; then
        uv pip install -r .claude/mcp-servers/requirements.txt
    else
        python3 -m pip install --user -r .claude/mcp-servers/requirements.txt
    fi
    echo "  ✓ Dependencias instaladas"
fi

# Install fastmcp
echo ""
echo "Verificando FastMCP..."
if python3 -c "import fastmcp" 2>/dev/null; then
    echo "  ✓ FastMCP instalado"
else
    echo "  → Instalando FastMCP..."
    if command -v uv &> /dev/null; then
        uv pip install fastmcp
    else
        python3 -m pip install --user fastmcp
    fi
    echo "  ✓ FastMCP instalado"
fi

# Pre-warm uv cache for Python MCPs (one-time download, instant startup after)
echo ""
echo "Pre-aquecendo cache uv para Python MCP servers..."
if command -v uv &> /dev/null; then
    if uv run --with "fastmcp,pandas,numpy,matplotlib,seaborn,requests,beautifulsoup4,lxml,watchdog,pyyaml,redis" \
        python -c "import fastmcp; print('  OK: cache pronto (fastmcp', fastmcp.__version__, ')')" 2>/dev/null; then
        echo "  Proximos starts dos Python MCPs serao instantaneos."
    else
        echo "  Warmup parcial — alguns pacotes podem ser baixados no startup"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "  uv nao encontrado — Python MCPs usarao pip install"
    WARNINGS=$((WARNINGS + 1))
fi

# Summary
echo ""
echo "========================"
if [ $ERRORS -gt 0 ]; then
    echo "❌ Setup incompleto: $ERRORS erros, $WARNINGS avisos"
    echo "   Corrija os erros acima e execute novamente."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Setup completo com $WARNINGS avisos"
    echo "   Tudo funcional, mas considere as recomendacoes."
    exit 0
else
    echo "✅ Setup completo! Ambiente pronto para DuarteOS."
    exit 0
fi
