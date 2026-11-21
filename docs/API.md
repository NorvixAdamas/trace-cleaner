# API và hợp đồng dữ liệu

Mọi kết quả mang `schemaVersion: '1.0'`. Engine báo `ENGINE_VERSION = '2.3'`, prompt báo
`PROMPT_VERSION = '2.3.1'`.

## Làm sạch

```js
TraceCore.cleanText(text, { markdown: true }) // →
{
  text, stats, audit: [{ index, char, category, action }],
  warnings: [], log: {}, segments, offsetSystem: 'utf16-source',
  engineVersion: '2.3', schemaVersion: '1.0'
}
```

- `audit[].index` là UTF-16 index trên **chuỗi gốc**.
- `markdown: false` → bỏ marker, giữ nội dung; code fence được `unfence` chứ không bị regex văn xuôi
  chạm vào.
- Không xoá mục danh sách, phủ định, điều kiện, ngoại lệ, số, URL, email, trích dẫn.

## Quét Unicode

```js
TraceCore.scan(text) // → [{ codepoint, category, count, name, severity, action, indexes }]
TraceCore.countsFor(text) // → { vis, pua, blank, quotes, emdash, tells }
```

## Bảo toàn

```js
TraceCore.checkPreservation(original, proposed, { markdown, strict }) // →
{
  preservation: { numbers: 'passed'|'failed'|'warning'|'not-checked', ... },
  issues: [{ check, severity: 'failed'|'warning', code, detail, expected? }],
  failed: boolean, ok: boolean,
  requiresManualReview: boolean,
  checksRun: string[]
}
```

Mã issue: `number_missing`, `numeric_relation_reversed`, `url_missing`, `email_missing`,
`date_missing`, `negation_removed`, `condition_removed`, `quote_missing`, `list_item_removed`,
`markdown_structure_changed`, `length_changed`.

`preservation.semanticReview` luôn là `'not-checked'`: không có kiểm tra ngữ nghĩa tự động.

## Prompt

```js
TraceWriting.buildPrompt(mode, { markdown, custom }) // → string
TraceWriting.MODES // → [{ id, label, purpose, instruction }]
```

9 chế độ: `general`, `proofread`, `clarity`, `concise`, `natural`, `professional`, `academic`,
`cover`, `email`. Prompt tự soạn của người dùng được giữ, nhưng luôn ghép thêm mệnh đề bảo toàn +
Markdown từ registry.

## Gợi ý ngữ pháp

```js
TraceWriting.analyze(text, { language }) // →
{ language, supported, suggestions: [Suggestion], truncated }
```

```json
{
  "id": "suggestion-001",
  "type": "grammar",
  "severity": "warning",
  "language": "en",
  "start": 12,
  "end": 19,
  "original": "has went",
  "replacement": "has gone",
  "reason": "Present perfect cần quá khứ phân từ.",
  "source": "deterministic-rule",
  "ruleId": "en.irregular-participle",
  "accepted": false
}
```

`applySuggestion(text, suggestion, { sourceRevision })` và
`applySuggestions(text, list)` trả `{ text, applied, rejected, conflicts }`; từ chối khi `original`
không còn khớp hoặc hai gợi ý chồng lấn.

## Diff và tài liệu

```js
TraceCore.diffWords(before, after) // → [{ type: 'equal'|'insert'|'delete', value }]
TraceCore.diffStats(ops)           // → { added, removed, kept }
TraceCore.applyEdits(text, edits, { sourceRevision }) // →
{ text, applied, rejected, conflicts, sourceRevision, schemaVersion }
```

`edits[]`: `{ find, replace }` | `{ find, replace, occurrence }` | `{ find, replace, index }` |
`{ start, end, replace }`.

- `index` là **vị trí chính xác** của `find`; lệch ⇒ `conflicts[].reason = 'text_mismatch'`.
- Không có `index`/`occurrence` mà `find` xuất hiện nhiều lần ⇒ `rejected[].reason = 'ambiguous'`.
- Chồng lấn ⇒ cả hai vào `conflicts`.

```js
const doc = new TraceCore.DocumentSession(original);
doc.propose(text, { id })        // → { id, baseRevision }
doc.acceptProposal(id)           // → { ok:true, revision } | { ok:false, error }
doc.acceptAll()                  // → như trên
doc.commit(text, reason)         // → revision
doc.undo() / doc.redo() / doc.restoreOriginal()
doc.snapshot()                   // → { revision, pendingProposal, canUndo, canRedo, staleCount, ... }
doc.diffAgainst()                // diff original → working
doc.export('txt'|'md')           // → { text, revision }  (không sửa bản gốc)
```

Lỗi: `STALE_DOCUMENT_REVISION`, `NO_PENDING_PROPOSAL`, `PROPOSAL_NOT_FOUND`.

## Provider

```js
TraceProviders.generate(cfg, {
  text, prompt, signal, timeoutMs, requestId, fetchImpl, retryDelayMs, onModelSwitch
}) // → { text, model, provider, requestId, schemaVersion }
```

`cfg`: `{ provider: 'google'|'openai', key, base?, model? }`.

Hành vi: 404 → thử model fallback (Google), 5xx → retry một lần, 401/403/429/timeout/cancel → dừng
ngay và trả mã tương ứng. `TraceProviders.RequestRegistry` giữ `requestId → AbortController`
(`start`, `cancel`, `finish`, `cancelAll`).

```js
TraceProviders.validateConfiguration(cfg) // → { ok:true, ... } | { ok:false, error }
TraceProviders.listModels(cfg)            // → string[]
TraceProviders.validateBaseUrl(url)       // → { ok, error? }
```

## File / parser

```js
TraceCore.PARSER_LIMITS                    // hằng số đã freeze
TraceCore.validateZipEntryName(name)       // → { ok, reason? }
TraceCore.checkZipBudget(entries)          // → { ok, total } | { ok:false, reason, detail }
TraceCore.assertSafeXml(xml, { name })     // → true | throw { code:'PARSER_ERROR' }
TraceCore.xmlDepth(xml)                    // → number
TraceCore.clampText(text)                  // → { text, truncated }
```

`entries[]`: `{ name, size, compressedSize, method }`. `reason`: `too_many_entries`,
`entry_too_large`, `suspicious_expansion`, `archive_too_large`, `unsupported_method`,
`path_traversal`, `absolute_path`, `backslash`, `nul_byte`, `too_long`, `empty`.

## Hợp đồng Python

`tools/trace_scan.py --json` trả:

```json
{
  "stats": { "words": 0, "sentences": 0, "chars": 0, "cv": 0, "em_dash_per_1k": 0 },
  "findings": [{ "codepoint": "U+200B", "cp": 8203, "category": "invisible", "count": 1, "severity": "HIGH", "name": "...", "action": "..." }],
  "security_chars": 1,
  "cleaned": "...",
  "cleaning": { "changes": { "invisible": 1 }, "audit": [], "after": {} }
}
```

Fixture dùng chung: `tests/fixtures/parity-cases.json` — mỗi case có `text` và `cleaned` mà **cả**
JS core và Python CLI phải cho ra.
