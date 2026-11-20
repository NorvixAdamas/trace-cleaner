# Trace Cleaner 2.0 — Báo cáo triển khai

Ngày: 2026-11-20. Báo cáo này chỉ ghi việc **đã làm và đã kiểm tra**; phần chưa làm nằm ở mục H.

---

## A. Trạng thái repository

| Mục | Giá trị |
|---|---|
| Commit bắt đầu | `b11d616` |
| HEAD hiện tại | `b11d616` — **thay đổi chưa commit** (theo yêu cầu không tự push/commit) |
| Nhánh | `main` |
| `git status` | 8 file sửa, 7 nhóm file mới chưa track |

**Sửa:**

- `index.html`
- `extension/background.js`, `content.js`, `manifest.json`, `panel.js`, `sidebar.js`
- `tools/trace_scan.py`, `tools/build_guide.py`

**Thêm:**

- `package.json`, `.github/workflows/ci.yml`
- `packages/core/{unicode,entities,preservation,diff,document,markdown,index}.js`
- `tests/{unicode,preservation,diff,markdown,parity,core-sync,web-inline}.test.js`
- `tools/{sync_core.py,check_extension.js}`
- `extension/core/{entities,preservation}.js` (sinh tự động, có kiểm tra khớp)
- `docs/{AUDIT,ARCHITECTURE,API,PRIVACY,SECURITY,TESTING,ROADMAP,TRACE_CLEANER_2_FINAL_REPORT}.md`
- `README.md`

**Xoá:** không.

---

## B. Kiến trúc

- **Nguồn logic mới:** `packages/core/` — ESM thuần, không dependency, chạy Node và trình duyệt.
  Gồm Unicode, trích xuất thực thể, kiểm tra bảo toàn, diff, mô hình tài liệu, tách Markdown.
- **Web:** vẫn là một file chạy offline. Hàm `preservationCheck` được nhúng trong `index.html` và
  **được test bằng cách trích xuất chính khối mã đó** (`tests/web-inline.test.js`).
- **Extension:** service worker chuyển sang ES module, import `extension/core/preservation.js`
  (bản sao tự động của core). Background trả `{ text, preservation }` thay vì text thô.
- **CLI:** bảng phân loại được đồng bộ với core; thêm audit từng ký tự; giữ emoji cờ.
- **Tài liệu:** audit, kiến trúc, API, bảo mật, privacy, testing, roadmap.

Luồng dữ liệu và quyết định thiết kế: `docs/ARCHITECTURE.md`.

---

## C. Chức năng

### Đã xong và đã kiểm tra

1. **Bảo toàn dữ kiện sau viết lại** (web + extension): số (multiset), chiều `from…to`, URL, email,
   ngày, trích dẫn, phủ định, điều kiện, mục liệt kê, cấu trúc Markdown, độ dài.
2. **Cleaner không còn xoá mục giữa bộ ba.** `Kotlin, Java, and Python` → `Kotlin, Java and Python`.
3. **Không còn đảo nghĩa "not just".** `is not just` → `isn't just` (giữ phủ định).
4. **URL, inline code, code fence, emoji cờ, ZWJ được bảo vệ** trong cleaner web.
5. **Undo chuỗi Humanize** (`↩ Bản trước`) và **khôi phục bản gốc trước khi viết lại**.
6. **Audit Unicode** ở core và Python CLI (vị trí, codepoint, hành động, lý do).
7. **Parity JS ↔ Python** được test trên cùng fixture.
8. **Manifest extension hẹp hơn**: bỏ host permission cho mọi URL.
9. **Test suite 44 test** + 4 lệnh kiểm tra tĩnh.
10. **Guide tái tạo được**: `build_guide.py --check`.

### Một phần

- **Diff & mô hình tài liệu** có API + test (`diffWords`, `DocumentSession`) nhưng **chưa có UI**
  hiển thị diff hay accept từng thay đổi.
- **Kiểm tra bảo toàn** là heuristic deterministic; `semanticReview` luôn `not_checked`.
- **Extension**: đã sửa mã và kiểm tra tĩnh, **chưa chạy trong Chrome thật**.
- **README/LICENSE**: README có; license chưa chọn.

### Chưa làm

- Grammar/spelling/punctuation engine; 7 chế độ viết lại; voice profile; nhiều phương án cho một câu.
- Hợp nhất `cleanText`/`clean` vào `packages/core`.
- Timeout request, key "chỉ phiên", nút xoá key.
- Giới hạn tài nguyên khi parse file; C2PA/signature verification.
- E2E, accessibility audit, benchmark chất lượng viết.

---

## D. Sửa lỗi

