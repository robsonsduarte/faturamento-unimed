# Task: Ops — Deploy em Producao

## Objetivo
Executar deploy em producao com checklist pre-deploy verificado, passos de deploy padronizados, validacao pos-deploy automatizada e procedimento de rollback pronto.

## Contexto
Usar para cada deploy em producao. O deploy e o momento de maior risco operacional — um processo bem definido reduz drasticamente a chance de incidentes. Cada deploy deve seguir o mesmo checklist, independentemente do tamanho da mudanca. "So um ajustinho" e responsavel por 80% dos incidentes.

## Pre-requisitos
- [ ] Mudancas testadas em staging/pre-producao
- [ ] Testes automatizados passando (CI verde)
- [ ] Janela de deploy adequada (evitar sexta-feira a noite)
- [ ] Responsavel pelo deploy identificado e disponivel
- [ ] Canal de comunicacao aberto (Slack, Teams, etc)

## Passos

### 1. Checklist Pre-Deploy
```
Pre-deploy (30 minutos antes):

Codigo:
- [ ] Branch main esta atualizada
- [ ] CI passou (lint + tipos + testes + build)
- [ ] Code review aprovado
- [ ] Nenhum PR pendente que deveria entrar junto
- [ ] CHANGELOG atualizado (se aplicavel)

Banco de Dados:
- [ ] Migracoes testadas em staging
- [ ] Migracoes sao reversiveis (rollback testado)
- [ ] Backup do banco feito nas ultimas 2 horas
- [ ] Nenhuma migracao destrutiva (DROP sem backup)

Configuracao:
- [ ] Variaveis de ambiente novas configuradas em producao
- [ ] Secrets/credenciais novos provisionados
- [ ] Feature flags configurados (se aplicavel)

Infraestrutura:
- [ ] Servidor com espaco em disco suficiente
- [ ] Memoria disponivel para build + restart
- [ ] Health check atual retornando sucesso
- [ ] Nenhum incidente em andamento

Comunicacao:
- [ ] Equipe notificada sobre o deploy
- [ ] Stakeholders cientes (se mudanca visivel ao usuario)
- [ ] Numero de suporte disponivel (se aplicavel)
```

### 2. Registrar Metricas Baseline
```bash
# Salvar metricas ANTES do deploy para comparacao
echo "=== Baseline pre-deploy ==="
echo "Timestamp: $(date)"

# Health check
curl -s http://localhost:3000/api/health | jq .

# Metricas de aplicacao
curl -s http://localhost:3000/api/health | jq '{
  status: .status,
  uptime: .uptime,
  memory: .memory
}'

# Contadores de erro (ultimas 2 horas)
# Verificar logs ou metricas do monitoramento

# Latencia dos endpoints principais
# Verificar dashboards de monitoramento
```

### 3. Executar Deploy
```bash
#!/bin/bash
# scripts/deploy.sh
set -euo pipefail

APP_DIR="/opt/app"
DEPLOY_LOG="/var/log/deploy/$(date +%Y%m%d_%H%M%S).log"

echo "[$(date)] === INICIO DO DEPLOY ===" | tee -a "$DEPLOY_LOG"

# 1. Salvar versao atual (para rollback)
cd "$APP_DIR"
PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo "Commit anterior: $PREVIOUS_COMMIT" | tee -a "$DEPLOY_LOG"

# 2. Atualizar codigo
echo "[$(date)] Atualizando codigo..." | tee -a "$DEPLOY_LOG"
git pull origin main 2>&1 | tee -a "$DEPLOY_LOG"
NEW_COMMIT=$(git rev-parse HEAD)
echo "Novo commit: $NEW_COMMIT" | tee -a "$DEPLOY_LOG"

# 3. Instalar dependencias (se mudaram)
if git diff "$PREVIOUS_COMMIT" "$NEW_COMMIT" --name-only | grep -q "package-lock.json"; then
  echo "[$(date)] Instalando dependencias..." | tee -a "$DEPLOY_LOG"
  npm ci --production 2>&1 | tee -a "$DEPLOY_LOG"
fi

# 4. Executar migracoes (se existirem)
if git diff "$PREVIOUS_COMMIT" "$NEW_COMMIT" --name-only | grep -q "migrations/"; then
  echo "[$(date)] Executando migracoes..." | tee -a "$DEPLOY_LOG"
  npx supabase migration up 2>&1 | tee -a "$DEPLOY_LOG"
fi

# 5. Build
echo "[$(date)] Building..." | tee -a "$DEPLOY_LOG"
npm run build 2>&1 | tee -a "$DEPLOY_LOG"

# 6. Restart da aplicacao
echo "[$(date)] Reiniciando aplicacao..." | tee -a "$DEPLOY_LOG"
pm2 restart ecosystem.config.js 2>&1 | tee -a "$DEPLOY_LOG"

# 7. Aguardar startup
echo "[$(date)] Aguardando startup..." | tee -a "$DEPLOY_LOG"
sleep 10

# 8. Health check
for i in {1..6}; do
  HEALTH=$(curl -sf http://localhost:3000/api/health || echo '{"status":"error"}')
  STATUS=$(echo "$HEALTH" | jq -r '.status')

  if [ "$STATUS" = "ok" ]; then
    echo "[$(date)] Health check OK!" | tee -a "$DEPLOY_LOG"
    break
  fi

  if [ $i -eq 6 ]; then
    echo "[$(date)] HEALTH CHECK FALHOU! Iniciando rollback..." | tee -a "$DEPLOY_LOG"
    # Rollback automatico
    git checkout "$PREVIOUS_COMMIT"
    npm run build
    pm2 restart ecosystem.config.js
    echo "[$(date)] ROLLBACK CONCLUIDO para $PREVIOUS_COMMIT" | tee -a "$DEPLOY_LOG"
    exit 1
  fi

  echo "[$(date)] Health check tentativa $i/6 falhou. Aguardando..." | tee -a "$DEPLOY_LOG"
  sleep 10
done

echo "[$(date)] === DEPLOY CONCLUIDO ===" | tee -a "$DEPLOY_LOG"
echo "De: $PREVIOUS_COMMIT" | tee -a "$DEPLOY_LOG"
echo "Para: $NEW_COMMIT" | tee -a "$DEPLOY_LOG"
```

