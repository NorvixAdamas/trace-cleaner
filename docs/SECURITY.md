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
| Node XML / thuộc tính / block | 300 000 / 1 000 000 / 200 000 |
| Text một trang PDF / stream PDF | 400 000 ký tự / 32 MB |
| Thời gian parse | 5 000 ms (deadline kiểm tra trong vòng lặp, không phải sau khi xong) |

Giới hạn là hằng `Object.freeze`, UI không được vượt.

## ZIP (`packages/core/zip.js`)

- Đọc central directory, kiểm số entry, tên entry (`..`, đường dẫn tuyệt đối, `\`, NUL, tên quá
  dài, trùng tên), kiểu nén (chỉ stored/deflate), ZIP64, entry mã hoá, kích thước khai báo, tỉ lệ
  nở và tổng ngân sách.
- Giải nén **streaming**: đếm byte thật theo từng chunk, gọi `reader.cancel()` ngay khi vượt
  `maxEntryBytes` hoặc tổng `maxTotalUncompressedBytes` — không buffer cả entry rồi mới kiểm.
- CRC32 và kích thước thật được đối chiếu với metadata; metadata sai ⇒ `PARSER_ERROR` chứ không
  tin theo khai báo.
- Deadline + `AbortSignal` được kiểm trong vòng đọc chunk; archive bị cắt cụt / central directory
  hỏng bị từ chối.
- Tỉ lệ nở chỉ áp cho entry > 1 MB (tránh false positive với file text nhỏ nén tốt).

## XML (`packages/core/xml.js`)

Tokenizer + parser thật, dùng cho **mọi** part OOXML được đọc (main, comments, relationships,
notes, worksheet, styles, shared strings…):

- từ chối `<!DOCTYPE`, `<!ENTITY`, mọi khai báo `<!…` khác, processing instruction không hợp lệ;
- chỉ giải mã 5 entity định nghĩa sẵn + numeric ref, entity lạ ⇒ lỗi (XXE bất khả thi về cấu trúc);
- giới hạn byte, độ sâu, số node, số thuộc tính, độ dài text; thuộc tính trùng / thẻ không khớp bị từ chối;
- không resolve namespace, không schema validate, không theo relationship ngoài.

## PDF (`packages/core/pdf.js`)

Parser cấu trúc tự viết: xref table + xref stream + object stream, FlateDecode có predictor,
ToUnicode CMap, phân trang theo cây `/Pages`. File `/Encrypt` trả `pdf_encrypted` thay vì đoán text.
Không hỗ trợ LZW/JPX/CCITT (báo `unsupported_filter`), không OCR. Mọi stream giải nén có ngân sách
và bị cắt khi vượt `maxPdfStreamBytes`.

## C2PA / provenance (`packages/core/c2pa.js`)

- Tìm container (JPEG APP11 / PNG `caBX`), parse JUMBF, đọc COSE_Sign1 và x5chain.
- Xác minh chữ ký thật (ES256/384/512, RS256, PS256/384/512) và hard-binding SHA-256 của asset
  (có xử lý exclusion `c2pa.hash.data`).
- **Không** validate chain tới root CA, không CRL/OCSP, không timestamp. Trust store mặc định rỗng;
  UI phân biệt `signature_valid_untrusted` với `verified_trusted`.
- Trạng thái `asset_modified_after_signing` chỉ ra file đã đổi sau khi ký.
- Không xoá metadata provenance khi làm sạch văn bản; không suy ra tác giả từ việc thiếu metadata.

## API key và Base URL

- Web: key nằm trong biến phiên của tab; extension: `chrome.storage.session`. Tick "Ghi nhớ" mới ghi
  `localStorage` / `chrome.storage.local`. Có nút **Xoá key** xoá cả hai nơi.
- Migration: key cũ trong `chrome.storage.local` không có cờ `remember` bị chuyển sang session và
  xoá khỏi local khi nạp cấu hình (không âm thầm giữ key trên đĩa).
- Không log key, không đưa key vào message lỗi (`redactSecrets` + test).
- Base URL phải `https`, chỉ cho `http` với loopback (`localhost`, `127.0.0.1`, `[::1]`); URL có
  username/password bị từ chối; scheme khác bị từ chối.
- Extension xin quyền **đúng origin** của provider tuỳ biến qua `chrome.permissions.request` trong
  user gesture; background kiểm `chrome.permissions.contains` trước mỗi request và trả
  `CONFIG_ERROR` kèm hướng dẫn nếu chưa cấp.
- Cảnh báo trong UI khi dùng Base URL tuỳ chỉnh: văn bản sẽ đi tới host đó.

## Extension permissions

Bắt buộc: `storage`, `activeTab`, `scripting`, `sidePanel`; host permissions chỉ 3 domain API.
`optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` — Chrome chỉ
cấp origin cụ thể khi người dùng bấm Lưu cấu hình và chấp nhận hộp thoại.

Content script chạy trên `http://*/*` và `https://*/*` (đã bỏ `file://`, `ftp://`, `<all_urls>`).
Lý do vẫn rộng: phím `Alt+Shift+S` và sidebar nổi phải hoạt động trên trang đang đọc mà không cần
bấm icon. Đã đo bằng Chrome E2E (`tests/e2e/extension.spec.js`): content script chỉ dựng DOM khi
người dùng mở, không chặn/không sửa nút của trang. Migration sang `activeTab` + `commands` vẫn là
việc của phiên bản sau vì Playwright không kích hoạt được phím tắt cấp trình duyệt một cách đáng tin
— thu hẹp quyền lúc này sẽ là thu hẹp chưa được kiểm chứng.

Rủi ro còn lại: content script đọc được nội dung trang https bất kỳ khi người dùng mở sidebar; mã
extension là mã cục bộ, không tải code từ xa.

## Rủi ro còn lại (chưa xử lý)

1. DOCX: comment được đọc, nhưng reply/thread và `w:moveFrom`/`w:moveTo` chỉ được ghi nhận như
   revision thường, không dựng lại thành cây chuyển đoạn.
2. PDF: reading order là xấp xỉ theo toán tử text; không hỗ trợ LZW/JPX/CCITT, không OCR, không giải mã.
3. C2PA: không validate chain/CRL/OCSP/timestamp; trust store của web mặc định rỗng.
4. Parser chạy trên main thread (đã tối ưu để DOCX 3000 đoạn ≈ 34 ms, nhưng file sát trần vẫn có thể
   gây giật); chưa chuyển sang Worker.
5. Không có CSP riêng cho extension; dựa vào CSP mặc định của MV3.
6. Web app render nội dung bằng `textContent`/`createElement` (không `innerHTML` cho dữ liệu model),
   nhưng guide tĩnh vẫn dùng `innerHTML` từ nguồn tin cậy trong repo.

## Báo cáo lỗi

Gửi qua issue của repository, kèm: bước tái hiện, loại file/văn bản (đã khử dữ liệu nhạy cảm),
thông báo lỗi và mã lỗi (`PROVIDER_*`, `PARSER_ERROR`, …).
