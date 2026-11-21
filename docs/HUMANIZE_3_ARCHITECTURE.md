# Humanize 3.0 — Writing Intelligence architecture

## Layers

```
packages/core/                  hardened, shared by web + extension
  cleaning.js                   protected-region segmentation (code/URL/email)
  preservation.js               numbers/URLs/dates/negation/citations/lists/structure
  diff.js, document.js          edits, revisions, undo/redo, stale proposals
  entities.js                   deterministic entity extraction
        │
packages/writing/               one canonical writing engine
  grammar/                      sentence rules (en/vi/neutral)
  engine/readability.js         sentence/paragraph metrics, observations
  engine/clarity.js             conservative wordy/redundant phrase suggestions
  engine/preserve.js            semantic-element comparison, status
  engine/document.js            terminology + document-level findings
  engine/rewrite.js             deterministic pipeline + preservation gate
  analyze.js                    entrypoint: analyzeWriting / applyWriting*
  prompts.js                    prompt text + 14 modes (12 canonical)
  modes/index.js                thin ESM re-export of the same registry
  consistency.js                document consistency checks
  evaluation.js                 dataset metrics
  shared/schema.js              suggestion schema, revision hash, validation
  shared/normalization.js       quotation ranges
        │
tools/sync_assets.js ──────────► index.html generated core/prompt blocks
                                 extension/core/bundle.js
                                 extension/core/prompts.js
```

`packages/writing/prompts.js` is self-contained because its generated extension
copy must not import relative files. `modes/index.js` re-exports the same object
for ESM callers; it is not a second registry.

## Analysis pipeline

`analyzeWriting(text, options)`:

1. Runs `grammar.analyze` on protected text segments. Direct quotations are
   skipped, code/URLs/emails are skipped by `segmentText`.
2. Runs `clarity.analyzeClarity` with the same protections.
3. Runs `document.analyzeDocument`, which reuses `consistency.analyzeConsistency`
   and adds abbreviations, repeated sentences, repeated introductions and
   numeric claims.
4. Runs `readability.analyzeReadability` (observation only; no automatic split).
5. Normalises every suggestion through `shared/schema.normalizeSuggestion`, adds
   the document `revision`, sorts and removes overlaps.

The report contains:

- `suggestions` — sentence-level, accept/reject individually.
- `insights` — readability, clarity and document observations; never auto-applied.
- `document.findings` — terminology/date/number/abbreviation conflicts.
- `readability.metrics` — words, sentences, paragraphs, distributions, Flesch
  for English only.
- `revision` — hash used to reject stale suggestions.
- `capabilities` — what is deterministic and what still needs a model.

## Suggestion lifecycle

```js
const report = analyzeWriting(text);
const hit = report.suggestions[0];

applyWritingSuggestion(text, hit);
// -> { ok, text, preservation, blocked }

applyWritingSuggestions(text, list);
// -> refuses to return changed text if deterministic preservation is blocked
```

`applyWritingSuggestions` compares the result with the original using
`comparePreservation`. If numbers, names, citations, conditions, negation,
qualifiers, modals, lists or Markdown structure are lost, the changed text is
not returned unless the caller explicitly passes `allowUnsafe: true`.

## Rewrite modes

`rewrite(text, { mode })` resolves aliases through `resolveMode` and runs only
the mode's declared deterministic operations:

| Mode | Deterministic ops | Needs model |
|---|---|---|
| grammar | grammar corrections | no |
| natural | grammar corrections | yes |
| deep | — | yes |
| academic | grammar, contraction expansion | yes |
| professional | grammar, contraction expansion, clarity trims | yes |
| conversational | — | yes |
| concise | grammar, clarity trims | yes |
| expanded | grammar | yes |
| vocabulary | — | yes |
| coherence | grammar, clarity trims | yes |
| paragraph | — | yes |
| custom | grammar | yes |
| cover | grammar | yes |
| email | grammar | yes |

A mode marked `requiresModel: true` does not pretend the deterministic subset is
the full rewrite. The UI can use the mode prompt from the registry and must label
the result as model output when a provider is called.

## Non-goals

- No detector evasion, no purposeful misspellings, no fabricated personal facts.
- No automatic contradiction resolution.
- No claim of semantic equivalence: `semanticEquivalence` is always `not_checked`.
- No hidden transmission: deterministic analysis is local; provider calls are
  explicit user actions in the existing UI.
