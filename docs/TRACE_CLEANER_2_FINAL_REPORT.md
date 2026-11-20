# Trace Cleaner 2.1 — Báo cáo triển khai (đã lỗi thời)

> **Trạng thái:** tài liệu lịch sử cho milestone 2.1. Ba commit 2.1 đã ở trên `origin/main`
> (`4730665`, `499c762`, `056cd6b`); HEAD hiện tại là `056cd6b`, không phải `5fb0721`. Các số liệu
> "chưa push", 73 test, `<all_urls>`, `PROMPT_VERSION 2.1.0` dưới đây **không còn đúng**.
> Xem [TRACE_CLEANER_2_2_FINAL_REPORT.md](TRACE_CLEANER_2_2_FINAL_REPORT.md).

Ngày: 2026-11-20. Baseline: `5fb0721`. Báo cáo chỉ ghi việc **đã làm và đã kiểm tra**;
phần chưa làm nằm ở mục H. Không commit, không push (theo yêu cầu).

---

## A. Trạng thái repository

| Mục | Giá trị |
|---|---|
| HEAD bắt đầu | `5fb0721a7650ea9bd1f1b250da6924309d69b034` |
| HEAD cuối | `5fb0721` — **không tạo commit mới** |
| Nhánh | `main` (không đổi) |
| `git status` | 9 file sửa, 7 mục mới chưa track (liệt kê dưới) |
| Commit/push | **không** |

**Sửa:** `index.html`, `extension/{background,content,panel,sidebar}.js`, `extension/panel.html`,
`extension/manifest.json`, `tools/check_extension.js`, `package.json`, `.github/workflows/ci.yml`.

**Thêm:** `packages/core/cleaning.js`, `packages/writing/prompts.js`,
`extension/core/{bundle,prompts}.js` (sinh tự động), `tools/sync_assets.js`,
`tests/{cleaning,extension-sidebar,writing-prompts,assets-sync}.test.js`,
`docs/UNIFIED_BASELINE.md`.

**Xoá:** không.

---

## B. Kiến trúc

- **Canonical core:** `packages/core/` là nguồn duy nhất cho Unicode, thực thể, bảo toàn, diff,
  tài liệu, Markdown **và làm sạch** (`cleaning.js` mới).
- **Prompt canonical:** `packages/writing/prompts.js` — `PROMPT_BASE`, 9 chế độ, mệnh đề Markdown,
  `SELF_EDIT`, `buildPrompt()`. Không còn prompt thứ hai.
- **Extension:** `sidebar.js` trở thành UI adapter; mọi phép làm sạch đi qua `TraceCore.cleanText`
  trong `extension/core/bundle.js` (bundle classic-script sinh từ `packages/core`).
  `background.js` import prompt từ `extension/core/prompts.js`.
- **Web:** prompt lấy từ khối `@generated:prompts` trong `index.html` (sinh từ registry).
  Cleaner và `preservationCheck` của web **vẫn là bản nhúng** — chưa migrate (xem H).
- **Artifact sinh tự động:** `tools/sync_assets.js` sinh bundle extension, bản copy prompt và
  khối prompt trong `index.html`; `--check` fail khi lệch. `tools/sync_core.py` vẫn phụ trách
  `entities.js`/`preservation.js` cho service worker.
- **CLI:** không đổi trong 2.1; vẫn là bảng Python tương đương + parity test.

Chi tiết: `docs/ARCHITECTURE.md`, baseline: `docs/UNIFIED_BASELINE.md`.

---

## C. Lỗi đã sửa

