# Unified Baseline — Trace Cleaner 2.1

Ngày lập: 2026-11-20. Mục đích: chốt **hiện trạng thật** trước khi sửa, để báo cáo cuối không
phải suy đoán. Mọi số liệu dưới đây lấy từ lệnh chạy trong repo, không lấy từ tài liệu cũ.

## 1. Trạng thái repository lúc bắt đầu

| Mục | Giá trị |
|---|---|
| Nhánh | `main` |
| HEAD | `5fb0721` (`5fb0721a7650ea9bd1f1b250da6924309d69b034`) |
| `origin/main` | `5fb0721` — local == remote, 0 ahead / 0 behind |
| `git status` | sạch (không có thay đổi chưa commit) |
| File ignored | `.freebuff/.gitignore`, `.freebuff/project-id` |
| Test | 44 pass (trước thay đổi của 2.1) |

## 2. Bản đồ bề mặt (surface map)

| Bề mặt | Entry point | Làm sạch | Kiểm tra bảo toàn | Prompt | Gọi model |
|---|---|---|---|---|---|
| Web | `index.html` (1 file, GitHub Pages + `file://`) | `cleanText()` nhúng | `preservationCheck()` nhúng | `P_BASE` + `P_PRESETS` nhúng | `callLLM()` trong trang |
| Extension side panel | `extension/panel.html` → `panel.js` → `sidebar.js` | `clean()` riêng trong `sidebar.js` | `background.js` → `core/preservation.js` | `PROMPT` riêng trong `background.js` | `background.js` |
| Extension sidebar nổi | `content.js` → `sidebar.js` (shadow DOM) | như trên | như trên | như trên | qua background |
| CLI | `tools/trace_scan.py` | `clean_text()` Python | không có (chỉ scan/clean) | không có | không gọi mạng |
| Core | `packages/core/*.js` | `unicode.clean()` | `preservation.checkPreservation()` | — | — |

## 3. Trùng lặp phát hiện được (trước khi sửa)

| # | Logic | Bản 1 | Bản 2 | Hệ quả |
|---|---|---|---|---|
| D-1 | Làm sạch Unicode | `index.html` `cleanText()` (~200 dòng) | `sidebar.js` `clean()` (~40 dòng + 2 bảng regex) | Extension xoá ZWJ/ZWNJ, web thì không → hai sản phẩm khác nhau |
| D-2 | Bảng codepoint | `index.html` `classify()` + `KILL`/`BLANK`/`HOMO` | `packages/core/unicode.js` | Ba bảng phải sửa tay cùng lúc |
| D-3 | Kiểm tra bảo toàn | `index.html` `preservationCheck()` | `packages/core/preservation.js` | Hai bộ mã lỗi khác nhau |
| D-4 | Prompt viết lại | `index.html` `P_BASE`/`P_PRESETS`/`SELF_EDIT` | `background.js` `PROMPT`/`MD_*_CLAUSE` | Hai prompt mâu thuẫn; bản extension còn dặn xoá tricolon |
| D-5 | Prompt "sinh prompt" | `index.html` `buildPrompt()` (tiếng Việt) | — | Cũng dặn xoá tricolon/bullet/heading |
| D-6 | Danh sách model fallback | `index.html` `GOOGLE_FALLBACK` | `background.js` `GOOGLE_FALLBACK` | Phải sửa hai nơi khi Google đổi tên model |
| D-7 | Chuẩn hoá lỗi provider | `index.html` xử lý chuỗi lỗi trong `runRewrite()` | `background.js` `isModelErr`/`isBusyErr` | Không có mã lỗi ổn định, không timeout |

## 4. Lỗi P0 xác nhận trong extension (bản 1.4.0)

Đọc trực tiếp `extension/sidebar.js` tại `5fb0721`:

| Mã | Vị trí | Hành vi sai |
|---|---|---|
| P0-A | `TRICOLON`, `TRICOLON2` | `(m, a, b, c, end) => a + " and " + b + end` → **mất mục thứ ba** |
| P0-B | `FRAME2` | `(m, a, b) => a` → `"It is not just a tool, it is a platform."` thành `"a tool"` |
| P0-C | `INVIS = /[\u200B-\u200D...]/g` | xoá luôn U+200C/U+200D (ZWNJ/ZWJ) |
| P0-D | `background.js` `PROMPT` | "Delete on sight … Three-item lists (tricolons)" |
| P0-E | `index.html` `P_BASE` + `buildPrompt()` | cùng chỉ dẫn xoá tricolon, bullet, heading |

Tái hiện (trước khi sửa): `sidebar.clean('Kotlin, Java, and Python')` → `'Kotlin and Java'`;
`sidebar.clean('👨‍👩‍👧')` → '👨👩👧' (mất ZWJ).

## 5. Artifact sinh tự động

| Artifact | Nguồn | Sinh bởi | Kiểm tra |
|---|---|---|---|
| `extension/core/entities.js` | `packages/core/entities.js` | `tools/sync_core.py` | `sync_core.py --check`, `tests/core-sync.test.js` |
| `extension/core/preservation.js` | `packages/core/preservation.js` | `tools/sync_core.py` | như trên |
| `extension/core/bundle.js` | 7 module `packages/core/*` | `tools/sync_assets.js` | `sync_assets.js --check`, `tests/assets-sync.test.js` |
| `extension/core/prompts.js` | `packages/writing/prompts.js` | `tools/sync_assets.js` | như trên |
| khối `@generated:prompts` trong `index.html` | `packages/writing/prompts.js` | `tools/sync_assets.js` | như trên + `tests/writing-prompts.test.js` |
| guide trong `index.html` | `GUIDE.md` | `tools/build_guide.py` | `build_guide.py --check` |

## 6. Luồng dữ liệu thật (sau 2.1)

```
Người dùng dán văn bản
  → DocumentSession (original bất biến) [core, dùng trong test/API; web chưa nối UI]
  → cleanText() [packages/core/cleaning.js]
       ├─ stripMarkdown nếu người dùng tắt Markdown
       ├─ protectRegions: code fence, inline code, link, autolink, URL, email
       ├─ unicode.clean() trên từng đoạn chữ (giữ joiner/VS/cờ, audit vị trí)
       └─ countsFor() cho UI
  → (tuỳ chọn) buildPrompt(mode) [packages/writing/prompts.js]
       → provider (web: trong trang; extension: background.js, timeout 60s)
  → checkPreservation(original, proposed) [packages/core/preservation.js]
  → UI hiện kết quả + vấn đề bảo toàn + đường lùi
```

## 7. Phạm vi hoàn thành trong 2.1

| Phase | Nội dung | Trạng thái |
|---|---|---|
| 0 | Baseline, bản đồ trùng lặp, tái hiện P0 | xong (tài liệu này) |
| 1 | Hotfix P0 extension + prompt | xong, có regression test |
| 2 | Core canonical: `cleaning.js`, `prompts.js`, bundle sinh tự động | xong cho extension; **web chưa migrate cleaner** |
| 3 | Parity: extension ↔ core, web prompt ↔ registry | xong phần đã migrate; web cleaner vẫn là bản nhúng |
| 4-8 | Document UI, provider thống nhất toàn bộ, writing engine, forensics, E2E | một phần / chưa (xem báo cáo cuối mục H) |

## 8. Điều KHÔNG được tuyên bố

- Không có bằng chứng extension chạy trong Chrome thật trong phiên 2.1.
- Không gọi API thật (không có key).
- Web vẫn giữ `cleanText`/`preservationCheck` nhúng: **chưa** dùng core canonical.
- Không có grammar/spelling engine.
