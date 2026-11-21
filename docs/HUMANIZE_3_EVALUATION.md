# Humanize 3.0 — Evaluation

## What exists

- Runner: `packages/writing/evaluation.js`
- CLI: `node tools/eval_writing.js` (writes `docs/WRITING_EVAL.md`)
- Data: `tests/fixtures/writing-eval/dev.json` (24 cases) and `heldout.json`
  (12 cases), all self-authored, no user data.
- Total labelled expectations: 30 across 36 cases.

The runner now reports precision, recall, F1, false-positive rate,
false-negative rate, offset accuracy, string preservation and optional entity /
number / citation preservation, failure rate and average latency. Acceptance
rate is `null`: it requires real user logs and is never invented.

## Current results (deterministic layer)

| Set | Cases | Labels | Matched | Missing | Extra | Precision | Recall | F1 | FPR | FNR | Offset |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | 24 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 100.0% |
| held-out | 12 | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 100.0% |

String preservation: 100% on both sets. Entity/number/citation preservation is
shown as `—` because these fixtures do not yet include those dedicated fields;
reporting them as 100% would be false.

These numbers are **not** evidence of general writing quality. The dataset is
small, self-authored and intentionally focused on rules the engine implements.
It is a regression suite, not an independent benchmark.

## Gate F status: BLOCKED

The 3.0 directive requires at least 400 meaningful cases, a separate held-out
split, and independently reviewed reference corrections.

What is missing and why it was not fabricated:

1. **Scale**: only 36 cases exist. Generating 364 near-identical cases from
   templates would inflate coverage without adding information.
2. **Independence**: the author of the rules is also the author of every label.
   Independent review requires a second annotator or a licensed corpus with
   published corrections.
3. **Licensing/provenance**: no external corpus with clear redistribution rights
   is present in the repository. Downloading a corpus without recording its
   licence would violate the data-provenance requirement.
4. **Acceptance rate**: requires production telemetry or a user study.

The framework accepts optional `preserveEntities`, `preserveNumbers` and
`preserveCitations` arrays per case, so a properly licensed corpus can be added
without changing the runner. Gate F remains **BLOCKED** until that data exists.

## Preventing leakage

- `dev.json` and `heldout.json` are loaded separately.
- Held-out thresholds are checked only in `tests/writing-eval.test.js`.
- No fixture is generated at runtime from the rules.
- The test asserts fixtures contain no real URLs.

## Commands

```bash
node tools/eval_writing.js          # regenerate docs/WRITING_EVAL.md
node tools/eval_writing.js --check  # fail if docs drift
node --test tests/writing-eval.test.js
```
