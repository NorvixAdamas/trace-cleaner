# Trace Cleaner 2.3.1 — Hardening report

> Báo cáo này ghi **đúng những gì đã chạy và đã kiểm**. Những hạng mục chưa làm hoặc chưa kiểm
> được nằm ở mục J và không được tính là đạt. Kết luận ở mục K là **chưa release-ready** cho toàn
> bộ phạm vi 2.3.1.

## A. Release identity

| Trường | Giá trị |
|---|---|
| Version sản phẩm | **2.3.1** (`package.json`, `package-lock.json`, `extension/manifest.json`, tiêu đề web) |
| Prompt registry | **2.3.1** (`packages/writing/prompts.js`, bản sinh `extension/core/prompts.js`) |
| Engine | `2.3` (không đổi hành vi engine) |
| Branch | `hardening/2.3.1` (tách từ `main` tại `9de92f0`) |
| Baseline | `9de92f037b18607d71f8ed2d5c63a19d9421f033` |
| Commit | commit release trên `main` (hash: `git log -1`; không có co-author/attribution khác ngoài NorvixAdamas) |
| Tag | không tạo trong lần push này |
| Push | `origin/main`, dùng credential đã lưu của NorvixAdamas; không force-push |
| CI | kiểm sau khi push bằng GitHub check-runs; kết quả ghi ở cuối mục I |

## B. C2PA hardening

Đã sửa trong `packages/core/c2pa.js`:

- **Ngân sách tập trung** `C2PA_LIMITS`: asset 100 MB, manifest 4 MB, một box 4 MB, 512 box,
  JUMBF depth 12, CBOR depth 24, 50 000 item, collection 5 000, chuỗi 1 MB, 100 exclusion,
  chứng chỉ 64 KB, chain 8, tổng 256 KB, 3 000 ms.
- **PNG `caBX`**: kiểm `length` với số byte còn lại và với `maxBytes` trước khi cắt payload; chunk
  khai báo vượt biên ⇒ `invalid: truncated_chunk`; `caBX` quá lớn ⇒ `manifest_too_large`.
  Trước đây `subarray` tự cắt im lặng và không có giới hạn.
- **JPEG APP11**: cộng dồn nhiều segment và từ chối khi tổng vượt ngân sách; segment length nằm
  ngoài file hoặc < 2 ⇒ invalid. Trước đây từng chunk được kiểm riêng và chunk quá lớn bị bỏ qua
  im lặng (manifest dở).
- **JUMBF**: kiểm LBox/XLBox (kể cả tràn `MAX_SAFE_INTEGER`), box tối thiểu, biên, số box dùng
  chung qua đệ quy, depth, label UTF-8; lỗi cấu trúc **ném lỗi**, không `break` trả cây dở.
- **CBOR**: viết lại decoder với budget dùng chung cho definite và indefinite; mọi length được
  kiểm với byte còn lại trước khi lặp/cấp phát; giới hạn collection/string; text UTF-8 fatal;
  duplicate map key bị từ chối; `requireComplete` chặn trailing bytes ở COSE/claim/assertion;
  float/simple value ngoài phạm vi bị từ chối thay vì trả số mò.
- **COSE**: `alg` bắt buộc nằm trong protected header; `alg` unprotected mâu thuẫn bị từ chối;
  `COSE_Sign1` thừa phần tử bị từ chối; protected header không phải map ⇒ `manifest_invalid`.
- **Thuật toán**: chỉ **ES256** được giữ sau khi rà; ES384/512, RS256, PS256/384/512, Ed25519 đã bị
  bỏ khỏi danh sách vì không có fixture kiểm thử độc lập trong bộ test này. Chúng trả `unsupported`,
  không được coi là "hỗ trợ".
- **Hard binding**: `hashWithExclusions` export để test; exclusion phải là số nguyên không âm, nằm
  trong asset, không chồng lấn; hash algorithm chỉ sha256/384/512; lỗi exclusion ⇒
  `manifest_invalid` (trước đây chỉ ghi diagnostic và vẫn trả trạng thái hợp lệ).
- **Trust**: `signature_valid_pinned` là trạng thái riêng cho ghim fingerprint/cert; luôn trả
  `chainStatus: "not_evaluated"`, `trustMode: "pinned_leaf"` khi ghim. `verified_trusted` **không
  còn được tạo** vì chưa có validate chain. Chứng chỉ hết hạn có `certificate_expired`.
- **DER**: kiểm `count` byte của length với biên; `derChildren` ném lỗi khi > 500 node thay vì dừng.

