# OMEGA Quality Gate: Validation

**Type:** `validation`
**Threshold:** >= 95/100
**Version:** 1.0.0

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | All test categories covered | 20 | For mind clones: surface, medium, deep, and paradox categories all present. For code: unit, integration, and edge-case categories all present. | Any required test category missing |
| 2 | Ground truth comparison | 15 | When ground truth data exists, results are compared against it with documented deltas | Ground truth available but not used, or comparison not documented |
| 3 | Score calculation documented | 15 | Scoring methodology is explicit: formula, weights, and thresholds are written in the test output | Score appears without explanation of how it was calculated |
| 4 | Edge cases tested | 20 | >= 5 edge cases identified and tested (empty input, max values, unicode, concurrent access, malformed data) | < 5 edge cases OR obvious edge cases untested |
| 5 | Regression check passed | 15 | All previously passing tests still pass; no existing functionality broken | Any previously passing test now fails |
| 6 | Results reproducible | 15 | Running the same validation twice produces consistent results (within documented tolerance for stochastic tests) | Results vary beyond documented tolerance, or no tolerance documented for stochastic tests |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 95**

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Return to same agent (SENTINEL) with specific failed criteria. Must add missing tests or fix reproducibility. |
| 2nd fail | Vertical escalation — ATLAS (PM) reviews test scope. If mind clone: original clone creator re-validates. |
| 3rd fail | Circuit breaker OPEN — validation frozen. Human review required. All test artifacts preserved in `.claude/omega/progress.log`. |

---

## Notes

- **Mind clone test categories:**
  - *Surface*: Basic identity checks (name, role, key quotes).
  - *Medium*: Framework application (can the clone apply its own frameworks correctly?).
  - *Deep*: Reasoning under ambiguity (novel scenarios the real person hasn't explicitly addressed).
  - *Paradox*: Contradictory scenarios testing internal consistency and graceful handling.
- **Reproducibility tolerance**: For LLM-based tests, document acceptable variance (e.g., "score may vary +/- 3 points"). Tests with > 5% variance must be flagged.
- **Edge cases** must be domain-appropriate. For mind clones: empty prompt, language mismatch, topic outside expertise. For code: boundary values, null inputs, concurrent mutations.
- Ground truth comparison is N/A only if explicitly documented as "no ground truth available" with justification.
