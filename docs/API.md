# API nội bộ

Các module dưới `packages/core/` là ESM thuần, không dependency, chạy được trong Node ≥ 20 và
trình duyệt hiện đại. Chúng chưa phải API công khai; có thể đổi trước bản 2.0 ổn định.

## Unicode — `packages/core/unicode.js`

```js
import { scan, clean, classify, summary, nameOf, isFlagSequence, ACTIONABLE } from './packages/core/unicode.js';

classify('a')                    // 'other' | 'blank' | 'invisible' | 'bidi' | 'joiner'
                                 // | 'tag' | 'pua' | 'vs' | 'emoji' | 'homoglyph'
                                 // | 'linesep' | 'punct'
scan(text)
// [{ cp, hex, name, category, severity, action, count, positions, flag }]

clean(text, {
  normalize: 'NFC',
  blankToSpace: true,
  foldHomoglyphs: true,
  straightQuotes: true,
  emDash: 'comma' | 'hyphen' | 'space' | 'keep',
  removeJoiners: false,          // true = xoá ZWJ/ZWNJ (nguy hiểm với Ả Rập/Indic/emoji)
  removeVariationSelectors: false,
})
// { text, log, audit: [{ index, codePoint, hex, char, category, action, replacement, reason }],
//   warnings: string[] }
```

Bất biến: `clean` không đụng dấu tiếng Việt; giữ ZWJ/VS mặc định; giữ tag char của emoji cờ;
audit ghi mọi thay đổi và cả lý do giữ cờ.

## Thực thể — `packages/core/entities.js`

```js
extractEntities(text)
// { urls, emails, versions, dates, percentages, currencies, citations, quotes,
//   acronyms, properNouns, numbers }
numberCounts(text)        // Map<number, count>
extractEnumerations(text) // [['Kotlin','Java','Python'], ...]
extractFromTo(text)       // [{ from:'4.2', to:'2.1', unit:'seconds' }]
markdownStructure(text)   // { headings, bullets, ordered, fences, links, bold, tables }
```

## Bảo toàn — `packages/core/preservation.js`

```js
checkPreservation(original, proposed, { markdown: true, minLengthRatio: 0.55, maxLengthRatio: 1.45 })
// {
//   preservation: {
//     numbers, urls, emails, dates, entities, negation, conditions,
//     citations, structure, lists, length: 'passed'|'warning'|'failed',
//     semanticReview: 'not_checked'
//   },
//   issues: [{ check, severity: 'warning'|'failed', code, detail, expected? }],
//   requiresManualReview: boolean,
//   checksRun: string[]
// }
```

`semanticReview` **luôn** `not_checked`. Không có "passed" cho kiểm tra chưa chạy.

Mã lỗi thường gặp: `number_missing`, `numeric_relation_reversed`, `url_missing`, `email_missing`,
`date_missing`, `citation_missing`, `negation_removed`, `condition_removed`, `list_item_removed`,
`structure_lost`, `length_changed`, `entity_missing`.

## Diff — `packages/core/diff.js`

```js
diffWords(before, after)   // [{ type:'equal'|'insert'|'delete', value }]
diffStats(ops)             // { added, removed, kept }
similarity(a, b)           // 0..1 theo token giữ nguyên
applyEdits(text, [{ find, replace, index? }]) // { text, applied, rejected }
diffLines(ops, width)      // mảng dòng có tiền tố '+ ' / '- ' / '  '
```

## Tài liệu — `packages/core/document.js`

```js
const doc = new DocumentSession(text, { language: 'vi', format: 'md' });
doc.propose(newText);   // → { id, at, text, baseRevision }
doc.acceptAll();        // proposed → accepted + working + revision
doc.reject();           // bỏ proposed
doc.commit(text, 'edit'); // thêm revision
doc.undo(); doc.redo(); doc.canUndo(); doc.canRedo();
doc.export('md');       // { format, at, text } — original vẫn nguyên
doc.diff();             // { ops, stats }
doc.snapshot();
```

## Markdown — `packages/core/markdown.js`

```js
splitMarkdown(text)       // [{ type:'text'|'code'|'inlineCode'|'link'|'autolink', value }]
transformProse(text, fn)  // chỉ biến đổi đoạn 'text'; code/link giữ nguyên bytes
stripMarkdown(text)       // { text, removed }
countStructure(text)
```

## CLI — `tools/trace_scan.py`

```
python tools/trace_scan.py FILE [--strip] [-o OUT] [--json [--audit]]
       [--aggressive] [--keep-quotes] [--em-dash comma|hyphen|space|keep]
       [--fail-on-security]
```

Exit code: `0` bình thường, `2` khi `--fail-on-security` và có ký tự thuộc nhóm nguy hiểm.

`--json` trả:

```json
{
  "stats": { "words": 0, "sentences": 0, "cv": 0.0 },
  "findings": [{ "cp": 8203, "codepoint": "U+200B", "category": "invisible", "count": 1 }],
  "security_chars": 0,
  "cleaning": { "changes": {}, "audit": [], "after": {} }
}
```

`cleaning` chỉ có khi dùng `--audit`.

## Thông điệp extension

```js
chrome.runtime.sendMessage({ type: 'humanize', text, cfg: { prompt, markdown, provider, base, model, key } })
// → { text, preservation: <checkPreservation result> }
// → { error: string }
```

`cfg.markdown` ép background thêm mệnh đề giữ/xoá Markdown; prompt do người dùng gửi vẫn được
giữ nguyên phần đầu.
