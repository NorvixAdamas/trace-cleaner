# Humanize 3.0 — Testing

## Commands and last real results

Run on 2026-11-21, Windows, Node 26, repository working tree with uncommitted 3.0 changes.

| Command | Result |
|---|---|
| `npm test` | **352 tests, 352 pass, 0 fail** |
| `npx playwright test` | **7 passed** (Chrome extension + web rewrite + language switch) |
| `node tools/sync_assets.js --check` | artifact khớp nguồn |
| `python tools/sync_core.py --check` | extension/core khớp packages/core |
| `python tools/build_guide.py --check` | index.html guide khớp |
| `node tools/check_extension.js` | `manifest OK · v3.0.0 · 4 permission` |
| `node tools/eval_writing.js --check` | dev 20/20, held-out 10/10, docs khớp |
| `node tools/bench_writing.js` | writes `docs/HUMANIZE_3_BENCHMARKS.md` |

Playwright was re-run after the final bundle sync: 7/7 passed. The new review
insights/filter panel and Custom Voice editor are not covered by E2E; they are
source/contract-tested only and should be checked manually before release.

## New 3.0 tests

`tests/writing-engine.test.js` (22 tests) plus 2 prompt parity tests:

- integrated analysis and revision hashing;
- stale suggestion rejection and preservation status after apply;
- blocking a change that drops negation;
- numbers, names, citations, lists, conditions, qualifiers, modals;
- contraction equivalence;
- direct-quotation protection;
- readability sentence/paragraph splitting and Flesch language policy;
- clarity rules and protected code/URL;
- rewrite modes grammar/concise/academic/conversational;
- 12 canonical mode contracts and custom voice prompt;
- document abbreviations, repeated sentences and numeric claims;
- empty/Markdown/code/nested-list inputs and mixed Vietnamese/English.

Existing suites continue to cover:

- grammar en/vi, false positives, Unicode offsets, list preservation;
- consistency terminology/date/number/unit/quote;
- document sessions, stale proposals, undo/redo/restore;
- providers timeout/cancel/error normalization;
- cleaning, Markdown, preservation, parity, ZIP/XML/OOXML/PDF/C2PA;
- generated artifact synchronization and prompt contract.

## Coverage gaps (not counted as passes)

- **No dedicated E2E for the new review insights/filter UI.** The existing web
  E2E covers rewrite proposal flow, not the review tab's readability panel.
- **No custom-voice UI test** because the UI control does not exist yet; only
  `buildPrompt('custom', { customVoice })` is tested.
- **No live provider test** — no API key available. Deterministic provider
  tests only.
- **No 400-case independent evaluation** — 36 self-authored cases only.
- **No full Vietnamese grammar test corpus** — only the implemented
  deterministic typo/spacing/repetition rules.
- **No performance regression threshold** — benchmark is recorded, not asserted;
  machine variance makes a hard threshold unreliable.
- **No worker stress test** for multi-megabyte pasted text.
- **No real-user acceptance test** for suggestion acceptance rate.

## Determinism

Writing analysis and deterministic rewrite are pure functions of input text.
The only non-deterministic values are timestamps in benchmarks and ID generation
in `DocumentSession`. Tests avoid asserting timestamps or random IDs.
