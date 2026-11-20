# Kiến trúc Trace Cleaner

## 1. Ràng buộc thiết kế

1. **Web phải chạy offline, không build.** `index.html` được GitHub Pages phục vụ trực tiếp; mở
   bằng `file://` vẫn chạy. Không import ESM trong trang.
2. **Extension MV3** đóng gói từ thư mục `extension/`.
3. **CLI Python** chạy stdlib, không cài package.
4. **Không gửi văn bản/file đi đâu** trừ khi người dùng bấm Humanize và đã nhập key.
5. **Bản gốc không bị ghi đè** — mọi phép biến đổi phải có đường lùi.

## 2. Sơ đồ (sau 2.1)

```
packages/
  core/                        ← NGUỒN DUY NHẤT cho logic dùng chung (ESM, 0 dependency)
    unicode.js                 phân loại codepoint, scan, clean + audit
    entities.js                số/URL/email/ngày/trích dẫn/liệt kê
    preservation.js            kiểm tra bảo toàn sau viết lại
    cleaning.js                engine làm sạch: bảo vệ vùng cấu trúc + gọi unicode.clean
    markdown.js                tách code/link, stripMarkdown, đếm cấu trúc
    diff.js                    word diff, applyEdits, similarity
    document.js                DocumentSession
    index.js                   re-export
  writing/
    prompts.js                 NGUỒN DUY NHẤT cho prompt + 9 chế độ + mệnh đề Markdown

extension/
  manifest.json                MV3, background type=module, 4 permission
  background.js                gọi model (timeout 60s), chuẩn hoá lỗi, checkPreservation
  core/
    entities.js                sinh tự động (sync_core.py)   ← service worker import
    preservation.js            sinh tự động (sync_core.py)
    prompts.js                 sinh tự động (sync_assets.js)
    bundle.js                  sinh tự động (sync_assets.js) ← classic script → globalThis.TraceCore
  content.js                   sidebar nổi trong shadow DOM (chỉ dựng khi mở)
  sidebar.js                   UI adapter: KHÔNG có regex làm sạch riêng
  panel.js / panel.html        Side Panel gốc

index.html                     app 1 file: UI + scan + forensics + guide nhúng
  ├─ khối @generated:prompts   prompt + preset + MD clauses (sinh từ packages/writing/prompts.js)
  └─ cleanText/preservationCheck  BẢN NHÚNG — chưa migrate sang core (xem §6)

tools/
  trace_scan.py                CLI, bảng Python tương đương core
  build_guide.py               GUIDE.md → index.html (--check)
  sync_core.py                 core → extension/core (entities, preservation) (--check)
  sync_assets.js               core → bundle; prompts → extension + index.html (--check)
  check_extension.js           manifest, thứ tự nạp core, artifact, icon
tests/                         node --test, 73 test
```

## 3. Luồng làm sạch (một engine, ba bề mặt)

```
text
 └─ cleanText(text, { markdown })
      ├─ nếu markdown === false: stripMarkdown (bỏ marker, giữ nội dung)
      ├─ segmentText: tách code fence / inline code / link / autolink / URL / email
      ├─ với mỗi đoạn chữ: unicode.clean()
      │    ├─ giữ ZWJ/ZWNJ/variation selector/emoji cờ (mặc định)
      │    ├─ xoá ZWSP/BOM/soft hyphen/tag char/PUA/bidi
      │    ├─ khoảng trắng lạ → space, typography tuỳ chọn
      │    └─ audit: { index (offset chuỗi gốc), hex, category, action, reason }
      └─ countsFor(): đếm tell để hiển thị (không phải xác suất, không phải tác giả)
```

Bất biến: **không** xoá mục danh sách, **không** đổi phủ định, **không** sửa câu. Mọi phép "sửa
câu" của bản cũ (tricolon, "not just", khung đối lập, xoá signpost) đã bị bỏ khỏi extension.

## 4. Luồng viết lại

```
original ──► buildPrompt(mode, {markdown})  [packages/writing/prompts.js]
              ├─ web: nối vào callLLM trong trang
              └─ extension: background.js → resolvePrompt(cfg) + timeout 60s
         ──► model ──► proposed
                        └─ checkPreservation(original, proposed)
                              numbers / urls / emails / dates / entities / negation /
                              conditions / citations / structure / lists / length
                              semanticReview: not_checked
```

Prompt tự soạn của người dùng vẫn được dùng, nhưng **luôn** bị nối thêm khối chế độ + mệnh đề
Markdown lấy từ registry — không thể vô tình bỏ ràng buộc bảo toàn.

## 5. Artifact sinh tự động và chống lệch

| Artifact | Nguồn | Tool | Check |
|---|---|---|---|
| `extension/core/{entities,preservation}.js` | `packages/core` | `sync_core.py` | `--check` + `tests/core-sync.test.js` |
| `extension/core/bundle.js` | 7 module `packages/core` | `sync_assets.js` | `--check` + `tests/assets-sync.test.js` |
| `extension/core/prompts.js` | `packages/writing/prompts.js` | `sync_assets.js` | `--check` |
| khối prompt trong `index.html` | `packages/writing/prompts.js` | `sync_assets.js` | `--check` + `tests/writing-prompts.test.js` |

Bundle là bản dịch ESM → classic script bằng transform tối thiểu; tool **từ chối** mọi module dùng
`export default`/`export *`/`export {}` để không sinh bundle sai. Sửa `packages/core` thì phải chạy
lại tool; CI fail nếu quên.

## 6. Trùng lặp còn lại (được ghi nhận, không giấu)

`index.html` vẫn giữ `cleanText()` và `preservationCheck()` nhúng. Lý do: trang phải chạy `file://`
mà không build. Hệ quả:

- Web và extension **có thể** lệch hành vi làm sạch. Test hiện chỉ bảo vệ extension ↔ core
  (`tests/extension-sidebar.test.js`) và Python ↔ JS (`tests/parity.test.js`).
- Khối nhúng vẫn được test bằng cách trích xuất chính nó (`tests/web-inline.test.js`), nên không
  thể lệch âm thầm mà test xanh — nhưng đó là test *bản nhúng*, không phải test *core*.

Bước tiếp theo (xem ROADMAP #1): nhúng bundle vào `index.html` và biến hai hàm nhúng thành adapter
mỏng gọi `TraceCore`.

## 7. Quyết định có chủ ý

| Quyết định | Lý do |
|---|---|
| Không thêm dependency | Pages/extension/CLI chạy không cần cài; giảm rủi ro chuỗi cung ứng |
| Không viết parser ZIP/PDF mới | rủi ro cao; ưu tiên giới hạn tài nguyên + review |
| Giữ ZWJ/ZWNJ/VS mặc định | phá tiếng Ả Rập/Indic/emoji là lỗi dữ liệu |
| Giữ tag char của emoji cờ | xoá sẽ phá emoji; audit ghi lý do |
| `semanticReview: not_checked` | không tạo cảm giác an toàn giả |
| Bỏ mọi quy tắc "sửa câu" phá huỷ | đã gây mất mục danh sách và đảo phủ định ở extension 1.4.0 |
| Chín chế độ viết lại thay vì 4 preset | mỗi chế độ có ràng buộc riêng, không chỉ đổi nhãn |
| Web chưa migrate cleaner | cần nhúng bundle + đổi test; làm ẩu sẽ phá app đang chạy |
