# Privacy

## Nguyên tắc

Mặc định **không rời máy**. Chỉ một thao tác gửi dữ liệu ra ngoài: Humanize/viết lại bằng model,
và chỉ khi người dùng đã nhập API key rồi bấm chạy.

## Bảng dữ liệu → nơi xử lý

| Chức năng | Xử lý tại | Rời máy? |
|---|---|---|
| Quét Unicode, làm sạch, strip Markdown | trình duyệt/CLI | không |
| Chẩn đoán 21 tiêu chí, CV câu, tell | trình duyệt | không |
| Diff, kiểm tra bảo toàn | trình duyệt/extension | không |
| Đọc metadata .docx/.pptx/.xlsx/.pdf/ảnh | trình duyệt | không |
| ELA ảnh | trình duyệt | không |
| Guide, prompt soạn sẵn | trình duyệt | không |
| Humanize / viết lại | Google Gemini hoặc API OpenAI-compatible do người dùng chọn | **có** |
| Tải danh sách model | cùng provider ở trên | **có** (chỉ danh sách model) |

## Dữ liệu được gửi khi Humanize

- Toàn bộ văn bản trong ô nhập (tối đa 20.000 ký tự ở web; extension chưa chặn — xem ROADMAP).
- Prompt (mặc định hoặc do người dùng sửa).
- Không gửi tên file, metadata file, hay lịch sử chat.

## Lưu trữ tại máy

| Khoá | Nội dung | Ghi chú |
|---|---|---|
| `localStorage["traceApiCfg"]` | provider/base/model/key | chỉ khi bật "lưu cấu hình" |
| `localStorage["tracePrompt"]` | prompt tuỳ chỉnh | đồng bộ sang extension |
| `localStorage["traceMdKeep"]` | trạng thái nút Markdown | `"0"` = tắt |
| `localStorage["traceChainOrder"]` | thứ tự chuỗi | |
| `localStorage["traceBoxSize"]` | kích thước ô phóng to | |
| `chrome.storage.local["traceCfg"]` | cấu hình + key của extension | không sync |
| `chrome.storage.local["tracePrompt"]` | prompt dùng chung | |

Không có analytics, không có telemetry, không có cookie theo dõi.

## Quyền của người dùng (hiện có / còn thiếu)

- Xoá key web: bỏ tick "lưu cấu hình" (xoá khỏi localStorage) và xoá ô key.
- Xoá key extension: mở "API key & model" và xoá nội dung, bấm Lưu (chưa có nút riêng).
- Xoá lịch sử: hiện **chưa có** lịch sử tài liệu được lưu; đóng tab là mất.
- Xuất dữ liệu: copy/tải `.txt` từ tab Đã làm sạch.
- Tắt hoàn toàn AI: không nhập key, chỉ dùng Quét/Làm sạch.

## Điều không được hứa

- Không hứa "xoá dấu vết AI" hay "qua detector". Sản phẩm sửa lỗi viết và làm sạch ký tự.
- Không hứa dữ liệu gửi provider là riêng tư: chính sách của Google/OpenAI/OpenRouter áp dụng.
- Không hứa localStorage là nơi lưu bí mật an toàn.
