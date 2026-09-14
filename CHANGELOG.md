# Changelog

## 2.1.0 — 2026-09-14

- Lite viewer (flowchart only, ~50 KB) is the default; `with 3d` renders the full viewer with the 3D follow mode.
- English UI: viewer strings follow the report's `lang` (`ko`/`en`); `render --lang` is embedded into the data.
- `source` subcommand reads numbered line ranges at the pinned commit; `collect` splits the diff per file with a coverage budget and cross-checks counts against PR metadata.
- `verify-sources` checks excerpts and classifies errors (auth / missing / range / excerpt).
- README in English and Korean; CI (validation, tests on Node 20/22/24, viewer sync, real-Chrome render check, 3-OS install smoke); release workflow attaching a runtime-only archive.

## 2.0.0 — 2026-09-10

- First shared version: 7-step workflow, report contract, compiled offline 3D viewer.