Fixture: bộ fixture tự ký ES256 hiện có (PNG) vẫn dùng; thêm fixture adversarial dựng trong test
(PNG/JPEG/JUMBF/CBOR/DER). **Chưa có fixture C2PA độc lập** từ nguồn bên ngoài.

## C. ZIP và XML hardening

### ZIP (`packages/core/zip.js`)

- Bỏ `budget.entryLimit` dùng chung. Mỗi lần đọc tính `maxBytes` cố định tại thời điểm chạy; toàn bộ
  `read()` đi qua một promise queue nên không có hai lần inflate chen nhau trên cùng ngân sách.
- `openZip` kiểm cấu trúc sớm: local header bounds, tên/extra, khoảng dữ liệu trước central
  directory, chồng lấn (`overlapping_data`), central directory trỏ sai local header, tên UTF-8
  strict (bỏ fallback latin1).
- Abort gắn với `reader.cancel()` của reader đang đọc; listener được gỡ; lỗi race → `cancelled`;
  kiểm signal sau vòng đọc. `read()` nhận thêm `opts.signal` hợp nhất với signal archive, nên huỷ
  một entry không huỷ entry khác.
- Test mới: hai entry đồng thời với `maxBytes` khác nhau; hai lần đọc cùng entry; huỷ giữa inflate
  trong khi entry khác vẫn xong; `close()` khi pending; central directory sai; tên không UTF-8.

### XML (`packages/core/xml.js`)

- `parseXml` nhận `Uint8Array`; `decodeXmlInput` kiểm **byte** trước khi decode, dùng
  `TextDecoder('utf-8', { fatal: true })`, bỏ BOM UTF-8, từ chối BOM UTF-16/UTF-32.
- Từ chối control character XML 1.0 và surrogate lẻ; `stats.bytes` báo byte UTF-8 thật.
- OOXML `readPart`/`readPartRoot` đọc bytes qua ZIP với `maxBytes = maxXmlBytes`, nên part quá lớn
  bị cắt trong lúc inflate, không decode trước rồi mới kiểm. `assertSafeXml` cũng đổi sang byte.
- Test: multibyte sát ngưỡng, UTF-8 hỏng, BOM, UTF-16, control char, surrogate, stats byte.

## D. Worker architecture

**Chưa triển khai.** Parser vẫn chạy trên main thread; deadline là kiểm tra hợp tác, không dừng
được một đoạn synchronous. Không có `requestId`/terminate-based timeout, không có worker cho
OOXML/XML/PDF/C2PA, không có kiểm UI freeze. Đây là hạng mục P0 **chưa đạt**.

## E. PDF migration

**Chưa triển khai.** `packages/core/pdf.js` vẫn là parser tự viết; chưa cài `pdfjs-dist`, chưa có
worker packaging, chưa có corpus 10 PDF độc lập, chưa có benchmark trước/sau. Không có tuyên bố
"PDF.js là parser chính". Đây là hạng mục P0 **chưa đạt**.

## F. Chrome Extension

- Bỏ hoàn toàn `content_scripts` tĩnh khỏi `extension/manifest.json`; manifest 2.3.1 chỉ còn
  `storage`, `activeTab`, `scripting`, `sidePanel` + 3 host API + optional host.
- Thêm command `toggle-floating` (`Alt+Shift+F`). Background lấy tab active, từ chối URL không
  `http(s)`, chèn `core/bundle.js`, `config.js`, `sidebar.js`, `content.js` bằng
  `chrome.scripting.executeScript`, gửi `toggle`; lỗi hiện badge `!` 3 giây. Không fallback chèn mù.
- `content.js` idempotent qua `__traceCleanerLoaded`; khởi tạo `lastEditable` từ `activeElement`
  để "Lấy chữ" hoạt động ngay sau khi chèn (lỗi phát hiện bởi E2E).
- **E2E thật** (`tests/e2e/extension.spec.js`, Chromium headed, load unpacked):
  - trước thao tác: không có `#trace-cleaner-host`;
  - chèn bằng đúng file-list của command, sidebar hiện, lấy đúng textarea, đóng/mở;
  - chèn lại: vẫn đúng một host (không listener trùng);
  - nút của trang vẫn click được;
  - panel/render, API key session→local→clear, huỷ request thật, custom host chưa cấp quyền.
- Giới hạn: hộp thoại host permission và phím tắt cấp trình duyệt không điều khiển được bằng
  Playwright. E2E dùng bản copy manifest có sẵn `https://example.test/*`; việc Chrome nhận
  `Alt+Shift+F`/hộp thoại quyền **chưa được tự động hoá**. Side Panel bubble vẫn chỉ kiểm qua
  `panel.html`.

