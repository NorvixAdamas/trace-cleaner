# Security

Tài liệu này mô tả **hiện trạng** và rủi ro còn lại. Không có tuyên bố "an toàn tuyệt đối".

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

- Không backend. Làm sạch văn bản/Unicode chạy tại máy.
- **Rời máy khi:** gọi `/models` hoặc `generateContent` (Gemini), `/chat/completions`
  (OpenAI-compatible/OpenRouter) bằng key người dùng nhập.
- API key nằm trong `localStorage["traceApiCfg"]` khi bật "lưu cấu hình"; nếu không bật, key chỉ
  nằm trong DOM tới khi tải lại. **Không phải két mã hoá**: mọi script cùng origin đọc được.
- Output model vào DOM bằng `textContent`; chuỗi nội suy trong `innerHTML` đi qua `esc()`.
- Không có CSP riêng (GitHub Pages không cho đặt header).
- Prompt trong trang được sinh từ `packages/writing/prompts.js` (khối `@generated:prompts`), nên
  người dùng có thể sửa prompt nhưng **không** sửa được ràng buộc chế độ/Markdown do registry áp.

### 2.2 Extension

- Permissions: `storage`, `activeTab`, `scripting`, `sidePanel`.
- Host permissions: chỉ 3 domain API (Gemini, OpenAI, OpenRouter).
- `content_scripts.matches: ["<all_urls>"]` **vẫn tồn tại** vì sidebar nổi + phím tắt `Alt+Shift+S`
  + đồng bộ prompt cần chạy trên trang bất kỳ. Đây là **quyền rộng có chủ ý**, đã ghi nhận
  (AUDIT F-12); **không** được mô tả là "đã thu hẹp hoàn toàn". Giảm thiểu: sidebar chỉ dựng DOM
  khi người dùng mở; chỉ đọc vùng chọn/ô đang focus khi bấm "Lấy văn bản"; không quét toàn trang,
  không tự gửi dữ liệu.
- `background.js` là ES module, import `extension/core/preservation.js` và `core/prompts.js`
  (bản sinh tự động). Không có remote code, không `eval`.
- **Timeout:** mọi request model bị huỷ sau 60s (`AbortController`). Lỗi được map sang mã ổn định
  (`PROVIDER_AUTH_ERROR`, `PROVIDER_RATE_LIMIT`, `PROVIDER_TIMEOUT`, `PROVIDER_UNAVAILABLE`,
  `PROVIDER_MODEL_UNAVAILABLE`, `PROVIDER_EMPTY_RESPONSE`, `NETWORK_ERROR`, `CANCELLED`).
  Body lỗi bị cắt còn 180 ký tự; **không** log key, không đưa key vào message.
- Model trả về luôn qua `checkPreservation` trước khi hiển thị; lỗi hiện rõ, không tự ẩn.

### 2.3 CLI (`tools/trace_scan.py`)

- Đọc file UTF-8, ghi khi có `-o`. Không gọi mạng.
- Chưa có giới hạn kích thước file — file rất lớn sẽ tốn RAM.

## 3. Xử lý output không tin cậy

1. Prompt không phải biện pháp bảo vệ. Mỗi phản hồi đều qua `checkPreservation`.
2. Lỗi bảo toàn (`failed`) không bị ẩn: hiện danh sách vấn đề, giữ bản gốc, người dùng quyết định.
3. `semanticReview` luôn `not_checked`. UI không được nói "đã kiểm tra nghĩa".
4. Không thực thi HTML/JS từ model; không `eval` output.

## 4. Prompt như một bề mặt tấn công

- Prompt cũ (≤ 2.0) dặn model **xoá** tricolon, bullet, "not just" — vừa làm mất dữ kiện vừa tạo
  cảm giác "đã xử lý". Từ 2.1 chỉ còn một registry (`packages/writing/prompts.js`) đặt bảo toàn lên
  đầu và cấm xoá mục danh sách/phủ định.
- Prompt tự soạn của người dùng vẫn bị nối thêm khối chế độ + mệnh đề Markdown từ registry, nên
  không thể vô tình bỏ ràng buộc cấu trúc.
- Prompt không bao giờ được dùng để tuyên bố "vượt detector" hay "văn người thật".

## 5. File không tin cậy

- Web đọc file cục bộ bằng `FileReader`/`arrayBuffer` và tự parse container.
- **Chưa** xác nhận có giới hạn kích thước giải nén, số entry ZIP, độ sâu XML (AUDIT F-16).
  Không nên mở file lạ từ nguồn không tin cậy.
- Không chạy macro, không mở embedded object.
- C2PA/chữ ký số: chỉ đọc dấu hiệu cấu trúc; **không** xác minh chữ ký, không kết luận "hợp lệ",
  không xoá metadata provenance.

## 6. Bí mật

- Không có credential trong repo. `.gitignore` chặn `*.log`, `*.pyc`, `shots/`, `tools/__tmp__/`.
- Key lưu trong `chrome.storage.local` / `localStorage` (plaintext) khi người dùng chọn lưu.
  Chưa có nút "Xoá key", chưa có chế độ "chỉ phiên".
- Nếu key từng bị dán vào chat/log, phải tạo key mới.

## 7. Việc cần làm

| Ưu tiên | Việc |
|---|---|
| P1 | Giới hạn kích thước file + giải nén + thời gian parse; harden XML (không DTD/entity ngoài) |
| P1 | Test tự động cho timeout + mã lỗi provider (mock `fetch`) |
| P2 | Nút huỷ request ở extension; key "chỉ phiên" mặc định + nút xoá key |
| P2 | CSP khi triển khai ngoài GitHub Pages |
| P2 | Thu hẹp `<all_urls>` (activeTab + optional host) sau khi có Chrome smoke test |
| P3 | Xác minh C2PA bằng tool chính thức thay vì đọc thủ công |
