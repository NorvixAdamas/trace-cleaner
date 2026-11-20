# Privacy

## Điều gì ở lại máy

Toàn bộ: quét Unicode, làm sạch, bảo toàn, diff, rà soát tài liệu, gợi ý ngữ pháp, đọc metadata
file, ELA, CLI Python. Không có backend, không telemetry, không analytics, không crash reporting.

## Khi nào dữ liệu rời máy

Chỉ khi bạn bấm **Humanize / Viết lại** và đã nhập API key. Văn bản (không phải file) được gửi tới:

| Provider | Đích mặc định |
|---|---|
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta` |
| OpenAI-compatible | `https://api.openai.com/v1` hoặc Base URL bạn nhập |

Base URL tuỳ chỉnh nghĩa là văn bản đi tới host đó — UI phải nói rõ. Chỉ chấp nhận `https`; `http`
chỉ với loopback (Ollama, LM Studio…).

## API key

- **Mặc định chỉ trong phiên**: web giữ trong biến của tab (mất khi đóng tab); extension không ghi
  vào storage trừ khi bạn tick "ghi nhớ".
- Tick "ghi nhớ" → lưu `localStorage` (web) hoặc `chrome.storage.local` (extension), dạng plaintext.
  Đây **không phải** mã hoá; bất kỳ tiện ích nào đọc được storage của extension/trang đó đều đọc được.
- Có nút **Xoá key**. Key không vào log, không vào message lỗi, không vào báo cáo, không vào file
  trong repo.

## File

File bạn chọn được đọc bằng `FileReader`/`arrayBuffer` trong tab. Không upload. ELA được render
thành data URL trong bộ nhớ; giữ tối đa 8 kết quả để không phình RAM.

## Lịch sử tài liệu

`DocumentSession` chỉ sống trong tab hiện tại. Không lưu lên server, không lưu vào storage trừ khi
bạn tự export. Đóng tab là mất.

## Prompt tự soạn / tuỳ chọn viết

Prompt người dùng tự sửa được lưu cục bộ (`localStorage` web, `chrome.storage.local` extension, đồng
bộ hai chiều giữa hai bề mặt) để dùng lại. Không có profile nào được gửi lên server.

## Điều app không làm

- Không xoá C2PA hay metadata provenance khi làm sạch văn bản.
- Không kết luận ai viết văn bản từ Unicode, metadata hay thời gian soạn.
- Không hứa "qua detector". Điểm số là heuristic đếm đặc trưng.
- Không gửi văn bản tới dịch vụ bên thứ ba nào ngoài provider bạn chọn.
