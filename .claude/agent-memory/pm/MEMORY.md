# PM (ATLAS) — Memoria Persistente

## Sessoes

- [2026-02-24] init: Primeira ativacao do PM. Projeto com MVP ~90% funcional em producao.
- [2026-02-26] feat: workflow processado/faturado no lote. Delegado a FORGE (backend) + PRISM (frontend). Bug critico corrigido: guias duplicadas em lotes.
- [2026-02-26] fix: toFixed null crash em tiss.ts + XML SAW somente para guias COMPLETAS. Deploy + migration aplicados.

## Estado do Projeto

- 80+ arquivos TypeScript, 27+ API routes, 19 paginas dashboard
- Producao: https://faturamento.consultoriopro.com.br
- VPS Contabo: 157.173.120.60, Docker + Traefik
- Lote status: rascunho → gerado → enviado → aceito → processado → faturado → glosado → pago

## Decisoes

- [2026-02-26] Workflow lote: processado antes de faturado (sequencial obrigatorio)
- [2026-02-26] Propagacao de status lote → guias (exceto CANCELADA)
- [2026-02-26] Guard triplo contra guias duplicadas em lotes: frontend filter + API filter + backend validation
- [2026-02-26] Usar ?? (nullish coalescing) em vez de || para valores monetarios — 0 e valor valido
- [2026-02-26] XML SAW: so persistir saw_xml_data no banco quando guia status === COMPLETA

## Padroes Observados

- git push falha no sandbox Claude Code (SIGBUS signal 10) — usuario deve fazer push no terminal
- Hook post-edit-lint dispara blocking error sem stderr — eslint passa limpo, e falso positivo do hook
- Para features que tocam backend + frontend: delegar a fullstack agent e mais eficiente que split
