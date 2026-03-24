# Squad: Listar Squads

Lista todos os squads disponiveis no projeto com status e detalhes.

## Instrucoes

Voce vai listar todos os squads configurados no projeto. Siga este fluxo:

### PASSO 1: Verificar Diretorio

1. Verifique se o diretorio `squads/` existe na raiz do projeto
2. Se NAO existir:
   - Informe: "Nenhum squad encontrado. O diretorio `squads/` nao existe."
   - Sugira: "Use `/DUARTEOS:squad:create-squad {nome}` para criar seu primeiro squad."
   - Encerre aqui

### PASSO 2: Coletar Dados

1. Liste todos os subdiretorios dentro de `squads/`
2. Para cada subdiretorio, leia `squads/{nome}/squad.yaml`
3. Se `squad.yaml` nao existir no subdiretorio, marque como "incompleto"
4. Extraia de cada squad.yaml:
   - `name` — nome do squad
   - `description` — descricao
   - `agents` — lista de agentes (contar quantidade)
   - `tasks` — lista de tasks (contar quantidade)
   - `config.inherit_agents` — agentes herdados

### PASSO 3: Verificar Agentes Globais

1. Verifique tambem `.claude/commands/agents/` para agentes globais disponiveis
2. Liste-os separadamente como "Agentes Globais (herdaveis)"

### PASSO 4: Apresentar Resultados

Mostre uma tabela formatada:

```
## Squads do Projeto

| # | Nome | Descricao | Agentes | Tasks | Heranca | Status |
|---|------|-----------|---------|-------|---------|--------|
| 1 | {nome} | {desc} | {N} proprios + {M} herdados | {T} | {inherit_agents} | OK |
| 2 | {nome} | {desc} | {N} | {T} | nenhuma | incompleto |

## Agentes Globais Disponiveis

| Agente | Arquivo | Pode ser herdado por qualquer squad |
|--------|---------|-------------------------------------|
| architect | .claude/commands/agents/architect.md | sim |
| qa | .claude/commands/agents/qa.md | sim |
| ... | ... | ... |

## Templates Disponiveis

| Template | Descricao | Agentes inclusos |
|----------|-----------|-----------------|
| basic | Squad minimo | lead, executor |
| fullstack | Dev completo | backend-lead, frontend-lead, qa |
| ... | ... | ... |
```

### PASSO 5: Diagnostico (se houver problemas)

Para cada squad com status "incompleto", informe o que esta faltando:
- squad.yaml ausente
- Agentes referenciados mas arquivos nao existem
- Tasks referenciadas mas arquivos nao existem

Sugira como corrigir cada problema.

### PASSO 6: Acoes Sugeridas

Ao final, sugira acoes relevantes:

```
## Acoes

- Criar novo squad: `/DUARTEOS:squad:create-squad {nome}`
- Executar um squad: `/DUARTEOS:squad:run-squad {nome} "demanda"`
- Clonar mente de especialista: `/DUARTEOS:squad:clone-mind {nome}`
```

## Regras

- Sempre verificar integridade dos arquivos referenciados
- Nunca modificar nada — este comando e somente leitura
- Se nenhum squad existir, a sugestao de criacao e obrigatoria
- Formato tabular para facil leitura
- Incluir contagem real de agentes e tasks (nao assumir)
