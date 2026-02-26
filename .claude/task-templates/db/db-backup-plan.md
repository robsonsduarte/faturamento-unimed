# Task: DB — Planejar Backup e Recovery

## Objetivo
Criar estrategia completa de backup e recovery para o banco de dados, incluindo frequencia, retencao, automacao, teste de restore e documentacao de procedimentos de emergencia.

## Contexto
Usar ao configurar um novo ambiente de producao, revisar estrategia existente, ou apos incidentes de perda de dados. Backups que nunca foram testados NAO sao backups — sao esperanca. O plano deve cobrir desde falhas simples (query DELETE errada) ate desastres completos (perda do servidor).

## Pre-requisitos
- [ ] Acesso administrativo ao banco de dados
- [ ] Entendimento do volume de dados e taxa de crescimento
- [ ] RPO (Recovery Point Objective) definido pelo negocio
- [ ] RTO (Recovery Time Objective) definido pelo negocio
- [ ] Orcamento para armazenamento de backups

## Passos

### 1. Definir RPO e RTO
```
RPO (Recovery Point Objective):
  "Quantos dados podemos perder?"
  → Resposta: Maximo 1 hora de dados
  → Implicacao: Backup a cada 1 hora OU replicacao continua

RTO (Recovery Time Objective):
  "Quanto tempo ate o sistema voltar?"
  → Resposta: Maximo 30 minutos
  → Implicacao: Backup deve ser restauravel em <30 minutos

Cenarios de perda:
| Cenario | RPO Real | RTO Real | Aceitavel? |
|---------|----------|----------|------------|
| DELETE acidental em 1 tabela | 1h (ultimo backup) | 15min | Sim |
| Corrupcao de banco inteiro | 1h | 30min | Sim |
| Perda do servidor | 1h | 45min | Marginal |
| Perda do datacenter | 1h | 2h | Nao (melhorar) |
```

### 2. Definir Estrategia de Backup
```
Camadas de protecao:

1. Supabase PITR (Point-in-Time Recovery):
   - Retencao: 7 dias (plano Pro) / 28 dias (plano Team)
   - RPO: Segundos (WAL shipping continuo)
   - Quando usar: Restaurar a qualquer ponto nos ultimos 7-28 dias
   - Limitacao: Restaura o banco INTEIRO, nao tabelas individuais

2. Backup Logico Diario (pg_dump):
   - Frequencia: A cada 6 horas
   - Retencao: 30 dias
   - Formato: Custom (-Fc) para restore seletivo
   - Armazenamento: S3 com versionamento
   - Quando usar: Restaurar tabelas especificas

3. Backup Logico Semanal (completo):
   - Frequencia: Domingo as 03:00
   - Retencao: 90 dias
   - Formato: Plain text SQL + Custom
   - Armazenamento: S3 + copia offsite
   - Quando usar: Disaster recovery completo

4. Snapshot de Storage:
   - Frequencia: Diario
   - Retencao: 14 dias
   - Quando usar: Recuperar arquivos do Supabase Storage
```

### 3. Implementar Backup Automatizado
```bash
#!/bin/bash
# scripts/backup-database.sh

set -euo pipefail

# Configuracao
DB_URL="${DATABASE_URL}"
BACKUP_DIR="/backups/postgres"
S3_BUCKET="s3://myapp-backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.dump"
RETENTION_DAYS=30

# Criar diretorio se nao existe
mkdir -p "${BACKUP_DIR}"

# Executar backup
echo "[$(date)] Iniciando backup..."
pg_dump "${DB_URL}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${BACKUP_FILE}" \
  2>&1 | tee "${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Verificar integridade
echo "[$(date)] Verificando integridade..."
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERRO: Backup corrompido!"
  exit 1
fi

# Upload para S3
echo "[$(date)] Enviando para S3..."
aws s3 cp "${BACKUP_FILE}" "${S3_BUCKET}/${TIMESTAMP}/" --storage-class STANDARD_IA

# Limpar backups antigos locais
echo "[$(date)] Limpando backups com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -name "backup_*.dump" -mtime +${RETENTION_DAYS} -delete

# Limpar backups antigos no S3
aws s3 ls "${S3_BUCKET}/" | while read -r line; do
  backup_date=$(echo "$line" | awk '{print $1}')
  if [[ $(date -d "$backup_date" +%s) -lt $(date -d "-${RETENTION_DAYS} days" +%s) ]]; then
    folder=$(echo "$line" | awk '{print $2}')
    aws s3 rm "${S3_BUCKET}/${folder}" --recursive
  fi
done

echo "[$(date)] Backup concluido: ${BACKUP_FILE}"
echo "[$(date)] Tamanho: $(du -h ${BACKUP_FILE} | cut -f1)"
```

