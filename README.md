# Trace Cleaner

Công cụ **chạy tại máy** để:

- quét và làm sạch ký tự Unicode ẩn (ZWSP, BOM, soft hyphen, tag char, PUA, bidi, homoglyph);
- chẩn đoán văn bản theo các đặc trưng **đo được** (độ biến thiên câu, em dash, tricolon, bullet,
  bold lead-in…);
- viết lại văn bản bằng model của bạn (Gemini / OpenAI-compatible) **và kiểm tra lại** xem số,
  URL, ngày, phủ định, điều kiện, trích dẫn, cấu trúc Markdown có bị mất không;
- rà soát thay đổi theo từng bước: diff, chấp nhận/từ chối, undo/redo, khôi phục bản gốc, export;
- gợi ý ngữ pháp/chính tả **deterministic, offline** cho tiếng Anh và tiếng Việt, kèm phân tích
  nhất quán toàn tài liệu; duyệt **từng** gợi ý với undo/redo;
- đọc file `.docx/.pptx/.xlsx/.pdf/ảnh` bằng parser cấu trúc: DOCX tracked changes + comment,
  PPTX speaker notes, XLSX worksheet/ô/ngày/công thức, PDF trang + text layer, C2PA có xác minh
  chữ ký; mọi giới hạn tài nguyên được áp trong lúc đọc.

Không có backend. Không có telemetry. Văn bản/file chỉ rời máy khi bạn bấm Humanize và đã nhập
API key — xem [docs/PRIVACY.md](docs/PRIVACY.md).

> Đây không phải công cụ "vượt detector". Điểm số trong app là heuristic đếm đặc trưng, không
> phải xác suất AI, và không có gì đảm bảo một detector thương mại sẽ nói gì. App không kết luận
> ai là tác giả của văn bản.

## Phiên bản

| Thành phần | Version |
|---|---|
| Sản phẩm (web + extension + CLI) | **2.3.1** |
| Prompt registry (`PROMPT_VERSION`) | **2.3.1** — tách riêng khỏi version sản phẩm |
| Engine (`ENGINE_VERSION`) | **2.3** |
| Schema kết quả | `1.0` |

## Dùng web

Cách 1: mở `index.html` trực tiếp (offline, không cần server).

Cách 2:

```bash
python -m http.server 8781 --bind 127.0.0.1
# http://127.0.0.1:8781/index.html
```

Bản công khai: `https://norvixadamas.github.io/trace-cleaner/`.

`index.html` dùng **cùng engine với extension**: bundle sinh tự động từ `packages/core` được nhúng
giữa marker `@generated:core:start/end`. Trang chỉ còn adapter mỏng, không có bản sao thuật toán.

## Extension Chrome (MV3, v2.3.1)

1. `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `extension/`.
2. Bấm icon để mở Side Panel. Sidebar nổi chỉ được chèn sau thao tác của bạn: `Alt+Shift+F` (command của extension) rồi `Alt+Shift+S` để bật/tắt.
3. Nhập API key trong mục "API key & model". Mặc định key chỉ nằm trong `chrome.storage.session`
   (mất khi đóng trình duyệt); tick **"Ghi nhớ API key trên máy này"** mới ghi
   `chrome.storage.local`. Có nút **Xoá key**. Key cũ do bản ≤2.2 để lại trong local được chuyển
   sang session khi nạp cấu hình.
4. Chọn kiểu viết lại trong ô cạnh nút Markdown (9 chế độ, cùng bộ với web).
5. Nút **Huỷ** dừng request đang chạy (khác với timeout). Nếu kiểm tra bảo toàn thất bại, nút
   "Dán vào trang" yêu cầu xác nhận rõ ràng.

Quyền: `storage`, `activeTab`, `scripting`, `sidePanel`; host bắt buộc chỉ 3 domain API, host tuỳ
biến nằm trong `optional_host_permissions` và chỉ được cấp khi bạn bấm Lưu cấu hình (Chrome hỏi
đúng origin). Provider tự nhập phải là `https://` (hoặc `http://localhost` khi phát triển);
background từ chối request nếu origin chưa được cấp quyền.

Không còn `content_scripts` tĩnh: trang không bị chèn script khi tải. Command `Alt+Shift+F` xin
`activeTab` cho tab đang mở rồi mới chèn `core/bundle.js`, `config.js`, `sidebar.js`,
`content.js`; chèn lại là idempotent (một host, một bộ listener). Trang Chrome nội bộ và
`file://` bị từ chối. Chi tiết: [docs/SECURITY.md](docs/SECURITY.md).

