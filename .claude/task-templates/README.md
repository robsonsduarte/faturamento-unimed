# Task Templates DuarteOS

Sistema de templates de tarefas para padronizar e acelerar a execucao de atividades recorrentes no desenvolvimento de software. Cada template define objetivo, passos, criterios de aceite e entregaveis concretos.

## Como Usar

```
/DUARTEOS:squad:task [template-name] [contexto adicional opcional]
```

O comando identifica o template pelo nome (exato ou busca parcial), adapta ao contexto fornecido e executa os passos sequencialmente.

### Exemplos

- `/DUARTEOS:squad:task spec-feature` — Especificar uma nova feature
- `/DUARTEOS:squad:task dev-api-endpoint criar endpoint de upload` — Implementar endpoint com contexto
- `/DUARTEOS:squad:task qa-code-review src/lib/services/` — Revisar codigo de um diretorio especifico
- `/DUARTEOS:squad:task db-migration adicionar tabela de notificacoes` — Criar migracao de banco
- `/DUARTEOS:squad:task sec-owasp-audit` — Executar auditoria de seguranca completa

## Templates Disponiveis

| Nome | Categoria | Descricao |
|------|-----------|-----------|
| `spec-feature` | Spec | Especificar nova feature com escopo, user stories, mockups e criterios de aceite |
| `spec-api-contract` | Spec | Definir contrato de API com endpoints, schemas, autenticacao e erros |
| `spec-prd` | Spec | Criar Product Requirements Document com problema, solucao, metricas e fases |
| `spec-user-story` | Spec | Escrever user stories com persona, necessidade, criterio e prioridade |
| `spec-migration-plan` | Spec | Planejar migracao com estado atual, estado desejado, riscos e rollback |
| `spec-architecture-decision` | Spec | Registrar decisao arquitetural (ADR) com contexto, opcoes e consequencias |
| `dev-api-endpoint` | Dev | Implementar endpoint de API com rota, controller, validacao e testes |
| `dev-component` | Dev | Criar componente UI com props, estados, variantes e testes |
| `dev-refactor` | Dev | Refatorar codigo identificando smell, planejando mudanca e mantendo testes verdes |
| `dev-integration` | Dev | Integrar servico externo com API client, error handling, retry e mocking |
| `dev-migration` | Dev | Executar migracao de dados/schema com script, validacao e rollback |
| `dev-hotfix` | Dev | Corrigir bug urgente em producao com reproducao, root cause e fix |
| `dev-feature` | Dev | Implementar feature completa end-to-end com backend, frontend e testes |
| `dev-hook` | Dev | Criar hook React customizado com interface, estado, side effects e testes |
| `qa-test-suite` | QA | Criar suite de testes com estrategia unit, integration e e2e |
| `qa-code-review` | QA | Revisar codigo com checklist de seguranca, performance e padroes |
| `qa-regression` | QA | Teste de regressao identificando areas afetadas e comparando resultados |
| `qa-performance` | QA | Teste de performance com baseline, load test, profiling e otimizacao |
| `qa-accessibility` | QA | Auditoria de acessibilidade WCAG 2.1, screen readers e navegacao por teclado |
| `qa-e2e` | QA | Testes end-to-end com fluxos criticos, setup e integracao CI |
| `db-migration` | DB | Criar migracao de banco com DDL, up/down, validacao e RLS |
| `db-seed` | DB | Popular banco com dados de desenvolvimento, fixtures e cleanup |
| `db-rls-policy` | DB | Configurar Row Level Security com policies, roles e testes de acesso |
| `db-index-optimization` | DB | Otimizar indices com EXPLAIN ANALYZE e identificacao de queries lentas |
| `db-backup-plan` | DB | Planejar backup e recovery com estrategia, frequencia e teste de restore |
| `db-schema-design` | DB | Projetar schema com ERD, normalizacao, relacoes e constraints |
| `ops-ci-cd` | Ops | Configurar pipeline CI/CD com build, test, lint, deploy e environments |
| `ops-docker` | Ops | Dockerizar aplicacao com Dockerfile, compose, volumes e networking |
| `ops-deploy` | Ops | Deploy em producao com checklist pre-deploy, steps e validacao pos-deploy |
| `ops-monitoring` | Ops | Configurar monitoramento com metricas, alertas, dashboards e on-call |
| `ops-ssl-cert` | Ops | Configurar certificado SSL com geracao, instalacao e renovacao automatica |
| `ops-scaling` | Ops | Planejar escalabilidade com bottlenecks, caching e CDN |
| `sec-owasp-audit` | Sec | Auditoria OWASP Top 10 com verificacao e remediacao de cada vulnerabilidade |
| `sec-dependency-scan` | Sec | Scan de dependencias com npm audit, snyk e avaliacao de riscos |
| `sec-penetration-plan` | Sec | Planejar teste de penetracao com escopo, metodologia e ferramentas |
| `sec-incident-response` | Sec | Plano de resposta a incidentes com deteccao, contencao e recuperacao |
| `sec-auth-review` | Sec | Revisar autenticacao/autorizacao com flows, tokens, RBAC e sessions |

## Estrutura de Diretorio

```
task-templates/
├── README.md           # Este arquivo (indice)
├── spec/               # Especificacao e planejamento
├── dev/                # Desenvolvimento e implementacao
├── qa/                 # Qualidade e testes
├── db/                 # Banco de dados
├── ops/                # Operacoes e infraestrutura
└── sec/                # Seguranca
```

## Formato Padrao

Todo template segue a mesma estrutura: Objetivo, Contexto, Pre-requisitos, Passos, Criterios de Aceite, Entregaveis e Verificacao. Isso garante consistencia e previsibilidade na execucao.
