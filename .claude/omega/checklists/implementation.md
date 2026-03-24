# OMEGA Quality Gate: Implementation

**Type:** `implementation`
**Threshold:** >= 90/100
**Version:** 1.0.0

---

## Criteria

| # | Criterion | Weight | PASS | FAIL |
|---|-----------|--------|------|------|
| 1 | TypeScript strict (zero `any`) | 15 | No `any` type in codebase; `strict: true` in tsconfig | Any `any` type present or strict mode disabled |
| 2 | Tests pass | 15 | All existing and new tests pass with exit code 0 | Any test failure |
| 3 | Coverage >= 80% | 10 | Line coverage >= 80% for modified/new files | Coverage < 80% for any modified/new file |
| 4 | No security vulnerabilities (OWASP top 10) | 10 | No injection, XSS, CSRF, auth bypass, or other OWASP top 10 patterns detected | Any OWASP top 10 vulnerability pattern found |
| 5 | No hardcoded secrets | 10 | No API keys, tokens, passwords, or credentials in source code | Any secret, key, or credential hardcoded in source |
| 6 | No console.log/debugger | 5 | No `console.log`, `console.debug`, or `debugger` statements (except in designated logging utilities) | Any debug statement outside of logging utilities |
| 7 | No TODO/FIXME without issue ref | 5 | Every `TODO` or `FIXME` comment includes a GitHub issue reference (e.g., `TODO(#123)`) | Any `TODO`/`FIXME` without issue reference |
| 8 | Follows project conventions | 15 | Conventional Commits format; code identifiers in English; communication in Portuguese; file placement matches project structure | Any deviation from documented project conventions |
| 9 | Incremental (Edit > Write) | 15 | Existing files modified via Edit (not rewritten via Write); changes are minimal and targeted | Existing file rewritten entirely via Write without justification |

---

## Scoring Formula

```
score = SUM(criterion_weight * (1 if PASS else 0))
```

Total possible: **100**
Threshold to pass: **>= 90**

---

## Escalation Procedure (on failure)

| Attempt | Action |
|---------|--------|
| 1st fail | Return to same agent with specific failed criteria and code locations. Agent must fix ONLY the failing items. |
| 2nd fail | Horizontal escalation — SENTINEL (QA) performs deep review. If security issue: SPECTER (Security Auditor) engaged. |
| 3rd fail | Circuit breaker OPEN — implementation frozen. ATLAS (PM) decides: rollback to last green state or escalate to human. Log full history to `.claude/omega/progress.log`. |

---

## Notes

- Criterion 1 (zero `any`): `as any` casts also count as violations. Use proper generics or `unknown` instead.
- Criterion 5 (secrets): `.env` files are allowed but must be in `.gitignore`. Hardcoded means literals in `.ts`/`.js` source files.
- Criterion 6 (console.log): Allowed in files explicitly designated as logging utilities (e.g., `src/logger.ts`).
- Criterion 9 (incremental): If Write is used on an existing file, the commit message or PR description MUST include an explicit justification.
- Security checks (criterion 4) should cover at minimum: SQL injection, path traversal, prototype pollution, and unsafe deserialization.
