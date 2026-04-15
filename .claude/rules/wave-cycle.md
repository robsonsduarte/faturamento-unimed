---
paths:
  - "docs/stories/**"
  - "docs/**"
---

# Wave Cycle — DUOS Development Flow

## Modo de Operacao: AUTONOMO

O DUOS executa o ciclo completo automaticamente.

## Ciclo Principal

```
Plan → Build → Check → Ship
```

### Plan — Planejar
- Analisa o pedido, decompoe em tarefas, define abordagem

### Build — Implementar
- Implementa codigo com quality gates inline (lint, typecheck, test)

### Check — Auditar (obrigatorio)
- Code review, AC, regressoes, seguranca, performance
- Verdicts: PASS | CONCERNS | FAIL (volta para Build, max 3x)

### Ship — Entregar
- Commit automatico. Push/PR so quando o usuario pedir.

## Cerimonia Adaptativa

| Complexidade | Fases |
|---|---|
| Trivial | Build → Check → Ship |
| Standard | Plan → Build → Check → Ship |
| Complex | Plan + @fowler → Build → Check rigoroso → Ship |
