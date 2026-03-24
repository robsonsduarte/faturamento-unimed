# OMEGA Quality Gate: PCFE (Pre-Clone Fidelity Estimation)

**Type:** `planning`
**Threshold:** >= 85/100
**Version:** 1.0.0
**Pipeline:** MMOS Engine v3 — Phase 3 Sub-Workflow

---

## Pre-Conditions

Before running the PCFE checklist, the following MUST be satisfied:

| # | Pre-Condition | How to Verify |
|---|---------------|---------------|
| P1 | Source catalog exists with >= 1 fonte primaria | Catalog YAML generated in Phase 1 with at least 1 entry where `primaria: true` |
| P2 | MIU sample extracted (20-50 MIUs) | Phase 2 output contains between 20 and 50 MIUs with semantic classification |
| P3 | Each MIU mapped to a DNA layer | Every MIU in sample has a non-null `camada_dna` field |
| P4 | Coverage metrics calculated | Per-layer MIU counts and coverage percentages available |

If ANY pre-condition fails, the PCFE sub-workflow MUST NOT proceed. Return to the failing phase.

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | VS (Volume Score) calculated correctly | 15 | Score derived from source count lookup table; bonuses for books (+5 each, max +15) and long interviews (+3 each, max +9) applied; final capped at 100 | Score not matching lookup table OR bonuses miscalculated OR exceeds 100 |
| 2 | DS (Diversity Score) calculated correctly | 10 | Each source type checked for presence; points assigned per type (livros=15, videos=15, entrevistas=15, artigos=15, tweets=10, palestras=10, idiomas=10, span=10); sum capped at 100 | Any type presence check missing OR points not matching schema OR sum > 100 uncapped |
| 3 | CS (Coverage Score) calculated correctly | 20 | All 10 DNA layers evaluated; MIU count mapped to coverage (0=0%, 1-2=40%, 3-5=70%, 6+=100%); weighted by layer relative_weight; paradoxos_produtivos has weight 0.15 (highest single layer) | Any layer missing from evaluation OR wrong MIU-to-coverage mapping OR wrong weights |
| 4 | PS (Profundidade Score) calculated correctly | 10 | All 7 criteria evaluated; bonus (+10 for long interviews) and penalty (-20 if >70% tweets) applied; final clamped to [0, 100] | Criteria not fully evaluated OR bonus/penalty not applied OR score outside [0, 100] |
| 5 | QS (Quality Score) calculated correctly | 10 | All 7 quality criteria evaluated; mutual exclusion respected (100% primarias vs 90% primarias); sum capped at 100 | Criteria missing OR both pct_100 and pct_90 scored simultaneously OR sum > 100 |
| 6 | FE formula correct | 15 | FE = VS*0.20 + DS*0.15 + CS*0.30 + PS*0.20 + QS*0.15; weights sum to 1.00; arithmetic verified | Wrong weights OR weights don't sum to 1.00 OR arithmetic error |
| 7 | Gap report complete | 10 | Every DNA layer with CS < 40% has a gap entry with: camada, cobertura (%), impacto (CRITICO/MODERADO/BAIXO), and actionable recomendacao | Any layer below 40% missing from gaps OR gap entry missing required fields |
| 8 | Classification and recommendation correct | 10 | FE mapped to correct classification (>=85=EXCELENTE, 70-84=BOM, 55-69=MODERADO, 40-54=FRACO, <40=INSUFICIENTE) and matching recommendation (GO / GO COM RESSALVAS / ENRIQUECER / ENRIQUECER OBRIGATORIO / ABORTAR) | Classification does not match FE range OR recommendation mismatched |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 85**

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Return to estimating agent with specific failed criteria highlighted. Agent must fix ONLY the failing components without changing passing ones. |
| 2nd fail | Vertical escalation — ATLAS (PM) reviews. COMPASS (Context Engineer) re-validates source catalog quality and MIU sample representativeness. |
| 3rd fail | Circuit breaker OPEN — PCFE estimation frozen. Human review required. Present partial results with explicit warning about unreliable estimation. Log full history to `.claude/omega/progress.log`. |

---

## Notes

- **PCFE is a planning task, NOT a mind_clone task.** It estimates fidelity from material metadata — it does NOT produce the actual clone DNA.
- **CS has the highest weight (20 of 100 in this checklist, 30% in the FE formula)** because DNA layer coverage is the strongest predictor of real fidelity.
- **Mutual exclusion rules:**
  - VS bonus: `bonus_livros` counts each book once (max 3 books = +15). `bonus_entrevistas` counts each interview >60min once (max 3 = +9).
  - DS: Each source type is binary (present or not). No partial credit.
  - PS: `gte_3_profundas` (30pts) and `gte_1_profunda` (15pts) are mutually exclusive — use the higher-scoring one that applies.
  - QS: `pct_100_primarias` (25pts) and `pct_90_primarias` (15pts) are mutually exclusive.
- **FE range mapping to real fidelity:**
  - `F_min = FE * 0.85` (worst case)
  - `F_provavel = FE * 0.95` (typical case)
  - `F_max = min(FE * 1.10, 100)` (best case, capped)
- **Enrichment loop:** If human chooses ENRIQUECER at the gate, the pipeline loops back to Phase 1 with new material. PCFE is re-run with the expanded catalog. Maximum 3 enrichment loops.
- **Calibration:** After clone completion (Phase 9), FE vs F_real is compared and stored in `.claude/omega/pcfe-calibration.yaml` for future weight tuning.
