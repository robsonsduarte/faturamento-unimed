# Task: Sec — Scan de Dependencias

## Objetivo
Executar scan completo de dependencias do projeto para identificar vulnerabilidades conhecidas (CVEs), avaliar riscos, atualizar pacotes seguros e documentar decisoes sobre riscos aceitos.

## Contexto
Usar como parte do ciclo de manutencao regular (mensal recomendado), apos alertas de seguranca (Dependabot, Snyk), ou antes de releases. Dependencias de terceiros sao o vetor de ataque mais comum em aplicacoes modernas — 97% do codigo de uma aplicacao tipica vem de dependencias.

## Pre-requisitos
- [ ] Acesso ao codebase com package.json e package-lock.json
- [ ] Node.js e npm instalados
- [ ] Ferramentas de scan disponíveis (npm audit, npx auditjs, snyk)
- [ ] Ambiente de desenvolvimento funcional para testar atualizacoes
- [ ] Suite de testes para validar que atualizacoes nao quebram nada

## Passos

### 1. Executar npm audit
```bash
# Scan basico
npm audit

# Apenas dependencias de producao (ignorar devDependencies)
npm audit --production

# Output em JSON (para processamento automatico)
npm audit --json > audit-report.json

# Resumo esperado:
# X vulnerabilities (Y critical, Z high, W moderate, V low)
```

Interpretar resultados:
```
Severidade:
- Critical: Exploravel remotamente, sem autenticacao → CORRIGIR IMEDIATAMENTE
- High: Exploravel com alguma condicao → CORRIGIR EM 7 DIAS
- Moderate: Exploravel com condicoes especificas → CORRIGIR EM 30 DIAS
- Low: Impacto minimo ou exploracao improvavel → AVALIAR
```

### 2. Analisar Cada Vulnerabilidade
Para cada CVE encontrado, documente:
```markdown
### CVE-2024-XXXXX — [Nome do pacote]

**Severidade:** Critical
**Pacote:** lodash
**Versao afetada:** < 4.17.21
**Versao atual no projeto:** 4.17.20
**Tipo:** Prototype Pollution

**Explorabilidade no nosso contexto:**
- O codigo usa lodash.merge() com input do usuario? SIM/NAO
- Se SIM: CORRIGIR URGENTE
- Se NAO: Risco reduzido, mas atualizar mesmo assim

**Correcao:**
- Atualizar para lodash@4.17.21+
- Ou substituir por alternativa nativa (Object.assign, spread operator)

**Dependencia direta ou transitiva:**
- Direta: lodash → atualizar em package.json
- Transitiva via: react-hook-form → aguardar upstream fix ou usar override
```

### 3. Classificar e Priorizar
```
Prioridade de correcao:

P0 (Corrigir hoje):
- Critical + dependencia direta + codigo usa funcao afetada
- Critical + servico exposto a internet

P1 (Corrigir esta semana):
- High + dependencia direta
- Critical + transitiva (com workaround disponivel)

P2 (Corrigir este mes):
- Moderate + qualquer
- High + transitiva

P3 (Backlog):
- Low + qualquer
- Vulnerabilidade em devDependency nao exposta em producao
```

### 4. Atualizar Dependencias Seguras
```bash
# Atualizar apenas patches de seguranca (seguro na maioria dos casos)
npm audit fix

# Se precisa de major version bump (mais arriscado)
npm audit fix --force  # CUIDADO: pode quebrar compatibilidade

# Melhor abordagem: atualizar uma por uma
npm install lodash@latest
npm install next@latest

# Para dependencias transitivas, usar overrides:
# package.json:
{
  "overrides": {
    "vulnerable-pkg": ">=2.0.0"
  }
}

# Apos cada atualizacao:
npx tsc --noEmit          # tipagem
npm run lint               # lint
npx vitest run             # testes
npm run build              # build
```

