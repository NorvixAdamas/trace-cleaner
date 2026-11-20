import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

function loadInline() {
  const start = html.indexOf('const escapeRe = s =>');
  const end = html.indexOf('function paintPreservation');
  assert.ok(start > 0 && end > start, 'không tìm thấy khối preservationCheck trong index.html');
  const code = html.slice(start, end);
  return new Function('let mdKeep = true;\n' + code + '\nreturn preservationCheck;')();
}

test('index.html: danh sách ba mục không được mất một mục', () => {
  const check = loadInline();
  const result = check(
    'Developed Android applications using Kotlin, Java, and Python.',
    'Built Android apps with Kotlin and Python.',
  );
  assert.equal(result.failed, true);
  assert.ok(result.issues.some(i => i.code === 'list_item_removed'));
});

test('index.html: đổi số và đảo chiều so sánh bị bắt', () => {
  const check = loadInline();
  const changed = check('Startup time fell from 4.2 seconds to 2.1 seconds.', 'Startup time fell from 4.6 seconds to 2.1 seconds.');
  assert.ok(changed.issues.some(i => i.code === 'number_missing'));
  const reversed = check('Startup time fell from 4.2 seconds to 2.1 seconds.', 'Startup time went from 2.1 seconds to 4.2 seconds.');
  assert.ok(reversed.issues.some(i => i.code === 'numeric_relation_reversed'));
});

test('index.html: phủ định, URL, trích dẫn được kiểm tra', () => {
  const check = loadInline();
  const neg = check('It is not available unless you enable it.', 'It is available when you enable it.');
  assert.ok(neg.issues.some(i => i.code === 'negation_removed'));
  const url = check('See https://example.com/docs.', 'See https: //example.com/docs.');
  assert.ok(url.issues.some(i => i.code === 'url_missing'));
  const cite = check('Work (Smith, 2024) supports this.', 'Work supports this.');
  assert.ok(cite.issues.some(i => i.code === 'citation_missing'));
});

test('index.html: bản viết lại giữ nguyên thì không báo lỗi', () => {
  const check = loadInline();
  const text = 'The API returns 24 rows in under 2 seconds. See https://example.com/docs.';
  const result = check(text, text);
  assert.deepEqual(result.issues, []);
  assert.equal(result.failed, false);
});
