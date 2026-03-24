# Squad: Criar Squad Customizado

Crie um novo squad customizado para o projeto.

**Agente lider:** PM (ATLAS) — coleta requisitos e valida resultado
**Agente executor:** NEXUS (Architect) ou TITAN (System Builder) — cria a estrutura de arquivos
**Modo:** Interativo — guia o usuario passo a passo

> **Regra de ouro:** O PM (ATLAS) e orquestrador PURO. Ele coleta requisitos do usuario (PASSOs 1 e 2),
> DELEGA a criacao de arquivos spawnando NEXUS ou TITAN (PASSOs 3 e 4), e valida o resultado (PASSO 5).
> O PM NUNCA escreve arquivos diretamente.

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

### PASSO 3: Delegar Criacao da Estrutura

> **O PM NAO cria arquivos.** O PM prepara o briefing e SPAWNA um agente executor.

1. **Escolher agente executor:**
   - Se o squad e de desenvolvimento (fullstack, basic, scratch com dev) → spawnar **NEXUS (Architect)**
   - Se o squad e de infraestrutura/automacao (automation, data-science, ops) → spawnar **TITAN (System Builder)**

2. **Preparar briefing para o agente spawnado** com:
   - Nome do squad normalizado
   - Template escolhido (ou scratch)
   - Descricao fornecida pelo usuario
   - Qualquer requisito coletado nos passos anteriores

3. **O agente spawnado (NEXUS ou TITAN) executa a criacao:**

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

O PM (ATLAS) coleta as respostas do usuario e repassa ao agente spawnado (NEXUS/TITAN) para implementar:

1. **Agentes:** PM pergunta: "Quais agentes esse squad precisa? (ex: backend, frontend, qa, devops)"
   - O agente spawnado cria `squads/{nome}/agents/{agente}.md` para cada agente com:
     - YAML frontmatter (name, description, tools, model)
     - Responsabilidades
     - Estilo de comunicacao
     - Regras
   - O agente spawnado atualiza `squad.yaml` com o novo agente

2. **Tasks:** PM pergunta: "Que tipo de tarefas esse squad vai executar?"
   - O agente spawnado cria template em `squads/{nome}/tasks/{tipo}.md` para cada tipo
   - O agente spawnado atualiza `squad.yaml` com as novas tasks

3. **Config:** PM pergunta: "Precisa herdar algum agente global? (architect, qa, pm, etc)"
   - Se sim, o agente spawnado adiciona ao `inherit_agents` no `squad.yaml`
   - Agentes globais vivem em `.claude/commands/agents/`

4. **Coding Standards:** PM pergunta: "Tem padroes especificos para esse squad?"
   - O agente spawnado preenche `config/coding-standards.md` (se sim) ou cria com padroes minimos (se nao)

### PASSO 5: Validacao (PM retoma o controle)

O PM (ATLAS) valida o resultado produzido pelo agente spawnado:

1. Verifique que todos os arquivos referenciados em `squad.yaml` existem
2. Verifique que cada agente tem pelo menos: name, description, responsabilidades
3. Se houver problemas, o PM instrui o agente spawnado a corrigir
4. Mostre resumo final ao usuario:

```
Squad "{nome}" criado com sucesso!

Diretorio: squads/{nome}/
Agentes: {lista}
Tasks: {lista}
Heranca: {inherit_agents ou "nenhuma"}

Proximo passo: /DUARTEOS:squad:run-squad {nome} "sua demanda aqui"
```

## Exemplos de uso

```
/DUARTEOS:squad:create-squad meu-saas
/DUARTEOS:squad:create-squad data-pipeline
/DUARTEOS:squad:create-squad landing-pages
```

## Regras

- Nunca criar squad sem pelo menos 1 agente (nem que seja generico)
- Sempre gerar squad.yaml valido e completo
- Se o usuario nao souber o que precisa, sugira baseado no nome/descricao
- Cada arquivo criado deve ser funcional, nao placeholder vazio
- Mantenha consistencia com o estilo dos agentes existentes em `templates/agents/`
