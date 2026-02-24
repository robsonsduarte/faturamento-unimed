#!/bin/bash
set -e

# === Config ===
VPS_HOST="root@157.173.120.60"
VPS_DIR="/root/faturamento-unimed"
APP_NAME="faturamento-unimed"

echo "=== Deploy: $APP_NAME ==="
echo ""

# 1. Sync files to VPS (exclude heavy/local stuff)
echo "[1/3] Enviando arquivos pro VPS..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='.planning' \
  --exclude='.claude' \
  --exclude='saw-api/node_modules' \
  ./ "$VPS_HOST:$VPS_DIR/"

# 2. Build on VPS
echo ""
echo "[2/3] Build no VPS..."
ssh "$VPS_HOST" "cd $VPS_DIR && docker compose -f docker-compose.prod.yml build --no-cache"

# 3. Deploy
echo ""
echo "[3/3] Subindo container..."
ssh "$VPS_HOST" "cd $VPS_DIR && docker compose -f docker-compose.prod.yml up -d"

echo ""
echo "=== Deploy concluido! ==="
echo "URL: https://faturamento.consultoriopro.com.br"
echo ""
echo "Logs: ssh $VPS_HOST 'docker logs -f $APP_NAME'"