| # | Hành vi gốc | Nguyên nhân | File/hàm | Sửa | Test | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `Kotlin, Java, and Python` → `Kotlin and Java` | callback `TRICOLON`/`TRICOLON2` bỏ capture thứ ba | `extension/sidebar.js` | xoá toàn bộ quy tắc tricolon; cleaner dùng core | `extension-sidebar.test.js` (5 danh sách) | pass |
| 2 | `It is not just a tool, it is a platform.` → `a tool` | `FRAME2` trả `a` | `extension/sidebar.js` | xoá `FRAME1`/`FRAME2`; chỉ làm sạch ký tự | `extension-sidebar.test.js` (5 câu EN/VI) | pass |
| 3 | `👨‍👩‍👧` → mất ZWJ; `می‌خواهم` hỏng | `INVIS` phủ `U+200B–U+200D` | `extension/sidebar.js` | xoá regex; core phân loại joiner/VS riêng và giữ mặc định | `extension-sidebar.test.js`, `cleaning.test.js` | pass |
| 4 | Prompt dặn model xoá tricolon, bullet, phủ định | prompt cũ trong `background.js`, `index.html` | `background.js`, `index.html` | thay bằng registry bảo toàn-trước; web sinh từ cùng nguồn | `writing-prompts.test.js` | pass |
| 5 | `buildPrompt()` (prompt tiếng Việt) dặn xoá tricolon/bullet/heading | viết cho mục tiêu "né detector" | `index.html` | đổi thành "giữ đủ mục / giữ cấu trúc / không đảo phủ định" | `writing-prompts.test.js` (quét `index.html`) | pass |
| 6 | Làm sạch cạnh URL ăn mất khoảng trắng (`seehttps://…`) | tidy cắt `[ \t]+$` trên từng đoạn chữ | `packages/core/cleaning.js` | `cleanProseStrict` giữ khoảng trắng biên | `cleaning.test.js` | pass |
| 7 | Request model có thể treo vô hạn | không timeout/abort | `extension/background.js` | `AbortController` 60s + `withTimeout` | kiểm tra cú pháp + review mã | chưa E2E |
| 8 | Lỗi provider không có mã ổn định | ném chuỗi tự do | `extension/background.js` | `PROVIDER_AUTH_ERROR`, `_RATE_LIMIT`, `_TIMEOUT`, `_UNAVAILABLE`, `_EMPTY_RESPONSE`, `NETWORK_ERROR`, `CANCELLED` | review mã | chưa có test provider |
| 9 | `test:core` trỏ tới `tests/document.test.js` không tồn tại | script cũ | `package.json` | bỏ file không tồn tại, thêm `cleaning.test.js` | `npm test` | pass |
| 10 | CI không kiểm tra artifact sinh tự động | thiếu bước | `.github/workflows/ci.yml` | thêm `node tools/sync_assets.js --check` | chạy local exit 0 | pass (chưa đẩy lên) |

---

## D. Parity giữa các bề mặt

| Tính năng | Web | Extension | Python | Hợp đồng chung | Đã kiểm chứng |
|---|---|---|---|---|---|
| Làm sạch Unicode | bản nhúng `cleanText` | `TraceCore.cleanText` (core) | `clean_text()` | `packages/core/unicode.js` | Extension ↔ core: **có test**; Python ↔ JS: **parity test**; Web ↔ core: **KHÔNG** |
| Bảo toàn dữ kiện | `preservationCheck` nhúng | `core/preservation.js` | — | `packages/core/preservation.js` | Extension: import trực tiếp; Web: **chưa** dùng core |
| Prompt viết lại | khối sinh tự động | `core/prompts.js` | — | `packages/writing/prompts.js` | **có test** (`writing-prompts.test.js`, `assets-sync.test.js`) |
| Chế độ viết lại | 4 preset UI | 9 chế độ (select) | — | `MODES` | registry **có test**; UI mới chỉ kiểm tra tĩnh |
| Mã lỗi provider | chuỗi tiếng Việt | mã `PROVIDER_*` | — | `background.js` | **chưa** thống nhất với web |
| Artifact sinh tự động | prompt block | bundle + prompts | — | `sync_assets.js` / `sync_core.py` | **có test drift** |
| Diff | không có UI | không có UI | — | `packages/core/diff.js` | core **có test** |

Ghi chú thẳng: web **chưa** dùng canonical core cho cleaner/bảo toàn. Đây là khoảng trống lớn nhất
còn lại của mục tiêu "one source of truth".

---

## E. Kiểm thử

Đã chạy (2026-11-20, Node v26.13.0, Python 3.11.9):

| Lệnh | Kết quả |
|---|---|
| `node --test tests/*.test.js` | **73 pass / 0 fail / 0 skip** (~1,0 s) |
| `node tools/sync_assets.js --check` | exit 0 — `artifact khớp nguồn` |
| `python tools/sync_core.py --check` | exit 0 — `extension/core khớp packages/core` |
| `node tools/check_extension.js` | exit 0 — `manifest OK · v2.1.0 · 4 permission` (1 warning `<all_urls>`) |
| `python tools/build_guide.py --check` | exit 0 — guide khớp |
| `node --check` cho 7 file JS đã sửa/mới | exit 0 |
| `new Function(<script trong index.html>)` | hợp lệ cú pháp |
| Chromium, `http://127.0.0.1:8791/index.html` | trang chạy, `PROMPT_VERSION=2.1.0`, `P_BASE` không còn chỉ dẫn xoá, 4 preset, `cleanText` giữ tricolon/URL, `preservationCheck` bắt `list_item_removed`, 0 lỗi console |