| # | Vấn đề | Nguyên nhân gốc | File | Sửa | Test |
|---|---|---|---|---|---|
| 1 | Mất mục giữa bộ ba (P0) | Regex tricolon trả `${a} ${conj} ${c}`, bỏ `b` | `index.html` | Giữ đủ mục, chỉ bỏ dấu phẩy Oxford | `preservation.test.js`, `web-inline.test.js`, Chromium |
| 2 | "not just X" → "X" (P0) | `FRAME_FIX` thay `(is|are) not just` bằng `$1` | `index.html` | Bỏ quy tắc đó | Chromium: `isn't just` |
| 3 | Chuỗi ghi đè văn bản gốc (P1) | `runChain` gán `src.value = cur` không lưu bản cũ | `index.html` | Lưu + nút `↩ Bản trước` | kiểm tra mã/UI (chưa E2E) |
| 4 | URL/code bị regex cấu trúc sửa (P1) | Bảo vệ URL đặt **sau** bước cấu trúc; code không được bảo vệ | `index.html` | Placeholder cho URL, code, cờ trước bước cấu trúc | Chromium |
| 5 | Emoji cờ bị phá (P1) | Mọi `tag` bị xoá | `index.html`, `trace_scan.py` | Nhận diện `U+1F3F4` + tag, giữ nguyên | `unicode.test.js`, `parity.test.js`, Chromium |
| 6 | Python thiếu audit, thiếu LRM/RLM/ALM | Bảng cũ, chỉ trả count | `trace_scan.py` | Thêm codepoint + `audit[]` + `--audit` | `parity.test.js` |
| 7 | Extension xin quyền mọi URL (P1) | `host_permissions` quá rộng | `extension/manifest.json` | Chỉ 3 domain API | `check_extension.js` |
| 8 | Extension tin output model (P1) | Không kiểm tra sau khi gọi | `background.js`, `content.js`, `panel.js`, `sidebar.js` | `checkPreservation` + hộp cảnh báo + revert | `core-sync.test.js`, kiểm tra tĩnh |
| 9 | Build guide không kiểm tra được | Không có `--check` | `build_guide.py` | Thêm chế độ check, exit 1 khi lệch | chạy thật: exit 0 |
| 10 | Nút Copy Markdown gắn nhầm listener | `id="btnMd"` trùng ở thanh chuỗi và báo cáo file | `index.html` | Đổi thành `btnCopyMd` | kiểm tra id trùng: 0 |

---

## E. Testing

Đã chạy (2026-11-20):

| Lệnh | Kết quả |
|---|---|
| `node --test tests` | **44 pass / 0 fail / 0 skip** (~0,4 s) |
| `python tools/build_guide.py --check` | exit 0, guide khớp |
| `node tools/check_extension.js` | exit 0, manifest v1.4.0, 4 permission |
| `python tools/sync_core.py --check` | exit 0, bản sao khớp |
| `python -c "ast.parse(...)"` | `trace_scan.py` hợp lệ |
| `node -e "new Function(<script>)"` | script web hợp lệ cú pháp |
| Chromium + `cleanText` | 5/5 kịch bản đúng, console 0 lỗi |

Chi tiết từng test: `docs/TESTING.md`.

**Không chạy:** extension trong Chrome thật; gọi API thật; E2E; fixture file forensics; đo hiệu
năng; accessibility. Không có kết quả nào ở trên đại diện cho những phần này.

---

## F. Bảo mật

- **Quyền extension:** còn `storage`, `activeTab`, `scripting`, `sidePanel`; host chỉ
  `generativelanguage.googleapis.com`, `api.openai.com`, `openrouter.ai`.
  Content script vẫn `<all_urls>` (cần cho sidebar nổi) — ghi rõ trong `docs/SECURITY.md`.
- **Key:** vẫn lưu plaintext trong `localStorage`/`chrome.storage.local` khi người dùng chọn lưu;
  không phải két mã hoá, đã ghi rõ. Chưa có nút xoá riêng.
- **Output model:** luôn coi là không tin cậy; render bằng `textContent`, escape khi nội suy HTML;
  chạy kiểm tra bảo toàn trước khi hiển thị.
- **File parser:** **chưa** xác nhận có giới hạn kích thước/giải nén/XML; rủi ro mở. Không tuyên bố
  an toàn với file độc hại.
- **Bí mật trong repo:** không có; `.gitignore` chặn log/temp.
- **C2PA/chữ ký:** chưa xác minh; không kết luận hợp lệ.

---

## G. Hiệu năng

Không thực hiện phép đo mới trong phiên này. Không có tuyên bố tăng/giảm RAM, tốc độ hay kích
thước bundle. Thay đổi hiệu năng duy nhất là gián tiếp: kiểm tra bảo toàn chạy bằng regex trên
văn bản đã có trong bộ nhớ, không gọi mạng, nhưng chưa đo chi phí trên văn bản rất dài.

---

## H. Việc còn lại

| Ưu tiên | Việc | Ghi chú |
|---|---|---|
| P0 | Chạy extension trong Chrome thật + gọi API thật | xác nhận luồng end-to-end, kể cả cảnh báo bảo toàn |
| P1 | Timeout + huỷ request extension | tránh treo UI |
| P1 | Giới hạn kích thước/giải nén/thời gian parse file; harden XML | rủi ro bảo mật mở |
| P1 | UI diff + accept/reject từng thay đổi trên `DocumentSession` | hiện chỉ accept toàn bộ |
| P2 | Hợp nhất cleaner web/extension vào `packages/core` | cần test hồi quy rộng |
| P2 | Markdown parser chuẩn, giữ định dạng khi viết lại | hiện là regex |
| P2 | 7 chế độ viết lại, voice profile, structured output | phần lớn của "2.0" |
| P2 | Grammar/spelling/punctuation engine en/vi | chưa có |
| P2 | Key "chỉ phiên" + nút xoá key | |
| P3 | Chọn LICENSE, release notes | |
| P3 | CI chạy thật trên GitHub | workflow đã có, chưa push |
| P3 | Accessibility audit, benchmark chất lượng viết | |

Không có blocker kỹ thuật nào ngoài việc cần key API và Chrome thật để kiểm chứng end-to-end.
