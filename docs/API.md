# API nội bộ

Các module dưới `packages/` là ESM thuần, không dependency, chạy Node ≥ 20 và trình duyệt hiện đại.
Chưa phải API công khai; có thể đổi trước bản ổn định.

## Làm sạch — `packages/core/cleaning.js` (canonical)

```js
import { cleanText, countsFor, protectRegions, segmentText, TELL_PATTERNS } from './packages/core/cleaning.js';

cleanText(text, {
  markdown: true,             // false = xoá marker Markdown, giữ nội dung
  emDash: 'comma',            // 'comma' | 'hyphen' | 'space' | 'keep'
  straightQuotes: true,
  blankToSpace: true,
  foldHomoglyphs: true,
  removeJoiners: false,       // chỉ bật khi người dùng chọn rõ
  removeVariationSelectors: false,
})
// {
//   text, log, warnings,
//   audit: [{ index, codePoint, hex, char, category, action, replacement, reason }],
//   protectedRegions: number,
//   stats: { vis, blank, pua, quotes, emdash, dbl, tells, joinerKept, vsKept }
// }

protectRegions(text) // [{ type:'code'|'inlineCode'|'link'|'autolink'|'url'|'email', start, end, value }]
segmentText(text)    // [{ type, value, start }] — đoạn chữ và đoạn bảo vệ xen kẽ
countsFor(text)      // số liệu cho UI; không phải xác suất, không phải kết luận tác giả
```

Bất biến: không xoá mục danh sách, không đổi phủ định, giữ joiner/VS/emoji cờ, audit dùng **offset
trong chuỗi gốc** (UTF-16), vùng bảo vệ giữ nguyên byte.

## Unicode — `packages/core/unicode.js`

```js
import { scan, clean, classify, summary, nameOf, isFlagSequence, ACTIONABLE } from './packages/core/unicode.js';

classify('a')  // 'other'|'blank'|'invisible'|'bidi'|'joiner'|'tag'|'pua'|'vs'|'emoji'|'homoglyph'|'linesep'|'punct'
scan(text)     // [{ cp, hex, name, category, severity, action, count, positions, flag }]
clean(text, { normalize:'NFC', blankToSpace:true, foldHomoglyphs:true, straightQuotes:true,
              emDash:'comma', removeJoiners:false, removeVariationSelectors:false })
// { text, log, audit, warnings }
```

## Thực thể — `packages/core/entities.js`

```js
extractEntities(text)     // { urls, emails, versions, dates, percentages, currencies,
                          //   citations, quotes, acronyms, properNouns, numbers }
numberCounts(text)        // Map<number, count>
extractEnumerations(text) // [['Kotlin','Java','Python'], ...]
extractFromTo(text)       // [{ from:'4.2', to:'2.1', unit:'seconds' }]
countStructure(text)      // { headings, bullets, ordered, fences, links, bold, tables }
```

## Bảo toàn — `packages/core/preservation.js`

```js
checkPreservation(original, proposed, { markdown:true, minLengthRatio:0.55, maxLengthRatio:1.45, strict:false })
// {
//   preservation: { numbers, urls, emails, dates, entities, negation, conditions,
//                   citations, structure, lists, length: 'passed'|'warning'|'failed',
//                   semanticReview: 'not_checked' },
//   issues: [{ check, severity:'warning'|'failed', code, detail, expected? }],
//   requiresManualReview: boolean,
//   checksRun: string[]
// }
```

`semanticReview` **luôn** `not_checked`. Mã lỗi: `number_missing`, `numeric_relation_reversed`,
`url_missing`, `email_missing`, `date_missing`, `citation_missing`, `negation_removed`,
`condition_removed`, `list_item_removed`, `structure_lost`, `length_changed`, `entity_missing`.

## Prompt — `packages/writing/prompts.js` (canonical)

```js
import {
  PROMPT_VERSION, PRESERVATION_RULES, PROMPT_BASE, MODES,
  MD_KEEP_CLAUSE, MD_PLAIN_CLAUSE, SELF_EDIT, buildPrompt, webPresets, WEB_PRESET_KEYS,
} from './packages/writing/prompts.js';

PROMPT_VERSION            // '2.1.0'
Object.keys(MODES)        // general, proofread, clarity, concise, natural,
                          // professional, academic, cover, email
buildPrompt('concise', { markdown: true })
// PROMPT_BASE + "## Editing mode: Concise" + instruction + MD_KEEP_CLAUSE
```

Mọi prompt bắt đầu bằng khối "Non-negotiable preservation" (dữ kiện, danh sách, phủ định, trích dẫn,
không bịa). Không có chỉ dẫn xoá nội dung.

## Diff — `packages/core/diff.js`

```js
diffWords(before, after)   // [{ type:'equal'|'insert'|'delete', value }]
diffStats(ops)             // { added, removed, kept }
similarity(a, b)           // 0..1
applyEdits(text, [{ find, replace, index? }]) // { text, applied, rejected }
diffLines(ops, width)      // dòng có tiền tố '+ ' / '- ' / '  '
```

## Tài liệu — `packages/core/document.js`

```js
const doc = new DocumentSession(text, { language:'vi', format:'md' });
doc.propose(newText); doc.acceptAll(); doc.reject(); doc.commit(text,'edit');
doc.undo(); doc.redo(); doc.export('md'); doc.diff(); doc.snapshot();
```

## Markdown — `packages/core/markdown.js`

```js
splitMarkdown(text)       // [{ type:'text'|'code'|'inlineCode'|'link'|'autolink', value }]
transformProse(text, fn)  // chỉ đổi đoạn 'text'
stripMarkdown(text)       // { text, removed }
```

## Extension

```js
// content.js / panel.js → background
chrome.runtime.sendMessage({
  type: 'humanize', text,
  cfg: { prompt, markdown, mode, provider, base, model, key }
})
// → { text, preservation, promptVersion, mode }
// → { error, code, retryable }
```

`cfg.mode` là khoá trong `MODES`. Prompt tự soạn vẫn bị nối thêm khối chế độ + mệnh đề Markdown.

Mã lỗi: `VALIDATION_ERROR`, `CONFIG_ERROR`, `PROVIDER_AUTH_ERROR`, `PROVIDER_RATE_LIMIT`,
`PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`, `PROVIDER_MODEL_UNAVAILABLE`, `PROVIDER_EMPTY_RESPONSE`,
`PROVIDER_BAD_RESPONSE`, `NETWORK_ERROR`, `CANCELLED`. Timeout mặc định 60s (`AbortController`).

Bundle cho content script / side panel: `extension/core/bundle.js` đặt `globalThis.TraceCore` với
cùng API `cleanText`/`countsFor`/`checkPreservation`/`scan`/`diffWords`/`DocumentSession`.

## CLI — `tools/trace_scan.py`

```
python tools/trace_scan.py FILE [--strip] [-o OUT] [--json [--audit]]
       [--aggressive] [--keep-quotes] [--em-dash comma|hyphen|space|keep]
       [--fail-on-security]
```

Exit code `0` bình thường, `2` khi `--fail-on-security` và có ký tự nguy hiểm. `--json --audit` trả
`{ stats, findings[], security_chars, cleaning:{ changes, audit, after } }`.