Phân bố test: `cleaning` 10, `unicode` 10, `markdown` 10, `preservation` 11, `extension-sidebar` 7,
`writing-prompts` 7, `diff` 6, `assets-sync` 5, `web-inline` 4, `parity` 2, `core-sync` 1.

**Không chạy / không có kết quả:** extension trong Chrome thật (chỉ kiểm tra tĩnh + test trong vm);
gọi API thật; E2E; fixture docx/pptx/xlsx/pdf; đo hiệu năng; accessibility; xác minh C2PA.

---

## F. Bảo mật và privacy

- **Quyền extension:** `storage`, `activeTab`, `scripting`, `sidePanel`; host permission chỉ 3 domain
  API. `content_scripts.matches` **vẫn `<all_urls>`** — cần cho sidebar nổi + phím tắt; đã ghi rõ
  trong `docs/SECURITY.md`, không tuyên bố "đã thu hẹp hoàn toàn".
- **Key:** vẫn plaintext trong `chrome.storage.local` / `localStorage` khi người dùng chọn lưu;
  chưa có nút xoá riêng, chưa có chế độ "chỉ phiên".
- **Request:** thêm timeout 60s + `AbortController`; lỗi 401/403/429/404/5xx được map sang mã,
  message cắt còn 180 ký tự; không log key.
- **Prompt:** một registry duy nhất, không còn chỉ dẫn xoá nội dung; prompt tự soạn vẫn bị ép kèm
  mệnh đề Markdown/nội dung từ registry.
- **Bảo toàn:** mọi phản hồi model vẫn qua `checkPreservation`; lỗi không bị ẩn.
- **File parser:** **không thay đổi** trong 2.1 — chưa có giới hạn giải nén/XML (rủi ro mở).
- **Provenance:** không có thay đổi nào xoá metadata C2PA; công cụ vẫn chỉ đọc dấu hiệu, không xác minh.

---

## G. Hiệu năng

Không đo trong phiên này. Không có tuyên bố nhanh/chậm hơn. Thay đổi có ảnh hưởng tiềm năng:
bundle core trong extension lớn hơn sidebar cũ (bundle ~1.4k dòng), và `cleanText` chạy qua
`segmentText` trước khi phân loại codepoint. Chưa benchmark; xem mục H.

---

## H. Việc chưa làm

| Ưu tiên | Việc | Ghi chú |
|---|---|---|
| P0 | Web dùng canonical core cho `cleanText` + `preservationCheck` | hiện vẫn là bản nhúng; cần nhúng bundle vào `index.html` + đổi `web-inline.test.js` sang test adapter |
| P0 | Chạy extension trong Chrome thật + gọi API thật | chưa ai xác nhận E2E trong phiên này |
| P1 | Test cho timeout/mã lỗi provider | mã đã có, chưa có test tự động (cần mock fetch) |
| P1 | Giới hạn tài nguyên parse file + harden XML | rủi ro bảo mật mở, không đổi trong 2.1 |
| P1 | UI diff + accept/reject từng thay đổi trên `DocumentSession` | core có API + test, UI chưa nối |
| P2 | Grammar/spelling/punctuation engine en/vi | chưa có; không được quảng cáo |
| P2 | Thống nhất mã lỗi web ↔ extension | web vẫn hiện chuỗi lỗi thô |
| P2 | Thu hẹp `<all_urls>` bằng `activeTab` + optional host | cần thử nghiệm Chrome thật trước |
| P3 | LICENSE, benchmark, accessibility, C2PA verification | |

---

## I. Mốc tiếp theo đề xuất

**Nhúng bundle core vào `index.html` và chuyển `cleanText` + `preservationCheck` của web sang
`TraceCore`**, cập nhật `tests/web-inline.test.js` để test adapter thay vì bản sao. Đây là mốc
duy nhất còn lại để tuyên bố "một nguồn sự thật" cho cả ba bề mặt, và nó đo được bằng test drift
đã có sẵn.
