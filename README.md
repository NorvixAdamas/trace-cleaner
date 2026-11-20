# Trace Cleaner

Công cụ **chạy tại máy** để:

- quét và làm sạch ký tự Unicode ẩn (ZWSP, BOM, soft hyphen, tag char, PUA, bidi, homoglyph);
- chẩn đoán văn bản theo các đặc trưng đo được (độ biến thiên câu, em dash, tricolon, bullet,
  bold lead-in…);
- viết lại văn bản bằng model của bạn (Gemini / OpenAI-compatible) **và kiểm tra lại** xem số,
  URL, ngày, phủ định, điều kiện, trích dẫn, cấu trúc Markdown có bị mất không;
- đọc metadata file `.docx/.pptx/.xlsx/.pdf/ảnh` và phân tích ELA cục bộ.

Không có backend. Không có telemetry. Văn bản/file chỉ rời máy khi bạn bấm Humanize và đã nhập
API key — xem [docs/PRIVACY.md](docs/PRIVACY.md).

> Đây không phải công cụ "vượt detector". Điểm số trong app là heuristic đếm đặc trưng, không
> phải xác suất AI, và không có gì đảm bảo một detector thương mại sẽ nói gì.

## Dùng web

Cách 1: mở `index.html` trực tiếp (offline, không cần server).

Cách 2:

```bash
python -m http.server 8781 --bind 127.0.0.1
# http://127.0.0.1:8781/index.html
```

Bản công khai: `https://norvixadamas.github.io/trace-cleaner/`.

## Extension Chrome (MV3, v2.1.0)

1. `chrome://extensions` → bật Developer mode → **Load unpacked** → chọn thư mục `extension/`.
2. Bấm icon để mở Side Panel, hoặc `Alt+Shift+S` để mở sidebar nổi trên trang.
3. Nhập API key trong mục "API key & model" (lưu bằng `chrome.storage.local`).
4. Chọn kiểu viết lại trong ô cạnh nút Markdown (9 chế độ, cùng bộ với `packages/writing/prompts.js`).

Quyền: `storage`, `activeTab`, `scripting`, `sidePanel`; host chỉ 3 domain API. Content script vẫn
chạy trên mọi trang để có sidebar nổi — lý do và rủi ro: [docs/SECURITY.md](docs/SECURITY.md).

Extension dùng chung core với web: sidebar **không** còn regex làm sạch riêng, mọi phép làm sạch
đi qua `extension/core/bundle.js` (sinh từ `packages/core/`).

## CLI

```bash
python tools/trace_scan.py file.txt                    # báo cáo
python tools/trace_scan.py file.txt --strip -o clean.txt
python tools/trace_scan.py file.txt --json --audit     # kèm audit từng ký tự
cat file.txt | python tools/trace_scan.py --strip
```

`--fail-on-security` trả exit code 2 khi có tag char / PUA / homoglyph (dùng cho CI).

## Test

```bash
node --test tests/*.test.js           # 73 test, không cần npm install
node tools/sync_assets.js --check     # bundle + prompt + index.html khớp nguồn
python tools/sync_core.py --check     # extension/core khớp packages/core
node tools/check_extension.js         # manifest, thứ tự nạp core, artifact, icon
python tools/build_guide.py --check   # guide trong index.html khớp GUIDE.md
```

## Sinh lại artifact (sau khi sửa `packages/`)

```bash
node tools/sync_assets.js     # extension/core/bundle.js, extension/core/prompts.js, prompt trong index.html
python tools/sync_core.py     # extension/core/{entities,preservation}.js
python tools/build_guide.py   # guide trong index.html từ GUIDE.md
```

CI fail nếu artifact lệch nguồn (`sync_assets.js --check`, `sync_core.py --check`).

## Cấu trúc

```
index.html            app 1 file (Pages dùng trực tiếp)
GUIDE.md              nguồn guide, build vào index.html
packages/core/        Unicode, làm sạch, thực thể, bảo toàn, diff, tài liệu, Markdown (ESM, 0 dependency)
packages/writing/     prompt + 9 chế độ viết lại (nguồn duy nhất cho web và extension)
tests/                unit + regression + parity JS/Python + drift artifact (73 test)
extension/            MV3: background, content, sidebar, side panel, core sinh tự động
tools/                CLI, build guide, sync core, sync assets, kiểm tra extension
docs/                 audit, baseline, kiến trúc, API, bảo mật, privacy, testing, roadmap
```

Chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md) ·
[docs/AUDIT.md](docs/AUDIT.md) · [docs/UNIFIED_BASELINE.md](docs/UNIFIED_BASELINE.md) ·
[docs/ROADMAP.md](docs/ROADMAP.md).

## Trạng thái

Bản 2.1: extension đã dùng core canonical; **web vẫn giữ cleaner/preservation nhúng** (chưa
migrate). Những gì đã xong và chưa xong được liệt kê trung thực trong
[docs/TRACE_CLEANER_2_FINAL_REPORT.md](docs/TRACE_CLEANER_2_FINAL_REPORT.md).

## License

Chưa có file LICENSE → hiện là "all rights reserved". Cần chọn giấy phép trước khi phát hành.
