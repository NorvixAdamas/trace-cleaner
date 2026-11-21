# Trace Cleaner 3.0 — Humanize Intelligence release report

Date: 2026-11-21 · Base commit: `c82c75143b458948e2000a359962f72773c016a8`
Branch: `main` · Working tree: **25 modified + 15 untracked paths, not committed**
(no commit/push was requested or authorized).

## 1. Original architecture audit

Full findings with reproductions are in `docs/HUMANIZE_3_AUDIT.md`. Summary:

- One hardened core already existed; writing was a deterministic proofreader with
  no document orchestrator, readability, or semantic-status schema.
- Suggestions had no revision; a stale suggestion could be applied if offsets
  happened to coincide.
- Grammar and clarity rules edited text inside direct quotations.
- Prompt registry had 9 modes; the directive requires 12 canonical modes, and the
  web/extension lists had drifted.
- Evaluation had 30 self-authored labels, no F1/FPR/FNR or entity metrics.
- Provider live calls, full Vietnamese grammar, worker isolation and independent
  corpora were already known gaps from 2.3.1 and remain gaps.

## 2. Discovered defects

| Severity | Defect | Status |
|---|---|---|
| Critical | Stale suggestions had no revision guard | Fixed |
| Critical | Direct quotations could be auto-corrected | Fixed |
| High | 9 modes instead of 12; web/extension drift | Fixed |
| High | No security boundary for document prompt injection | Fixed |
| High | Document suggestions missing from main analysis | Fixed |
| High | `currentMode()` fell back to removed `general` mode | Fixed |
| Medium | Throwing rule was silently swallowed | Fixed (reported) |
| Medium | Evaluation lacked F1/FPR/FNR/entity metrics | Fixed |
| High | Only 36 self-authored eval cases | **Blocked** |
| High | Vietnamese grammar coverage is partial | **Partial** |
| Medium | No writing benchmark | Fixed |
| Medium | Review UI lacked insights/filter | Fixed |
| Medium | Live provider unverified | **Blocked** |

## 3. Files changed

Modified: `README.md`, `docs/ROADMAP.md`, `docs/WRITING_EVAL.md`,
`extension/core/{bundle,prompts}.js`, `extension/manifest.json`,
`extension/sidebar.js`, `index.html`, `package{,-lock}.json`,
`packages/core/cleaning.js`, `packages/writing/{evaluation,index,prompts,suggestions}.js`,
`packages/writing/grammar/index.js`, `tools/sync_assets.js`,
`tests/{assets-sync,e2e/extension,extension-background,web-core-adapter,writing-prompts}.*`.

New: `packages/writing/analyze.js`, `packages/writing/engine/{readability,clarity,
preserve,document,rewrite}.js`, `packages/writing/modes/index.js`,
`packages/writing/shared/{schema,normalization}.js`, `tests/writing-engine.test.js`,
`tools/bench_writing.js`, and the eight `docs/HUMANIZE_3_*.md` files
(this report included).

## 4. New modules

- `analyze.js` — canonical `analyzeWriting` / `applyWritingSuggestion(s)`.
- `engine/readability.js` — metrics + observations, no automatic rewriting.
- `engine/clarity.js` — conservative wordy/redundancy suggestions.
- `engine/preserve.js` — semantic-element comparison + status.
- `engine/document.js` — document-level findings.
- `engine/rewrite.js` — mode pipeline + preservation gate.
- `shared/schema.js` — revision hash, normalized suggestion schema, validation.
- `shared/normalization.js` — quotation ranges.

## 5. Removed duplicates

No second writing engine was created. The old direct calls
`TraceWriting.analyze + TraceWriting.analyzeConsistency` in the review UI were
replaced by `TraceWriting.analyzeWriting`. Mode metadata remains single-source in
`prompts.js`; `modes/index.js` is a re-export, not a copy.

## 6. Implemented features

- Integrated analysis: grammar/spelling/punctuation + clarity + consistency +
  document insights + readability.
- Suggestion schema with revision and preservation status; stale rejection.
- `applyWritingSuggestions` refuses to return text that drops numbers, names,
  citations, negations, conditions, qualifiers, modals, list items or structure.
- 12 canonical modes + cover/email, aliases, mode-specific prompt instructions,
  per-mode deterministic operations, custom voice profile support.
- Quotation protection; code/URL/email protection preserved.
- Prompt-injection boundary; hedge and author-position preservation.
- Evaluation metrics: F1, FPR, FNR, entity/number/citation preservation, failure
  rate, latency; acceptance rate explicitly not measured.
- Review UI: readability summary, document insights, category filter.
- Version 3.0.0 across package, manifest, prompt registry, engine and docs.

## 7. Tests added

`tests/writing-engine.test.js` — 22 tests, plus 2 prompt parity tests, covering analysis, stale revisions,
preservation blocking, quotation protection, readability, clarity, rewrite modes,
12-mode contracts, custom voice, document insights and adversarial inputs.
Suite total grew from 328 to **352** (24 new cases, no existing test removed or weakened).

## 8. Test results

| Check | Result |
|---|---|
| `npm test` | **352 pass, 0 fail** |
| `npx playwright test` | **6 pass** |
| `node tools/eval_writing.js --check` | dev 20/20, held-out 10/10, docs match |
| `node tools/sync_assets.js --check` | artifacts match |
| `python tools/sync_core.py --check` | extension/core matches |
| `python tools/build_guide.py --check` | guide matches |
| `node tools/check_extension.js` | manifest OK · v3.0.0 · 4 permissions |

