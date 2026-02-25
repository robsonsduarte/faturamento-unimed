#!/bin/bash
set -e

# === Config ===
VPS_HOST="faturamento-vps"
VPS_DIR="/root/faturamento-unimed"
APP_NAME="faturamento-unimed"

echo "=== Deploy: $APP_NAME ==="
echo ""

# 1. Sync files to VPS (exclude heavy/local stuff)
echo "[1/4] Enviando arquivos pro VPS..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.planning' \
  --exclude='.claude' \
  --exclude='saw-api/node_modules' \
  ./ "$VPS_HOST:$VPS_DIR/"

# 2. Ensure .env symlink exists (Docker Compose reads .env for build args)
echo ""
echo "[2/4] Garantindo .env symlink..."
ssh "$VPS_HOST" "cd $VPS_DIR && ln -sf .env.production .env"

# 3. Build on VPS
echo ""
echo "[3/4] Build no VPS..."
ssh "$VPS_HOST" "cd $VPS_DIR && docker compose -f docker-compose.prod.yml build --no-cache"

# 4. Deploy
echo ""
echo "[4/4] Subindo container..."
ssh "$VPS_HOST" "cd $VPS_DIR && docker compose -f docker-compose.prod.yml up -d"

echo ""
echo "=== Deploy concluido! ==="
echo "URL: https://faturamento.consultoriopro.com.br"
echo ""
echo "Logs: ssh $VPS_HOST 'docker logs -f $APP_NAME'"
