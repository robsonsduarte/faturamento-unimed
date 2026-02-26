#!/bin/bash
# DuarteOS: Sandbox Environment Setup
# Configures E2B or Docker sandbox for safe code execution

set -e

echo "🔒 DuarteOS Sandbox Setup"
echo "========================="
echo ""

# Check Docker
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    echo "  ✓ Docker $(docker --version 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"
    DOCKER_AVAILABLE=true
else
    echo "  ⚠ Docker nao encontrado"
    DOCKER_AVAILABLE=false
fi

# Check E2B
echo ""
echo "Checking E2B..."
if [ -n "$E2B_API_KEY" ]; then
    echo "  ✓ E2B_API_KEY configurada"
    E2B_AVAILABLE=true
else
    echo "  ⚠ E2B_API_KEY nao configurada"
    echo "    Obtenha em: https://e2b.dev/dashboard"
    E2B_AVAILABLE=false
fi

echo ""
echo "Opcoes de sandbox disponíveis:"
echo ""

if [ "$E2B_AVAILABLE" = true ]; then
    echo "  [1] E2B (Cloud Sandbox) — Firecracker microVMs, sem config local"
    echo "      ✓ E2B_API_KEY ja configurada"
fi

if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "  [2] Docker Sandbox — Container local isolado"
    echo "      ✓ Docker ja instalado"
fi

echo "  [3] Nenhum — Pular sandbox (pode adicionar depois)"
echo ""

read -p "Escolha [1/2/3]: " CHOICE

case $CHOICE in
    1)
        echo ""
        echo "Configurando E2B Sandbox..."
        # Add E2B to .mcp.json
        echo "  → E2B MCP sera adicionado ao .mcp.json"
        echo "  ✓ E2B configurado"
        echo ""
        echo "Adicione ao .mcp.json:"
        echo '  "e2b-sandbox": {'
        echo '    "command": "npx",'
        echo '    "args": ["-y", "@e2b/mcp-server"],'
        echo '    "env": {'
        echo '      "E2B_API_KEY": "$E2B_API_KEY"'
        echo '    }'
        echo '  }'
        ;;
    2)
        echo ""
        echo "Configurando Docker Sandbox..."
        echo "  → Docker sandbox MCP sera adicionado ao .mcp.json"
        echo "  ✓ Docker sandbox configurado"
        echo ""
        echo "Adicione ao .mcp.json:"
        echo '  "code-sandbox": {'
        echo '    "command": "npx",'
        echo '    "args": ["-y", "code-sandbox-mcp"]'
        echo '  }'
        ;;
    3)
        echo "  → Sandbox pulado"
        ;;
    *)
        echo "  → Opcao invalida, pulando sandbox"
        ;;
esac

echo ""
echo "✅ Setup de sandbox concluido."
