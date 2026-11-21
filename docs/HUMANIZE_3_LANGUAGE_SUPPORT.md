# Humanize 3.0 — Language support

## Summary

| Capability | English | Vietnamese |
|---|---|---|
| Language detection | yes | yes |
| Spelling/typo rules | curated common misspellings | unambiguous typos |
| Repeated words | yes | yes, reduplication allowlist |
| Spacing/punctuation | yes | yes |
| Sentence capitalisation | yes | yes (Latin + Vietnamese letters) |
| Articles / agreement | partial deterministic | not applicable |
| Unicode NFC normalisation suggestion | via sentence layer | explicit NFD suggestion |
| Readability metrics | yes, Flesch estimate | metrics only; no Flesch |
| Document consistency | yes | yes (shared neutral checks) |
| Full grammar checker | **no** | **no** |

The engine does not translate Vietnamese into English and then apply English
rules. Vietnamese rules are separate (`grammar/vi.js`); neutral rules are used
only when the language is unknown.

## English coverage

Deterministic rules currently include:

- repeated words (with a small allowlist such as `had had`, `that that`);
- `would/could/should/must/might of` → `have`;
- common irregular past participles after `has/have/had`;
- curated misspellings;
- `a/an` with vowel-sound exceptions and acronyms;
- spacing before/after punctuation;
- lowercase `I`, sentence-start capitalisation;
- `they was`, `he don't`, `have/has`, `there is` + plural;
- `much/many` with curated countability lists;
- `its` + determiner, `their` + be, `loose` + verb, comparative + `then`;
- optional Oxford comma suggestion (low confidence, never automatic).

Not covered: full tense/aspect analysis, arbitrary article selection, deep
parallel structure, modifier attachment, conditionals and context-dependent
word choice. Those require a model and are not claimed as deterministic.

## Vietnamese coverage

- `TYPOS` contains only pairs where the wrong form is not another valid word.
- Reduplication (`người người`, `ngày ngày`, …) is allowlisted to prevent false
  positives.
- Spacing before punctuation and after commas/periods is checked with numeric
  and abbreviation exceptions (`1,5`, `3.14`, `TP.HCM`).
- NFD text is detected and NFC is suggested; intentional combining sequences
  inside code/URLs/quotes are not touched.
- Style trims (`cũng như là`, `nói chung là`, …) are low-confidence suggestions,
  not spelling errors.

Not covered: classifier selection (`con/cái/chiếc`), full subject-predicate
agreement, word-order errors, regional vocabulary, formal/informal register
classification, and semantic ambiguity. Vietnamese is first-class in the
architecture, but the deterministic layer is explicitly partial.

## Unicode policy

- Offsets are UTF-16 into the original text.
- NFC normalisation is a suggestion, never applied by analysis.
- BOM, control characters and invisible characters belong to the cleaning
  engine, not the writing engine.
- Quoted text is never auto-corrected; quotation ranges are computed by
  `shared/normalization.js`.

## False-positive controls

- Unknown language: only neutral rules run.
- Protected regions: code, inline code, URLs, emails and links are skipped.
- Direct quotations: skipped by grammar and clarity.
- Redundancy phrases: only a curated list with unambiguous equivalents.
- Document findings: require at least two occurrences or evidence and never
  auto-resolve a contradiction.
- Suggestions never auto-apply; corrections and style suggestions are separated.
