# OMEGA Quality Gate: Research

**Type:** `research`
**Threshold:** >= 80/100
**Version:** 1.0.0

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | Minimum sources count | 15 | >= 10 distinct sources cited | < 10 sources or sources not individually identifiable |
| 2 | Source diversity | 15 | >= 3 source types (books, interviews, articles, talks, podcasts, papers) | < 3 source types |
| 3 | Primary sources ratio | 15 | >= 40% of sources are primary (original works, interviews, official docs) | < 40% primary sources |
| 4 | Triangulation per topic | 15 | Every major claim backed by >= 3 independent sources | Any major claim with < 3 independent sources |
| 5 | Citation quality | 15 | All sources have author, date, and locator (URL/ISBN/DOI) | Any source missing author OR date OR locator |
| 6 | No hallucinated data | 15 | Every fact traceable to a cited source; no fabricated quotes, dates, or statistics | Any fact that cannot be traced or is fabricated |
| 7 | Coverage completeness | 10 | All subtopics defined in the research brief are addressed | Any subtopic from the brief left unaddressed |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 80**

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Return to same agent with specific failed criteria highlighted. Agent must address ONLY the failing items. |
| 2nd fail | Vertical escalation — ATLAS (PM) reviews scope and assigns COMPASS (Context Engineer) to assist with source gaps. |
| 3rd fail | Circuit breaker OPEN — task frozen. Human review required. Log full history to `.claude/omega/progress.log`. |

---

## Notes

- "Primary source" = content authored/spoken by the subject themselves (books, interviews, official talks).
- "Secondary source" = analysis, summaries, or commentary by third parties.
- Triangulation requires sources to be **independent** (different authors, different publications).
- Hallucination check is binary: a single fabricated fact means FAIL on criterion 6.
