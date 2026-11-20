# Trace Cleaner 2.2 — Báo cáo cuối

Ngày: 2026-11-20. Phạm vi: sprint "Force Completion" trên `main`, baseline `056cd6b`.
**Không commit, không push** — toàn bộ thay đổi nằm trong working tree.

---

## A. Trạng thái repository

| Mục | Giá trị |
|---|---|
| HEAD bắt đầu | `056cd6b949eb5877272e443eb8620be3e59eeda4` |
| HEAD cuối | `056cd6b` (không tạo commit mới) |
| Nhánh | `main` |
| Commit/push | **không** thực hiện |
| Working tree | có thay đổi chưa commit (xem `git status --short` ở mục cuối) |

File **mới**: `packages/core/limits.js`, `tools/bench.js`, `tests/{web-core-adapter,providers,grammar,file-limits,extension-background,parity-contract,list-false-positive}.test.js`, `tests/fixtures/parity-cases.json`, `docs/{TRACE_CLEANER_2_2_BASELINE,TRACE_CLEANER_2_2_FINAL_REPORT,BENCHMARKS}.md`.

File **xoá**: `tests/web-inline.test.js` (test hàm private cũ; thay bằng test adapter thật).

File **sửa chính**: `index.html`, `extension/{background,sidebar,content,panel}.js`, `extension/manifest.json`, `packages/core/{entities,preservation,diff,index}.js`, `packages/writing/{prompts.js,grammar/en.js}`, `tools/{sync_assets,sync_core,trace_scan,check_extension}.js/.py`, `package.json`, các file `docs/*` và `README.md`, artifact sinh tự động.

## B. Kiến trúc

- **Canonical core**: `packages/core/*` — một engine làm sạch, bảo toàn, diff, tài liệu, Markdown, giới hạn parser.
- **Bundle**: `tools/sync_assets.js` sinh `extension/core/bundle.js` (IIFE, phơi `TraceCore`, `TraceWriting`, `TraceProviders`) và nhúng cùng bundle vào `index.html` giữa marker `@generated:core:start/end`. Deterministic, `--check` fail nếu lệch.
- **Web**: `index.html` chỉ còn adapter mỏng `cleanText`/`stripMarkdown`/`preservationCheck`/`buildPrompt` gọi core; không còn regex làm sạch hay bảng phrase.
- **Extension**: `background.js` `import "./core/bundle.js"` và dùng `TraceProviders.generate` + `RequestRegistry`; sidebar là UI adapter gọi `TraceCore`.
- **Python**: `tools/trace_scan.py` giữ độc lập, đối chiếu qua `tests/fixtures/parity-cases.json`.
- **Provider**: `packages/providers/registry.js` là API duy nhất (`generate`, `listModels`, `validateConfiguration`), dùng chung web + extension.
- **Document lifecycle**: `DocumentSession` (original bất biến, working, proposal có `baseRevision`) nối vào tab **Rà soát**.
- **Generated assets**: `extension/core/bundle.js`, `extension/core/prompts.js`, `extension/core/{entities,preservation}.js`, khối `@generated:core` + `@generated:prompts` trong `index.html`.

## C. Lỗi đã sửa (hành vi gốc → nguyên nhân → sửa → test)

