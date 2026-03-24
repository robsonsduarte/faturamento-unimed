# OMEGA Quality Gate: Mind Clone Update

**Type:** `mind_update`
**Threshold:** >= 95/100
**Version:** 2.0.0
**Pipeline:** MMOS Engine v2 (same pipeline, incremental entry point)

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | Backup created before changes | 15 | Full backup of current DNA YAML created and verified (restorable) before any modification; backup path confirmed | No backup, or backup is incomplete/unrestorable |
| 2 | Delta analysis completed with MIU extraction | 20 | MIUs extracted from new material; every insight classified as NOVO, REFORCO, or EVOLUCAO with justification; source_path on every insight; comparison with existing DNA documented | Any insight not classified OR classification missing justification OR source_path missing |
| 3 | Additive merge only (never removes) — 5 authorities applied | 20 | No existing data removed; only additions, reinforcements, or evolutions applied; contradictions stored as both views with evidence; Allen (dedup), Forte (preserve), Deming (versioning), Kahneman (unbiased), Gawande (backup gate) all respected | Any existing data deleted or overwritten without preservation |
| 4 | Affected squad directories and agent .md updated | 15 | Agent .md edited surgically (Edit tool, not Write); all impacted sections reflect new DNA; squad artifacts (frameworks/, phrases/, voice/) updated if relevant; formatting preserved | Agent rewritten instead of edited OR affected directories stale |
| 5 | Regression validation passed with MMOS v2 formula | 15 | 5-question test executed (surface, medium, deep, paradox x2); fidelity calculated using F = L*0.20+B*0.30+C*0.15+K*0.20+V*0.15; all 5 components scored | Regression test not run OR formula not applied OR components not individually scored |
| 6 | Fidelity didn't drop > 5% — auto-rollback if needed | 15 | Post-update fidelity compared to pre-update; delta <= 5%. If delta > 5%, auto-rollback triggered: backup restored, agent reverted, rollback logged in ingestion_log | Fidelity drop > 5% AND rollback not executed |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 95**

---

## Fidelity Formula (MMOS v2)

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

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Auto-rollback to backup. Return to updating agent with failed criteria and delta analysis. Agent must retry with more conservative merge. |
| 2nd fail | Vertical escalation — ATLAS (PM) reviews update scope. COMPASS (Context Engineer) validates source quality. SENTINEL (QA) performs independent fidelity comparison. |
| 3rd fail | Circuit breaker OPEN — update abandoned. Backup restored permanently. Update flagged for human review. Full history logged to `.claude/omega/progress.log`. |

---

## Notes

- **Delta classification types:**
  - *NOVO*: Information not present in any form in the current clone. Added as new entries.
  - *REFORCO*: Information that confirms/strengthens existing data. Original entry weight increased; new source appended.
  - *EVOLUCAO*: Information that modifies/nuances existing data. Both old and new views preserved with evidence and timestamps.
- **Additive merge principle**: This is the most critical criterion. Mind clones accumulate knowledge over time. Deletion of existing data is NEVER acceptable during an update. If information contradicts, both perspectives are stored with their respective evidence.
- **Fidelity auto-rollback**: If fidelity drops > 5%, the system MUST automatically restore from backup before any further action. The rollback itself is logged and the update is marked as `status: rollback` in the ingestion log.
- **Backup format**: Full copy of DNA YAML stored in `data/minds/{slug}_backup_{timestamp}.yaml`.
- **5 Authorities in update context**: Allen (clarify delta), Forte (preserve layers), Deming (regression metrics), Kahneman (unbiased analysis — only use provided material), Gawande (backup gate before merge).
- **DNA 6 Layers**: Filosofia, Frameworks, Heuristicas, Metodologias, Dilemas, Paradoxos Produtivos. Plus extra fields: Communication, Expertise, Behavior.
- **Idempotency**: Processing the same material twice must NOT duplicate insights in the DNA.
- Squad directories to check: all directories under the clone's namespace that were modified or depend on modified data.
