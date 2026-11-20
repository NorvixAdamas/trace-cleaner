# Trace Cleaner — Engineering Audit

- **Ngày audit:** 2026-11-20
- **HEAD lúc bắt đầu:** `b11d616` (`Nhẹ hơn, ô text phóng to được và tuỳ chọn Markdown giữ/xoá định dạng`)
- **Nhánh:** `main`
- **Phạm vi:** toàn bộ file được track trong repo (18 file, ~340 KB mã + guide)
- **Cách kiểm tra:** đọc mã, chạy CLI, chạy app trong Chromium với server tĩnh, viết test hồi quy
- **Nguyên tắc:** chỉ ghi "đã xác nhận" khi đã tái hiện được; suy đoán ghi rõ là chưa xác nhận

Repo không có `README.md`, `package.json`, `LICENSE`, test, hay workflow CI ở thời điểm audit. Đây là
một ứng dụng một-file (`index.html`, 3.582 dòng) + extension MV3 + CLI Python.

---

## 1. Kiến trúc hiện tại

| Thành phần | File | Vai trò |
|---|---|---|
| Web app | `index.html` | Toàn bộ UI, cleaner, scan, scoring, forensics file/ảnh, prompt, guide nhúng |
| Guide nguồn | `GUIDE.md` | Được `tools/build_guide.py` render vào 2 vùng đánh dấu trong `index.html` |
| CLI | `tools/trace_scan.py` | Quét/làm sạch Unicode, thống kê câu |
| Extension | `extension/*` | Side panel + sidebar nổi trong shadow DOM, gọi model qua background |
| Build guide | `tools/build_guide.py` | Markdown → HTML, chèn vào `index.html` |
| Icon | `tools/make_icons.py` | Sinh PNG bằng stdlib |

### Luồng dữ liệu (trước audit)

```
Người dùng → textarea#src
   ├─ Quét: scanChars/lintTells/tricolons/... → tab Báo cáo
   ├─ Làm sạch: cleanText(text, cleanOpts()) → tab Đã làm sạch / Điểm
   │     └─ (tuỳ chọn) stripMarkdown khi tắt Markdown
   └─ Chuỗi: callLLM → cleanText → ghi đè src
Extension: content/panel → background.humanize → Google/OpenAI → trả text thô
```

Cleaner tồn tại **4 bản độc lập**: `cleanText` (web), `clean` (sidebar), `strip_text` (Python),
prompt + regex trong `background.js`. Không có test dùng chung, không có fixture chung.

---

## 2. Chức năng đang có (không phải danh sách mong muốn)

- Quét codepoint (invisible, tag, PUA, bidi, homoglyph, blank, joiner, VS, typography).
- Làm sạch ký tự + một số phép sửa câu bằng regex.
- 21 tiêu chí heuristic (CV câu, em dash, tricolon, bullet, bold lead-in, v.v.) — gọi là "%".
- Viết lại bằng Gemini / OpenAI-compatible; tự đổi model khi 404, thử lại khi 503.
- Humanize 2 vòng (tuỳ chọn), preset prompt, đồng bộ prompt web ⇄ extension.
- Đọc file `.docx/.pptx/.xlsx/.pdf/.jpg/.png/.webp/.txt/.md/...` tại máy, báo metadata/ELA.
- Guide 19 chương nhúng, mount/unmount theo tab.
- Extension: Side Panel gốc, sidebar nổi, lấy/dán văn bản trang, phím tắt.

---

## 3. Lỗi và rủi ro đã xác nhận

Mức độ: **P0** mất dữ liệu/đảo nghĩa, **P1** sai chức năng rõ, **P2** rủi ro, **P3** vệ sinh.

### F-01 — P0 — Cleaner xoá mục giữa của mọi bộ ba

- **File/hàm:** `index.html` → `cleanText()`, bước 4 "tricolon → bộ hai".
- **Tái hiện:** `cleanText("Developed Android applications using Kotlin, Java, and Python.", {structural:true})`
  → `"Developed Android applications using Kotlin and Python."` (đã chạy trong Chromium).
- **Hệ quả:** mất một công nghệ/kỹ năng/dữ kiện chỉ vì câu có 3 mục. Đây là lỗi mất dữ liệu,
  không phải phong cách.
- **Sửa:** giữ đủ mục, chỉ bỏ dấu phẩy Oxford (`Kotlin, Java and Python`).
- **Test:** `tests/preservation.test.js` ("mất Java là lỗi"), `tests/web-inline.test.js`,
  kiểm tra trực tiếp trong trình duyệt.

