# Roadmap

Trạng thái tính đến 2026-11-20. "Xong" nghĩa là có mã + test (hoặc kiểm tra ghi rõ trong
`docs/TESTING.md`); không có nghĩa là đã đạt mọi tiêu chí của bản 2.0.

## Phase 0 — Audit & baseline — **xong**

- Audit đầy đủ: `docs/AUDIT.md`.
- Baseline git: `b11d616`; thay đổi của phase này **chưa commit**.
- 44 test + 3 script kiểm tra.

## Phase 1 — Toàn vẹn dữ liệu — **một phần**

| Việc | Trạng thái |
|---|---|
| Bản gốc không bị ghi đè (web) | xong: `#src` chỉ đổi khi người dùng bấm; nút `↩ Bản gốc trước khi chạy` |
| Undo chuỗi Humanize | xong: `↩ Bản trước` |
| Mô hình tài liệu có trạng thái + undo/redo | xong ở `packages/core/document.js` + test; **chưa nối vào UI** |
| Diff | xong `packages/core/diff.js` + test; **chưa có UI diff** |
| Kiểm tra bảo toàn | xong web + extension (deterministic) |
| Sửa lỗi mất dữ liệu (tricolon) | xong |
| Sửa lỗi đảo nghĩa ("not just") | xong |
| Bảo vệ URL/code/emoji cờ | xong |
| Per-change accept/reject | **chưa** (chỉ accept toàn bộ / reject toàn bộ) |

## Phase 2 — Writing engine — **chưa**

Chưa có grammar/spelling/punctuation engine deterministic. Hiện chỉ có 21 tiêu chí heuristic
(đếm tell), không phải phân tích ngữ pháp. Cần:

- Rule engine theo ngôn ngữ (en/vi), mỗi gợi ý có vị trí + giải thích + độ tin cậy.
- Hợp nhất `cleanText` (web) và `clean` (extension) vào `packages/core`.
- UI review từng gợi ý.

## Phase 3 — Natural rewrite — **một phần**

| Việc | Trạng thái |
|---|---|
| 7 chế độ viết lại | **chưa** (chỉ có 4 preset prompt: general/cover/academic/email) |
| Kiểm tra bảo toàn sau model | xong |
| Nhiều phương án cho một câu | **chưa** |
| Voice profile | **chưa** |
| Structured JSON output + validate | **chưa** |
| Trước/sau + accept từng sửa | **chưa** (có hiển thị kết quả + revert) |

## Phase 4 — Forensics — **một phần**

- Đọc metadata/ELA hiện có từ trước, **chưa được audit sâu** trong phase này.
- Giới hạn tài nguyên khi parse file: **chưa** (rủi ro mở, AUDIT F-16).
- C2PA/chữ ký: **chưa** xác minh; chỉ đọc dấu hiệu.
- Parser XLSX/PPTX/PDF: hiện tại là đọc thủ công; chưa dùng thư viện chuẩn.

## Phase 5 — Provider & extension — **một phần**

- Kiểm tra bảo toàn ở background: xong.
- Thu hẹp host permissions: xong.
- Timeout/huỷ request: **chưa**.
- Key "chỉ phiên" + nút xoá: **chưa**.
- Kiểm thử extension trong Chrome thật: **chưa**.

## Phase 6 — UI/product — **một phần**

- Nút Markdown, phóng to ô text, mount/unmount guide, undo chain: xong trước/trong phase này.
- Writing Studio nhiều mục (Studio/Rewrite/Inspector/Report/History/Settings): **chưa**.
- Accessibility audit: **chưa**.

## Phase 7 — Testing & release — **một phần**

- Unit/regression/parity: xong (44 test).
- CI workflow: có `.github/workflows/ci.yml` nhưng **chưa chạy trên GitHub** (chưa push).
- E2E, security review chuyên biệt, performance report: **chưa**.
- LICENSE: **chưa chọn**.

## Thứ tự đề xuất tiếp theo

1. Timeout + huỷ request extension (P1, nhỏ).
2. Giới hạn tài nguyên parse file + harden XML (P1).
3. UI diff + accept từng thay đổi trên nền `DocumentSession` + `diff.js` (P1).
4. Hợp nhất cleaner web/extension vào `packages/core` kèm bộ test hồi quy mở rộng (P2).
5. Grammar/spelling rule engine en/vi (P2, lớn).
6. Chọn license + viết release notes (P3).
