# Trace Cleaner 2.3.0 — Release report

**Ngày:** 2026-11-20 · **Baseline audited:** `7f5beea` (2.2.0) · **Branch:** `main`
**Release commit:** xem `git log -1 --format=%H` (hash được báo trong phản hồi phát hành)

Báo cáo này mô tả **đúng những gì đã ship**, kèm phần chưa làm được. Không có mục nào ở đây
được đánh dấu hoàn thành chỉ vì UI đã có nút hoặc vì một hằng số đã tồn tại.

---

## A. Kết quả phát hành

| Mục | Giá trị |
|---|---|
| Version sản phẩm | **2.3.0** (`package.json`, `extension/manifest.json`, tiêu đề web `v2.3.0`) |
| Engine (`ENGINE_VERSION`) | **2.3** |
| Prompt registry (`PROMPT_VERSION`) | **2.3.0** |
| Node tests | **311 pass · 0 fail · 0 skip** |
| Chrome E2E | **6 pass · 0 fail** (Chromium 159, headed, extension load unpacked) |
| Writing eval | dev **20/20** · held-out **10/10** · 0 finding thừa |
| Generated assets | `sync_assets --check` khớp · `sync_core --check` khớp · `build_guide --check` khớp |
| Extension manifest | `manifest OK · v2.3.0 · 4 permission` (1 warning có chủ ý, xem F) |
| Deployment | Không có backend/deploy. Web là `index.html` tĩnh (GitHub Pages đọc trực tiếp). |
| CI | Workflow cập nhật (unit + eval + sync + E2E dưới `xvfb`); trạng thái run thật được báo sau khi push. |

---

## B. Những gì đã triển khai

### B1. Reliability & Security

