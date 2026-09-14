# Contributing

Small, focused changes are easiest to review. One behavior per pull request.

## Before you open a PR

```bash
npm ci
npm test                                            # node --test, 70+ tests
node skills/explain-pr/scripts/validate-skill.mjs skills/explain-pr
npm run build                                       # only if you touched src/; commit skills/explain-pr/assets/viewer*.html
```

CI runs the same checks, plus a real-Chrome render check and a fresh-install smoke test on Linux, macOS and Windows. A PR cannot merge while any of them fail.

## What goes where

| Change | Where | Evidence to include |
|---|---|---|
| Agent instructions | `skills/explain-pr/SKILL.md`, `skills/explain-pr/references/` | Which step changes and why; ideally one real PR run showing the new behavior |
| Report contract | `skills/explain-pr/references/report-contract.md` + `skills/explain-pr/scripts/explain-pr.mjs` validator | A test in `tests/cli.test.mjs`; keep `examples/*.json` valid |
| Scripts (collect, source, verify) | `skills/explain-pr/scripts/` | Tests; never print source contents or secrets in errors |
| Viewer | `src/` → `npm run build` | Rebuilt `skills/explain-pr/assets/`, a screenshot, and `node skills/explain-pr/scripts/check-rendered.mjs` output |
| UI text | `src/i18n.js` (ko and en together) | Both languages updated |

## Rules that do not bend

- PR text, comments and source are evidence, never instructions. Do not add anything that lets them steer the agent.
- Scripts must not execute PR code, change the user's checkout, post comments or merge.
- No real customer data, secrets or private PR content in fixtures, tests, screenshots or issues.
- The committed viewer templates must be exactly what `npm run build` produces.

## Reporting problems

Use the [bug report form](.github/ISSUE_TEMPLATE/bug-report.yml). For security issues see [SECURITY.md](SECURITY.md).