### 4. Agendar Backups
```bash
# Crontab
# Backup a cada 6 horas
0 */6 * * * /opt/app/scripts/backup-database.sh >> /var/log/backup.log 2>&1

# Backup completo semanal (domingo 03:00)
0 3 * * 0 /opt/app/scripts/backup-full.sh >> /var/log/backup-full.log 2>&1

# Verificacao diaria do ultimo backup
0 9 * * * /opt/app/scripts/verify-backup.sh >> /var/log/backup-verify.log 2>&1
```

### 5. Documentar Procedimento de Restore
```markdown
## Procedimento de Restore

### Cenario 1: Restaurar tabela especifica
# Listar conteudo do backup
pg_restore --list backup_20240115_120000.dump | grep "TABLE DATA.*contents"

# Restaurar apenas a tabela desejada
pg_restore \
  --dbname=$DATABASE_URL \
  --table=contents \
  --data-only \
  --clean \
  backup_20240115_120000.dump

### Cenario 2: Restaurar banco completo
# CUIDADO: Isso sobrescreve TODOS os dados atuais
# 1. Confirmar que e o backup correto
pg_restore --list backup_20240115_120000.dump | head -20

# 2. Restaurar
pg_restore \
  --dbname=$DATABASE_URL \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  backup_20240115_120000.dump

### Cenario 3: PITR (Supabase)
# Via dashboard do Supabase:
# Settings → Database → Backups → Point in Time Recovery
# Selecionar data/hora desejada
# ATENCAO: Restaura o banco inteiro para aquele ponto
```

### 6. Testar Restore
Agendar teste mensal de restore:
```bash
#!/bin/bash
# scripts/verify-backup.sh

# Pegar ultimo backup
LATEST_BACKUP=$(ls -t /backups/postgres/backup_*.dump | head -1)

# Criar banco temporario para teste
createdb backup_test_db

# Restaurar no banco de teste
pg_restore \
  --dbname=backup_test_db \
  --no-owner \
  --no-privileges \
  "${LATEST_BACKUP}"

# Validar integridade
psql backup_test_db -c "SELECT count(*) FROM profiles;"
psql backup_test_db -c "SELECT count(*) FROM contents;"
psql backup_test_db -c "SELECT count(*) FROM user_subscriptions;"

# Comparar com producao
PROD_COUNT=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM profiles;")
TEST_COUNT=$(psql backup_test_db -t -c "SELECT count(*) FROM profiles;")

if [ "$PROD_COUNT" != "$TEST_COUNT" ]; then
  echo "ALERTA: Contagem de profiles divergente! Prod: $PROD_COUNT, Backup: $TEST_COUNT"
fi

# Limpar banco de teste
dropdb backup_test_db

echo "Verificacao de backup concluida: ${LATEST_BACKUP}"
```

### 7. Configurar Alertas
```
Alertas de backup:
- Backup nao executou no horario esperado → alerta em 30min
- Backup falhou → alerta imediato
- Tamanho do backup diminuiu >20% → investigar (possivel perda de dados)
- Verificacao de restore falhou → alerta critico
- Espaco de armazenamento >80% → alerta de capacidade
```

### 8. Documentar Plano Completo
```markdown
## Plano de Backup — [Nome do Projeto]

### Estrategia
| Tipo | Frequencia | Retencao | RPO | RTO |
|------|-----------|----------|-----|-----|
| PITR (Supabase) | Continuo | 7 dias | Segundos | ~1h |
| pg_dump | 6h | 30 dias | 6h | 15min |
| Completo | Semanal | 90 dias | 7 dias | 30min |

### Responsaveis
- Backup automatico: cron (sem intervencao humana)
- Verificacao: [nome] (mensal)
- Restore em emergencia: [nome] + [backup]

### Contatos de Emergencia
| Pessoa | Telefone | Quando acionar |
|--------|----------|---------------|
| DBA | +55... | Perda de dados confirmada |
| CTO | +55... | Downtime > 30min |
```

## Criterios de Aceite
- [ ] RPO e RTO definidos e aprovados pelo negocio
- [ ] Estrategia multicamada documentada (PITR + logico + offsite)
- [ ] Scripts de backup automatizados e agendados
- [ ] Scripts de restore documentados para cada cenario
- [ ] Teste de restore executado com sucesso
- [ ] Alertas configurados para falhas de backup
- [ ] Retencao definida e implementada (limpeza automatica)
- [ ] Backup offsite configurado (diferentes regioes/provedores)

## Entregaveis
- Script de backup automatizado
- Script de verificacao/restore
- Crontab configurado
- Documentacao do plano completo
- Registro do teste de restore

## Verificacao
- [ ] Backup executa automaticamente no horario esperado
- [ ] Restore de tabela especifica funciona em <15min
- [ ] Restore completo funciona em <30min
- [ ] Alertas disparam quando backup falha (testar desabilitando cron)
- [ ] Backup offsite acessivel a partir de outra localizacao
