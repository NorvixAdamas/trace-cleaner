# Benchmarks — Trace Cleaner 2.2

Số đo thật, sinh bởi `node tools/bench.js --write` ngày 2026-11-20.

- Máy: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz · win32 x64 · 16 GB RAM
- Node: v26.13.0
- Mỗi phép đo: 1 lần warmup + 5 lần (grammar/document/provider: 3 lần), báo trung vị.
- Không có số liệu trình duyệt trong bảng này; chi phí render/DOM chưa được đo.

| Phép đo | Kích thước | Trung vị | Min | Max | Ghi chú |
|---|---|---|---|---|---|
| unicode scan | 2k từ | 0.45 ms | 0.37 ms | 0.60 ms | 11834 ký tự |
| cleanText (markdown) | 2k từ | 1.97 ms | 1.78 ms | 2.27 ms |  |
| cleanText (plain) | 2k từ | 2.26 ms | 2.07 ms | 2.63 ms |  |
| preservation check | 2k từ | 1.82 ms | 1.57 ms | 2.35 ms |  |
| markdown split | 2k từ | 0.05 ms | 0.05 ms | 0.05 ms |  |
| word diff (self) | 2k từ | 0.39 ms | 0.27 ms | 0.54 ms |  |
| grammar analyze | 2k từ | 2.27 ms | 1.60 ms | 2.31 ms |  |
| document session | 2k từ | 0.02 ms | 0.01 ms | 0.03 ms |  |
| unicode scan | 20k từ | 2.01 ms | 1.96 ms | 4.37 ms | 117758 ký tự |
| cleanText (markdown) | 20k từ | 21.92 ms | 18.09 ms | 22.58 ms |  |
| cleanText (plain) | 20k từ | 25.89 ms | 23.40 ms | 35.43 ms |  |
| preservation check | 20k từ | 16.25 ms | 15.42 ms | 17.87 ms |  |
| markdown split | 20k từ | 0.44 ms | 0.43 ms | 0.70 ms |  |
| word diff (self) | 20k từ | 3.38 ms | 2.77 ms | 3.86 ms |  |
| grammar analyze | 20k từ | 20.44 ms | 19.43 ms | 20.99 ms |  |
| document session | 20k từ | 0.01 ms | 0.01 ms | 0.01 ms |  |
| zip budget (120 entry) | — | 0.06 ms | 0.05 ms | 0.08 ms |  |
| xml safety (16 KB) | — | 0.22 ms | 0.22 ms | 0.23 ms |  |
| provider overhead (mock) | — | 0.14 ms | 0.14 ms | 0.16 ms |  |

- word diff 50k từ (so với chính nó, có thay đổi): 17.72 ms
- cleanText (markdown): 2k từ: 1.97 ms · 20k từ: 21.92 ms

## 2.3 — parser cấu trúc và writing intelligence (2026-11-20)

Sinh bởi `node tools/bench_2_3.js`, cùng máy i7-9750H / 16 GB / Node v26.13.0, mỗi case 3 lần,
báo trung vị. Đây là **số Node**, không phải số trình duyệt.

| Phép đo | Kích thước | Trung vị |
|---|---|---|
| ZIP đọc entry (streaming inflate) | 2.7 MB base64 không nén được | **27 ms** |
| DOCX phân tích cấu trúc (3000 đoạn) | 257 KB XML | **34 ms** |
| PPTX (2 slide + notes) | fixture | 3 ms |
| XLSX (1 sheet, shared strings, ngày, công thức) | fixture | 2 ms |
| PDF (100 trang, text layer) | 100 trang | 5 ms |
| C2PA xác minh chữ ký PNG đã ký | fixture | 1 ms |
| Grammar VI (260 đoạn) | ~33k ký tự | 5.6 ms |
| Grammar EN (200 câu) | ~16k ký tự | 1.7 ms |
| Consistency VI (260 đoạn) | ~33k ký tự | 0.9 ms |
| Word diff | 100k ký tự | 1.7 ms |

**Trước/sau đáng chú ý:** cùng file DOCX 3000 đoạn mất **2 649 ms** ở bản đầu của parser 2.3 do
`lineAt()` quét lại từ đầu chuỗi cho mỗi element (O(n²)); sau khi đổi sang bộ đếm dòng tăng dần còn
**34 ms** (≈78×). Đây là số đo trước/sau trên cùng máy, cùng fixture.

**Đo trong trình duyệt:** chưa có benchmark DOM/render. Phân tích file trong web chạy trên main
thread; với file sát trần (3000+ đoạn) người dùng có thể thấy giật — xem giới hạn bên dưới.

## Giới hạn đã biết

- `diffWords` dùng DP O(n·m) với trần 4.000.000 ô; vượt trần thì rơi về chế độ thay cả khối (một delete + một insert) — chính xác về nội dung nhưng thô hơn khi review.
- `cleanText` chạy đồng bộ trên main thread; văn bản rất lớn nên chia nhỏ trước khi dán vào web app.
- ZIP (2.3) giải nén streaming và **huỷ được giữa chừng** khi vượt ngân sách: đếm byte theo chunk,
  `reader.cancel()` ngay khi vượt `maxEntryBytes`/tổng ngân sách, không chờ entry nở xong.
- Parser OOXML/PDF/C2PA chạy đồng bộ trên main thread. DOCX 3000 đoạn ≈ 34 ms trên desktop;
  máy yếu hơn hoặc file sát trần sẽ chậm hơn. Chưa có Worker isolation (xem release report 2.3).
