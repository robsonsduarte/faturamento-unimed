# Governanca DuarteOS — Convencoes de Nomenclatura e Ciclo de Vida

**Versao:** 1.0.0

Este documento define as regras formais para nomear, criar, deprecar e versionar todas as entidades do sistema DuarteOS.

---

## 1. Entidades e Seus Padroes

### Agentes

| Regra | Exemplo |
|-------|---------|
| Formato: `{CODENAME}` — maiusculo, 3-7 caracteres, sem espacos | ATLAS, NEXUS, FORGE |
| Codename deve ser unico e evocativo do arquetipo | SENTINEL (guardiao), SHADOW (espelho) |
| Cada agente tem: codename + arquetipo + estilo + saudacao + assinatura | — |
| Agentes custom seguem as mesmas regras | SPARK, LENS, VAULT |

### Comandos

| Regra | Exemplo |
|-------|---------|
| Formato: `/{scope}:{action}` — minusculo, kebab-case | /DUARTEOS:squad:quick, /DUARTEOS:agents:pm |
| Scopes validos: `agents`, `squad`, `gsd` | — |
| Actions em kebab-case, verbo imperativo | plan-phase, sync-ide, clone-mind |
| Nomes curtos (max 20 chars incluindo scope) | /DUARTEOS:squad:new-project |

### Task Templates

| Regra | Exemplo |
|-------|---------|
| Formato: `{category}-{action}.md` — minusculo, kebab-case | spec-feature.md |
| Categorias: `spec`, `dev`, `qa`, `db`, `ops`, `sec` | dev-api-endpoint.md |
| Action descreve o que a task faz | qa-code-review.md |
| Um template por arquivo | — |

### Squads

| Regra | Exemplo |
|-------|---------|
| Formato: `{domain}` — minusculo, kebab-case | basic, fullstack |
| Nome do diretorio = nome do squad | data-science, automation |
| Manifest obrigatorio: `squad.yaml` | — |
| Cada squad tem pelo menos 1 agente e 1 task | — |

### Arquivos de Protocolo

| Regra | Exemplo |
|-------|---------|
| Formato: `{NOME}.md` — maiusculo, sem espacos | CONSTITUTION.md |
| Residem em `.claude/protocols/` | GOVERNANCE.md, SYNAPSE.md |
| Versionados (header com versao) | CONFIG-PROTOCOL.md |

### Estados (Synapse)

| Estado | Formato |
|--------|---------|
| Repouso | `idle` |
| Transicao | `activated`, `analyzing`, `planning`, `executing`, `reviewing` |
| Bloqueio | `blocked` |
| Final | `completed` |

### Config

| Regra | Exemplo |
|-------|---------|
| Formato: `{layer}.yaml` — minusculo | system.yaml, project.yaml |
| Chaves em snake_case | default_model, min_test_coverage |
| Valores tipados (string, number, boolean) | — |

---

## 2. Ciclo de Vida

### Criacao de Entidade

1. Verificar que o nome segue as convencoes acima
2. Verificar que nao existe entidade com mesmo nome
3. Documentar proposito e escopo
4. Adicionar ao registro apropriado (README, squad.md, etc.)

### Deprecacao

1. Marcar como `[DEPRECATED]` no titulo
2. Adicionar nota com: motivo, alternativa sugerida, versao de remocao prevista
3. Manter por **2 versoes major** antes de remover
4. Exemplo: deprecado em v5.0.0 → removido em v7.0.0

### Versionamento (Semver)

| Tipo | Quando | Exemplo |
|------|--------|---------|
| **MAJOR** (X.0.0) | Breaking changes, novos conceitos, mudanca de comportamento | v4→v5: protocols, config layers |
| **MINOR** (x.Y.0) | Novas features retrocompativeis | v5.1: novo template de squad |
| **PATCH** (x.y.Z) | Bug fixes, ajustes de texto | v5.0.1: typo na constitution |

---

## 3. Mapa de Jurisdicao de Agentes

A separacao de responsabilidades entre agentes e principio constitucional (Artigo 0). Esta secao define a jurisdicao de cada agente e suas restricoes explicitas.

### Tabela de Jurisdicao

| Agente | Codename | Jurisdicao EXCLUSIVA | PROIBIDO |
|--------|----------|---------------------|----------|
| Data Engineer | PAVEL DUROV | Migrations, schemas, queries, modelagem, indexes, triggers, seeds, backfills, otimizacao de BD | Codigo aplicacao, frontend, APIs, deploy |
| Backend | FORGE | APIs, logica de negocio, servicos, integracoes externas | Banco de dados (SQL, migrations, schemas), frontend (UI, componentes, CSS) |
| Frontend | PRISM | Implementacao de componentes, paginas, hooks, estado | Definir UX/Design System, banco de dados, APIs backend |
| UX/Design System | BRAD FROST | UX design, Design System, tokens, patterns, guidelines, componentes atomicos | Implementacao de codigo, banco de dados, APIs |
| DevOps | DEVOPS | Git operations, CI/CD, Docker, deploy, monitoramento | Logica de negocio, banco de dados, frontend |
| PM | ATLAS | Orquestracao, delegacao, decisoes de escopo, autorizacao | Executar qualquer task tecnica diretamente |
| Architect | NEXUS | Arquitetura, planejamento tecnico, decisoes estruturais | Executar implementacao diretamente |
| QA | SENTINEL | Verificacao, testes, debug, auditoria de qualidade | Implementar features, alterar banco de dados |
| Context Engineer | COMPASS | Coerencia, pesquisa, contexto, discuss-phase | Implementar codigo, alterar banco de dados |
| Devil's Advocate | SHADOW | Contestacao, red team, validacao de planos | Implementar codigo, alterar banco de dados |

### Regra de Enforcement

ATLAS (PM) DEVE verificar a jurisdicao do agente ANTES de spawnar qualquer task. Se a task cruza jurisdicoes, ATLAS deve decompor em sub-tasks e delegar cada uma ao agente correto.

Documento completo de referencia: `.claude/protocols/AGENT-JURISDICTION.md`

---

## 4. Regras de Ouro

1. **Consistencia > criatividade** — siga o padrao existente, nao invente novos
2. **Explicitez > convencao** — quando em duvida, seja mais explicito
3. **Nomes descritivos** — o nome deve explicar o que a entidade faz
4. **Ingles para codigo, portugues para docs** — exceto quando o projeto define diferente
5. **Prefixos padrao** — use os prefixos estabelecidos (spec-, dev-, qa-, db-, ops-, sec-)
