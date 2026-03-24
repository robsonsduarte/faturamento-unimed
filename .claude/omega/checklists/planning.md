# OMEGA Quality Gate: Planning

**Type:** `planning`
**Threshold:** >= 85/100
**Version:** 1.0.0

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | Clear objective stated | 15 | Single, unambiguous objective with measurable outcome defined | Objective missing, vague, or contains multiple conflicting goals |
| 2 | Tasks are atomic and verifiable | 15 | Every task has a single deliverable and a clear "done" definition | Any task is compound (multiple deliverables) or lacks verification method |
| 3 | Dependencies mapped | 15 | All inter-task dependencies explicitly declared (blockedBy/blocks) | Any implicit dependency not declared, or circular dependencies present |
| 4 | Risks identified | 15 | >= 3 risks listed with likelihood, impact, and mitigation strategy each | < 3 risks OR any risk missing likelihood/impact/mitigation |
| 5 | Rollback procedure defined | 10 | For every destructive/irreversible step, a rollback or undo path is documented | Any destructive step without rollback documentation |
| 6 | Success criteria defined | 15 | Quantitative criteria (numbers, thresholds, metrics) that determine plan completion | Criteria are qualitative-only ("looks good") or missing entirely |
| 7 | Estimation reasonable | 15 | Each task has a time/effort estimate; total aligns with scope and available resources | No estimates, or total estimate is unrealistic (< 50% or > 200% of likely effort) |

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
| 1st fail | Return to same agent with specific failed criteria highlighted. Agent must refine ONLY the failing items. |
| 2nd fail | Vertical escalation — ATLAS (PM) re-scopes the plan. NEXUS (Architect) validates technical feasibility. |
| 3rd fail | Circuit breaker OPEN — plan frozen. Human review required. Log full history to `.claude/omega/progress.log`. |

---

## Notes

- "Atomic task" = can be completed by a single agent in a single work session without further decomposition.
- Dependencies must form a DAG (directed acyclic graph) — cycles are always FAIL.
- Rollback is especially critical for data migrations, file deletions, and config changes.
- Estimations should use T-shirt sizes (S/M/L/XL) or time ranges, never single-point estimates.
