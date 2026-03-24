# OMEGA Quality Gate: Mind Clone Creation

**Type:** `mind_clone`
**Threshold:** >= 95/100
**Version:** 3.0.0
**Pipeline:** MMOS Engine v3 (11 Fases 0-10, 15 Entidades, 5 Autoridades, PCFE Sub-Workflow)

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | Phase 0 — Intake: Canonical slug and dedup | 3 | Slug canonicalized (lowercase, no accents, hyphens); category assigned; `synapse/minds/{slug}.yaml` checked for duplicates; if exists, redirected to mind-update | Slug not canonical OR category missing OR duplicate check skipped |
| 2 | Phase 1 — Research: Source catalog complete | 5 | Catalog compiled with metadata per source (tipo, titulo, url, duracao_estimada, profundidade, primaria, idioma, data_publicacao); minimum 3 sources found; ZERO secondary sources accepted; all rejected sources logged | Catalog missing metadata fields OR < 3 sources OR any secondary source accepted OR rejections not logged |
| 3 | Phase 2 — Rapid Analysis: MIU sample and coverage | 5 | 20-50 MIUs extracted from representative sample (<= 30% of material); each MIU classified by `tipo_semantico` and `camada_dna`; coverage metrics per DNA layer calculated; source diversity in sample | < 20 MIUs OR > 50 MIUs OR MIUs missing classification OR coverage metrics absent |
| 4 | Phase 3 — PCFE: Fidelity estimation validated | 5 | PCFE sub-workflow passes dedicated checklist (`pcfe.md`) with score >= 85; FE calculated with all 5 components (VS, DS, CS, PS, QS); gap report generated for layers with CS < 40%; classification and recommendation assigned | PCFE checklist score < 85 OR any component missing OR gap report incomplete OR classification missing |
| 5 | Phase 4 — Human Gate: Decision registered | 3 | Human decision (APROVAR / ENRIQUECER / ABORTAR) explicitly registered; enrichment loop count <= 3; if ENRIQUECER, new material added and Phases 1-3 re-run; if ABORTAR, pipeline terminated with reason logged | Decision not registered OR loop count > 3 OR enrichment without re-running Phases 1-3 |
| 6 | Phase 5 — Scaffold: Infrastructure created | 4 | 21+ squad directories created; `config.yaml` valid YAML with required fields (name, slug, version, pipeline_version, created_at, fidelity_estimated, status, category); DNA skeleton created from mind-template.yaml; pipeline TASKS created (6 task files); personalized checklist created | < 21 dirs OR config.yaml invalid/missing fields OR DNA skeleton missing OR tasks not created |
| 7 | Phase 6 — Extraction: MIUs and fragments generated | 8 | MIUs extracted with semantic context preserved; fragmentation quality >= 95%; Progressive Summarization layers 1-3 complete; source references on every MIU; estilometria computed | Fragmentation quality < 95% OR layers incomplete OR source references missing OR estilometria missing |
| 8 | Phase 7 — Inference: Drivers with evidence, 3 independent agents | 13 | Drivers calculated from evidence (>= 2 MIUs each); 3 independent agents concordance >= 0.85; predictive accuracy >= 90%; tiers classified (gold/silver/bronze) | Drivers without evidence OR concordance < 0.85 OR accuracy < 90% |
| 9 | Phase 7 — DNA 6 Layers populated | 8 | All 6 DNA layers (Filosofia, Frameworks, Heuristicas, Metodologias, Dilemas, Paradoxos Produtivos) have entries; `source_path` on each entry; >= 2 paradoxos with >= 3 sources each | Any DNA layer empty OR entries missing `source_path` OR < 2 paradoxos |
| 10 | Phase 8 — Mapping: System components scored | 8 | All components have scores; internal consistency >= 95%; mind_system_mappings generated; artifacts/ populated (cognitive, behavioral, linguistic, narrative) | Component coverage < 100% OR consistency < 95% OR artifacts missing |
| 11 | Phase 9 — Profile: Fidelity >= 95% with validation | 13 | Fidelity F >= 95% (formula: L*0.20+B*0.30+C*0.15+K*0.20+V*0.15); no component below 85%; blind test passed; noise audit >= 0.90; pre-mortem documented | F < 95% OR any component < 85% OR blind test failed OR pre-mortem missing |
| 12 | Phase 9 — Calibration: FE vs F comparison | 5 | `delta_estimativa = F - FE` calculated; `accuracy_estimativa = 100 - abs(delta)` calculated; if accuracy < 70%, anomaly flagged for PCFE calibration; results stored in `.claude/omega/pcfe-calibration.yaml` with {slug, FE, F_real, delta, accuracy} | FE vs F comparison not performed OR results not persisted OR anomaly not flagged when accuracy < 70% |
| 13 | Phase 10 — Recommendation: Agent operational | 7 | Agent .md generated with full system prompt; frameworks/, phrases/, voice/ populated; recommended tools and development gaps documented | Agent .md missing OR squad directories empty |
| 14 | Gates Gawande: All kill items passed | 8 | All inter-phase gates (1→2, 6→7, 7→8, 8→9, 9→10) passed with kill items satisfied; no blocking items unresolved | Any kill item failed without resolution |
| 15 | Synapse integration: DNA persisted and indexed | 5 | DNA saved in `.claude/synapse/minds/{slug}.yaml`; `_index.yaml` updated; ingestion log entry created; config.yaml populated with final fidelity score | DNA not persisted OR index not updated |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 95**