### 5. Avaliar Dependencias Desnecessarias
```bash
# Listar dependencias nao usadas
npx depcheck

# Para cada dependencia nao usada:
# 1. Verificar se realmente nao e usada (imports indiretos, dynamic imports)
# 2. Se confirmado: npm uninstall [pacote]

# Verificar tamanho de cada dependencia
npx npm-size [pacote]

# Considerar alternativas mais leves:
# moment.js (300KB) → date-fns (30KB) ou dayjs (7KB)
# lodash (600KB) → lodash-es (tree-shakeable) ou nativos
```

### 6. Verificar Licencas
```bash
# Listar licencas de todas as dependencias
npx license-checker --summary

# Licencas problematicas:
# - GPL: "viral", pode obrigar a abrir seu codigo
# - AGPL: Mais restritiva que GPL para SaaS
# - Unlicensed: Sem permissao explicita de uso

# Licencas seguras para SaaS:
# - MIT: Pode usar em qualquer contexto
# - Apache-2.0: Pode usar, precisa manter aviso
# - BSD-2/BSD-3: Pode usar com restricoes minimas
# - ISC: Similar a MIT
```

### 7. Configurar Monitoramento Continuo
```bash
# GitHub Dependabot (gratuito)
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
    # Agrupar minor/patch updates
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

```yaml
# GitHub Actions: scan automatico em PRs
# .github/workflows/security.yml
name: Security Scan
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm audit --production --audit-level=high
        # Falha o PR se houver vulnerabilidade High ou Critical
```

### 8. Documentar Relatorio
```markdown
## Relatorio de Scan de Dependencias

**Data:** 2024-01-15
**Total de dependencias:** 245 (diretas: 42, transitivas: 203)
**Ferramenta:** npm audit + depcheck

### Resumo de Vulnerabilidades
| Severidade | Quantidade | Corrigidas | Aceitas | Pendentes |
|-----------|-----------|-----------|---------|-----------|
| Critical | 0 | - | - | - |
| High | 2 | 1 | 0 | 1 |
| Moderate | 5 | 3 | 2 | 0 |
| Low | 8 | 0 | 8 | 0 |

### Vulnerabilidades Pendentes
| CVE | Pacote | Severidade | Acao | Prazo |
|-----|--------|-----------|------|-------|
| CVE-2024-001 | pkg-x | High | Aguardando fix upstream | 7 dias |

### Riscos Aceitos
| CVE | Pacote | Severidade | Justificativa |
|-----|--------|-----------|---------------|
| CVE-2024-002 | dev-tool | Moderate | Apenas devDependency, nao em prod |
| CVE-2024-003 | lib-y | Moderate | Funcao afetada nao usada no projeto |

### Dependencias Removidas
- unused-pkg: nao estava em uso (economizou 200KB no bundle)

### Licencas
- Todas as dependencias usam licencas compatíveis (MIT, Apache-2.0, BSD)
- Nenhuma GPL/AGPL encontrada

### Proxima Revisao
Agendada para: [data + 30 dias]
```

## Criterios de Aceite
- [ ] npm audit executado para producao e desenvolvimento
- [ ] Cada CVE Critical/High analisado individualmente
- [ ] Vulnerabilidades priorizadas (P0/P1/P2/P3)
- [ ] Dependencias atualizadas e testes passando
- [ ] Dependencias nao usadas removidas
- [ ] Licencas verificadas (nenhuma GPL em producao)
- [ ] Monitoramento continuo configurado (Dependabot ou equivalente)
- [ ] Relatorio documentado com riscos aceitos justificados
- [ ] Zero vulnerabilidades Critical em producao
- [ ] Testes passam apos atualizacoes

## Entregaveis
- Relatorio de scan (markdown)
- package.json atualizado
- package-lock.json atualizado
- Configuracao de Dependabot
- Workflow de CI para scan automatico

## Verificacao
- [ ] `npm audit --production` retorna zero Critical/High
- [ ] Testes passam: `npx vitest run`
- [ ] Build funciona: `npm run build`
- [ ] Dependabot esta criando PRs automaticamente
- [ ] Proxima revisao agendada no calendario