| # | Hành vi gốc | Nguyên nhân | Sửa | Test |
|---|---|---|---|---|
| 1 | Web làm sạch khác extension, còn xoá mục danh sách/tính từ | `index.html` có engine riêng | adapter gọi `TraceCore.cleanText`; xoá engine cũ | `web-core-adapter.test.js` (so kết quả web == core), `cleaning.test.js` |
| 2 | Preservation của web bỏ sót điều kiện/trích dẫn/Markdown | bản riêng trong `index.html` | adapter gọi `TraceCore.checkPreservation`, giữ shape cũ | `web-core-adapter.test.js` |
| 3 | Prompt web chứa mục tiêu CV, "tạo một chỗ không hoàn hảo" | `buildPrompt` riêng | dùng `TraceWriting.buildPrompt` + registry 9 chế độ | `writing-prompts.test.js`, `web-core-adapter.test.js` |
| 4 | Code fence mất khoảng trắng/dòng trống sau bước chuẩn hoá cuối | chuẩn hoá văn xuôi chạy trên toàn chuỗi | `cleaning.js` segment-aware: mỗi đoạn prose dọn riêng, vùng bảo vệ giữ nguyên byte | `core-protected.test.js` (so sánh chuỗi tuyệt đối) |
| 5 | Audit offset sai sau NFC | normalize trước khi ghi vị trí | `unicode.js` giữ offset trên chuỗi gốc (UTF-16), `OFFSET_SYSTEM='utf16-source'` | `unicode-offset.test.js` |
| 6 | Đề xuất cũ ghi đè bản mới | lifecycle chỉ ghi `baseRevision`, không kiểm | `DocumentSession.acceptProposal` từ chối `STALE_DOCUMENT_REVISION` | `document-session.test.js` |
| 7 | `applyEdits` trượt sang chỗ khác khi `index` lệch | `index` hiểu là "điểm bắt đầu tìm" | `index` = vị trí chính xác; lệch ⇒ `text_mismatch`, ngoài biên ⇒ `out_of_bounds` | `diff.test.js`, `diff-apply.test.js` |
| 8 | Báo sai "mất mục danh sách" khi văn bản gần như không đổi | regex liệt kê dùng `\s` nuốt câu sau | `entities.js`: khoảng trắng trong mục chỉ space/tab, cắt tại dấu kết câu; so khớp theo tập từ | `list-false-positive.test.js` |
| 9 | Sau khi Chấp nhận, Undo/Redo mất lịch sử | `reviewEnsure()` reset session vì `src` đã bằng working | giữ session khi `src === working` | kiểm trong Chromium + `web-core-adapter.test.js` (assert nguồn) |
| 10 | Extension có stack provider riêng, không huỷ được request | `background.js` tự viết `geminiCall`/`openaiCall` | dùng `TraceProviders` + `RequestRegistry`, thêm `cancel`, chặn gửi trùng | `extension-background.test.js` |
| 11 | Dán kết quả dù bảo toàn thất bại | nút Dán không kiểm guard | confirm rõ ràng khi có issue `severity: failed` | `extension-background.test.js` (assert nguồn sidebar) |
| 12 | ZIP/XML không có ngân sách | parser thiếu giới hạn | `packages/core/limits.js` + `unzip()`/`analyzeDocx` dùng nó | `file-limits.test.js` |
| 13 | Python đổi CRLF→LF trên Windows, `--json` không trả bản sạch | mở file text mode; chỉ tính cleaned khi `--strip` | `newline=""` khi đọc/ghi; tính `cleaned` cho `--json` | `parity-contract.test.js` |
| 14 | Version lệch (package 2.0.0-dev, manifest 2.1.0, prompt 2.1.0) | cập nhật rời rạc | 2.2.0 ở cả ba; prompt version tách riêng | `assets-sync.test.js` |

## D. Parity giữa các bề mặt

| Tính năng | Web | Extension | Python | Hợp đồng canonical | Đã kiểm |
|---|---|---|---|---|---|
| Làm sạch Unicode + văn xuôi | ✅ adapter → core | ✅ sidebar → core | ✅ CLI (tầng ký tự) | `TraceCore.cleanText` | Test JS + 8 fixture đối chiếu Python |
| Preservation | ✅ adapter → core | ✅ background → core | ❌ không có | `checkPreservation` | Test core + web adapter + extension |
| Markdown protection | ✅ | ✅ | ❌ | `splitMarkdown` | `core-protected`, `markdown` |
| Diff / review | ✅ tab Rà soát | ⚠️ chỉ hiện thay đổi + cảnh báo, không diff từng từ | ❌ | `diffWords`, `DocumentSession` | Chromium E2E cho web |
| Prompt 9 chế độ | ✅ | ✅ | ❌ | `writing/prompts.js` | `writing-prompts.test.js` |
| Provider + mã lỗi | ✅ | ✅ | ❌ | `providers/registry.js` | `providers.test.js`, `extension-background.test.js` |
| Grammar/spelling | ✅ (tab Rà soát) | ❌ | ❌ | `writing/grammar` | `grammar.test.js` |
| Giới hạn file | ✅ | ❌ (extension không parse file) | ❌ | `core/limits.js` | `file-limits.test.js` |