---

## Fidelity Formula (MMOS v3)

```
F = (L x 0.20) + (B x 0.30) + (C x 0.15) + (K x 0.20) + (V x 0.15)

L = Linguistic Accuracy    (0-100)
B = Behavioral Fidelity    (0-100) — HIGHEST WEIGHT
C = Contradiction Handling  (0-100)
K = Knowledge/Framework     (0-100)
V = Voice Authenticity      (0-100)

Minimum per component: 85
Minimum composite: 95
```

## Pre-Clone Fidelity Estimation (PCFE)

```
FE = (VS x 0.20) + (DS x 0.15) + (CS x 0.30) + (PS x 0.20) + (QS x 0.15)

VS = Volume Score       (0-100) — quantity of material
DS = Diversity Score    (0-100) — variety of source types
CS = Coverage Score     (0-100) — DNA layer coverage (HIGHEST WEIGHT)
PS = Profundidade Score (0-100) — depth vs superficiality
QS = Quality Score      (0-100) — source reliability

FE >= 85: GO (high probability of F >= 95%)
FE 70-84: GO WITH CAVEATS
FE 55-69: ENRICH (request more sources)
FE 40-54: ENRICH MANDATORY
FE < 40:  ABORT

Dedicated checklist: .claude/omega/checklists/pcfe.md
Calibration data: .claude/omega/pcfe-calibration.yaml
```

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Return to creating agent with specific failed phases. Agent must address ONLY failing phases without regressing passing ones. For Phases 0-5, re-run the specific failing phase. For Phases 6-10, re-run from the failing phase forward. |
| 2nd fail | Vertical escalation — ATLAS (PM) reviews. COMPASS (Context Engineer) audits source quality and PCFE accuracy. SENTINEL (QA) re-runs validation suite. |
| 3rd fail | Circuit breaker OPEN — clone creation frozen. Clone marked as DRAFT (not production-ready). Human review required. Full history logged to `.claude/omega/progress.log`. |

---

## Notes

- **Primary sources** = content authored/spoken by the person being cloned (their books, their talks, their interviews).
- **DNA 6 Layers** (Synapse v3 / MMOS v3):
  1. *Filosofia*: Core beliefs, worldview, first principles.
  2. *Frameworks*: Mental models, decision-making structures, step-by-step processes.
  3. *Heuristicas*: Rules of thumb, shortcuts, practical wisdom, red flags.
  4. *Metodologias*: Repeatable processes, formal systems, tools.
  5. *Dilemas*: Known tensions, contradictions, unresolved questions, position evolution.
  6. *Paradoxos Produtivos*: Internal contradictions that coexist and generate value (GOLD LAYER — 35% of fidelity).
- **Pipeline v3 phases**: 0=Intake, 1=Research, 2=Rapid Analysis, 3=PCFE, 4=Human Gate, 5=Scaffold, 6=Extraction, 7=Inference, 8=Mapping, 9=Profile, 10=Recommendation.
- **PCFE** = Pre-Clone Fidelity Estimation. Dedicated checklist at `.claude/omega/checklists/pcfe.md`. Runs as a planning task (threshold >= 85).
- **Human Gate (Phase 4)** = Only phase requiring explicit human decision. Options: APROVAR (proceed), ENRIQUECER (loop back to Phase 1, max 3 loops), ABORTAR (terminate pipeline).
- **Calibration (Phase 9)** = FE vs F comparison. Stored in `.claude/omega/pcfe-calibration.yaml`. Anomaly flagged if `accuracy_estimativa < 70%`.
- **5 Authorities**: Allen (GTD workflow), Forte (CODE memory), Deming (PDSA quality), Kahneman (anti-bias), Gawande (DO-CONFIRM gates).
- **15 Entities**: contents, mius, fragments, drivers, mind_drivers, miu_driver_evidence, driver_relationships, mapping_systems, system_components, component_driver_map, mind_component_scores, mind_system_mappings, minds, mind_tools, tools (+tool_driver_affinities, tool_relations).
- **Gates Gawande**: 5 inter-phase gates — 1->2 (post-research), 6->7 (post-extraction), 7->8 (post-inference), 8->9 (post-mapping), 9->10 (post-profile). Each gate has kill items that must pass.
- **Agent signature** format: `<!-- OMEGA:agent={agent_name} phase={phase} timestamp={ISO8601} -->` or equivalent metadata block.
- A clone that fails 3x is tagged `status: draft` in its metadata and excluded from production use until human review clears it.
