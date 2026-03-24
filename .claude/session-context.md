# Session Context — Faturamento Unimed

## Estado Atual
- **Milestone:** MVP v1 (sem milestone formal GSD)
- **Fase atual:** Producao estavel — bug fixes aplicados e deployed
- **Status da fase:** deployed + migration aplicada
- **Ultima operacao:** fix toFixed null + XML SAW somente COMPLETAS (2026-02-26)
- **Proximo passo:** Aguardando proxima demanda
- **Bloqueios:** nenhum

## Artefatos Ativos
- **ROADMAP.md:** — (nao existe, projeto sem GSD formal)
- **BLUEPRINT.md:** .planning/BLUEPRINT.md (spec completa do sistema)
- **PLAN.md ativos:** —
- **CONTEXT.md:** —
- **VERIFICATION.md:** —

## Commits da Sessao (2026-02-26)
- `1c98594` feat: workflow processado/faturado no lote com propagacao para guias
- `c580787` fix: impedir guias ja em lote de aparecer na criacao de novo lote
- `4e801c7` fix: propagacao guias via service_role + limitar campos no select do lote
- `4f3880a` fix: null guard em toFixed + XML SAW somente para guias COMPLETAS

## Decisoes Recentes
- [2026-02-26] Lote processado → propaga PROCESSADA para guias (exceto CANCELADA)
- [2026-02-26] Lote faturado → exige processado anterior + numero_fatura obrigatorio → propaga FATURADA
- [2026-02-26] Guias com lote_id != null excluidas da criacao de novo lote (frontend + backend guard)
- [2026-02-26] API retorna guias_atualizadas para feedback na UI (toast com contagem)
- [2026-02-26] toFixed null fix: usar ?? (nullish coalescing) em vez de || para valores monetarios
- [2026-02-26] XML SAW: so persistir saw_xml_data quando guia status === COMPLETA

## Pendencias
- Nenhuma pendencia critica

### 2026-02-24 21:56 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:20 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:22 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:24 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:24 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:27 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:28 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:50 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:54 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 22:56 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 23:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 23:10 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 23:12 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 23:14 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-24 23:20 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 07:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 07:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 08:09 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 08:12 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 08:14 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 08:15 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 08:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:03 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:12 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:35 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:39 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 09:44 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 10:23 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 10:26 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 10:52 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 10:55 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 11:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 11:11 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 12:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 12:06 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 13:35 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 13:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 13:53 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 13:54 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 13:58 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:01 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:03 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:08 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:10 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:10 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:15 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:16 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:17 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:21 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:25 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:26 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:27 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 14:29 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:01 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:03 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:07 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:09 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:22 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:26 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:31 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 15:31 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 16:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:01 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:03 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:09 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:19 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:27 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 17:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 18:31 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 18:41 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 19:07 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 19:28 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 21:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 21:50 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 21:58 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:09 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:17 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:26 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:31 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:32 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 22:37 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 23:08 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-25 23:09 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 02:29 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 04:49 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 09:24 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 09:43 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 09:45 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 11:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 11:35 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 11:37 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 11:46 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 11:48 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:15 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:16 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:22 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:22 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:28 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:34 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 12:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:23 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:35 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:36 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:39 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:44 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:51 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 13:59 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:05 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:20 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:44 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:44 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:46 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 14:48 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:22 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:24 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:24 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:26 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 15:46 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 16:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 16:10 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 16:46 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-02-26 16:52 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 08:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 08:27 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 08:44 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 08:53 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 08:57 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:02 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:08 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:18 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:25 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:33 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:33 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:52 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 09:59 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 10:25 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 10:25 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:00 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:40 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:52 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:52 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 11:59 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook

### 2026-03-24 14:50 — Sessao encerrada automaticamente
- Contexto salvo via DuarteOS hook