**ZIP streaming thật (`packages/core/zip.js`)**
- `openZip()` đọc central directory, từ chối ZIP64, entry mã hoá, method ngoài stored/deflate,
  tên trùng, path traversal (`..`, `/`, `\`, NUL), entry quá dài.
- Giải nén theo `DecompressionStream` + reader: đếm byte **theo từng chunk**, vượt
  `maxEntryBytes` hoặc tổng `maxTotalUncompressedBytes` thì `reader.cancel()` ngay. Không buffer
  entry rồi mới kiểm.
- CRC32 và kích thước thật đối chiếu metadata; metadata nói dối ⇒ lỗi, không tin khai báo.
- Deadline + `AbortSignal` kiểm trong vòng đọc; archive cụt, central directory hỏng bị từ chối.
- Tỉ lệ nở chỉ áp cho entry > 1 MB để tránh false positive với text nhỏ nén tốt.

**XML strict dùng cho mọi part (`packages/core/xml.js`)**
- Tokenizer/parser thật: thẻ khớp, thuộc tính trùng, quote, text ngoài root, nhiều root.
- Từ chối `<!DOCTYPE`, `<!ENTITY`, mọi `<!…` khác; chỉ 5 entity chuẩn + numeric ref ⇒ XXE bất khả
  thi về cấu trúc; entity lạ là lỗi, không im lặng bỏ qua.
- Giới hạn byte/depth/node/attribute/text; đếm dòng **O(n)** (xem C6).
- Mọi part OOXML được đọc (main, comments, relationships, notesSlide, worksheet, styles,
  sharedStrings) đều đi qua cùng parser — không còn chỉ kiểm `document.xml`.

**OOXML cấu trúc (`packages/core/ooxml.js`)**
- DOCX: paragraph + style, `w:ins`/`w:del` kèm author/date/paragraph, comment + anchor,
  rsid count, relationship resolution.
- PPTX: thứ tự slide theo `sldIdLst`, title/body, speaker notes từ `notesSlide` đúng slide.
- XLSX: worksheet theo workbook order, visible/hidden, shared strings, inline string, number,
  boolean, error, formula giữ nguyên (không thực thi), ngày theo numFmt + serial 1900/1904.

**PDF cấu trúc (`packages/core/pdf.js`)**
- xref table, xref stream, object stream, FlateDecode + predictor, ToUnicode CMap, cây `/Pages`.
- Text theo trang, số ảnh/trang, kích thước/xoay, `hasTextLayer`, `scanned`; `/Encrypt` ⇒
  `pdf_encrypted`; filter không hỗ trợ ⇒ diagnostic, không giả vờ đã trích đủ.
- Ngân sách stream + deadline + signal.

**C2PA (`packages/core/c2pa.js`)**
- Tìm container JPEG APP11 / PNG `caBX`, parse JUMBF, COSE_Sign1, X.509 DER.
- Xác minh chữ ký ES256/384/512, RS256, PS256/384/512; hard-binding SHA-256 với exclusion.
- Trạng thái tách biệt: `not_detected`, `detected_unverified`, `manifest_invalid`,
  `signature_invalid`, `signature_valid_untrusted`, `verified_trusted`,
  `asset_modified_after_signing`, `unsupported`.
- Trust store tường minh (fingerprint/DER). **Không** validate chain tới root CA, không CRL/OCSP,
  không timestamp — nên mặc định cao nhất chỉ đạt `signature_valid_untrusted`.

**DocumentSession (`packages/core/document.js`)**
- `propose()` chỉ nhận metadata trong whitelist; `id`, `text`, `baseRevision`, `baseText` không thể
  bị ghi đè; proposal bị freeze; stale revision bị từ chối.
- `acceptEdit()` duyệt một phần proposal; `applyLocalEdit()` duyệt **một gợi ý** với offset +
  revision check, ghi lịch sử `accept-suggestion`, undo được; offset cũ bị từ chối.
- `compare()`, `restoreRevision()`, export giữ lịch sử.

**Rewrite A9**
- Web: `cleaned` là bản duy nhất được hiển thị, kiểm bảo toàn, đưa vào `DocumentSession` và export.
  `raw` của model chỉ còn trong `lastRewrite.raw` để gỡ lỗi, không bao giờ là proposal.
- Regression E2E (`tests/e2e/web-rewrite.spec.js`) chứng minh hiển thị = proposal = bản Accept.

**API key + quyền provider (extension)**
- `extension/config.js`: key mặc định ở `chrome.storage.session`; chỉ ghi `chrome.storage.local`
  khi tick "Ghi nhớ API key trên máy này"; nút Xoá key xoá cả hai; key cũ không có cờ remember bị
  di trú sang session và xoá khỏi local.
- `optional_host_permissions` cho provider tuỳ biến; `chrome.permissions.request` đúng origin trong
  user gesture; background kiểm `permissions.contains` trước mỗi request và trả `CONFIG_ERROR` nếu
  chưa cấp. URL có credential / scheme lạ bị từ chối.

### B2. Writing Intelligence

- **Tiếng Việt**: bỏ false positive với "cũng như là", "nói chung là", "ngoài ra thì", "tuy nhiên
  thì" — thành gợi ý văn phong; allowlist láy từ; NFD normalization; guard số thập phân/TP.HCM;
  typo thật vẫn bắt; thêm luật khoảng trắng sau dấu câu và cặp từ dư.
- **Tiếng Anh**: have/has, there is + plural, much/many, its/it's, their/there, loose/lose,
  then/than, Oxford comma; a/an theo âm (acronym, số, cách đọc), không theo ký tự đầu.
- **Schema gợi ý 2.0**: `id`, `ruleId`, `category`, `kind` (correction/suggestion), `severity`,
  `confidence`, `explanation`, `start/end`, `original/replacement`, `paragraph`, `evidence`.
- **Consistency toàn tài liệu**: biến thể thuật ngữ, capitalization, định dạng ngày, số, đơn vị,
  abbreviation, heading, quote style — mỗi finding có evidence (vị trí + text), không tự sửa.
- **Duyệt từng gợi ý**: danh sách trong tab Rà soát, nút Áp dụng/Bỏ qua từng mục, nút "áp dụng các
  sửa lỗi chắc chắn ≥ 0.95" (áp từ cuối để offset không lệch), tất cả qua `applyLocalEdit`.
- **Eval**: `tests/fixtures/writing-eval/{dev,heldout}.json`, `tools/eval_writing.js`,
  `docs/WRITING_EVAL.md`; tách dev/held-out, đo precision/recall/offset/preservation.

### B3. Document Intelligence

| Định dạng | Đã đọc | Chưa đọc / giới hạn |
|---|---|---|
| DOCX | paragraph + style, tracked insert/delete + author/date, comment + anchor, rsid | reply thread, moveFrom/moveTo dựng cây, footnote/endnote |
| PPTX | slide order, title/body, speaker notes | layout/master text, animation, chart data |
| XLSX | sheet order/visibility, cell ref/value, shared/inline string, number/bool/error, formula, date | merged cells, defined names, pivot, chart |
| PDF | xref table/stream, ObjStm, Flate+predictor, ToUnicode, page text/images | LZW/JPX/CCITT, OCR, mã hoá, reading order nhiều cột |
| Ảnh | JPEG/PNG structure, EXIF, DQT/ELA, C2PA verify | WebP/GIF/TIFF/HEIC chỉ nhận diện |
| C2PA | container, manifest, chữ ký, hard binding | chain/CRL/OCSP/timestamp, trust store mặc định rỗng |

### B4. Cross-platform

- Web và extension dùng chung `packages/core`, `packages/writing`, `packages/providers` qua bundle
  sinh tự động (`tools/sync_assets.js`); `--check` chặn drift trong CI.
- Grammar/consistency/C2PA/OOXML/PDF đều nằm trong bundle; sidebar không còn regex riêng.
- Cùng contract provider: requestId, timeout, cancel registry, redaction, fallback model.
- UI dùng chung thuật ngữ/severity/category; web và extension cùng policy key session-first.

---

## C. Bug đã sửa (có tái hiện)

1. **ZIP bomb**: bản 2.2 giải nén cả entry rồi mới kiểm `byteLength`; nay huỷ giữa stream. Test:
   entry vượt trần 1 byte, tổng ngân sách, ratio, metadata sai, huỷ giữa chừng.
2. **XML chỉ kiểm một phần**: `assertSafeXml` dạng regex chỉ chạy trên vài part; nay mọi part đi
   qua parser strict, có test DTD/ENTITY/độ sâu/node/attribute.
3. **Giới hạn "trang trí"**: `maxPages/maxSlides/maxSheets/maxXmlNodes/maxPdfTextPages` trước đây
   không được enforce; nay áp trong vòng lặp kèm deadline.
4. **DocumentSession metadata overwrite**: metadata từ model có thể ghi đè `id/text/baseRevision`;
   nay whitelist + freeze + test tấn công.
5. **A9 raw vs cleaned**: web hiển thị bản đã làm sạch nhưng đưa raw vào Review; nay một chuỗi duy
   nhất, có E2E tái hiện đúng lỗi cũ (raw có ZWSP/em dash).
6. **Hiệu năng XML O(n²)**: `lineAt()` quét lại từ đầu cho mỗi element; DOCX 3000 đoạn **2 649 ms**
   → **34 ms** sau khi dùng bộ đếm dòng tăng dần. Phát hiện qua benchmark 2.3, không phải suy đoán.
7. **Key extension lưu local mặc định**: trái với privacy docs; nay session-first + opt-in + di trú.
8. **Custom provider không có quyền host**: request trước đây fail mơ hồ; nay xin quyền đúng origin
   và background trả lỗi cấu hình rõ ràng.
9. **Gợi ý ngữ pháp không duyệt được từng cái**: trước đây áp cả chuỗi qua `commit`; nay
   `applyLocalEdit` + UI duyệt từng mục, có undo/redo và chống offset cũ.
10. **Tiêu đề/guide lệch định vị**: tiêu đề "xoá dấu vết ký tự & tell AI" và playbook stealth trong
    guide được thay bằng mục tiêu chất lượng/độ tin cậy bằng chứng.

---

## D. Bằng chứng kiểm thử

```
npm test                        → 311 tests, 311 pass, 0 fail, 0 skipped
npx playwright test             → 6 passed
node tools/eval_writing.js --check → dev 20/20, held-out 10/10, 0 extra
node tools/sync_assets.js --check  → artifact khớp nguồn
python tools/sync_core.py --check  → extension/core khớp packages/core
python tools/build_guide.py --check→ guide khớp
node tools/check_extension.js      → manifest OK · v2.3.0 · 4 permission
```

**Chrome E2E thật** (`tests/e2e/extension.spec.js`, Playwright 1.65.1 + Chromium 159, headed):

1. `panel.html` load như extension page thật; ping trả engine/prompt version; manifest 2.3.0.
2. Key policy: local không có key sau khi lưu (mặc định), session có key; tick ghi nhớ → local;
   reload → nạp lại; Xoá key → sạch cả hai.
3. Huỷ request: `requestfailed` = `net::ERR_ABORTED`; UI dừng chờ; response về muộn không ghi đè.
4. Custom host chưa cấp quyền → `CONFIG_ERROR` trước khi gọi mạng.
5. Sidebar nổi: `Alt+Shift+S`, lấy chữ từ textarea, đóng/mở lại, nút của trang vẫn hoạt động.

**Web E2E** (`tests/e2e/web-rewrite.spec.js`): model trả text có ZWSP/em dash/quote cong; hiển thị =
proposal = bản Accept; khôi phục bản gốc đúng.

**Không chạy được / không claim:**
- Bong bóng Side Panel do Chrome vẽ: không thao tác được bằng Playwright; phần UI bên trong đã test
  qua `panel.html`, việc Chrome mở panel từ toolbar không được tự động hoá.
- Hộp thoại cấp quyền của Chrome: không tự động bấm được; đã test hệ quả (chưa cấp ⇒ CONFIG_ERROR)
  chứ không test chính dialog.
- Provider live: không có API key thật trong phiên này; request được giả lập ở tầng network. Hợp
  đồng request/timeout/cancel dùng chung code đã có test provider riêng.
- Chrome E2E không chạy trong CI của phiên này (chỉ cấu hình); trạng thái CI thật báo sau push.

---

## E. Hiệu năng

Máy: Intel i7-9750H · 16 GB · win32 x64 · Node v26.13.0. Median 3 lần, `node tools/bench_2_3.js`.
Đây là số **Node**, không phải trình duyệt.

| Case | Trước | Sau |
|---|---|---|
| DOCX 3000 đoạn (257 KB XML) | 2 649 ms | **34 ms** |
| ZIP entry 2.7 MB (streaming) | — | 27 ms |
| PDF 100 trang | — | 5 ms |
| PPTX 2 slide + notes | — | 3 ms |
| XLSX 1 sheet | — | 2 ms |
| C2PA verify PNG đã ký | — | 1 ms |
| Grammar VI 260 đoạn | — | 5.6 ms |
| Consistency VI 260 đoạn | — | 0.9 ms |
| Word diff 100k ký tự | — | 1.7 ms |

Không có benchmark DOM/render. Phân tích file vẫn chạy main thread; chưa có Worker.

---

## F. Giới hạn còn lại

1. **C2PA**: không validate chain tới root CA, không CRL/OCSP/timestamp; web không cấu hình trust
   store nên trạng thái cao nhất là `signature_valid_untrusted`. UI nói đúng như vậy.
2. **PDF**: không hỗ trợ LZW/JPX/CCITT, không OCR, không giải mã; reading order xấp xỉ.
3. **DOCX**: chưa dựng cây reply comment / moveFrom-moveTo; footnote/endnote chưa đọc.
4. **XLSX**: merged cell, defined name, pivot/chart chưa đọc.
5. **Parser main thread**: file sát trần có thể gây giật; chưa có Worker isolation.
6. **Content script vẫn chạy trên mọi http(s)**: cần cho `Alt+Shift+S`. Đã chứng minh bằng E2E là
   không can thiệp trang, nhưng chưa migrate sang `activeTab` + `commands` vì Playwright không
   kích hoạt phím tắt cấp trình duyệt đáng tin — thu hẹp lúc này là chưa được kiểm chứng.
7. **CLI Python**: parity chỉ ở phần quét/làm sạch codepoint (8 fixture dùng chung), **không** có
   parser OOXML/PDF/C2PA/writing intelligence. Không claim parity toàn phần.
8. **Writing eval**: 30 fixture tự viết, không phải corpus độc lập; 100% trên bộ nhỏ không chứng
   minh chất lượng trên văn bản thật.
9. **Trust store C2PA trên web**: chưa có UI nạp chứng chỉ tin cậy; chỉ dùng được qua API.
10. **Guide** vẫn chứa số liệu detector/vendor lịch sử (có nguồn) để giải thích giới hạn; đó là tài
    liệu tham khảo, không phải chỉ dẫn né tránh.

---

## G. File và kiến trúc

**Module mới**
- `packages/core/zip.js`, `xml.js`, `ooxml.js`, `pdf.js`, `c2pa.js`
- `packages/writing/consistency.js`, `evaluation.js`
- `extension/config.js`
- `tools/bench_2_3.js`, `tools/eval_writing.js`, `tools/make_c2pa_fixture.mjs`
- `tests/{zip,xml,ooxml,pdf,c2pa,document-invariants,writing-eval,consistency}.test.js`
- `tests/helpers/{zip-builder,ooxml-fixtures,pdf-fixtures}.js`
- `tests/fixtures/c2pa/*`, `tests/fixtures/writing-eval/*`
- `tests/e2e/{extension,web-rewrite}.spec.js`, `playwright.config.js`

**Sửa quan trọng**
- `packages/core/document.js` (whitelist/freeze/applyLocalEdit)
- `packages/core/xml.js` (line counter O(n))
- `packages/core/limits.js` (limit XML/PDF mới)
- `packages/core/index.js`, `tools/sync_assets.js` (export + bundle)
- `packages/writing/{suggestions,grammar/{vi,en,index}}.js`
- `index.html` (adapter parser mới, review suggestions, A9, version, tiêu đề)
- `extension/{manifest.json,background.js,sidebar.js,content.js,panel.js,panel.html}`
- `README.md`, `GUIDE.md`, `docs/{PRIVACY,SECURITY,TESTING,BENCHMARKS,API,ARCHITECTURE}.md`
- `.github/workflows/ci.yml`, `package.json`

**Dependency**
- Runtime: **không thêm dependency nào**. Parser/C2PA/writing đều dependency-free.
- Dev: `@playwright/test` (Apache-2.0) + Chromium tải bởi Playwright, chỉ dùng cho E2E. Không ảnh
  hưởng bundle web/extension.

**Migration**
- Không đổi schema kết quả (`schemaVersion 1.0`); thêm field mới (`docx`, `pptx`, `xlsx`, `sections`,
  `c2pa` states) nên code cũ đọc field cũ vẫn chạy.
- Prompt/engine version tăng; `localStorage`/`chrome.storage` cũ được đọc, key extension cũ được di trú.
- Web vẫn mở được bằng `file://`; không có build step mới bắt buộc.

---

## H. Đánh giá cuối

**Release-ready trong phạm vi đã tuyên bố.** Ba track đều có implementation + test thật:

- security: ZIP streaming, XML strict toàn bộ part, limit enforce, C2PA verify, key/host policy —
  có test biên và test tấn công;
- writing: false positive VI giảm có regression, EN mở rộng, consistency có evidence, duyệt từng
  gợi ý qua DocumentSession, eval tách dev/held-out;
- document: DOCX/PPTX/XLSX/PDF parse cấu trúc, được hiển thị theo bảng/trường thay vì blob text;
- integration: một chuỗi rewrite duy nhất (E2E), bundle sync, version đồng bộ.

Điều **không** nên nói: C2PA đã "trusted", PDF đã "đầy đủ", CLI ngang web, hay E2E đã chạy trong CI.
Những giới hạn ở mục F là thật và được phản ánh trong UI/docs, không bị giấu sau nhãn "hoàn thành".
