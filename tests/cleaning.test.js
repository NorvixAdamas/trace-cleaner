import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, countsFor, protectRegions, segmentText } from '../packages/core/cleaning.js';

const LISTS = [
  'Kotlin, Java, and Python',
  'React, Node.js, and PostgreSQL',
  'planning, implementation, testing, and deployment',
  'small, medium, large, and extra-large',
  'C++, C#, and F#',
];

test('làm sạch không bao giờ bỏ mục trong danh sách', () => {
  for (const text of LISTS) {
    assert.equal(cleanText(text).text, text, `danh sách bị đổi: ${text}`);
  }
});

test('phủ định và điều kiện được giữ nguyên', () => {
  const cases = [
    'It is not just a tool, it is a platform.',
    'This is not available unless the user enables permissions.',
    'The feature is not only fast but also reliable.',
    'Không phải mọi thay đổi đều an toàn.',
    'Chỉ người dùng có quyền mới được truy cập.',
  ];
  for (const text of cases) {
    assert.equal(cleanText(text).text, text, `nghĩa bị đổi: ${text}`);
  }
});

test('URL, email, inline code và code fence được bảo vệ nguyên byte', () => {
  const text = [
    'See https://example.com/a,b,and,c and https://example.com/path?x=1&y=2',
    'Mail ops@example.com, run `const result = a, b, and c;`',
    '```python',
    'items = ["Kotlin", "Java", "Python"]',
    '```',
    'Then use C++ / C# and Node.js 24.14.1.',
  ].join('\n');
  const out = cleanText(text).text;
  assert.match(out, /https:\/\/example\.com\/a,b,and,c/);
  assert.match(out, /https:\/\/example\.com\/path\?x=1&y=2/);
  assert.match(out, /ops@example\.com/);
  assert.match(out, /`const result = a, b, and c;`/);
  assert.match(out, /items = \["Kotlin", "Java", "Python"\]/);
  assert.match(out, /C\+\+ \/ C# and Node\.js 24\.14\.1/);
});

test('khoảng trắng cạnh vùng bảo vệ không bị mất', () => {
  assert.equal(cleanText('see https://example.com/a,b now').text, 'see https://example.com/a,b now');
  assert.equal(cleanText('a `b` c').text, 'a `b` c');
});

test('joiner, variation selector, emoji gia đình và emoji cờ được giữ', () => {
  const family = '👨\u200D👩\u200D👧';
  const flag = '🇻🇳';
  const arabic = 'می\u200Cخواهم';
  const hindi = 'क्\u200Dष';
  for (const text of [family, flag, arabic, hindi, '❤\uFE0F']) {
    assert.equal(cleanText(text).text, text, `ký tự có nghĩa bị xoá: ${text}`);
  }
});

test('ký tự vô hình thật sự vẫn bị xoá và ghi audit đúng vị trí', () => {
  const source = 'a\u200Bb\u200Bc';
  const result = cleanText(source);
  assert.equal(result.text, 'abc');
  assert.equal(result.audit.length, 2);
  assert.deepEqual(result.audit.map(entry => entry.index), [1, 3]);
  assert.equal(result.audit[0].hex, 'U+200B');
});

test('xoá marker Markdown vẫn giữ đủ mục và nội dung code', () => {
  const text = ['# Title', '', '- Kotlin', '- Java', '- Python', '', '`a, b, and c`'].join('\n');
  const out = cleanText(text, { markdown: false }).text;
  for (const item of ['Kotlin', 'Java', 'Python']) assert.match(out, new RegExp(item));
  // strip Markdown bỏ marker (kể cả backtick) nhưng phải giữ nội dung bên trong.
  assert.match(out, /a, b, and c/);
  assert.doesNotMatch(out, /^#/m);
  assert.doesNotMatch(out, /`/);
});

test('làm sạch lặp lại không đổi kết quả', () => {
  const text = 'Hello\u00A0world \u2014 "quoted" https://example.com/a,b';
  const once = cleanText(text).text;
  const twice = cleanText(once).text;
  assert.equal(twice, once);
});

test('countsFor đếm đặc trưng nhưng không khẳng định tác giả', () => {
  const counts = countsFor('a\u200Bb  \u201Cx\u201D \u2014 not just A but B');
  assert.equal(counts.vis, 1);
  assert.equal(counts.quotes, 2);
  assert.equal(counts.emdash, 1);
  assert.equal(counts.tells, 1);
  assert.equal(counts.joinerKept, 0);
});

test('protectRegions đánh dấu đúng loại vùng', () => {
  const spans = protectRegions('x https://a.test/p `code` [l](https://b.test) y');
  const types = segmentText('x https://a.test/p `code` [l](https://b.test) y')
    .filter(seg => seg.type !== 'text')
    .map(seg => seg.type)
    .sort();
  assert.deepEqual(types, ['inlineCode', 'link', 'url'].sort());
  assert.ok(spans.every(span => span.end > span.start));
});