### F-02 — P0 — Cleaner đảo nghĩa phủ định

- **File/hàm:** `index.html` → `cleanText()`, `FRAME_FIX`.
- **Tái hiện:** `"This is not just a tool, it is a platform."` → `"This is a tool, …"`.
- **Hệ quả:** câu khẳng định mạnh bị biến thành câu phủ định/khác nghĩa. Tương tự với mọi cấu trúc
  "not just X".
- **Sửa:** bỏ quy tắc `(am|is|are|was|were) not just` khỏi `FRAME_FIX`; giữ lại các khung không
  mang phủ định. Sau sửa: `"This isn't just a tool, it's a platform."` (đã kiểm tra trong Chromium).
- **Test:** kiểm tra trình duyệt (chưa có unit test tự động cho `cleanText` — xem F-13).

### F-03 — P1 — Chuỗi Humanize ghi đè văn bản gốc, không có undo

- **File/hàm:** `index.html` → `runChain()` (`src.value = cur`).
- **Hệ quả:** sau khi chạy, bản gốc biến mất khỏi ô nhập; người dùng không có đường lùi.
- **Sửa:** lưu bản trước, thêm nút `↩ Bản trước` (`#btnUndoChain`), khôi phục đúng nội dung cũ.
- **Test:** kiểm tra thủ công trong mã + UI; chưa có test e2e (xem mục 8).

### F-04 — P1 — Cleaner phá URL và code khi sửa cấu trúc

- **File/hàm:** `index.html` → `cleanText()`: URL chỉ được bảo vệ **sau** bước regex cấu trúc,
  code fence/inline code không được bảo vệ.
- **Tái hiện:** `"Visit https://example.com/a,b,and,c"` có thể bị regex tricolon/space chạm;
  `` `a, b, and c` `` bị sửa như văn xuôi.
- **Sửa:** bảo vệ URL (`\u0000…`), code fence/inline code (`\u0001…`) **trước** bước cấu trúc,
  phục hồi sau cùng. Đã kiểm tra trong Chromium: URL và `` `a, b, and c` `` nguyên vẹn.
- **Test:** kiểm tra trình duyệt; `tests/unicode.test.js` kiểm tra tầng core tương ứng.

### F-05 — P1 — Web cleaner xoá tag char của emoji cờ

- **File/hàm:** `index.html` → `cleanText()` (mọi `tag` bị xoá).
- **Hệ quả:** 🏴 + tag chars (England/Scotland…) mất phân vùng, chỉ còn lá cờ đen.
- **Sửa:** nhận diện chuỗi `U+1F3F4` + tag, thay bằng placeholder và phục hồi.
- **Test:** kiểm tra Chromium: `flagKept = true`; `packages/core/unicode.js` + `tests/unicode.test.js`
  cho tầng core.

### F-06 — P1 — CLI Python xoá tag char của cờ, không có audit

- **File/hàm:** `tools/trace_scan.py` → `strip_text()`.
- **Tái hiện:** input có emoji cờ → `--strip` trả về cờ đen, mất tag char (test parity trước sửa).
- **Sửa:** `flag_tag_positions()` giữ nguyên chuỗi; thêm `audit` (vị trí, codepoint, hành động,
  lý do) và cờ `--audit` khi xuất JSON.
- **Test:** `tests/parity.test.js` (Python CLI), `tests/unicode.test.js` (JS).

### F-07 — P2 — Bảng phân loại Python và JS lệch nhau

- **File/hàm:** `tools/trace_scan.py` vs `index.html`/`packages/core`.
- **Lệch xác nhận:** Python thiếu `U+200E/U+200F/U+061C` (LRM/RLM/ALM) trong nhóm vô hình; coi
  `U+2010/U+2011` là typography trong khi web coi là homoglyph.
- **Sửa:** thêm 3 codepoint vào `KILL`, thêm 2 dấu gạch vào `HOMOGLYPHS`; test parity so sánh
  **tập codepoint nguy hiểm** giữa JS core và Python trên cùng fixture.
- **Test:** `tests/parity.test.js` — pass.

### F-08 — P1 — Extension xin quyền host cho mọi URL

- **File:** `extension/manifest.json`.
- **Hiện trạng trước sửa:** `host_permissions` gồm `http://*/*` và `https://*/*`, dù chỉ cần 3 API.
- **Sửa:** chỉ còn `generativelanguage.googleapis.com`, `api.openai.com`, `openrouter.ai`.
  `activeTab` + `scripting` đủ cho thao tác trên tab đang mở.
