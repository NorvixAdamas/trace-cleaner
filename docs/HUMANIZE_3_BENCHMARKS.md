# Humanize 3.0 — benchmark thật

Sinh lại: `node tools/bench_writing.js` · Node v26.13.0 · win32/x64
CPU: Intel64 Family 6 Model 158 Stepping 10, GenuineIntel · thời điểm: 2026-11-21T01:19:03.948Z

| Từ | Ký tự | analyze trung bình | analyze max | rewrite trung bình | rewrite max |
|---|---|---|---|---|---|
| 500 | 2786 | 1.9 ms | 2.3 ms | 2.6 ms | 3.3 ms |
| 1000 | 5575 | 3.4 ms | 3.7 ms | 4.5 ms | 4.6 ms |
| 3000 | 16671 | 12.2 ms | 12.9 ms | 16.7 ms | 17.3 ms |
| 5000 | 27768 | 25.5 ms | 30.5 ms | 36.3 ms | 42.6 ms |

RSS tăng trong lúc chạy: **24.1 MiB**; heapUsed tăng: **6.0 MiB** (không phải peak; V8 có thể chưa trả bộ nhớ).

## Giới hạn của phép đo

- Chạy trên một máy, một tiến trình; không phải benchmark matrix đa phần cứng.
- `rewrite` ở đây là phần deterministic (grammar/clarity/contraction). Chế độ cần model không được đo vì không có API key và không được bịa số.
- Không đo cancellation latency: engine deterministic không có request mạng; cancellation của provider đã có test riêng.
- Kết quả thay đổi theo CPU, Node và tải máy; con số chỉ dùng để phát hiện hồi quy tương đối.
