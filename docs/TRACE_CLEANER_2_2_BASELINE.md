# Trace Cleaner 2.2 — Baseline (trước khi sửa)

Ghi tại thời điểm bắt đầu sprint 2.2. Mọi phát biểu dưới đây được kiểm bằng cách đọc
source và chạy lệnh, không dựa vào tài liệu cũ. Bản baseline còn truy được bằng
`git show 056cd6b:<path>`.

## 1. Trạng thái Git

| Mục | Giá trị |
|---|---|
| HEAD | `056cd6b949eb5877272e443eb8620be3e59eeda4` |
| Nhánh | `main` |
| Local vs `origin/main` | bằng nhau, working tree sạch |
| Commit gần nhất | `056cd6b` Documentation and CI artifact validation |
| Trước đó | `499c762` Extension 2.1.0 integration · `4730665` Canonical engine |

Ba commit 2.1 đã ở trên remote; báo cáo cũ (nói "chưa push") đã lỗi thời.

## 2. Kiến trúc tại baseline

```
index.html                     app 1 file: UI + cleaner riêng + preservation riêng + buildPrompt riêng
GUIDE.md                       nguồn guide, build vào index.html
packages/core/                 unicode, entities, preservation, diff, document, markdown, cleaning (ESM)
packages/writing/prompts.js    registry 9 chế độ (đã có)
packages/providers/            errors, request, google, openai-compatible, registry (đã có, CHỈ extension dùng)
extension/core/bundle.js       bundle sinh tự động (core + writing + providers)
extension/core/prompts.js      prompt sinh tự động
extension/core/{entities,preservation}.js  bản copy cho service worker
extension/{background,sidebar,content,panel}.js
tools/sync_assets.js           sinh bundle + prompt + khối prompt trong index.html
tools/sync_core.py             copy entities/preservation sang extension/core
tools/trace_scan.py            CLI Python độc lập
tools/build_guide.py           GUIDE.md → index.html
tests/*.test.js                73 test
```

## 3. Điểm vào thực tế

| Bề mặt | Điểm vào | Ghi chú |
|---|---|---|
| Web | `index.html` (mở trực tiếp hoặc GitHub Pages) | 1 file, không build step |
| Extension | `extension/manifest.json` → `background.js` (SW), `sidebar.js` + `content.js` (content script), `panel.js` (Side Panel) | MV3 |
| CLI | `python tools/trace_scan.py` | không mạng |
| Sinh artifact | `tools/sync_assets.js`, `tools/sync_core.py`, `tools/build_guide.py` | CI check drift |

## 4. Trùng lặp thuật toán tại baseline

| Hành vi | Bản canonical | Bản sao ở web | Hệ quả |
|---|---|---|---|
| Làm sạch Unicode/văn xuôi | `packages/core/cleaning.js` | `function cleanText()` trong `index.html` | Hai kết quả khác nhau; web còn regex phá nội dung |
| Bảo toàn nội dung | `packages/core/preservation.js` | `function preservationCheck()` trong `index.html` | Web bỏ qua các check mới (điều kiện, trích dẫn, Markdown) |
| Prompt | `packages/writing/prompts.js` | `function buildPrompt(text, strict)` | Web có mục tiêu CV, "tạo một chỗ không hoàn hảo" |
| Provider | `packages/providers/*` | `geminiCall`/`openaiCall`/`withTimeout` trong `background.js` | Mã lỗi và fallback khác web |

## 5. Hàm có nhưng chưa nối vào luồng thật (baseline)

- `packages/core/document.js` → `DocumentSession`: có test, **không** có UI.
- `packages/core/diff.js` → `applyEdits`, `diffWords`: `diffWords` chỉ dùng cho thống kê; không có diff view.
- `packages/writing/grammar/*`: chưa tồn tại; không có engine ngữ pháp/chính tả thật.
- `packages/providers/*`: web không dùng; extension dùng code riêng.
- `packages/core/limits.js`: chưa tồn tại; parser file không có ngân sách tài nguyên.

