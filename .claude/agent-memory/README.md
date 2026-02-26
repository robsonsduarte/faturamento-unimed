# Agent Memory — Memoria Persistente por Agente

Sistema de memoria individual dos agentes do DuarteOS.

## Estrutura

```
.claude/agent-memory/
  {agent-id}/MEMORY.md     — memoria individual do agente
  _global/PATTERNS.md      — padroes promovidos (confirmados por 3+ agentes)
  _meta/promotion-log.md   — historico de promocoes
```

## Como Funciona

### Memoria Individual
Cada agente mantem um arquivo `MEMORY.md` no seu diretorio.
O agente DEVE ler seu MEMORY.md no inicio de cada sessao.
O agente DEVE atualizar seu MEMORY.md ao aprender algo novo.

### Promocao de Padroes
Quando 3+ agentes registram o mesmo padrao → promove para `_global/PATTERNS.md`.
Padroes globais sao lidos por TODOS os agentes no inicio da sessao.

### O Que Memorizar
- Padroes do projeto (arquitetura, convencoes, decisoes)
- Erros recorrentes e como evitar
- Preferencias do usuario
- Decisoes tomadas e por que
- Coisas que funcionaram bem
- Coisas que nao funcionaram

### Formato do MEMORY.md

```markdown
# Memoria: {Agent Name}

## Padroes Aprendidos
- [data] padrao: descricao

## Decisoes Registradas
- [data] decisao: descricao | motivo: por que

## Erros Conhecidos
- [data] erro: descricao | solucao: como evitar

## Preferencias do Usuario
- [data] preferencia: descricao

## Notas
- [data] nota livre
```
