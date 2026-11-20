# Security

## Nguyên tắc

Mọi file tải lên và mọi văn bản dán vào đều là **dữ liệu không tin cậy**. Không có backend, không
telemetry. Văn bản chỉ rời máy khi người dùng chủ động gọi provider.

## Giới hạn tài nguyên parser (`packages/core/limits.js`)

| Giới hạn | Giá trị |
|---|---|
| Kích thước file | 60 MB |
| Số entry ZIP | 512 |
| Kích thước một entry sau giải nén | 32 MB |
| Tổng dung lượng giải nén | 96 MB |
| Tỉ lệ nở một entry | 120× |
| Kích thước XML | 16 MB |
| Độ sâu XML | 64 |
| Trang PDF / slide PPTX / sheet XLSX | 60 / 60 / 40 |
| Văn bản trích ra | 2 MB |

Giới hạn là hằng `Object.freeze`, UI không được vượt.

## ZIP

- Đọc central directory, kiểm **trước khi inflate**: số entry, tên entry (`..`, đường dẫn tuyệt
  đối, `\`, NUL, tên quá dài, trùng tên), kiểu nén (chỉ stored/deflate), kích thước khai báo,
  tỉ lệ nở, tổng dung lượng.
- Sau khi inflate kiểm lại kích thước thật (không tin metadata).
- Kiểm biên local header trước khi cắt buffer.
- **Còn hở**: `DecompressionStream` không cho ngắt giữa chừng theo số byte, nên một entry khai báo
  nhỏ nhưng nở lớn vẫn được giải nén xong rồi mới bị từ chối. Trần 32 MB/entry giới hạn thiệt hại.

## XML (DOCX/PPTX/XLSX)

`assertSafeXml()` chặn `<!DOCTYPE`, `<!ENTITY`, external `SYSTEM http(s)/file`, độ dài và độ sâu,
chạy **trước** mọi regex trích xuất. Không resolve external entity, không tải tài nguyên ngoài,
không thực thi macro/embedded object, không theo relationship ngoài.

## C2PA / provenance

- Hiện chỉ **dò marker cấu trúc** (JUMBF/C2PA box, `c2pa` strings). Không parse manifest, không
  xác minh chữ ký, không kiểm trust chain.
- Vì vậy UI chỉ được nói "có/không thấy marker", **không** được nói "chữ ký hợp lệ" hay "file thật".
- Không xoá metadata provenance khi làm sạch văn bản. Không suy ra tác giả từ việc thiếu metadata.

## API key và Base URL

- Mặc định **chỉ trong phiên**; tick "ghi nhớ" mới lưu (`localStorage` web, `chrome.storage.local`
  extension). Có nút xoá key.
- Không log key, không đưa key vào message lỗi (`redactSecrets` + test).
- Base URL phải `https`, chỉ cho `http` với loopback (`localhost`, `127.0.0.1`, `[::1]`).
- Cảnh báo trong UI khi dùng Base URL tuỳ chỉnh: văn bản sẽ đi tới host đó.

## Extension permissions

Hiện tại: `storage`, `activeTab`, `scripting`, `sidePanel`; host permissions chỉ 3 domain API.
Content script chạy trên `http://*/*` và `https://*/*` (đã bỏ `file://`, `ftp://` và `<all_urls>`).

Lý do vẫn rộng: sidebar nổi cần content script có sẵn trên trang; nếu bỏ, người dùng phải bấm icon
mỗi lần. `background.js` đã có đường chèn theo yêu cầu (`chrome.scripting.executeScript` trong
`openFallback`), nên migration khả thi — nhưng **chưa** thực hiện vì chưa có Chrome E2E để chứng
minh không mất tính năng (xem `docs/ROADMAP.md`).

Rủi ro còn lại: content script đọc được nội dung trang https bất kỳ khi người dùng mở sidebar; mã
extension là mã cục bộ, không tải code từ xa.

## Rủi ro còn lại (chưa xử lý)

1. Không huỷ được giữa chừng một entry ZIP đang nở.
2. PDF chỉ là heuristic: không parse xref/stream đầy đủ; có thể bỏ sót cấu trúc.
3. DOCX tracked changes/comments chưa đọc hết.
4. C2PA chưa xác minh mật mã.
5. Không có CSP riêng cho extension; dựa vào CSP mặc định của MV3.
6. Web app render nội dung bằng `textContent`/`createElement` (không `innerHTML` cho dữ liệu model),
   nhưng guide tĩnh vẫn dùng `innerHTML` từ nguồn tin cậy trong repo.

## Báo cáo lỗi

Gửi qua issue của repository, kèm: bước tái hiện, loại file/văn bản (đã khử dữ liệu nhạy cảm),
thông báo lỗi và mã lỗi (`PROVIDER_*`, `PARSER_ERROR`, …).