Playwright was run **after** the final bundle sync: 6/6 passed. No E2E covers the
new review insights/filter panel, so that UI is manually inspected only.

## 9. Evaluation metrics

Deterministic regression set (36 cases, 30 labels, self-authored):

| Set | Precision | Recall | F1 | FPR | FNR | Offset |
|---|---|---|---|---|---|---|
| dev | 100% | 100% | 100% | 0% | 0% | 100% |
| held-out | 100% | 100% | 100% | 0% | 0% | 100% |

These are not general-quality numbers. Entity/number/citation metrics are `—`
because the fixtures do not have those fields. Acceptance rate is not measured.
See `docs/HUMANIZE_3_EVALUATION.md`.

## 10. Before/after examples

Input:
`This is a apple. In order to test it, we utilize a very unique tool.`

- Before 3.0: only the `a → an` grammar suggestion (when clarity was not part of
  the report).
- After 3.0: `a → an`, `In order to → To`, `utilize → use`,
  `very unique → unique`, plus readability metrics (2 sentences, 15 words,
  average 7.5 words/sentence, Flesch ~75.1).
- Concise rewrite output: `This is an apple. To test it, we use a unique tool.`
  Preservation status: `preserved`.

Quotation:
`She said "I would of gone" and left.` — before 3.0 the quoted error was
suggested for correction; after 3.0 there are **0** suggestions inside the quote.

Preservation:
`The policy is not optional.` → `The policy is optional.` — status `blocked`,
text is not returned by `applyWritingSuggestions`.

## 11. Performance measurements

Real run, Node 26, Windows, `node tools/bench_writing.js`:

| Words | analyze avg | rewrite avg |
|---|---|---|
| 500 | 1.9 ms | 2.6 ms |
| 1,000 | 3.4 ms | 4.5 ms |
| 3,000 | 12.2 ms | 16.7 ms |
| 5,000 | 25.5 ms | 36.3 ms |

RSS tăng 24.1 MiB, heapUsed tăng 6.0 MiB trong lượt đo (không phải peak).

Full details and limitations: `docs/HUMANIZE_3_BENCHMARKS.md`. Model-mode latency
and cancellation latency were not measured because no live provider key exists.

## 12. Security findings

- Prompt injection boundary added; document is explicitly untrusted data.
- Post-model deterministic preservation cannot be overridden by document text.
- Direct quotations are not auto-edited.
- Stale asynchronous results are rejected by revision.
- No document logging, no hidden transmission, keys remain outside prompts.
- Mitigations are not a proof: a model can still follow embedded instructions;
  the post-check only limits damage to deterministic elements.
- Worker isolation for huge pasted text is still absent.

## 13. Acceptance gates

| Gate | Status | Evidence / blocker |
|---|---|---|
| A — Architecture | **PARTIAL** | One engine, one prompt registry, generated artifacts synchronized. Extension has mode parity but no analysis panel parity; extension UI does not expose suggestions. |
| B — Language quality | **PARTIAL** | English regression suite and Vietnamese deterministic tests exist; full Vietnamese grammar and independent false-positive corpus do not. |
| C — Semantic integrity | **PASS** | Revision-aware suggestions, negation/number/entity/citation/list/condition/qualifier/modal tests, preservation gate. |
| D — Writing modes | **PARTIAL** | 12 canonical modes with distinct prompts/ops/tests/docs; model-required modes are not live-verified. |
| E — User experience | **PARTIAL** | Individual accept/reject, undo/redo, diff, revision history, error states, insights, filter and a web Custom Voice editor exist; no E2E for the new panel/editor, and extension has no voice-profile editor. |
| F — Evaluation | **BLOCKED** | 36 self-authored cases, no independent review/licensed corpus/400 cases. |
| G — Reliability | **PARTIAL** | Cancellation/timeout tests and benchmark exist; no worker isolation or writing-layer timeout; provider live path unverified. |
| H — Security/privacy | **PASS** | Injection boundary, quote protection, stale guards, no logging/transmission, existing key policy; residual model-injection risk documented. |

No BLOCKED/PARTIAL gate is reported as PASS.

## 14. Remaining blockers

1. 400 meaningful, independently reviewed evaluation cases and licence/provenance.
2. Full Vietnamese grammar analysis and a false-positive corpus.
3. Worker isolation and a hard timeout for pathological pasted documents.
4. Live provider verification with the owner's key.
5. E2E coverage for the Custom Voice editor (the editor exists; only prompt/source tests cover it).
6. Independent DOCX/PPTX/XLSX/C2PA corpora from the 2.3.1 mandate.
7. E2E coverage for the new review insights/filter UI.

## 15. Git state

- Base/HEAD: `c82c75143b458948e2000a359962f72773c016a8`.
- No 3.0 commit exists; 25 modified and 15 untracked paths remain in the working
  tree. This is deliberate: the directive says do not commit or push without
  explicit authorization.
- `git status` output is reproducible with `git status --short`.

## 16. Release recommendation

**Not release-ready as a complete 3.0 platform.** The deterministic writing
engine, semantic preservation, mode registry, UI review improvements and
security guards are implemented and tested (352 Node tests, 6 Playwright tests).
Gates F, A, B, D, E and G remain partial/blocked for the reasons above.

Recommended next action: authorize a commit of this verified subset on a
dedicated branch, then complete Gate F with independently reviewed data before
calling 3.0 a release.
