# Trace Cleaner

Công cụ **chạy tại máy** để:

- quét và làm sạch ký tự Unicode ẩn (ZWSP, BOM, soft hyphen, tag char, PUA, bidi, homoglyph);
- chẩn đoán văn bản theo các đặc trưng **đo được** (độ biến thiên câu, em dash, tricolon, bullet,
  bold lead-in…);
- viết lại văn bản bằng model của bạn (Gemini / OpenAI-compatible) **và kiểm tra lại** xem số,
  URL, ngày, phủ định, điều kiện, trích dẫn, cấu trúc Markdown có bị mất không;
- rà soát thay đổi theo từng bước: diff, chấp nhận/từ chối, undo/redo, khôi phục bản gốc, export;
- gợi ý ngữ pháp/chính tả **deterministic, offline** cho tiếng Anh và một phần tiếng Việt;
- đọc metadata file `.docx/.pptx/.xlsx/.pdf/ảnh` và phân tích ELA cục bộ, có giới hạn tài nguyên.

Không có backend. Không có telemetry. Văn bản/file chỉ rời máy khi bạn bấm Humanize và đã nhập
API key — xem [docs/PRIVACY.md](docs/PRIVACY.md).

> Đây không phải công cụ "vượt detector". Điểm số trong app là heuristic đếm đặc trưng, không
> phải xác suất AI, và không có gì đảm bảo một detector thương mại sẽ nói gì. App không kết luận
> ai là tác giả của văn bản.

## Phiên bản

| Thành phần | Version |
|---|---|
| Sản phẩm (web + extension + CLI) | **2.2.0** |
| Prompt registry (`PROMPT_VERSION`) | **2.2.0** — tách riêng khỏi version sản phẩm |
| Engine (`ENGINE_VERSION`) | **2.2** |
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

## Extension Chrome (MV3, v2.2.0)

1. `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `extension/`.
2. Bấm icon để mở Side Panel, hoặc `Alt+Shift+S` để mở sidebar nổi trên trang.
3. Nhập API key trong mục "API key & model" (mặc định chỉ dùng trong phiên; tick "ghi nhớ" mới lưu
   vào `chrome.storage.local`, có nút xoá).
4. Chọn kiểu viết lại trong ô cạnh nút Markdown (9 chế độ, cùng bộ với web).
5. Nút **Huỷ** dừng request đang chạy (khác với timeout). Nếu kiểm tra bảo toàn thất bại, nút
   "Dán vào trang" yêu cầu xác nhận rõ ràng.

Quyền: `storage`, `activeTab`, `scripting`, `sidePanel`; host chỉ 3 domain API. Content script chạy
trên `http(s)` (không còn `file://`) để có sidebar nổi — lý do và kế hoạch thu hẹp:
[docs/SECURITY.md](docs/SECURITY.md).

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
npm test                              # 193 test, không cần npm install
node tools/sync_assets.js --check     # bundle + prompt + index.html khớp nguồn
python tools/sync_core.py --check     # extension/core khớp packages/core
node tools/check_extension.js         # manifest, thứ tự nạp core, artifact, icon
python tools/build_guide.py --check   # guide trong index.html khớp GUIDE.md
node tools/bench.js                   # benchmark thật (tuỳ chọn)
```

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
packages/core/        unicode, entities, preservation, diff, document, markdown, cleaning, limits
packages/writing/     prompts (9 chế độ), suggestions, language, grammar/{en,vi}
packages/providers/   errors, request (timeout/cancel/registry), google, openai-compatible, registry
extension/            MV3: background (service worker), sidebar, content, panel, core/ (sinh tự động)
tools/                sync_assets, sync_core, build_guide, check_extension, trace_scan, bench
tests/                unit + integration + parity (193 test)
docs/                 kiến trúc, API, bảo mật, privacy, testing, audit, roadmap, báo cáo 2.2
```

## Giấy phép

**UNLICENSED** — chưa chọn giấy phép. Không dùng lại mã nguồn khi chưa có quyết định của chủ dự án.

## Tài liệu

- [docs/TRACE_CLEANER_2_2_BASELINE.md](docs/TRACE_CLEANER_2_2_BASELINE.md) — baseline trước sprint
- [docs/TRACE_CLEANER_2_2_FINAL_REPORT.md](docs/TRACE_CLEANER_2_2_FINAL_REPORT.md) — báo cáo A–K
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md)
- [docs/SECURITY.md](docs/SECURITY.md) · [docs/PRIVACY.md](docs/PRIVACY.md)
- [docs/TESTING.md](docs/TESTING.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [docs/AUDIT.md](docs/AUDIT.md)
- [docs/BENCHMARKS.md](docs/BENCHMARKS.md)