- **Test:** `tools/check_extension.js` (chạy trong `npm run check:extension`).

### F-09 — P1 — Extension tin kết quả model, không kiểm tra bảo toàn

- **File/hàm:** `extension/background.js` → `humanize()`.
- **Hệ quả:** model có thể đổi số/URL/ngày, bỏ phủ định; extension vẫn trả về như bình thường.
- **Sửa:** background import `checkPreservation` từ `extension/core/` (bản sao tự động của
  `packages/core`), trả `{text, preservation}`; sidebar hiện hộp "Kiểm tra bảo toàn" + nút
  `↩ Bản trước`. Service worker chuyển sang `type: "module"`.
- **Test:** `tests/core-sync.test.js` đảm bảo bản sao khớp nguồn; `tools/check_extension.js`
  kiểm tra import tồn tại. **Chưa chạy extension trong Chrome thật** (xem mục 8).

### F-10 — P1 — Không có test, không có quy trình kiểm tra

- **Hiện trạng:** 0 test trước audit.
- **Đã thêm:** 44 test Node (`node --test tests`), fixture parity với Python, kiểm tra manifest,
  kiểm tra guide tái tạo được (`--check`).
- **Chưa có:** CI workflow, test E2E tự động.

### F-11 — P2 — API key lưu plaintext trong `localStorage`

- **File/hàm:** `index.html` → `apiCfg/loadApiCfg`, `localStorage[API_STORE]`;
  extension → `chrome.storage.local` (`traceCfg`).
- **Rủi ro:** script khác trên cùng origin, hoặc người dùng máy, đọc được key. Không phải "két mã hoá".
- **Hiện trạng:** đã có checkbox "lưu cấu hình"; key nằm trong DOM `type=password`.
- **Đề xuất:** mặc định chỉ phiên (session), chỉ lưu khi người dùng chủ động; thêm nút "Xoá key".
  **Chưa sửa** (thay đổi UX, cần quyết định sản phẩm).

### F-12 — P2 — Content script chạy trên mọi trang

- **File:** `extension/manifest.json` → `content_scripts.matches: ["<all_urls>"]`.
- **Lý do tồn tại:** sidebar nổi + phím tắt + đồng bộ prompt cần có mặt trên trang bất kỳ.
- **Rủi ro:** mã được nạp vào mọi tab; tăng bề mặt tấn công và bộ nhớ.
- **Hiện trạng:** DOM chỉ dựng khi người dùng mở; đã bỏ auto-build. **Chưa thu hẹp** vì sẽ mất
  tính năng; cần cân nhắc chuyển sang `optional_host_permissions` + `activeTab` (ghi ở ROADMAP).

### F-13 — P2 — Bốn bản cleaner, không có nguồn duy nhất

- **File:** `index.html` (`cleanText`/`stripMarkdown`), `extension/sidebar.js` (`clean`/`stripMarkdown`),
  `tools/trace_scan.py` (`strip_text`), `extension/background.js` (prompt).
- **Đã làm:** tạo `packages/core/{unicode,entities,preservation,diff,document,markdown}.js` + test;
  web dùng khối `preservationCheck` nhúng (được test trích xuất từ chính `index.html`); extension
  dùng bản sao core có kiểm tra khớp.
- **Chưa làm:** thay `cleanText`/`clean` bằng core. Đây là migration lớn, cần test hồi quy rộng
  trước khi đổi (xem ROADMAP, Phase 2).

### F-14 — P2 — Markdown xử lý bằng regex, không phải parser

- **File:** `stripMarkdown` trong `index.html` và `extension/sidebar.js`.
- **Rủi ro:** bảng, list lồng, escaped characters, code trong list có thể bị xử lý sai.
- **Đã làm:** `packages/core/markdown.js` tách code fence/inline code/link khỏi phần chữ + test.
- **Chưa làm:** nối vào web/extension; chưa dùng parser chuẩn (không thêm dependency khi chưa cần).

### F-15 — P2 — Gọi model không có timeout

- **File/hàm:** `extension/background.js` → `geminiCall/openaiCall`; `index.html` → `callGemini/callOpenAI`.
- **Rủi ro:** fetch treo, UI "đang gọi model…" vô hạn. Web có nút Dừng (AbortController), extension
  không có.
- **Đề xuất:** `AbortSignal.timeout(90_000)` + thông báo lỗi rõ. **Chưa sửa.**

