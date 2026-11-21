# Đánh giá Writing Intelligence

Sinh lại: `node tools/eval_writing.js` · đo trên fixture có nhãn, không phải "điểm AI".

| Tập | Case | Nhãn | Khớp | Thiếu | Thừa | Precision | Recall | F1 | FPR | FNR | Offset đúng |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dev | 24 | 20 | 20 | 0 | 0 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 100.0% |
| held-out | 12 | 10 | 10 | 0 | 0 | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% | 100.0% |

| Tập | Bảo toàn chuỗi | Thực thể | Số | Trích dẫn |
|---|---|---|---|---|
| dev | 100.0% | — | — | — |
| held-out | 100.0% | — | — | — |

- **FPR** = false positive / (khớp + thừa). **FNR** = thiếu / nhãn.
- **Acceptance rate**: chưa đo — cần log người dùng thật; runner không bịa số.
- **Failure rate / latency** có trong JSON của runner; không đưa vào bảng vì phụ thuộc máy chạy.

## Cách đọc

- **Precision** = finding đúng / tất cả finding. Thừa (false positive) làm giảm precision.
- **Recall** = finding đúng / nhãn. Thiếu làm giảm recall.
- **Offset đúng** = gợi ý trỏ đúng chuỗi gốc (`text.slice(start,end) === original`).
- **Bảo toàn** = sau khi áp các correction, các chuỗi trong `preserve` vẫn còn.

Các ca "văn phong tự nhiên" nằm trong fixture với `expect: []` — mọi gợi ý trên
các câu đó đều bị tính là false positive.
