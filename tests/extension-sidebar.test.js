/**
 * test sidebar như một UI adapter thật: nạp đúng bundle sinh ra từ packages/core
 * trong một context giả lập content script. Đây là regression test cho các lỗi
 * P0 của bản 1.4.0 (mất mục danh sách, đảo phủ định, xoá ZWJ/ZWNJ).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = readFileSync(join(ROOT, 'extension', 'core', 'bundle.js'), 'utf8');
const SIDEBAR = readFileSync(join(ROOT, 'extension', 'sidebar.js'), 'utf8');

function loadSidebar({ withCore = true } = {}) {
  const context = { console, performance: { now: () => 0 } };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  if (withCore) vm.runInContext(BUNDLE, context);
  vm.runInContext(SIDEBAR, context);
  return context.TraceSidebar;
}

test('extension: danh sách ba mục trở lên giữ nguyên từng mục', () => {
  const sidebar = loadSidebar();
  const cases = [
    'Kotlin, Java, and Python',
    'React, Node.js, and PostgreSQL',
    'planning, implementation, testing, and deployment',
    'small, medium, large, and extra-large',
    'C++, C#, and F#',
  ];
  for (const text of cases) {
    assert.equal(sidebar.clean(text, { markdown: true }).text, text, `mất mục: ${text}`);
  }
});

test('extension: phủ định tiếng Anh và tiếng Việt không bị đảo', () => {
  const sidebar = loadSidebar();
  const cases = [
    'It is not just a tool, it is a platform.',
    'This is not available unless the user enables permissions.',
    'The feature is not only fast but also reliable.',
    'Không phải mọi thay đổi đều an toàn.',
    'Chỉ người dùng có quyền mới được truy cập.',
  ];
  for (const text of cases) {
    assert.equal(sidebar.clean(text).text, text, `nghĩa bị đảo: ${text}`);
  }
});

test('extension: ZWJ, ZWNJ, variation selector và emoji cờ được giữ', () => {
  const sidebar = loadSidebar();
  assert.equal(sidebar.clean('👨\u200D👩\u200D👧').text, '👨\u200D👩\u200D👧');
  assert.equal(sidebar.clean('🇻🇳').text, '🇻🇳');
  assert.equal(sidebar.clean('❤\uFE0F').text, '❤\uFE0F');
  assert.equal(sidebar.clean('می\u200Cخواهم').text, 'می\u200Cخواهم');
});

test('extension: URL và code trong trang không bị regex văn xuôi chạm vào', () => {
  const sidebar = loadSidebar();
  const url = 'https://example.com/a,b,and,c';
  assert.match(sidebar.clean(`xem ${url} nhé`).text, new RegExp(url));
  assert.match(sidebar.clean('`const x = a, b, and c;`').text, /`const x = a, b, and c;`/);
});

test('extension: clean trả audit và stats dùng chung', () => {
  const sidebar = loadSidebar();
  const result = sidebar.clean('a\u200Bb');
  assert.equal(result.text, 'ab');
  assert.equal(result.audit.length, 1);
  assert.equal(result.removed.vis, 1);
  assert.equal(result.left.vis, 0);
  assert.equal(sidebar.stats('a\u200Bb').vis, 1);
});

test('extension: thiếu core thì báo lỗi rõ, không âm thầm dùng regex cũ', () => {
  const sidebar = loadSidebar({ withCore: false });
  assert.throws(() => sidebar.clean('anything'), /core dùng chung/);
});

test('extension: sidebar không còn quy tắc phá huỷ của bản 1.4.0', () => {
  assert.doesNotMatch(SIDEBAR, /TRICOLON2?/);
  assert.doesNotMatch(SIDEBAR, /FRAME2/);
  assert.doesNotMatch(SIDEBAR, /const INVIS\s*=/);
  assert.doesNotMatch(SIDEBAR, /\\u200B-\\u200D/);
  assert.match(SIDEBAR, /TraceCore/);
});
