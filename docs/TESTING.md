# Testing

## Chạy

```bash
node --test tests/*.test.js          # 73 test, không cần cài dependency
node tools/sync_assets.js --check    # bundle + prompt + index.html khớp nguồn
python tools/sync_core.py --check    # extension/core khớp packages/core
node tools/check_extension.js        # manifest, thứ tự nạp core, artifact, icon
python tools/build_guide.py --check  # guide trong index.html khớp GUIDE.md
```

`npm test` / `npm run check` là alias. Dùng glob `tests/*.test.js`, không dùng `node --test tests`:
Node 22 trên CI không nhận thư mục làm tham số.

Yêu cầu: Node ≥ 20 (đã chạy v26.13.0), Python 3.11 cho parity và script build. Test parity tự
`skip` nếu không có `python`.

## Kết quả chạy 2026-11-20 (sau 2.1)

| Lệnh | Kết quả |
|---|---|
| `node --test tests/*.test.js` | **73 pass, 0 fail, 0 skip** (~1,0 s) |
| `node tools/sync_assets.js --check` | `artifact khớp nguồn`, exit 0 |
| `python tools/sync_core.py --check` | `extension/core khớp packages/core`, exit 0 |
| `node tools/check_extension.js` | `manifest OK · v2.1.0 · 4 permission`, exit 0 (1 warning: `<all_urls>`) |
| `python tools/build_guide.py --check` | exit 0 |
| `node --check` trên 7 file JS | exit 0 |
| `new Function(<script trong index.html>)` | cú pháp hợp lệ |

## Test có gì

| File | Số test | Nội dung |
|---|---|---|
| `tests/cleaning.test.js` | 10 | 5 danh sách 3-4 mục giữ nguyên, phủ định EN/VI, URL/email/code, khoảng trắng cạnh vùng bảo vệ, joiner/VS/cờ, audit offset, idempotent, `markdown:false`, `countsFor` |
| `tests/unicode.test.js` | 10 | phân loại, scan vị trí, giữ ZWJ/VS, giữ emoji cờ, audit, tiếng Việt, em dash/quote, idempotent |
| `tests/markdown.test.js` | 10 | `DocumentSession` (original/proposed/accepted, undo/redo, export), tách code/link, strip |
| `tests/preservation.test.js` | 11 | Kotlin/Java/Python, số, đảo chiều `from…to`, phủ định/điều kiện, URL, trích dẫn, Markdown, độ dài |
| `tests/extension-sidebar.test.js` | 7 | nạp **bundle + sidebar** trong vm: 5 danh sách, 5 câu phủ định EN/VI, ZWJ/ZWNJ/VS/cờ, URL/code, audit/stats, thiếu core báo lỗi, quét mã nguồn không còn regex phá huỷ |
| `tests/writing-prompts.test.js` | 7 | không còn chỉ dẫn xoá trong prompt nguồn/extension/index.html; bảo toàn đứng trước; 9 chế độ khác nhau; `buildPrompt` + Markdown; web khớp registry; background import registry |
| `tests/diff.test.js` | 6 | word diff, dựng lại văn bản, similarity, `applyEdits` |
| `tests/assets-sync.test.js` | 5 | drift bundle/prompt/index.html, bundle phơi API core, copy prompt khớp, manifest nạp core trước sidebar, marker duy nhất |
| `tests/web-inline.test.js` | 4 | trích `preservationCheck` từ `index.html` và kiểm 4 hành vi then chốt |
| `tests/parity.test.js` | 2 | JS core vs Python CLI trên cùng fixture (ZWSP, BOM, homoglyph, bidi, PUA, cờ, LRM/RLM/ALM) |
| `tests/core-sync.test.js` | 1 | `extension/core` khớp `packages/core` |

## Regression bắt buộc

- `Kotlin, Java, and Python` · `React, Node.js, and PostgreSQL` · `planning, implementation, testing, and deployment` · `small, medium, large, and extra-large` · `C++, C#, and F#` — không mất mục nào.
- `It is not just a tool, it is a platform.` · `This is not available unless the user enables permissions.` · `The feature is not only fast but also reliable.` · `Không phải mọi thay đổi đều an toàn.` · `Chỉ người dùng có quyền mới được truy cập.` — không đảo nghĩa.
- `https://example.com/a,b,and,c` · `https://example.com/path?x=1&y=2` · `` `const result = a, b, and c;` `` · code fence Python — nguyên byte.
- `👨‍👩‍👧` · `🇻🇳` · `❤️` · `می‌خواهم` — joiner/VS/tag không bị xoá.
- Prompt không được chứa "Delete on sight", "Three-item lists", "Break it".

## Kiểm tra thủ công trong Chromium (2026-11-20, bản 2.0)

Server `python -m http.server 8781 --bind 127.0.0.1`, gọi trực tiếp `cleanText` trong trang:
5/5 kịch bản đúng (tricolon, URL có dấu phẩy, inline code + bold, cờ/ZWJ, "not just"), console 0 lỗi.

Bản 2.1 (sau khi đổi chuỗi prompt), mở lại trong Chromium qua `python -m http.server 8791`:
trang tải được, `PROMPT_VERSION = "2.1.0"`, `P_BASE` không còn "Delete on sight", `P_PRESETS` đủ
4 khoá, `buildHumanPrompt('general')` dài 2360 ký tự, `cleanText('Kotlin, Java, and Python')` giữ
nguyên, URL có dấu phẩy giữ nguyên, `preservationCheck` bắt `list_item_removed`, **0 lỗi console**.

## Chưa kiểm tra (không được coi là pass)

- Extension trong Chrome thật: nạp unpacked, bấm icon, Side Panel, `Alt+Shift+S`, chèn lại văn bản.
  Mới có: kiểm tra tĩnh manifest/thứ tự nạp + test logic trong vm.
- Gọi API thật (Gemini/OpenAI). Luồng timeout/mã lỗi mới **chưa có test tự động**.
- Web dùng core canonical: chưa xảy ra — web vẫn là bản nhúng.
- Fixture docx/pptx/xlsx/pdf/ảnh; C2PA; accessibility; benchmark.
- CI trên GitHub cho commit 2.1: chưa push nên chưa chạy.

## Khi thêm test

- Test chạm `index.html`/`extension/` phải đọc file thật, không copy hàm sang test.
- Test hành vi extension phải nạp `extension/core/bundle.js` thật (xem `extension-sidebar.test.js`),
  không mock core — nếu mock thì test không bắt được drift.
- Không đánh dấu pass cho hành vi chưa chạy; dùng `t.skip` kèm lý do.