## CLI

```bash
python tools/trace_scan.py file.txt                    # báo cáo
python tools/trace_scan.py file.txt --strip -o clean.txt
python tools/trace_scan.py file.txt --json --audit     # kèm audit từng ký tự + bản sạch
cat file.txt | python tools/trace_scan.py --strip
```

`--fail-on-security` trả exit code 2 khi có tag char / PUA / homoglyph (dùng cho CI). CLI giữ
nguyên CRLF và không truy cập mạng.

## Test

```bash
npm test                              # 311 test Node (unit + integration + security)
npx playwright test                    # 6 Chrome E2E thật (extension + web rewrite)
node tools/sync_assets.js --check     # bundle + prompt + index.html khớp nguồn
python tools/sync_core.py --check     # extension/core khớp packages/core
node tools/check_extension.js         # manifest, thứ tự nạp core, artifact, icon
python tools/build_guide.py --check   # guide trong index.html khớp GUIDE.md
node tools/eval_writing.js --check    # eval writing dev + held-out khớp docs
node tools/bench_2_3.js               # benchmark parser 2.3 (tuỳ chọn)
```

`npx playwright install chromium` một lần trước khi chạy E2E. E2E extension mở Chromium headed
(`headless:false`) vì Chrome không load unpacked extension ở headless shell; CI dùng `xvfb-run`.

## Sinh lại artifact (sau khi sửa `packages/`)

```bash
node tools/sync_assets.js     # extension/core/bundle.js, extension/core/prompts.js, core + prompt trong index.html
python tools/sync_core.py     # extension/core/{entities,preservation}.js
python tools/build_guide.py   # guide trong index.html từ GUIDE.md
```

CI fail nếu artifact lệch nguồn (`sync_assets.js --check`, `sync_core.py --check`).

## Cấu trúc

```
index.html            app 1 file (Pages dùng trực tiếp), adapter + UI + guide
GUIDE.md              nguồn guide, build vào index.html
packages/core/        unicode, entities, preservation, diff, document, markdown, cleaning, limits,
                      zip (streaming), xml (strict), ooxml, pdf, c2pa
tools/                sync_assets, sync_core, build_guide, check_extension, trace_scan, bench,
                      bench_2_3, eval_writing, make_c2pa_fixture
packages/writing/     prompts (9 chế độ), suggestions, language, consistency, evaluation,
                      grammar/{en,vi,index}
packages/providers/   errors, request (timeout/cancel/registry), google, openai-compatible, registry
extension/            MV3: background (service worker), config (key policy + host permission),
                      sidebar, content, panel, core/ (sinh tự động)
tests/                unit + integration + parity + security + writing eval + e2e/ (Playwright)
docs/                 kiến trúc, API, bảo mật, privacy, testing, audit, roadmap, benchmark,
                      báo cáo 2.2 (lịch sử) và 2.3
```

## Giấy phép

**UNLICENSED** — chưa chọn giấy phép. Không dùng lại mã nguồn khi chưa có quyết định của chủ dự án.

## Tài liệu

- [docs/TRACE_CLEANER_2_3_RELEASE_REPORT.md](docs/TRACE_CLEANER_2_3_RELEASE_REPORT.md) — báo cáo phát hành 2.3 (A–H)
- [docs/WRITING_EVAL.md](docs/WRITING_EVAL.md) — precision/recall trên dev + held-out
- [docs/TRACE_CLEANER_2_2_BASELINE.md](docs/TRACE_CLEANER_2_2_BASELINE.md) — baseline trước sprint 2.2 (lịch sử)
- [docs/TRACE_CLEANER_2_2_FINAL_REPORT.md](docs/TRACE_CLEANER_2_2_FINAL_REPORT.md) — báo cáo A–K
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md)
- [docs/SECURITY.md](docs/SECURITY.md) · [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/TESTING.md](docs/TESTING.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/AUDIT.md](docs/AUDIT.md)
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md)

## Trạng thái hardening 2.3.1

2.3.1 siết C2PA/CBOR, ZIP đồng thời/huỷ, giới hạn byte XML và bỏ chèn content script tĩnh.
Các hạng mục còn mở (worker cách ly đầy đủ, PDF.js, corpus độc lập, 400 case writing) được ghi
rõ là **chưa đạt** trong [docs/TRACE_CLEANER_2_3_1_RELEASE_REPORT.md](docs/TRACE_CLEANER_2_3_1_RELEASE_REPORT.md);
không có tuyên bố release-ready cho các hạng mục đó.
