# Roadmap

## Đã xong trong Humanize 3.0 (2026-11-21)

- `analyzeWriting`: grammar + clarity + readability + document insights trong một report.
- Schema gợi ý có `revision`, `preservationStatus`; áp gợi ý kiểm tra stale và bảo toàn.
- Registry prompt 3.0: 12 chế độ canonical + cover/email, alias cũ, custom voice.
- `comparePreservation`: số, tên, ngày, URL, email, trích dẫn, phủ định, điều kiện,
  qualifier, modal, danh sách, Markdown.
- Không sửa chữ trong trích dẫn trực tiếp; prompt coi tài liệu là dữ liệu không tin cậy.
- Evaluation thêm F1/FPR/FNR/entity/number/citation/latency/failure; UI review có
  readability, document insights và lọc theo loại.
- Benchmark thật 500–5000 từ trong `docs/HUMANIZE_3_BENCHMARKS.md`.

## Còn mở sau 3.0

- **Gate F**: 400 case có review độc lập + corpus có license; hiện chỉ 36 case tự viết.
- **Vietnamese grammar thật**: classifier, trật tự từ, sắc thái; hiện deterministic một phần.
- **Worker isolation** cho văn bản rất lớn và timeout cứng ở tầng UI.
- **Provider live verification** với key của chủ dự án; hiện chỉ test deterministic.
- **Custom Voice**: editor profile đã có ở web; extension chưa có editor tương đương và chưa có E2E.
- Corpus DOCX/PPTX/XLSX/C2PA độc lập vẫn chưa có.

## Đã xong trong 2.2 (2026-11-20)

- Web dùng canonical core (bundle sinh tự động, adapter mỏng, test phát hiện tái nhập engine riêng).
- Preservation, prompt, provider thống nhất giữa web và extension.
- `DocumentSession` nối vào UI: diff, chấp nhận/từ chối, undo/redo, khôi phục, export, chặn đề xuất cũ.
- `applyEdits` an toàn (vị trí chính xác, chống chồng lấn).
- Giới hạn parser + ZIP/XML hardening.
- Grammar/spelling deterministic cho en + một phần vi.
- Huỷ request thật ở extension, chống gửi trùng, gate dán khi bảo toàn thất bại.
- Python: giữ CRLF, `--json` trả bản sạch, fixture parity dùng chung.
- Benchmark thật, tài liệu 2.2 (baseline + báo cáo A–K), version đồng bộ 2.2.0.

## 2.3 — Browser Reliability & Verification (đề xuất)

1. **Chrome E2E thật** cho extension: Load unpacked, Side Panel, sidebar nổi, content script,
   injection, trang bị chặn, huỷ request, reload extension. Checklist đã có trong `docs/TESTING.md`.
2. **Giảm permission**: sau khi E2E xanh, bỏ `content_scripts` khỏi manifest, chuyển sang
   `activeTab` + `chrome.scripting` (đường `openFallback` đã có). Cần migration: bấm icon lần đầu
   để chèn sidebar, giữ phím tắt qua `commands`.
3. **Provider live smoke test** với key của chủ dự án (không đưa key vào repo/chat).
4. **C2PA verifier thật**: chọn thư viện chuẩn, hiển thị 8 trạng thái (không marker → marker →
   manifest → chữ ký → đã xác minh → trust chain), không bao giờ nói "hợp lệ" khi chưa xác minh.
5. **Accessibility audit**: axe/Lighthouse + điều hướng bàn phím, `aria-live` cho trạng thái,
   `prefers-reduced-motion`, tương phản.

## 2.4 — Document depth

- Parse tracked changes/comments trong DOCX; speaker notes/embedded boundaries trong PPTX.
- PDF: parser xref/stream thật, phát hiện incremental update và JavaScript một cách cấu trúc.
- Markdown: parser đầy đủ (nếu cần) với đánh giá license/kích thước/offline, hoặc fail-safe rõ ràng
  cho bảng, blockquote lồng, link có ngoặc.
- Grammar VI có ngữ cảnh; mở rộng EN (thì, giới từ, câu phức) với bộ false-positive lớn hơn.

## Không nằm trong roadmap

- Bypass detector, che giấu tác giả AI, làm sai provenance, xoá lịch sử tài liệu thật.
- Backend lưu văn bản người dùng.
- Tự động ghi đè trang web hoặc tài liệu mà không có bước duyệt.