## E. Writing engine

Đã có (deterministic, offline, không tự áp):

- **en**: `repeated-word` (có whitelist "had had", "that that"), `would-of`, `irregular-participle`, `article-a-an` (âm đầu + ngoại lệ university/hour), `spelling-common` (22 lỗi không mơ hồ), `double-space`, `space-before-punctuation`, `space-after-comma`, `lowercase-i`, `sentence-start`, `was-were`, `third-person-dont`.
- **vi**: lặp từ, lỗi gõ phổ biến, khoảng trắng trước dấu câu, viết hoa đầu câu, lặp dấu câu.
- **neutral**: khoảng trắng, áp cho ngôn ngữ chưa hỗ trợ (kèm `supported: false`).

Mọi gợi ý có schema chung (`id,type,severity,language,start,end,original,replacement,reason,source,accepted`), offset trên chuỗi gốc, áp qua `applySuggestion` có kiểm `original` và chống chồng lấn.

**Chưa hỗ trợ**: cú pháp câu phức tạp, thì, mạo từ nâng cao, tiếng Việt ngoài các luật trên, ngôn ngữ khác. Không dùng thư viện ngoài (không thêm dependency, không gửi văn bản ra mạng).

False positive đã xử lý: whitelist lặp từ, ngoại lệ phát âm a/an, bỏ qua code/URL/email/HTML, không áp luật EN cho văn bản VI.

## F. Provider testing

Test bằng `fetch` giả, không cần API key: 200 hợp lệ, JSON hỏng, rỗng, 400/401/403/404/429/500/503, timeout, huỷ, lỗi mạng, model sai, config sai, fallback model khi 404, retry 5xx, chặn trùng request, key không lộ trong message.

Bề mặt extension: `extension-background.test.js` chạy chính `background.js` trong `vm` với `chrome.*` giả — success, 401 → `PROVIDER_AUTH_ERROR`, văn bản rỗng, cancel → `CANCELLED`, trùng id, ping.

**Chưa kiểm**: gọi API thật (không có key), CORS thật trên trình duyệt.

## G. File security

- `PARSER_LIMITS`: 60 MB file, 512 entry, 32 MB/entry, 96 MB tổng, tỉ lệ nở 120, XML 16 MB, sâu 64, 60 trang/slide, 2 MB text.
- ZIP: kiểm tên entry (chặn `..`, absolute, backslash, NUL, trùng tên), kiểu nén (chỉ 0/8), kích thước khai báo và tổng TRƯỚC khi inflate; kiểm lại sau khi inflate.
- XML: chặn `DOCTYPE`, `ENTITY`, external SYSTEM, độ sâu; chạy trước mọi regex trích xuất.
- C2PA: **chỉ dò marker cấu trúc**, không xác minh chữ ký, không kết luận chữ ký hợp lệ. Không xoá metadata provenance khi làm sạch văn bản.

**Còn lại**: không huỷ được giữa chừng một entry đang nở (Web API không cho ngắt stream theo byte); không kiểm trang PDF theo cấu trúc xref đầy đủ; không xử lý tracked changes/comments đầy đủ.

## H. Browser testing

