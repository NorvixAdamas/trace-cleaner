# Testing

## Chạy

```bash
node --test tests                 # 44 test, không cần cài dependency
python tools/build_guide.py --check
node tools/check_extension.js
python tools/sync_core.py --check
```

`npm test` / `npm run check` là alias (package.json), nhưng npm không bắt buộc.

Yêu cầu: Node ≥ 20 (đã chạy trên v26.13.0), Python 3.11 cho test parity và các script build.
Test parity tự `skip` nếu không tìm thấy `python`.

## Kết quả chạy ngày 2026-11-20

| Lệnh | Kết quả |
|---|---|
| `node --test tests` | **44 pass, 0 fail**, 0 skip (≈0,4 s) |
| `python tools/build_guide.py --check` | `index.html không đổi (guide đã khớp)`, exit 0 |
| `node tools/check_extension.js` | `manifest OK · v1.4.0 · 4 permission`, exit 0 (1 warning: content script chạy mọi trang) |
| `python tools/sync_core.py --check` | `extension/core khớp packages/core`, exit 0 |
| `python -c "ast.parse(...)"` | `trace_scan.py` hợp lệ cú pháp |
| `node -e "new Function(<script trong index.html>)"` | script web hợp lệ cú pháp |

## Test có gì

| File | Nội dung |
|---|---|
| `tests/unicode.test.js` (10) | phân loại, scan theo vị trí, giữ ZWJ/VS, giữ emoji cờ, audit, tiếng Việt, em dash/quote, idempotent |
| `tests/preservation.test.js` (10) | Kotlin/Java/Python, số bị đổi, đảo chiều `from…to`, phủ định + điều kiện, URL, trích dẫn, Markdown, độ dài |
| `tests/diff.test.js` (6) | word diff, dựng lại văn bản từ ops, similarity, applyEdits |
| `tests/markdown.test.js` (10) | vòng đời tài liệu (original/proposed/accepted, undo/redo, export), tách code/link, strip |
| `tests/parity.test.js` (2) | JS core vs Python CLI trên cùng fixture (ZWSP, BOM, homoglyph, bidi, PUA, cờ, LRM/RLM/ALM); Python không phá cờ/ZWJ |
| `tests/core-sync.test.js` (1) | `extension/core` khớp `packages/core` |
| `tests/web-inline.test.js` (4) | trích hàm `preservationCheck` từ chính `index.html` và kiểm tra 4 hành vi then chốt |

## Regression bắt buộc (đã có)

- `"Developed Android applications using Kotlin, Java, and Python."` — không được mất mục nào.
- `"… from 4.2 seconds to 2.1 seconds."` — cả hai số và chiều so sánh phải giữ.
- `"The feature is not available unless …"` — `not` và `unless` phải còn.
- `"Visit https://example.com/docs"` — URL phải nguyên vẹn.
- Markdown: heading/bullet/link/code không bị làm phẳng khi bật giữ Markdown.

## Kiểm tra thủ công trong Chromium (2026-11-20)

Server: `python -m http.server 8781 --bind 127.0.0.1` → `http://127.0.0.1:8781/index.html`
(HTTP 200, 280.091 byte). Gọi trực tiếp `cleanText` trong trang:

| Input | Kỳ vọng | Kết quả |
|---|---|---|
| `…using Kotlin, Java, and Python.` | còn đủ 3 | `…Kotlin, Java and Python.` |
| `Visit https://example.com/a,b,and,c then continue.` | URL nguyên | nguyên vẹn |
| `**Bold:** text — with \`a, b, and c\` inline.` | giữ bold + code | `**Bold:** text, with \`a, b, and c\` inline.` |
| `Cờ 🏴󠁧󠁢󠁿 và nhà 👨‍👩` | giữ tag/ZWJ | giữ nguyên |
| `This is not just a tool…` | không đảo nghĩa | `This isn't just a tool…` |

Console: **0 lỗi** trong suốt các lần gọi.

## Chưa kiểm tra (và không được coi là đã pass)

- Extension trong Chrome thật (nạp unpacked, bấm icon, Side Panel, `Alt+Shift+S`): **chưa chạy**.
  Đã kiểm tra tĩnh manifest + import + cú pháp.
- Gọi API thật (Gemini/OpenAI): **chưa chạy** — không có key hợp lệ trong phiên này. Vì vậy
  luồng "model trả về → kiểm tra bảo toàn → hiện cảnh báo" mới được test ở tầng hàm, chưa E2E.
- File forensics với fixture docx/pptx/xlsx/pdf/ảnh hợp lệ và file hỏng: **chưa có fixture**.
- Hiệu năng/RAM: **không đo lại** trong phiên này; không đưa ra số liệu mới.
- Accessibility (bàn phím, screen reader): **chưa kiểm tra**.
- C2PA/chữ ký số: **chưa kiểm tra**.

## Khi thêm test

- Fixture dùng chung cho JS/Python đặt ở `tests/parity.test.js` hoặc thêm file dưới `tests/fixtures/`.
- Không đánh dấu pass cho hành vi chưa chạy; dùng `t.skip` kèm lý do.
- Test nào chạm vào `index.html` phải đọc từ file thật, không copy hàm sang test (tránh test
  xanh trong khi code web đã khác).
