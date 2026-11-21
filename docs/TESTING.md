# Testing

## Chạy

```bash
npm test                              # = node --test tests/*.test.js
node tools/sync_assets.js --check     # bundle + prompt + index.html khớp nguồn
python tools/sync_core.py --check     # extension/core khớp packages/core
node tools/check_extension.js         # manifest, thứ tự nạp core, artifact, icon
python tools/build_guide.py --check   # guide trong index.html khớp GUIDE.md
node tools/bench.js                   # benchmark (không phải test)
```

Yêu cầu: Node ≥ 20, Python 3.11+ cho parity/build. Test Python tự `skip` nếu không có `python`.

## Kết quả chạy 2026-11-20 (sau 2.3)

| Lệnh | Kết quả |
|---|---|
| `npm test` | **311 pass, 0 fail, 0 skip** |
| `npx playwright test` | **6 pass, 0 fail** (5 extension + 1 web rewrite) |
| `node tools/sync_assets.js --check` | `artifact khớp nguồn` |
| `python tools/sync_core.py --check` | `extension/core khớp packages/core` |
| `node tools/check_extension.js` | `manifest OK · v2.3.0 · 4 permission` (1 warning: content script rộng) |
| `node tools/eval_writing.js --check` | dev 20/20 · held-out 10/10, 0 thừa |
| `node --check` script tách từ `index.html` + 5 file extension | exit 0 |

### Chrome E2E thật (Playwright 1.65.1 + Chromium 159)

`tests/e2e/extension.spec.js` mở Chromium **headed** với `--load-extension`, dùng service worker,
content script và storage thật; provider được giả lập bằng `context.route` (không cần API key):

| Test | Nội dung kiểm |
|---|---|
| panel render | `panel.html` thật, ping trả `engine 2.3` / `prompt 2.3.0`, manifest 2.3.0 |
| API key | mặc định không có key trong local, key nằm ở session; tick ghi nhớ → local; reload → nạp lại; Xoá key → sạch cả hai |
| huỷ request | background abort thật (`requestfailed` = `net::ERR_ABORTED`), UI dừng chờ, kết quả về muộn không ghi đè output |
| custom host | origin chưa cấp quyền → `CONFIG_ERROR` trước khi gọi mạng |
| sidebar nổi | `Alt+Shift+S` inject, lấy chữ từ textarea của trang, đóng/mở lại, nút của trang vẫn click được |
| web rewrite (A9) | hiển thị = proposal = bản Accept; raw của model không lọt vào Review; khôi phục bản gốc đúng |

Không test được bằng Playwright: bong bóng Side Panel do Chrome vẽ (chỉ mở bằng click toolbar);
phần UI bên trong được test qua chính `panel.html`. CI chạy E2E dưới `xvfb-run`.

## Test có gì

| File | Nội dung |
|---|---|
| `cleaning.test.js` | danh sách 3–4 mục, phủ định EN/VI, URL/email/code, joiner/VS/cờ, audit, idempotent, `markdown:false` |
| `unicode.test.js` | phân loại, vị trí scan, giữ ZWJ/VS/cờ, tiếng Việt, em dash, idempotent |
| `unicode-offset.test.js` | offset trên chuỗi gốc: decomposed tiếng Việt, tiếng Ả Rập, emoji sau dấu tách |
| `core-protected.test.js` | code fence/URL/inline code giữ nguyên **byte**, CRLF, tab, khoảng trắng cuối |
| `preservation.test.js` | số, đảo chiều `from…to`, phủ định/điều kiện, URL, trích dẫn, Markdown |
| `list-false-positive.test.js` | ranh giới mục liệt kê, false `list_item_removed`, mất mục thật vẫn bắt |
| `markdown.test.js` | tách code/link/fence, strip giữ nội dung |
| `diff.test.js`, `diff-apply.test.js` | word diff, áp nhiều edit, `index` chính xác, chồng lấn, ngoài biên |
| `document-session.test.js` | stale revision, reject, undo/redo, export, diff so bản gốc |
| `web-core-adapter.test.js` | web adapter == core; phát hiện nhét lại engine/preservation riêng; prompt không còn mục tiêu detector |
| `extension-sidebar.test.js` | nạp bundle + sidebar trong `vm`: danh sách, phủ định, ZWJ/cờ, URL/code, audit |
| `extension-background.test.js` | chạy `background.js` thật với `chrome.*` giả: success, 401, rỗng, cancel, gửi trùng, ping; nguồn sidebar có nút Huỷ + gate |
| `providers.test.js` | 200/JSON hỏng/rỗng/400/401/403/404/429/500/503, timeout, huỷ, mạng, fallback, trùng, key không lộ |
| `grammar.test.js` | positive/negative/false-positive/Unicode/ngôn ngữ cho từng luật |
| `file-limits.test.js` | tên entry ZIP, path traversal, số entry, tỉ lệ nở, tổng dung lượng, DTD/ENTITY, độ sâu XML |
| `parity.test.js`, `parity-contract.test.js` | JS vs Python: codepoint, bản sạch trên 8 fixture dùng chung, CRLF |
| `assets-sync.test.js` | drift bundle/prompt/index.html, manifest, marker duy nhất |
| `writing-prompts.test.js` | 9 chế độ khác nhau, không chỉ dẫn xoá, web khớp registry |
| `core-sync.test.js` | `extension/core` khớp `packages/core` |
| `zip.test.js` | streaming budget, 1 byte vượt trần, tổng dung lượng, ratio, metadata sai, archive cụt, entry trùng/traversal/mã hoá, huỷ giữa chừng, CRC32 |
| `xml.test.js` | well-formed, entity, CDATA, DTD/ENTITY, thuộc tính trùng, độ sâu/node/text, số dòng |
| `ooxml.test.js` | DOCX ins/del/comment/anchor, PPTX thứ tự slide + notes, XLSX shared/inline/number/bool/error/formula/ngày/hidden, relationship hỏng |
| `pdf.test.js` | xref table/stream, ObjStm, Flate+predictor, ToUnicode, trang, encrypted, scan, file cụt |
| `c2pa.test.js` | chữ ký hợp lệ, asset bị sửa, chữ ký sai, manifest hỏng, không có C2PA, trust store |
| `document-invariants.test.js` | metadata không ghi đè proposal, proposal frozen, acceptEdit, applyLocalEdit (offset cũ bị từ chối), lịch sử |
| `writing-eval.test.js`, `consistency.test.js` | precision/recall/offset/preservation trên dev + held-out; nhất quán thuật ngữ/ngày/số/đơn vị |