### 4. Validacao Pos-Deploy (Smoke Tests)
```bash
# Executar imediatamente apos o deploy

echo "=== Smoke Tests Pos-Deploy ==="

# 1. Health check
curl -sf http://localhost:3000/api/health | jq .
echo "✓ Health check OK"

# 2. Paginas principais carregam
for page in "/" "/auth/login" "/dashboard"; do
  STATUS=$(curl -so /dev/null -w '%{http_code}' http://localhost:3000$page)
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
    echo "✓ $page → $STATUS"
  else
    echo "✗ $page → $STATUS (FALHA!)"
  fi
done

# 3. API endpoints principais respondem
for endpoint in "/api/health"; do
  STATUS=$(curl -so /dev/null -w '%{http_code}' http://localhost:3000$endpoint)
  echo "API $endpoint → $STATUS"
done

# 4. Verificar logs por erros
pm2 logs --nostream --lines 50 | grep -i "error\|exception\|fatal" || echo "✓ Sem erros nos logs"

echo "=== Smoke Tests Concluidos ==="
```

### 5. Monitoramento Pos-Deploy (30 min)
```
Monitorar por 30 minutos apos o deploy:

Minuto 0-5:
- [ ] Health check retornando OK
- [ ] Nenhum crash/restart de processo
- [ ] Logs sem erros novos

Minuto 5-15:
- [ ] Latencia dos endpoints dentro do normal
- [ ] Error rate nao aumentou
- [ ] Usuarios conseguem acessar (verificar via monitoramento)

Minuto 15-30:
- [ ] Metricas estaveis (CPU, memoria, conexoes)
- [ ] Nenhum ticket/alerta de suporte
- [ ] Funcionalidade nova funciona conforme esperado

Se QUALQUER anomalia:
1. Avaliar severidade (afeta usuarios?)
2. Se sim → rollback imediato
3. Se nao → investigar e decidir fix forward vs rollback
```

### 6. Procedimento de Rollback
```bash
#!/bin/bash
# scripts/rollback.sh
set -euo pipefail

APP_DIR="/opt/app"
ROLLBACK_COMMIT="${1:-}"  # Commit para voltar (opcional)

if [ -z "$ROLLBACK_COMMIT" ]; then
  # Pegar commit anterior do log de deploy
  ROLLBACK_COMMIT=$(cat /var/log/deploy/latest | grep "Commit anterior" | awk '{print $3}')
fi

echo "[$(date)] === INICIO DO ROLLBACK para $ROLLBACK_COMMIT ==="

cd "$APP_DIR"

# 1. Restaurar codigo
git checkout "$ROLLBACK_COMMIT"

# 2. Reinstalar dependencias
npm ci --production

# 3. Rebuild
npm run build

# 4. Restart
pm2 restart ecosystem.config.js

# 5. Verificar
sleep 10
curl -sf http://localhost:3000/api/health | jq .

echo "[$(date)] === ROLLBACK CONCLUIDO ==="
```

### 7. Comunicar Resultado
```
Apos deploy bem-sucedido:
- [ ] Notificar equipe: "Deploy concluido com sucesso"
- [ ] Listar mudancas principais
- [ ] Informar se ha acoes necessarias (ex: limpar cache)

Apos rollback:
- [ ] Notificar equipe: "Deploy revertido, investigando"
- [ ] Abrir incidente/ticket
- [ ] Agendar post-mortem
```

### 8. Atualizar Registro de Deploys
```markdown
## Registro de Deploy

| Data | Commit | Responsavel | Mudancas | Status |
|------|--------|------------|----------|--------|
| 2024-01-15 14:30 | abc1234 | @dev | Feature X + Fix Y | Sucesso |
| 2024-01-12 10:00 | def5678 | @ops | Migracao DB | Rollback (ver postmortem) |
```

## Criterios de Aceite
- [ ] Checklist pre-deploy verificado e documentado
- [ ] Baseline de metricas registrado antes do deploy
- [ ] Deploy executado com script padronizado
- [ ] Smoke tests executados e todos passaram
- [ ] Monitoramento pos-deploy por 30 minutos
- [ ] Procedimento de rollback testado e pronto
- [ ] Equipe notificada do resultado
- [ ] Registro de deploy atualizado

## Entregaveis
- Script de deploy (`scripts/deploy.sh`)
- Script de rollback (`scripts/rollback.sh`)
- Script de smoke tests (`scripts/smoke-test.sh`)
- Checklist pre-deploy (reutilizavel)
- Registro de deploy atualizado

## Verificacao
- [ ] Aplicacao esta funcionando em producao
- [ ] Nenhum erro novo nos logs (30 min apos deploy)
- [ ] Metricas de performance dentro do normal
- [ ] Usuarios nao reportaram problemas
- [ ] Rollback seria possivel em caso de emergencia