- **Chromium (Local browser), `http://127.0.0.1:8799/index.html`**: trang tải, console 0 message, 0 lỗi mạng (chỉ request index.html).
- Quét + Làm sạch trên văn bản có ZWSP, danh sách 3 mục, phủ định, code fence, URL có dấu phẩy → giữ nguyên nội dung, ZWSP bị xoá, cảnh báo bảo toàn sạch.
- Tab Rà soát: đề xuất → diff hiện 2 span thay đổi → Chấp nhận ghi vào bản đang sửa → Undo/Redo/Restore đều đúng; đề xuất cũ bị chặn khi tài liệu đã đổi (`1 đề xuất cũ đã bị chặn`, bản thủ công không bị ghi đè).
- Gợi ý ngữ pháp: 3 gợi ý cho "This is a apple. He has went home and i think…", áp dụng được.
- **Extension trong Chrome thật: CHƯA kiểm** — không có harness tải unpacked extension trong môi trường này. Đã kiểm tĩnh (`tools/check_extension.js`) và logic service worker bằng `vm`.

## I. CI và hiệu năng

- `npm test` → **193 test, 193 pass, 0 fail, 0 skip**.
- `node tools/sync_assets.js --check` → `artifact khớp nguồn`.
- `python tools/sync_core.py --check` → `extension/core khớp packages/core`.
- `node tools/check_extension.js` → `manifest OK · v2.2.0 · 4 permission` (1 warning: content script chạy trên mọi trang http(s)).
- `node --check` trên script tách từ `index.html` và các file extension → OK.
- Benchmark thật (`node tools/bench.js --write`, xem `docs/BENCHMARKS.md`): cleanText 2k từ ≈ 2.0 ms, 20k từ ≈ 17.7 ms; preservation 20k từ ≈ 16.6 ms; diff 50k từ ≈ 14 ms; scan 20k từ ≈ 3.6 ms.
- Accessibility: chưa audit toàn diện; đã có `aria-label` cho nút phóng to, focus outline cho textarea/select, nút có `title`.

## J. Việc chưa xong

| Việc | Vì sao | Cần gì để xong |
|---|---|---|
| Extension E2E trong Chrome (Side Panel, content script, injection, restricted pages) | Môi trường không có harness Chrome unpacked | Chạy `chrome://extensions` → Load unpacked + checklist trong `docs/TESTING.md` |
| Giảm `<all_urls>` → user-triggered injection | Chưa có smoke test Chrome để chắc không mất sidebar nổi | Làm E2E trước, rồi bỏ `content_scripts`, dùng `activeTab` + `scripting` (background đã có `openFallback`) |
| Xác minh chữ ký C2PA | Cần thư viện chuẩn + trust chain; chưa thêm dependency | Tích hợp verifier chính thức, hiển thị trạng thái 8 mức |
| Grammar cho tiếng Việt đầy đủ | Regex không đủ tin cậy | Rule có ngữ cảnh + bộ test lớn hơn, hoặc engine local |
| Provider live test | Không có API key | Chạy checklist `docs/TESTING.md` với key của chủ dự án |
| PDF parser theo cấu trúc | Hiện là heuristic | Parser xref/stream thật + giới hạn |
| Tracked changes/comments trong DOCX | Chưa parse `w:ins`/`w:del` | Đọc thêm part, hiển thị riêng |
| Accessibility audit | Chưa có công cụ | axe/Lighthouse + keyboard walkthrough |
| Python parity toàn phần | Python không có Markdown/preservation | Mở rộng contract hoặc ghi rõ giới hạn (đã ghi) |

## K. Milestone đề xuất

**2.3 — Browser Reliability & Verification**: (1) E2E extension thật + giảm permission có migration, (2) provider live smoke test có key, (3) C2PA verifier thật, (4) accessibility audit + sửa, (5) mở rộng grammar VI/EN có ngữ cảnh. Lý do: các mục còn lại đều phụ thuộc môi trường (Chrome, key, thư viện xác minh) chứ không phải code chưa viết.

---

## Trạng thái Git cuối

Xem đầu ra `git status --short` trong phiên làm việc: thay đổi chưa commit, **không** commit, **không** push, không `reset --hard`, không đổi default branch.