### F-16 — P2 — Giới hạn tài nguyên khi đọc file chưa được kiểm chứng

- **File/hàm:** `index.html` phần forensics (`docx/pptx/xlsx/pdf/ảnh`).
- **Hiện trạng:** chưa thấy giới hạn kích thước file, số entry ZIP, hay thời gian giải nén trong
  đoạn mã đã đọc.
- **Trạng thái:** **chưa xác nhận** có lỗ hổng ZIP bomb; cần review chuyên biệt trước khi kết luận.
  Không đưa ra tuyên bố an toàn.

### F-17 — P3 — Điểm "%" dễ bị hiểu là xác suất

- **File/hàm:** `index.html` → `scoreText()`, `riskScore()`.
- **Hiện trạng:** UI đã ghi "heuristic, không phải xác suất AI"; nhưng nhãn `%` vẫn tạo cảm giác
  định lượng. Đề xuất đổi nhãn thành "điểm tell /100" ở mọi chỗ.

### F-18 — P3 — GUIDE.md có số liệu API có thể đã cũ

- **File:** `GUIDE.md` (phần Gemma/Gemini quota).
- **Trạng thái:** chưa đối chiếu lại tài liệu chính thức trong audit này; không sửa để tránh
  ghi đè bằng số liệu không kiểm chứng.

### F-19 — P3 — Không có LICENSE

- **Hiện trạng:** repo công khai nhưng không có file license → mặc định "all rights reserved".
- **Đề xuất:** người dùng chọn giấy phép (MIT/Apache-2.0/…) trước khi phát hành bản 2.0.

### F-21 — P2 — Trùng `id="btnMd"` làm nút Copy Markdown gắn nhầm listener

- **File:** `index.html` — nút Markdown ở thanh CHUỖI (dòng ~381) và nút “Copy Markdown” trong báo
  cáo file (dòng ~3169) cùng `id="btnMd"`.
- **Hệ quả:** `$("btnMd")` trả về nút đầu tiên (nút Markdown), nên bấm “Copy Markdown” không copy
  mà còn gắn thêm listener vào nút Markdown. Phát hiện bằng kiểm tra id trùng.
- **Sửa:** đổi nút trong báo cáo thành `btnCopyMd` và cập nhật handler.
- **Test:** kiểm tra id trùng (script trong lần chạy cuối) — còn 0.

### F-20 — P3 — Build guide không có chế độ kiểm tra

- **Đã sửa:** `python tools/build_guide.py --check` trả exit 1 nếu `index.html` lệch `GUIDE.md`.

---

## 4. Những gì **không** kết luận

- Không có bằng chứng file metadata chứng minh tác giả; audit không thêm bất kỳ kết luận nào như vậy.
- Chưa benchmark chất lượng viết lại; không có số liệu "giảm bao nhiêu % bị detector bắt".
- Chưa kiểm chứng C2PA/signature; không tuyên bố đã xác minh chữ ký.
- Chưa chạy extension trong Chrome thật, chưa gọi API thật (không có key hợp lệ trong phiên này).

---

## 5. Kế hoạch khắc phục ưu tiên

| Ưu tiên | Việc | Trạng thái |
|---|---|---|
| 1 | Sửa mất dữ liệu tricolon + đảo nghĩa phủ định | **xong** |
| 2 | Bảo vệ URL/code/emoji cờ trong cleaner | **xong** |
| 3 | Kiểm tra bảo toàn sau model (web + extension) | **xong** |
| 4 | Undo cho chuỗi Humanize | **xong** |
| 5 | Bảng Unicode + audit Python, parity test | **xong** |
| 6 | Thu hẹp quyền extension, kiểm tra manifest | **xong** |
| 7 | Timeout gọi model, huỷ được ở extension | chưa |
| 8 | Hợp nhất cleaner web/extension vào `packages/core` | chưa |
| 9 | Markdown parser chuẩn + giữ định dạng khi viết lại | chưa |
| 10 | Giới hạn tài nguyên khi parse file, review ZIP/XML | chưa |
| 11 | CI (GitHub Actions) chạy `npm test` + `check_extension` | chưa |
| 12 | Chọn license, viết README đầy đủ | một phần |

Chi tiết kiến trúc đích: `docs/ARCHITECTURE.md`. Kết quả đo: `docs/TESTING.md`.
Báo cáo cuối: `docs/TRACE_CLEANER_2_FINAL_REPORT.md`.