## G. Writing evaluation

**Chưa đạt.** Dataset vẫn là 30 fixture tự soạn (20 dev + 10 held-out). Chạy thực tế:

```
dev: 20/20 nhãn · thừa 0 · precision 100.0% · recall 100.0% · offset 100.0% · bảo toàn 100.0%
held-out: 10/10 nhãn · thừa 0 · precision 100.0% · recall 100.0% · offset 100.0% · bảo toàn 100.0%
```

Không có 400 case, không có dữ liệu có nguồn/license, không có metric theo category. Con số 100%
trên 30 case tự soạn **không** chứng minh chất lượng soát lỗi thực tế và không được dùng để tuyên bố
như vậy.

## H. Document compatibility

**Chưa đạt.** Không có corpus DOCX/PPTX/XLSX/PDF/C2PA độc lập (mục tiêu 10/10/10/10/5). Test hiện
tại dùng fixture tự sinh trong repo; chúng kiểm parser nhưng không phải bằng chứng tương thích với
file thật. DOCX move/reply, PPTX notes mapping, XLSX 1904/custom format vẫn chỉ có fixture nội bộ.

## I. Complete test report

Chạy trên Windows, Node `v26.13.0`, Playwright `1.65.1` + Chromium bundled, ngày 2026-11-21:

| Kiểm | Kết quả |
|---|---|
| `npm test` (`node --test tests/*.test.js`) | **328 pass, 0 fail, 0 skip** |
| `npx playwright test` | **6 pass, 0 fail** (5 extension + 1 web rewrite) |
| `node tools/eval_writing.js --check` | dev 20/20, held-out 10/10, 0 thừa |
| `node tools/check_extension.js` | `manifest OK · v2.3.1 · 4 permission` |
| `python tools/build_guide.py --check` | `index.html không đổi (guide đã khớp)` |
| `node tools/sync_assets.js --check` | `artifact khớp nguồn` (sau lần sync cuối) |

Không chạy: benchmark 2.3.1 (không có thay đổi thuật toán đáng đo; không tạo số mới), corpus độc
lập, PDF.js, security fuzz/property-based ngoài các test adversarial thủ công ở trên.

## J. Remaining limitations (chưa đạt gate)

Đây là các hạng mục **thất bại/chưa làm**, không phải "limitation chấp nhận được" của một release
hoàn tất:

1. Worker isolation + hard timeout (P0) — chưa có.
2. PDF.js làm parser chính + corpus 10 PDF (P0) — chưa có.
3. Corpus độc lập DOCX/PPTX/XLSX/C2PA (P1) — chưa có.
4. Writing eval 400 case có nguồn/license, dev/held-out tách biệt (P1) — chưa có.
5. C2PA chain/CRL/OCSP/timestamp (P0 theo mục 2.4 nếu muốn tuyên bố PKI) — chưa có; chỉ pinned leaf.
6. Fixture C2PA độc lập + thuật toán ngoài ES256 — chưa có; các thuật toán khác bị từ chối.
7. Kiểm tự động phím tắt command và hộp thoại host permission của Chrome — không tự động hoá được
   trong môi trường này; E2E dùng manifest copy.
8. Benchmark/hardware matrix 2.3.1 — chưa chạy.

## K. Final engineering assessment

**Chưa release-ready.** Trong phạm vi đã làm, các thay đổi có test thật và chạy xanh:

- C2PA/CBOR/JUMBF/container: từ chối input vượt biên/quá lớn/sâu, trust pin tách khỏi PKI.
- ZIP: không còn chia sẻ `entryLimit`, đọc tuần tự có ngân sách, abort thực sự cancel reader, cấu
  trúc được kiểm sớm.
- XML: giới hạn byte UTF-8 thật, decode fatal, mọi part OOXML đi qua cùng pipeline.
- Extension: bỏ chèn tĩnh trên mọi trang; sidebar nổi chỉ chèn sau command, E2E thật xác nhận
  không host trước thao tác và idempotent sau khi chèn.

Nhưng các gate P0/P1 còn lại (worker, PDF.js, corpus độc lập, 400 case writing) **chưa đạt**, nên
2.3.1 không được gắn nhãn release candidate/release-ready. Có thể coi đây là một bước hardening đã
kiểm chứng một phần, cần tiếp tục trước khi phát hành theo đúng contract ở mục 15.
