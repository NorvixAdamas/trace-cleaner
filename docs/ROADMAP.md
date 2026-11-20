# Roadmap

Trạng thái 2026-11-20, sau 2.1. "Xong" = có mã + test (hoặc kiểm tra ghi rõ trong
`docs/TESTING.md`), không phải "đã đạt mọi tiêu chí".

## 0 — Baseline — xong

- `docs/UNIFIED_BASELINE.md`: HEAD `5fb0721`, ma trận bề mặt, 7 nhóm trùng lặp, 5 lỗi P0 tái hiện được.

## 1 — Toàn vẹn dữ liệu (P0) — xong cho extension, một phần cho web

| Việc | Trạng thái |
|---|---|
| Extension không còn xoá mục danh sách | xong — quy tắc tricolon bị xoá, có 5 regression test |
| Extension không còn đảo phủ định | xong — `FRAME2` bị xoá, 5 test EN/VI |
| Extension không xoá ZWJ/ZWNJ/VS/cờ | xong — dùng `unicode.clean`, 4 test |
| Prompt không còn chỉ dẫn xoá nội dung | xong — registry duy nhất, test quét 3 bề mặt |
| Web cleaner không xoá mục | xong từ 2.0, test `web-inline` |
| Web dùng core canonical | **chưa** — vẫn bản nhúng |

## 2 — Core canonical — một phần

| Việc | Trạng thái |
|---|---|
| `packages/core/cleaning.js` | xong, 10 test |
| `packages/writing/prompts.js` (9 chế độ) | xong, 7 test |
| Bundle classic-script sinh tự động + `--check` | xong |
| Extension dùng bundle, sidebar thành UI adapter | xong, 7 test |
| Web nhúng bundle, bỏ bản sao cleaner/preservation | **chưa** (mốc #1 dưới đây) |
| Python dùng fixture chung nhiều hơn | một phần (parity 2 test) |

## 3 — Cross-surface parity — một phần

- extension ↔ core: có test. Python ↔ JS: có parity test. **web ↔ core: chưa có**.
- Mã lỗi provider: extension có mã, web vẫn hiện chuỗi lỗi → chưa thống nhất.

## 4 — Document lifecycle & review — chưa nối UI

- `DocumentSession` + `diff.js` có API và test (10 test markdown/document + 6 diff).
- Chưa có UI diff, accept/reject từng sửa, revision history trong app.

## 5 — Provider — một phần

| Việc | Trạng thái |
|---|---|
| Timeout 60s + `AbortController` | xong ở extension (chưa có test tự động) |
| Mã lỗi chuẩn hoá | xong ở extension |
| Fallback model chỉ khi 404 | xong |
| Huỷ request từ UI | một phần — `btnStopRewrite` (web) có; extension chưa có nút huỷ |
| Key "chỉ phiên" + nút xoá | **chưa** |
| Mã lỗi thống nhất web ↔ extension | **chưa** |

## 6 — Writing intelligence — chưa

- Không có grammar/spelling/punctuation engine. Không được quảng cáo là có.
- 9 chế độ viết lại đã có trong registry + select ở extension; web mới có 4 preset UI.
- Voice profile, nhiều phương án/câu, structured JSON output: **chưa**.

## 7 — Security & forensics — chưa đổi trong 2.1

- Giới hạn kích thước/giải nén/XML: **chưa** (rủi ro mở).
- `<all_urls>` content script: **vẫn còn**, có lý do và ghi chú trong SECURITY.
- C2PA/signature verification: **chưa**.

## 8 — CI/E2E/docs — một phần

- CI có thêm bước `sync_assets.js --check`; chưa chạy trên GitHub vì chưa push.
- Test: 73 pass local (Node 26). Chrome smoke test: **chưa**.
- Docs đã cập nhật theo hiện trạng; LICENSE vẫn chưa chọn.

## Thứ tự đề xuất

1. **Web dùng core canonical**: nhúng `extension/core/bundle.js` vào `index.html` qua marker
   `@generated:core`, đổi `cleanText`/`preservationCheck` thành adapter gọi `TraceCore`, đổi
   `web-inline.test.js` sang test adapter + bundle thật. Đây là điều kiện để nói "một nguồn sự thật".
2. Test timeout/mã lỗi provider bằng `fetch` giả trong Node.
3. Giới hạn tài nguyên parse file + harden XML (P1 bảo mật).
4. UI diff + accept/reject từng thay đổi trên `DocumentSession`.
5. Grammar rule engine en/vi (chỉ công bố khi có test cho từng rule).
6. Chrome smoke test có ghi lại kết quả, rồi mới tính chuyện thu hẹp `<all_urls>`.
