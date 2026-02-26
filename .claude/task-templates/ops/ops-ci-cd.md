# Task: Ops — Configurar Pipeline CI/CD

## Objetivo
Configurar pipeline de integracao e entrega continua cobrindo build, lint, tipagem, testes, e deploy automatizado para multiplos ambientes, com gates de qualidade e rollback.

## Contexto
Usar ao iniciar um projeto, migrar de deploy manual para automatizado, ou adicionar novos ambientes. O pipeline deve ser rapido o suficiente para nao atrapalhar o fluxo de desenvolvimento (<10min para CI, <5min para CD), e confiavel o suficiente para que a equipe confie no processo.

## Pre-requisitos
- [ ] Repositorio Git configurado (GitHub, GitLab, Bitbucket)
- [ ] Ambientes definidos (dev, staging, producao)
- [ ] Secrets e credenciais identificados
- [ ] Processo de deploy atual documentado (se existir)
- [ ] Testes automatizados existentes

## Passos

### 1. Definir Fluxo de Branches
```
main (producao)
  ├── staging (pre-producao, deploy automatico)
  └── feature/* (desenvolvimento)
      └── PR → main (code review obrigatorio)

Fluxo:
1. Dev cria branch feature/xyz
2. Dev faz commits e push
3. CI roda automaticamente (lint, tipos, testes)
4. Dev abre PR para main
5. CI roda novamente + code review
6. Merge para main → deploy automatico para staging
7. Aprovacao manual → deploy para producao
```

### 2. Configurar CI (Integracao Continua)
```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true  # Cancelar runs anteriores da mesma branch

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    name: Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  build:
    name: Build
    needs: [lint, typecheck, test]  # So builda se tudo passou
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next/
```

### 3. Configurar CD (Entrega Continua)
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging  # Requer aprovacao se configurado
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/app
            git pull origin main
            npm ci --production
            npm run build
            pm2 restart ecosystem.config.js

# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  workflow_dispatch:  # Deploy manual (botao no GitHub)
    inputs:
      confirm:
        description: 'Confirmar deploy para producao'
        required: true
        type: boolean

jobs:
  deploy:
    name: Deploy to Production
    if: github.event.inputs.confirm == 'true'
    runs-on: ubuntu-latest
    environment: production  # Requer aprovacao
    steps:
      # ... similar ao staging mas com validacoes extras
```

### 4. Configurar Secrets
```
Secrets necessarios (configurar em Settings → Secrets):

CI:
- (nenhum para lint/type/test se nao usa servicos externos)

Staging:
- STAGING_HOST
- STAGING_USER
- STAGING_SSH_KEY
- STAGING_DATABASE_URL
- STAGING_SUPABASE_URL
- STAGING_SUPABASE_KEY

Production:
- PROD_HOST
- PROD_USER
- PROD_SSH_KEY
- PROD_DATABASE_URL
- PROD_SUPABASE_URL
- PROD_SUPABASE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
```

### 5. Adicionar Gates de Qualidade
```yaml
# Regras de protecao da branch main:
# Settings → Branches → Branch protection rules

Configurar:
- [x] Require pull request reviews (1 aprovacao)
- [x] Require status checks to pass (lint, typecheck, test, build)
- [x] Require branches to be up to date
- [x] Restrict who can push (apenas CI bot)
- [ ] Require signed commits (opcional)
```

### 6. Configurar Notificacoes
```yaml
# Adicionar ao final de cada workflow:
  notify:
    name: Notify
    needs: [deploy]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Notify Success
        if: needs.deploy.result == 'success'
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            -d '{"text":"Deploy para staging concluido com sucesso"}'

      - name: Notify Failure
        if: needs.deploy.result == 'failure'
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -H 'Content-type: application/json' \
            -d '{"text":"FALHA no deploy para staging! Verificar logs."}'
```

### 7. Implementar Rollback
```yaml
# .github/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Ambiente para rollback'
        required: true
        type: choice
        options: [staging, production]
      commits_back:
        description: 'Quantos commits voltar'
        required: true
        default: '1'

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 10
      - name: Rollback
        run: |
          COMMIT=$(git rev-parse HEAD~${{ github.event.inputs.commits_back }})
          echo "Rolling back to commit: $COMMIT"
          # Deploy da versao anterior
```

### 8. Otimizar Performance do Pipeline
```yaml
# Cache de dependencias
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'

# Paralelizar jobs independentes
jobs:
  lint:    # roda em paralelo
  typecheck:  # roda em paralelo
  test:    # roda em paralelo
  build:
    needs: [lint, typecheck, test]  # so apos todos passarem

# Cancelar runs anteriores da mesma branch
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

Target de tempo: CI completo < 10 minutos, Deploy < 5 minutos.

## Criterios de Aceite
- [ ] CI roda automaticamente em push e PR
- [ ] Pipeline inclui lint, tipagem, testes e build
- [ ] Build so executa se lint + tipos + testes passaram
- [ ] Deploy automatico para staging apos merge em main
- [ ] Deploy para producao requer aprovacao manual
- [ ] Secrets configurados e nao expostos em logs
- [ ] Gates de qualidade configurados na branch main
- [ ] Notificacoes de sucesso/falha configuradas
- [ ] Procedimento de rollback documentado e testado
- [ ] Pipeline completo executa em <10 minutos

## Entregaveis
- Workflows CI/CD (`.github/workflows/`)
- Configuracao de branch protection
- Documentacao de secrets necessarios
- Procedimento de rollback
- Script de deploy

## Verificacao
- [ ] Push em branch feature dispara CI
- [ ] PR sem testes passando nao pode ser mergeado
- [ ] Merge em main dispara deploy para staging
- [ ] Deploy para producao requer confirmacao manual
- [ ] Rollback funciona e restaura versao anterior
