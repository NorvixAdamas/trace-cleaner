# Humanize 3.0 — API

All offsets are UTF-16 offsets into the original string (`offsetSystem:
"utf16-source"`). Writing schema version is `3.0`; product/prompt version is
`3.0.0`.

## `analyzeWriting(text, options?)`

```js
import { analyzeWriting } from './packages/writing/analyze.js';

const report = analyzeWriting(text, {
  language: 'en' | 'vi' | 'unknown', // default: detect
  types: ['grammar', 'style'],       // optional category filter
  minConfidence: 0.8,                 // optional
  maxSuggestions: 500,
  includeDocument: true,
  includeReadability: true,
});
```

Returns:

```ts
{
  schemaVersion: '3.0',
  engineVersion: '3.0',
  language: 'en' | 'vi' | 'unknown',
  supported: boolean,
  revision: string,
  offsetSystem: 'utf16-source',
  suggestions: Suggestion[],
  insights: Insight[],
  readability: { metrics, observations, notes } | null,
  document: { findings, stats, limitations },
  stats: { total, corrections, byType, bySeverity, schema, insights, ... },
  analysisWarnings: Array<{ ruleId, message }>,
  capabilities: { deterministicAnalysis, modelRequired, languages, ... },
}
```

## Suggestion schema

```ts
{
  id: string,
  type: string,
  category: 'spelling' | 'grammar' | 'punctuation' | 'word-choice' |
            'redundancy' | 'style' | 'consistency' | 'capitalization',
  kind: 'correction' | 'suggestion',
  severity: 'error' | 'warning' | 'info',
  confidence: number,             // 0..1
  language: string,
  start: number,
  end: number,
  original: string,               // exact slice text[start:end]
  replacement: string,
  reason: string,
  explanation: string,
  source: 'deterministic-rule' | 'model',
  ruleId: string | null,
  paragraph: number | null,
  revision: string,
  preservationStatus: 'preserved' | 'review' | 'blocked' | 'not_checked',
  accepted: false,
}
```

Deterministic analysis sets `preservationStatus: not_checked`; preservation is
checked when applying or rewriting.

## `applyWritingSuggestion(text, suggestion)`

- Rejects `missing_suggestion`, `invalid_offsets`, `out_of_bounds`,
  `stale_text`, `stale_revision`.
- Returns `{ ok, text, result, preservation, blocked }`.
- `ok: false` leaves the input untouched.

## `applyWritingSuggestions(text, suggestions, options?)`

- Applies non-overlapping edits through `core/diff.applyEdits`.
- Rejects edits whose revision differs.
- Returns `{ ok:false, reason:'preservation_blocked', text: original }` when
  the result loses a deterministic semantic element.
- `options.allowUnsafe: true` is for tests/advanced callers; the UI must not use
  it.

## `comparePreservation(original, revised, options?)`

Elements: `numbers`, `urls`, `emails`, `dates`, `citations`, `properNouns`,
`names`, `negations`, `conditions`, `qualifiers`, `modals`, `lists`,
`structure`.

```ts
{
  schemaVersion: '3.0',
  status: 'preserved' | 'review' | 'blocked',
  safeToAutoAccept: boolean,
  semanticEquivalence: 'not_checked',
  elements: Array<{name, status, expected, actual, missing}>,
  blocked: string[],
  warnings: Array<{code, detail}>,
  core: object // core/preservation.js result
}
```

Contraction expansion is normalised (`don't` ≡ `do not`) so a grammatical
expansion is not misreported as a lost negation.

## `rewrite(text, options?)`

```js
const result = rewrite(text, { mode: 'concise', language: 'en' });
```

```ts
{
  mode, label, text, changed,
  changes: Array<{ruleId, original, replacement}>,
  requiresModel: boolean,
  deterministicOnly: boolean,
  preservation: PreservationReport,
  note: string,
}
```

If preservation is blocked, the rewrite reverts to the original and clears
`changes`.

## Modes

`MODES` contains 12 canonical modes (`CANONICAL_MODE_KEYS`) plus `cover` and
`email`. Aliases:

- `general` → `natural`
- `proofread` → `grammar`
- `clarity` → `coherence`

`buildPrompt(mode, { markdown, customVoice })` resolves aliases. `customVoice`
is capped at 2000 characters and is explicitly labelled style-only data.

## Errors and limits

- No exception is used for user-correctable problems; functions return
  structured `ok/reason` results.
- `maxSuggestions` defaults to 500. `truncated` is true when suggestions were
  cut; it is not silently hidden.
- Provider errors keep the existing normalized codes
  (`PROVIDER_AUTH_ERROR`, `PROVIDER_TIMEOUT`, `CANCELLED`, `VALIDATION_ERROR`).
- Live provider calls are not part of this deterministic API and remain
  unverified without a key.
