# Squad: Criar Squad Customizado

Crie um novo squad customizado para o projeto.

**Agente lider:** PM (Supreme Orchestrator)
**Modo:** Interativo — guia o usuario passo a passo

## Argumentos

$ARGUMENTS — nome do squad (obrigatorio)

## Instrucoes

Voce vai criar um squad completo e funcional. Siga este fluxo:

### PASSO 1: Validar Nome

1. Se `$ARGUMENTS` estiver vazio, pergunte o nome do squad ao usuario
2. Normalize o nome: lowercase, sem acentos, hifens no lugar de espacos
3. Verifique se `squads/{nome}/` ja existe — se sim, avise e pergunte se quer sobrescrever

### PASSO 2: Escolher Base

Pergunte ao usuario qual template usar como base:

| Template | Descricao | Agentes |
|----------|-----------|---------|
| `basic` | Squad minimo — 1 lead + 1 executor | 2 |
| `fullstack` | Dev completo — backend lead + frontend lead + QA | 3 |
| `data-science` | Dados — data engineer + analyst + ML engineer | 3 |
| `automation` | Automacoes — workflow designer + integrator + monitor | 3 |
| `scratch` | Do zero — so a estrutura vazia | 0 |

Templates disponiveis estao em `.claude/squad-templates/{template}/`. Se o template escolhido nao existir la, crie a estrutura do zero.

### PASSO 3: Criar Estrutura

#### Se template escolhido (nao scratch):

1. Leia os arquivos do template em `.claude/squad-templates/{template}/`
2. Copie toda a estrutura para `squads/{nome}/`
3. Substitua placeholders nos arquivos copiados:
   - `{{SQUAD_NAME}}` → nome do squad
   - `{{SQUAD_DESCRIPTION}}` → descricao fornecida pelo usuario
   - `{{PROJECT_NAME}}` → nome do projeto (de `.planning/PROJECT.md` ou pergunte)
   - `{{CREATED_AT}}` → data atual (YYYY-MM-DD)

#### Se scratch:

Crie a estrutura completa manualmente:

```
squads/{nome}/
  squad.yaml          — configuracao principal do squad
  README.md           — documentacao do squad
  config/
    coding-standards.md  — padroes de codigo especificos
    tech-stack.md        — stack tecnologica
  agents/              — definicoes dos agentes (*.md)
  tasks/               — templates de tarefas (*.md)
  templates/           — templates de artefatos
```

#### Conteudo do squad.yaml (sempre gerar):

```yaml
name: "{nome}"
description: "{descricao}"
created_at: "{data}"
version: "1.0.0"

agents: []
# Exemplo:
# - id: lead
#   file: agents/lead.md
#   role: orchestrator
#   model: sonnet
# - id: executor
#   file: agents/executor.md
#   role: executor
#   model: sonnet

tasks: []
# Exemplo:
# - id: default
#   file: tasks/default.md
#   assigned_to: executor

config:
  parallel: false          # execucao paralela de tasks
  max_retries: 2           # retentativas por task
  auto_verify: true        # verificacao automatica pos-task
  inherit_agents: []       # herdar agentes globais (ex: ["architect", "qa"])

hooks:
  pre_task: null           # comando antes de cada task
  post_task: null          # comando apos cada task
  on_complete: null        # comando ao finalizar squad
```

### PASSO 4: Customizacao Guiada

Apos criar a estrutura, guie o usuario:

1. **Agentes:** "Quais agentes esse squad precisa? (ex: backend, frontend, qa, devops)"
   - Para cada agente informado, crie `squads/{nome}/agents/{agente}.md` com:
     - YAML frontmatter (name, description, tools, model)
     - Responsabilidades
     - Estilo de comunicacao
     - Regras
   - Atualize `squad.yaml` com o novo agente

2. **Tasks:** "Que tipo de tarefas esse squad vai executar?"
   - Para cada tipo, crie template em `squads/{nome}/tasks/{tipo}.md`
   - Atualize `squad.yaml` com as novas tasks

3. **Config:** "Precisa herdar algum agente global? (architect, qa, pm, etc)"
   - Se sim, adicione ao `inherit_agents` no `squad.yaml`
   - Agentes globais vivem em `.claude/commands/agents/`

4. **Coding Standards:** "Tem padroes especificos para esse squad?"
   - Se sim, preencha `config/coding-standards.md`
   - Se nao, crie com padroes minimos (lint, commits, testes)

### PASSO 5: Validacao

1. Verifique que todos os arquivos referenciados em `squad.yaml` existem
2. Verifique que cada agente tem pelo menos: name, description, responsabilidades
3. Mostre resumo final:

```
Squad "{nome}" criado com sucesso!

Diretorio: squads/{nome}/
Agentes: {lista}
Tasks: {lista}
Heranca: {inherit_agents ou "nenhuma"}

Proximo passo: /squad:run-squad {nome} "sua demanda aqui"
```

## Exemplos de uso

```
/squad:create-squad meu-saas
/squad:create-squad data-pipeline
/squad:create-squad landing-pages
```

## Regras

- Nunca criar squad sem pelo menos 1 agente (nem que seja generico)
- Sempre gerar squad.yaml valido e completo
- Se o usuario nao souber o que precisa, sugira baseado no nome/descricao
- Cada arquivo criado deve ser funcional, nao placeholder vazio
- Mantenha consistencia com o estilo dos agentes existentes em `templates/agents/`