## Regression bắt buộc

- `Kotlin, Java, and Python` · `React, Node.js, and PostgreSQL` · `planning, implementation, testing, and deployment` · `small, medium, large, and extra-large` · `C++, C#, and F#` — không mất mục nào.
- `It is not just a tool, it is a platform.` · `This is not available unless the user enables permissions.` · `Không phải mọi thay đổi đều an toàn.` · `Chỉ người dùng có quyền mới được truy cập.` — không đảo nghĩa.
- `https://example.com/a,b,and,c` · `https://example.com/path?x=1&y=2` · `` `const result = a, b, and c;` `` · code fence Python — nguyên byte.
- `👨‍👩‍👧` · `🇻🇳` · `❤️` · `می‌خواهم` — joiner/VS/tag không bị xoá.
- Prompt không được chứa chỉ dẫn xoá nội dung, mục tiêu CV, "tạo một chỗ không hoàn hảo".

## Kiểm tra trong Chromium — 2026-11-20 (2.2)

Server: `python -m http.server 8799 --bind 127.0.0.1`, mở `index.html` trong Chromium (Local
browser của Desktop).

| Bước | Kết quả |
|---|---|
| Tải trang | HTTP 200, console **0 message**, mạng chỉ có request `index.html` |
| Quét + Làm sạch văn bản có ZWSP, list 3 mục, phủ định, code fence, URL `…/a,b` | giữ nguyên nội dung; ZWSP bị xoá; báo cáo bảo toàn sạch |
| Tab Rà soát: đề xuất → diff | 2 span thay đổi, nút Chấp nhận bật, đề xuất hiển thị |
| Chấp nhận | bản đang sửa + ô nhập cập nhật, diff về 0, Undo bật |
| Undo / Redo / Về bản gốc | lần lượt đúng cả ba |
| Đề xuất cũ sau khi tài liệu đổi | không ghi đè bản thủ công, bộ đếm "đề xuất cũ đã bị chặn" tăng |
| Gợi ý ngữ pháp | 3 gợi ý cho "This is a apple. He has went home and i think…", áp dụng được |

**Chưa kiểm**: extension trong Chrome thật (không có harness unpacked extension ở môi trường này),
provider gọi API thật (không có key), accessibility audit.

## Checklist thủ công cho extension (bắt buộc trước khi tin tưởng permission model)

1. `chrome://extensions` → Load unpacked `extension/` → không có lỗi manifest.
2. Bấm icon → Side Panel mở; `Alt+Shift+T`; `Alt+Shift+S` mở sidebar nổi.
3. Trên trang có `<textarea>`: "Lấy văn bản đang chọn", "Dán vào trang" hoạt động.
4. Trang `chrome://settings` (restricted): không có sidebar, thông báo rõ ràng, không crash.
5. Chạy Humanize không có key → `CONFIG_ERROR`; key sai → `PROVIDER_AUTH_ERROR`.
6. Bấm **Huỷ** giữa request → `CANCELLED`, không có kết quả cũ ghi đè.
7. Kết quả làm mất một mục danh sách → nút Dán yêu cầu xác nhận.
8. Reload extension khi một request đang chạy → không treo, mở lại được.
9. Tắt mạng → `NETWORK_ERROR`; bật lại → gọi được.
