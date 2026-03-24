# Squad: Executar Squad

Executa um squad em uma demanda especifica com orquestracao completa de agentes e tasks.

**Modo:** Orquestrado — PM coordena agentes conforme dependencias

## Argumentos

$ARGUMENTS — formato: `{nome-do-squad} "descricao da demanda"` (ambos obrigatorios)

## Instrucoes

Voce vai carregar, configurar e executar um squad completo. Siga este fluxo:

### PASSO 1: Parsear Argumentos

1. Extraia o nome do squad e a descricao da demanda de `$ARGUMENTS`
   - Primeira palavra = nome do squad
   - Restante = demanda (pode estar entre aspas ou nao)
2. Se faltar algum, pergunte ao usuario
3. Verifique se `squads/{nome}/squad.yaml` existe
   - Se NAO: liste squads disponiveis com `/DUARTEOS:squad:list-squads` e pergunte qual usar

### PASSO 2: Carregar Configuracao

1. Leia `squads/{nome}/squad.yaml` completo
2. Carregue cada agente:
   - Agentes proprios: leia `squads/{nome}/agents/{id}.md` para cada agente listado
   - Agentes herdados (`inherit_agents`): leia `.claude/commands/agents/{id}.md`
   - Se um arquivo de agente nao existir → ERRO, informe e sugira correcao
3. Carregue tasks relevantes de `squads/{nome}/tasks/`
4. Leia configs adicionais se existirem:
   - `squads/{nome}/config/coding-standards.md`
   - `squads/{nome}/config/tech-stack.md`

### PASSO 3: Montar Contexto

1. Identifique o agente com `role: orchestrator` — este e o lider
   - Se nenhum tiver role orchestrator, use o primeiro agente como lider
2. Carregue contexto do projeto:
   - `.planning/PROJECT.md` (se existir)
   - `.planning/STATE.md` (se existir)
   - `.planning/ROADMAP.md` (se existir)
3. Se o squad tem `hooks.pre_task`, registre para execucao

### PASSO 4: Criar Plano de Execucao

O lider analisa a demanda e cria um plano:

1. Interpretar a demanda do usuario
2. Quebrar em tasks atomicas
3. Atribuir cada task a um agente com base em suas responsabilidades
4. Definir dependencias entre tasks (qual precisa rodar antes de qual)
5. Agrupar em waves (tasks sem dependencia entre si rodam na mesma wave)

Formato do plano:

```
## Plano de Execucao

Demanda: "{demanda}"
Squad: {nome}
Agentes: {lista}

### Wave 1 (paralelo)
- [ ] Task 1: {descricao} → agente: {id}
- [ ] Task 2: {descricao} → agente: {id}

### Wave 2 (depende de Wave 1)
- [ ] Task 3: {descricao} → agente: {id} (depende: Task 1)
- [ ] Task 4: {descricao} → agente: {id} (depende: Task 1, Task 2)

### Wave 3 (depende de Wave 2)
- [ ] Task 5: {descricao} → agente: {id} (depende: Task 3)
```

6. Mostrar plano ao usuario e pedir confirmacao
   - Se `config.parallel: false`, todas as tasks rodam sequencialmente (1 wave grande)

### PASSO 5: Executar

Para cada wave, na ordem:

1. **Pre-task hook:** Se configurado, executar `hooks.pre_task`
2. **Spawnar agentes:** Cada agente recebe:
   - Seu arquivo de definicao (system prompt, regras, responsabilidades)
   - A task atribuida com contexto completo
   - Referencia a artifacts das tasks anteriores (se houver dependencia)
3. **Executar task:** O agente implementa a task
   - Cada task gera commits atomicos
   - O agente reporta resultado ao concluir
4. **Post-task hook:** Se configurado, executar `hooks.post_task`
5. **Validar:** Se `config.auto_verify: true`:
   - Rodar `tsc --noEmit` se houver TypeScript
   - Rodar lint se configurado
   - Rodar testes se existirem
   - Se falhar → retry ate `config.max_retries` vezes
6. **Registrar:** Marcar task como concluida no plano

Repetir para cada wave ate todas concluirem.

### PASSO 6: Reportar Resultado

Ao finalizar todas as waves:

1. Se `hooks.on_complete` configurado, executar
2. Gerar relatorio:

```
## Resultado da Execucao

Squad: {nome}
Demanda: "{demanda}"
Status: CONCLUIDO | PARCIAL | FALHOU

### Tasks Executadas
| # | Task | Agente | Status | Commits |
|---|------|--------|--------|---------|
| 1 | {desc} | {id} | OK | abc1234 |
| 2 | {desc} | {id} | OK | def5678 |
| 3 | {desc} | {id} | FALHOU | — |

### Verificacao
- TypeScript: OK/FALHOU
- Lint: OK/FALHOU
- Testes: OK/FALHOU ({N} passando, {M} falhando)

### Artefatos Gerados
- {lista de arquivos criados/modificados}

### Proximos Passos
- {sugestoes baseadas no resultado}
```

3. Salvar relatorio em `squads/{nome}/runs/{timestamp}-{slug}.md`

## Flags

- `--auto` — executa sem pedir confirmacao do plano
- `--dry-run` — gera plano mas nao executa (para revisar)
- `--verbose` — mostra output detalhado de cada agente

## Exemplos

```
/DUARTEOS:squad:run-squad meu-saas "implementar sistema de notificacoes push"
/DUARTEOS:squad:run-squad data-pipeline "criar ETL para importar dados do CRM"
/DUARTEOS:squad:run-squad --auto landing-pages "criar landing page para produto X"
/DUARTEOS:squad:run-squad --dry-run meu-saas "refatorar modulo de pagamentos"
```

## Regras

1. Nunca executar sem plano aprovado (exceto com --auto)
2. Cada task gera pelo menos 1 commit atomico
3. Se uma task falhar apos max_retries → marcar como FALHOU e continuar (nao bloquear o squad inteiro)
4. Tasks dependentes de uma task FALHOU sao automaticamente marcadas como PULADA
5. O relatorio final e obrigatorio — sempre gerar
6. Respeitar as regras e limitacoes de cada agente conforme definido em seu .md
7. Agentes herdados tem as mesmas permissoes que agentes proprios

## Hierarquia: Orchestrator do Squad vs ATLAS (PM)

O agente com `role: orchestrator` dentro do squad **NAO e um PM paralelo**. Ele opera DENTRO da autoridade do ATLAS (PM global).

### Escopo do orchestrator do squad
- Coordenar execucao de tasks DENTRO do escopo do squad
- Distribuir tasks entre agentes do squad conforme suas responsabilidades
- Monitorar progresso e reportar resultado

### Escalacao obrigatoria ao ATLAS
O orchestrator do squad DEVE escalar ao ATLAS (PM) quando:
- Encontrar **bloqueio** que impede o progresso do squad
- Houver **conflito entre agentes** que nao se resolve no escopo do squad
- A decisao envolver **estrategia do projeto** (prioridades, escopo, arquitetura global)
- A demanda **ultrapassar o escopo** do squad e afetar outros modulos do projeto

### Regra de ouro
> Decisoes que afetam o projeto como um todo pertencem ao ATLAS.
> O orchestrator do squad coordena execucao local. O ATLAS coordena o projeto.
