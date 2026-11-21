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
- **Cấu trúc được kiểm ngay khi mở**: mọi local header, độ dài tên/extra, khoảng dữ liệu nằm trước
  central directory; khoảng của hai entry chồng nhau ⇒ `overlapping_data`. Central directory trỏ
  sai local header bị từ chối. Tên entry phải là UTF-8 hợp lệ, không còn fallback latin1.
- **Đọc tuần tự có ngân sách**: một promise queue cho toàn archive; mỗi lần đọc tính `maxBytes`
  riêng tại thời điểm chạy, không còn `budget.entryLimit` dùng chung nên hai lần đọc đồng thời
  không ghi đè giới hạn của nhau. Tổng byte quan sát vẫn là ngân sách chung của archive.
- Giải nén **streaming**: đếm byte thật theo từng chunk, gọi `reader.cancel()` ngay khi vượt
  `maxEntryBytes` hoặc tổng `maxTotalUncompressedBytes` — không buffer cả entry rồi mới kiểm.
- `AbortSignal` của archive và `signal` riêng của từng lần đọc được hợp nhất; abort gọi
  `reader.cancel()` trên reader đang hoạt động, listener được gỡ, lỗi race được đổi thành
  `cancelled`, và signal được kiểm lại sau vòng đọc. Huỷ một entry không huỷ entry khác.
- CRC32 và kích thước thật được đối chiếu với metadata; metadata sai ⇒ `PARSER_ERROR`.
- Tỉ lệ nở chỉ áp cho entry > 1 MB (tránh false positive với file text nhỏ nén tốt).

## XML (`packages/core/xml.js`)

Tokenizer + parser thật, dùng cho **mọi** part OOXML được đọc (main, comments, relationships,
notes, worksheet, styles, shared strings…). `readPart` đọc bytes qua ZIP với
`maxBytes = maxXmlBytes` trước khi decode, nên part quá lớn bị cắt ngay trong lúc inflate.

- `parseXml` nhận cả string và `Uint8Array`; **giới hạn là byte UTF-8**, không phải `length`
  của chuỗi UTF-16. UTF-8 không hợp lệ, BOM UTF-16/UTF-32, control character XML 1.0 và surrogate
  lẻ bị từ chối; BOM UTF-8 được bỏ.
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
- **Ngân sách tập trung** (`C2PA_LIMITS`): asset 100 MB; manifest 4 MB; một box 4 MB; 512 box;
  depth JUMBF 12; CBOR depth 24, 50 000 item, collection 5 000, chuỗi 1 MB; exclusion 100;
  chứng chỉ 64 KB, chain 8, tổng 256 KB; thời gian 3 000 ms.
- PNG `caBX` và JPEG APP11 kiểm độ dài/cộng dồn trước khi cấp phát; chunk vượt biên, segment
  hỏng, tổng payload vượt ngân sách ⇒ `manifest_invalid`, không trả manifest parse dở.
- JUMBF: kiểm LBox/XLBox, biên, box tối thiểu, số box, depth, label UTF-8; lỗi cấu trúc ném lỗi
  thay vì dừng im lặng.
- CBOR: budget dùng chung cho definite **và** indefinite; kiểm length với số byte còn lại trước khi
  lặp; UTF-8 fatal; key trùng bị từ chối; trailing bytes bị từ chối ở payload bảo mật.
- COSE: `alg` **phải** nằm trong protected header; `alg` unprotected mâu thuẫn bị từ chối;
  `alg` hiện chỉ hỗ trợ ES256 (thuật toán chưa có fixture kiểm thử bị trả `unsupported`).
- Hard binding: exclusion phải là số nguyên không âm, nằm trong asset, không chồng lấn; thuật toán
  hash chỉ `sha256/sha384/sha512`; exclusion hỏng ⇒ `manifest_invalid`, không clamp.
- **Không** validate chain tới root CA, không CRL/OCSP, không timestamp. Ghim fingerprint/cert
  của người dùng trả `signature_valid_pinned` (tin cậy tường minh ở lá), **không** phải
  `verified_trusted`; `chainStatus = "not_evaluated"` luôn được trả về.
- Trạng thái `asset_modified_after_signing` chỉ ra file đã đổi sau khi ký; chứng chỉ hết hạn có
  trạng thái riêng `certificate_expired`.
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

**Không có `content_scripts` tĩnh.** Trang không bị chèn script khi tải. Command
`Alt+Shift+F` (`toggle-floating`) lấy tab đang active rồi mới `chrome.scripting.executeScript`
các file `core/bundle.js`, `config.js`, `sidebar.js`, `content.js`, sau đó gửi message
`toggle`. `content.js` tự chống chèn trùng (`__traceCleanerLoaded`), nên nhiều lần kích hoạt
không tạo host/listener thứ hai. Tab `chrome://`, Web Store, `file://` và scheme khác bị từ chối
với badge cảnh báo; không fallback sang chèn mù.

Giới hạn kiểm chứng: hộp thoại cấp quyền và phím tắt cấp trình duyệt không điều khiển được bằng
Playwright. E2E dùng bản copy manifest có sẵn host `https://example.test/*` và gọi đúng chuỗi
`executeScript` + `toggle` mà command dùng; việc Chrome nhận phím tắt `Alt+Shift+F` và hiện hộp
thoại quyền là hành vi trình duyệt **chưa được tự động hoá**.

## Rủi ro còn lại (chưa xử lý)

1. DOCX: comment được đọc, nhưng reply/thread và `w:moveFrom`/`w:moveTo` chỉ được ghi nhận như
   revision thường, không dựng lại thành cây chuyển đoạn.
2. PDF: vẫn là parser tự viết (xref/object stream/Flate/ToUnicode). Chưa migrate sang PDF.js; không
   hỗ trợ LZW/JPX/CCITT, không OCR, không giải mã. Corpus PDF/DOCX/PPTX/XLSX độc lập chưa có.
3. C2PA: không validate chain/CRL/OCSP/timestamp; chỉ ES256 có fixture. Chưa có fixture C2PA độc lập.
4. **Parser vẫn chạy trên main thread.** Deadline là kiểm tra hợp tác trong vòng lặp, không dừng
   được một đoạn synchronous đang chạy; chưa có Worker + terminate-based timeout.
5. Không có CSP riêng cho extension; dựa vào CSP mặc định của MV3.
6. Web app render nội dung bằng `textContent`/`createElement` (không `innerHTML` cho dữ liệu model),
   nhưng guide tĩnh vẫn dùng `innerHTML` từ nguồn tin cậy trong repo.
7. Writing evaluation vẫn là 30 fixture tự soạn (20 dev + 10 held-out), chưa đạt 400 case.

## Báo cáo lỗi

Gửi qua issue của repository, kèm: bước tái hiện, loại file/văn bản (đã khử dữ liệu nhạy cảm),
thông báo lỗi và mã lỗi (`PROVIDER_*`, `PARSER_ERROR`, …).
