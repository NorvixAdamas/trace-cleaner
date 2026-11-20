# Security

Tài liệu này mô tả **hiện trạng** và những rủi ro còn lại. Không có tuyên bố "an toàn tuyệt đối".

## 1. Mô hình mối đe doạ

| Tài sản | Rủi ro chính |
|---|---|
| Văn bản người dùng dán | lộ qua API bên thứ ba nếu bật Humanize |
| API key | đọc từ localStorage/chrome.storage, lộ qua log/commit |
| File tải lên (docx/pdf/ảnh) | parser bị lừa bởi file độc hại, ZIP bomb, XML external entity |
| Model output | prompt injection, chèn HTML, bịa dữ kiện |
| Extension | quyền quá rộng, đọc trang không được phép |

## 2. Bề mặt tấn công

### 2.1 Web app (`index.html`)

- Không có backend. Toàn bộ xử lý văn bản/Unicode chạy tại máy.
- **Rời máy khi:** gọi `/models` hoặc `generateContent` (Gemini), `/chat/completions`
  (OpenAI-compatible/OpenRouter) bằng key người dùng nhập.
- API key nằm trong `localStorage["traceApiCfg"]` khi bật "lưu cấu hình"; nếu không bật,
  key chỉ nằm trong DOM cho tới khi tải lại trang. **Không phải két mã hoá**: mọi script cùng
  origin (kể cả extension có quyền) đều đọc được. Đã ghi rõ trong UI.
- Output model được đưa vào DOM bằng `textContent`; các chuỗi nội suy trong `innerHTML`
  (tên model, thống kê, lỗi, báo cáo bảo toàn) đi qua `esc()`. Không render Markdown của model.
- Không có `Content-Security-Policy` riêng (GitHub Pages không cho đặt header). Nếu triển khai
  nơi khác, nên thêm CSP `default-src 'self'; connect-src ...`.

### 2.2 Extension

- Permissions: `storage`, `activeTab`, `scripting`, `sidePanel`.
- Host permissions: chỉ 3 domain API (Gemini, OpenAI, OpenRouter). Trước audit có `http://*/*`
  và `https://*/*` — đã bỏ.
- `content_scripts.matches: ["<all_urls>"]` vẫn tồn tại vì sidebar nổi + phím tắt + đồng bộ prompt
  cần chạy trên trang bất kỳ. Đây là **quyền rộng có chủ ý**, đã ghi nhận trong AUDIT (F-12).
  Giảm thiểu: sidebar chỉ dựng DOM khi người dùng mở; `content.js` chỉ đọc vùng chọn hoặc ô đang
  focus khi người dùng bấm "Lấy văn bản"; không quét toàn trang, không gửi dữ liệu đi.
- `background.js` là ES module, import bản sao `extension/core/`. Không có remote code.
- Model trả về được kiểm tra bảo toàn trước khi hiển thị; lỗi được hiện, không tự ẩn.

### 2.3 CLI (`tools/trace_scan.py`)

- Đọc file UTF-8, ghi file khi có `-o`. Không gọi mạng.
- Chưa có giới hạn kích thước file — chạy trên file rất lớn sẽ tốn RAM. Dùng `--json` cho pipeline.

## 3. Xử lý output không tin cậy

1. Prompt không phải biện pháp bảo vệ. Mỗi phản hồi đều qua `checkPreservation`
   (`packages/core/preservation.js` hoặc bản nhúng trong `index.html`).
2. Lỗi bảo toàn (`failed`) không bị ẩn: hiện danh sách vấn đề, giữ bản gốc, yêu cầu người dùng
   quyết định.
3. `semanticReview` luôn `not_checked`. UI không được nói "đã kiểm tra nghĩa".
4. Không thực thi HTML/JS từ model; không `eval`.

## 4. File không tin cậy

- Web app đọc file cục bộ bằng `FileReader`/`arrayBuffer` và tự parse container.
- **Chưa xác nhận** có giới hạn kích thước giải nén, số entry ZIP, độ sâu XML. Đây là rủi ro mở
  (AUDIT F-16). Không nên mở file lạ từ nguồn không tin cậy cho tới khi phần này được review.
- Không chạy macro, không mở embedded object.
- C2PA/chữ ký số: chỉ đọc dấu hiệu cấu trúc; **không** xác minh chữ ký. Không kết luận "hợp lệ".

## 5. Bí mật

- Không có credential nào trong repo. Không commit key.
- `.gitignore` chặn `*.log`, `*.pyc`, `shots/`, `tools/__tmp__/`.
- Nếu key từng bị dán vào chat/log, phải tạo key mới (đã xảy ra trong lịch sử dự án).
- Extension lưu key trong `chrome.storage.local` (không đồng bộ). Nên thêm nút "Xoá key" (ROADMAP).

## 6. Việc cần làm trước khi gọi là "2.0"

| Ưu tiên | Việc |
|---|---|
| P1 | Giới hạn kích thước file + giải nén + thời gian parse; harden XML (không DTD/entity ngoài) |
| P1 | Timeout + huỷ request ở extension |
| P2 | Chế độ key "chỉ phiên" mặc định, nút xoá key |
| P2 | CSP khi triển khai ngoài GitHub Pages |
| P2 | Thu hẹp content script (optional host permissions) nếu bỏ sidebar nổi |
| P3 | Ký/xác minh C2PA bằng tool chính thức thay vì đọc thủ công |