## 6. 14 điểm tồn đọng — xác minh tại baseline

| # | Điểm | Kết quả kiểm | Bằng chứng |
|---|---|---|---|
| 1 | Web dùng `cleanText()` riêng | **Đúng** | `index.html` có `function cleanText(text, o)` với bảng `PHRASES`, `CONTRACT`, regex xoá |
| 2 | Web dùng `preservationCheck()` riêng | **Đúng** | `index.html` tự đếm số/URL/ngày, không gọi core |
| 3 | Web có `buildPrompt(text, strict)` riêng | **Đúng** | chứa "CV ≥", "một chỗ không hoàn hảo", danh sách từ cấm |
| 4 | DocumentSession không nối vào UI | **Đúng** | không có tham chiếu `DocumentSession` trong `index.html` |
| 5 | Diff có API nhưng không có review UI | **Đúng** | không có tab/khung diff |
| 6 | Provider chưa thống nhất | **Đúng** | web gọi `callLLM`; extension gọi `geminiCall`/`openaiCall` |
| 7 | Extension thiếu test timeout/lỗi | **Đúng** | không có test nào chạm `background.js` |
| 8 | Parser file thiếu giới hạn | **Đúng** | `unzip()` không giới hạn entry/tỉ lệ/đường dẫn; không chặn DTD/ENTITY |
| 9 | Không có engine ngữ pháp/chính tả | **Đúng** | `packages/writing/` chỉ có prompts + suggestions mỏng |
| 10 | Extension còn `<all_urls>` | **Đúng** | `manifest.json` → `content_scripts[0].matches` |
| 11 | API key lưu plaintext khi chọn ghi nhớ | **Đúng** | `localStorage` / `chrome.storage.local` |
| 12 | C2PA không được xác minh mật mã | **Đúng** | chỉ dò marker chuỗi, không kiểm chữ ký |
| 13 | Chrome chưa test end-to-end | **Đúng** | không có harness/extension E2E |
| 14 | Báo cáo cuối mô tả baseline cũ | **Đúng** | `docs/TRACE_CLEANER_2_FINAL_REPORT.md` nói HEAD `5fb0721`, "chưa push" |

## 7. Rủi ro bảo mật tại baseline

1. ZIP: không giới hạn số entry, không chặn `..`/absolute path, không giới hạn tổng dung lượng giải nén, không chặn tỉ lệ nở → zip bomb / treo tab.
2. XML: `document.xml` được decode rồi chạy regex trực tiếp, không chặn `DOCTYPE`/`ENTITY`.
3. Extension: content script trên mọi URL, kể cả `file://` (khi người dùng bật).
4. API key: có thể nằm trong `localStorage` vĩnh viễn nếu người dùng tick "ghi nhớ"; không có nút xoá ở extension.
5. Base URL tuỳ ý: key có thể bị gửi tới host không mong muốn nếu người dùng dán URL lạ.
6. Prompt web cũ có chỉ dẫn tạo lỗi cố ý — không phải rủi ro bảo mật nhưng là rủi ro chất lượng/học thuật.

## 8. Test tại baseline

`node --test tests/*.test.js` → **73 pass, 0 fail**. Khoảng trống:

- Không test adapter web (chỉ trích hàm private ra test, nên không phát hiện web lệch core).
- Không test `background.js`, `content.js`, `panel.js`.
- Không test parser/ZIP/XML.
- Không test grammar (chưa có).
- Parity Python chỉ so danh sách codepoint, không so bản sạch/offset/CRLF.

## 9. Kết luận baseline

Sản phẩm đang ở trạng thái "đã có core tốt nhưng web chưa dùng core". Sprint 2.2 ưu tiên:
(1) web dùng core canonical, (2) sửa lỗi toàn vẹn dữ liệu, (3) review workspace thật,
(4) provider/cancel thống nhất, (5) giới hạn parser, (6) ngữ pháp thật, (7) E2E + tài liệu.
