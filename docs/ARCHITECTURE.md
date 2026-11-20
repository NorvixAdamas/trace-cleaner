# Kiến trúc Trace Cleaner

## 1. Ràng buộc thiết kế

1. **Web phải chạy offline, không build.** `index.html` được phục vụ trực tiếp bởi GitHub Pages;
   mở bằng `file://` vẫn phải chạy. Vì vậy không dùng bundler, không import ESM trong trang.
2. **Extension MV3** phải đóng gói được từ thư mục `extension/`.
3. **CLI Python** chạy bằng stdlib, không cài package.
4. **Không gửi văn bản/file đi đâu** trừ khi người dùng bấm Humanize và đã nhập key.
5. **Bản gốc không bị ghi đè** — mọi phép biến đổi phải có đường lùi.

## 2. Sơ đồ hiện tại (sau Phase 1)

```
packages/core/                 ← nguồn logic dùng chung (ESM, không dependency)
  unicode.js      phân loại codepoint, scan, clean + audit trail
  entities.js     trích xuất số/URL/email/ngày/trích dẫn/liệt kê
  preservation.js kiểm tra bảo toàn sau khi viết lại
  diff.js         word diff, applyEdits, similarity
  document.js     DocumentSession: original/working/proposed/accepted/exported
  markdown.js     tách code/link khỏi phần chữ, stripMarkdown, đếm cấu trúc

tests/                         ← node --test, không cài gì
  unicode / preservation / diff / markdown / parity / core-sync / web-inline

tools/
  trace_scan.py     CLI (bảng Unicode tương đương core, audit, parity)
  build_guide.py    GUIDE.md → index.html (--check)
  sync_core.py      packages/core → extension/core (--check)
  check_extension.js kiểm tra manifest + import + icon

extension/
  manifest.json     MV3, background type=module, 4 permission hẹp
  background.js     gọi model + checkPreservation
  core/             bản sao tự động của entities.js + preservation.js
  content.js        sidebar nổi trong shadow DOM (chỉ dựng khi mở)
  sidebar.js        UI + cleaner riêng (chưa migrate sang core)
  panel.js          Side Panel gốc

index.html                      ← app 1 file: UI + cleaner + scan + forensics + guide nhúng
  ↳ khối preservationCheck nhúng (được test trích xuất từ chính file)
```

## 3. Luồng sau thay đổi

### Làm sạch (offline)

```
text → cleanText()
  ├─ NFC
  ├─ bảo vệ URL (placeholder \u0000N\u0000)
  ├─ bảo vệ code fence/inline code (\u0001N\u0001)
  ├─ bảo vệ emoji cờ (\u0002N\u0002)
  ├─ phân loại từng codepoint (BLANKS/KILL/HOMO/joiner/VS)
  ├─ sửa câu: intensifier, eval adjective, mở/kết, Oxford comma, tách câu,
  │           frame không mang phủ định, bullet (chỉ khi Markdown tắt), contraction
  ├─ stripMarkdown (nếu Markdown tắt)
  └─ phục hồi code → URL → emoji cờ, chuẩn hoá khoảng trắng
```

### Viết lại + kiểm tra bảo toàn

```
src (original) ──► callLLM ──► raw
                                  ├─ cleanText(raw) ──► cleaned (hiển thị)
                                  └─ preservationCheck(original, raw)
                                        → số / URL / email / ngày / phủ định /
                                          điều kiện / trích dẫn / liệt kê / Markdown
                                        → issues[] (failed | warning)
original vẫn nằm trong #src; nút "↩ Bản gốc trước khi chạy" khôi phục
```

`preservation.semanticReview` luôn `not_checked`: không có kiểm tra ngữ nghĩa tự động đáng tin,
nên UI không được nói "đã kiểm tra nghĩa".

### Extension

```
panel/content ──sendMessage({type:"humanize", text, cfg})──► background
background: humanize() = callModel() + checkPreservation()
            trả { text, preservation }
sidebar: hiện hộp bảo toàn, nút "↩ Bản trước"
```

## 4. Mô hình tài liệu (`DocumentSession`)

| Trạng thái | Ai đổi | Ý nghĩa |
|---|---|---|
| `original` | không ai | nguyên văn người dùng nhập |
| `working` | `acceptAll()` / `commit()` | bản đang sửa |
| `proposed` | `propose()` | đề xuất của model, chưa áp dụng |
| `accepted` | `acceptAll()` | snapshot lần chấp nhận gần nhất |
| `exported` | `export()` | snapshot lúc xuất file |

`revisions[]` + `pointer` cho undo/redo; `commit()` sau khi undo cắt nhánh redo.
Hiện `DocumentSession` mới được dùng trong test và là API cho giai đoạn sau — web app chưa
chuyển sang dùng nó (xem ROADMAP).

## 5. Bảo toàn dữ kiện — thiết kế

- **Deterministic trước, LLM sau.** Prompt chỉ là hướng dẫn; kiểm tra thật chạy bằng mã.
- **Multiset, không phải set.** "2 giây" xuất hiện 2 lần thì bản mới phải còn 2 lần.
- **Quan hệ số học.** `from 4.2 to 2.1` bị đảo thành `from 2.1 to 4.2` → lỗi.
- **Phủ định/điều kiện đếm theo token**, không theo câu, để bắt "not … unless" bị bỏ.
- **Liệt kê** so khớp từng mục sau khi lowercase.
- **Markdown** so số heading/bullet/fence/link; bật giữ Markdown thì mất cấu trúc = lỗi.
- **Không có "passed" cho việc chưa chạy.** `semanticReview` luôn `not_checked`.

## 6. Vì sao vẫn còn trùng lặp

`index.html` phải là một file chạy được bằng `file://`, nên không thể `import` từ `packages/core`.
Giải pháp đang dùng:

- Hàm `preservationCheck` nhúng trong `index.html`, **được test bằng cách trích xuất chính khối mã
  đó** (`tests/web-inline.test.js`), nên không thể lệch âm thầm mà test vẫn xanh.
- `extension/core/` là bản sao sinh tự động, có `sync_core.py --check` và test khớp hash nội dung.

Đây là trả nợ một phần; hợp nhất hoàn toàn `cleanText` với `unicode.js` là việc của Phase 2 và cần
bộ test hồi quy rộng hơn (đặc biệt cho các phép sửa câu).

## 7. Các quyết định có chủ ý

| Quyết định | Lý do |
|---|---|
| Không thêm dependency | giữ Pages/extension/CLI chạy không cần cài đặt, giảm rủi ro chuỗi cung ứng |
| Không viết parser ZIP/PDF mới | rủi ro cao; ưu tiên giới hạn tài nguyên và review trước |
| Giữ ZWJ/ZWNJ/VS mặc định | phá tiếng Ả Rập/Indic/emoji là lỗi dữ liệu |
| Giữ tag char của emoji cờ | xoá sẽ phá emoji; audit ghi rõ lý do |
| `semanticReview: not_checked` | không được tạo cảm giác an toàn giả |
| Bỏ quy tắc "not just" | đảo nghĩa; để người dùng/LLM xử lý có ngữ cảnh |
