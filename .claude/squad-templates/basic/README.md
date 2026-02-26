# Squad: Basic

Squad minimo viavel — 1 lead + 1 executor.

## Agentes

| Agente | Role | Funcao |
|--------|------|--------|
| lead | orchestrator | Recebe demandas, cria plano, delega e valida |
| executor | executor | Implementa tarefas e reporta resultado |

## Quando Usar

- Projetos simples ou em fase inicial
- Tarefas que nao precisam de especializacao
- Prototipagem rapida
- Quando voce quer o minimo de overhead

## Como Funciona

1. Lead recebe a demanda do usuario
2. Lead quebra em tarefas e delega ao executor
3. Executor implementa e reporta
4. Lead valida e entrega resultado

## Como Customizar

- Adicione mais agentes editando `squad.yaml`
- Crie novos templates de task em `tasks/`
- Ajuste regras dos agentes em `agents/*.md`
- Mude `parallel: true` se quiser execucao paralela
