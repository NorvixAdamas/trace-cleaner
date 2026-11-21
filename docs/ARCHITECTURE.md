# Architecture — Trace Cleaner 2.3

## Nguyên tắc

1. Một engine canonical (`packages/core`), một registry prompt (`packages/writing/prompts.js`),
   một contract provider (`packages/providers/registry.js`).
2. Web và Extension chỉ là **adapter UI** gọi engine; không có bản sao thuật toán.
3. Mọi artifact sinh ra phải deterministic và có `--check` để CI phát hiện lệch.
4. Bản gốc của tài liệu là bất biến; mọi thay đổi đi qua `DocumentSession`.

## Luồng dữ liệu

```
packages/core/* ─┐
packages/writing/* ├─→ tools/sync_assets.js ─→ extension/core/bundle.js  (+ prompts.js)
packages/providers/*┘                        └─→ index.html @generated:core / @generated:prompts
                                                     │
                         ┌───────────────────────────┴──────────────┐
                   index.html (adapter + UI)                 extension/sidebar.js (adapter)
                                                                  │
                                                          extension/background.js
                                                                  │
                                                          TraceProviders.generate
```

`tools/sync_assets.js` resolve import tương đối giữa các module, gộp thành một IIFE, phơi
`TraceCore`, `TraceWriting`, `TraceProviders` trên `globalThis`. Bundle không có `import`/`export`
ở top level nên chạy được cả `file://` và service worker.

## packages/core

| Module | Trách nhiệm |
|---|---|
| `unicode.js` | phân loại/scan codepoint, làm sạch theo run, offset UTF-16 trên chuỗi gốc (`OFFSET_SYSTEM`) |
| `entities.js` | trích số, liệt kê, `from…to`, phủ định, điều kiện, URL, email, ngày, trích dẫn |
| `preservation.js` | kiểm bảo toàn sau khi viết lại; trả `{preservation, issues, failed, ok, checksRun}` |
| `markdown.js` | tách fence/HTML/inline code/link; `unfence`, `stripMarkdownInline`; không phá code |
| `cleaning.js` | engine làm sạch segment-aware: mỗi đoạn prose dọn riêng, vùng bảo vệ giữ nguyên byte |
| `diff.js` | `diffWords` (LCS có trần), `diffStats`, `similarity`, `applyEdits` an toàn |
| `document.js` | `DocumentSession`: original bất biến, working, proposal có `baseRevision`, history |
| `limits.js` | `PARSER_LIMITS`, `validateZipEntryName`, `checkZipBudget`, `xmlDepth`, `assertSafeXml`, `clampText` |

### Vùng bảo vệ

URL, email, autolink, Markdown link/image, inline code, fenced code (``` và ~~~), HTML/XML tag.
Trong vùng bảo vệ **không** chạy chuẩn hoá văn xuôi, không trim, không đổi dấu câu.

### Offset

Offset là **UTF-16 index trên chuỗi gốc**. Khi NFC làm đổi độ dài, vị trí vẫn tính trên chuỗi gốc;
run bắt đầu bằng combining mark được gộp vào run trước. Audit chỉ hứa đúng những gì hệ offset này
bảo đảm (xem `tests/unicode-offset.test.js`).

## packages/writing

- `prompts.js`: 9 chế độ (general, proofread, clarity, concise, natural, professional, academic,
  cover, email) + mệnh đề bảo toàn + mệnh đề Markdown; `PROMPT_VERSION` riêng.
- `suggestions.js`: schema gợi ý + `applySuggestion(s)` (kiểm `original`, chống chồng lấn).
- `language.js`: nhận diện en/vi, fallback `unknown` → chỉ luật neutral.
- `grammar/{en,vi,index}.js`: luật deterministic, mỗi luật trả `{start,end,replacement,reason}`.

## packages/providers

`errors.js` (mã lỗi + `normalizeError` + `redactSecrets`), `request.js` (`withTimeout`,
`RequestRegistry`, `validateBaseUrl`), `google.js`, `openai-compatible.js`, `registry.js`
(`generate` chuẩn hoá: fallback model khi 404, retry một lần khi 5xx, dừng khi huỷ/hết quota).

Mã lỗi dùng chung: `VALIDATION_ERROR`, `CONFIG_ERROR`, `PROVIDER_AUTH_ERROR`,
`PROVIDER_RATE_LIMIT`, `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`, `PROVIDER_MODEL_UNAVAILABLE`,
`PROVIDER_EMPTY_RESPONSE`, `PROVIDER_BAD_RESPONSE`, `NETWORK_ERROR`, `CANCELLED`,
`STALE_DOCUMENT_REVISION`, `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `PARSER_ERROR`,
`PERMISSION_DENIED`, `INTERNAL_ERROR`.

## Document lifecycle

```
original (immutable)
   └── working ──commit(text, reason)──→ revision mới (history)
         ▲                                   │
         └── undo / redo / restoreOriginal ──┘
proposal(text, baseRevision) ──acceptProposal(id)──→ chỉ khi baseRevision khớp revision hiện tại
```

`acceptProposal` trả `{ok:true, revision}` hoặc `{ok:false, error:{code:'STALE_DOCUMENT_REVISION'}}`.
Đề xuất cũ không bao giờ ghi đè bản mới.

## Web app

- Một file `index.html`, không build step, chạy `file://` và GitHub Pages.
- Adapter: `cleanText`, `stripMarkdown`, `preservationCheck`, `buildPrompt`, `modePrompt`,
  `currentMode` — mỗi hàm < ~1.400 ký tự, không regex biến đổi, test kiểm điều này.
- Tab **Rà soát**: original (read-only), bản đang sửa, đề xuất, diff theo từng span, báo cáo bảo
  toàn, gợi ý ngữ pháp, trạng thái revision/lịch sử, export.
- `reviewEnsure()` giữ session khi `src` bằng original **hoặc** bằng working (nếu không, Undo/Redo
  sẽ mất lịch sử ngay sau lần Chấp nhận đầu tiên).

## Extension

- `background.js` (ES module, `import "./core/bundle.js"`): chọn provider qua `TraceProviders`,
  `RequestRegistry` theo `requestId`, xử lý `humanize` / `cancel` / `ping`.
- `sidebar.js`: UI adapter (không `chrome.*`), nhận hooks `humanize`, `cancel`, `grab`, `insert`,
  `loadCfg`, `saveCfg`, `getPrompt`, `setPrompt`.
- `content.js`: chrome bridge + shadow DOM; `panel.js`: Side Panel dùng cùng sidebar.
- Preservation gate: kết quả có issue `severity: failed` ⇒ nút Dán yêu cầu xác nhận.

## Python CLI

Độc lập, không mạng, giữ option cũ. Hợp đồng với JS được kiểm bằng `tests/fixtures/parity-cases.json`
(tầng ký tự/whitespace, CRLF). Python **không** có Markdown protection hay preservation — giới hạn
này được ghi rõ trong README/CLI help.

## Giới hạn đã biết

- `diffWords` là O(n·m) có trần 4.000.000 ô; vượt trần → thay cả khối.
- Parser PDF/OOXML là heuristic: không phải parser đầy đủ, không parse tracked changes.
- C2PA: chỉ dò marker, không xác minh chữ ký.
- Grammar: regex có ngữ cảnh hẹp, không phải parser cú pháp.
