/**
 * Bảo toàn nguyên byte vùng có cấu trúc. Đây là regression test cho lỗi P0 của
 * 2.1: bước chuẩn hoá văn xuôi cuối cùng chạy xuyên qua code fence, làm mất
 * khoảng trắng cuối dòng, tab và dòng trống bên trong code.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText } from '../packages/core/cleaning.js';

const fence = body => '```python\n' + body + '\n```';

test('code fence giữ nguyên tab, khoảng trắng cuối dòng và dòng trống', () => {
  const body = 'items = ["Kotlin", "Java", "Python"]\n\n\nvalue = "preserve  spaces"\t';
  const source = 'Trước.\n\n' + fence(body) + '\n\nSau.';
  const out = cleanText(source).text;
  assert.ok(out.includes(body), `code bị sửa:\n${out}`);
});

test('code fence giữ nguyên dấu phẩy, chấm phẩy, ngoặc, unicode', () => {
  const body = 'const m = {a: 1, b: 2};\nlet s = "x, y, and z";\nconst ước = "ước lượng";\nconst arr = [1,2,3];';
  const out = cleanText('A\n\n' + fence(body) + '\n\nB').text;
  assert.ok(out.includes(body), 'dấu câu trong code bị đổi');
});

test('inline code giữ nguyên nội dung và dấu cách bên trong', () => {
  const source = 'Chạy `const result = a, b, and c;` rồi xem `npm  run  test`.';
  assert.equal(cleanText(source).text, source);
});

test('URL có query string và dấu câu cuối được giữ đúng', () => {
  const source = 'Xem https://example.com/path?x=1&y=2, rồi https://example.com/a,b.';
  const out = cleanText(source).text;
  assert.ok(out.includes('https://example.com/path?x=1&y=2'));
  assert.ok(out.includes('https://example.com/a,b'));
});

test('CRLF bên trong code fence không bị đổi thành LF', () => {
  const source = 'Mở đầu\r\n\r\n```\r\nline one  \r\n\r\n\r\nline two\r\n```\r\n\r\nKết.';
  const out = cleanText(source).text;
  assert.ok(out.includes('line one  \r\n\r\n\r\nline two'), 'CRLF/dòng trống trong code bị đổi');
});

test('nested Markdown: bullet chứa code và link vẫn còn đủ', () => {
  const source = [
    '- Bước một: dùng `a, b, and c`',
    '  - Bước con: xem [tài liệu](https://example.com/docs?a=1&b=2)',
    '- Bước hai: giữ 42% và không đổi',
  ].join('\n');
  assert.equal(cleanText(source).text, source);
});

test('văn xuôi vẫn được dọn trong khi code không bị chạm', () => {
  const source = 'Dòng   có   khoảng   trắng ,  và câu.\n\n' + fence('a  ,  b');
  const out = cleanText(source).text;
  assert.ok(out.startsWith('Dòng có khoảng trắng, và câu.'));
  assert.ok(out.includes('a  ,  b'));
});

test('thẻ HTML/XML giữ nguyên thuộc tính', () => {
  const source = '<w:p w:rsidR="00A1,00B2" w:val="x  y">chữ</w:p>';
  assert.equal(cleanText(source).text, source);
});

test('xoá Markdown vẫn giữ nguyên byte bên trong code fence', () => {
  const body = '  indented\n\n\nlast  ';
  const source = '# Tiêu đề\n\n- mục một\n- mục hai\n\n```js\n' + body + '\n```';
  const out = cleanText(source, { markdown: false }).text;
  assert.ok(out.includes(body), 'nội dung code bị cắt khi xoá Markdown');
  assert.match(out, /Tiêu đề/);
  assert.doesNotMatch(out, /^#/m);
});

test('làm sạch hai lần cho cùng kết quả kể cả có code', () => {
  const source = 'A  ,b\n\n' + fence('x  ,  y') + '\n\nC\u00A0D';
  const once = cleanText(source).text;
  assert.equal(cleanText(once).text, once);
});
