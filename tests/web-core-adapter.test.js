/**
 * Web phải dùng ĐÚNG engine với extension. Test này nạp bundle sinh tự động từ
 * index.html rồi chạy chính các adapter trong trang, nên nó bắt được cả hai lỗi:
 *   - adapter gọi sai core;
 *   - ai đó nhét lại một bản làm sạch/preservation riêng vào trang.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `không thấy khối ${startMarker}`);
  return html.slice(start, end);
}

const coreBlock = sliceBetween('/* @generated:core:start', '/* @generated:core:end */');

function loadCore() {
  const context = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, URL, AbortController, Math, Date, JSON };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(coreBlock, context);
  return context;
}

function loadAdapter(context, startMarker, endMarker, name, prelude = '') {
  const code = sliceBetween(startMarker, endMarker);
  const script = `${prelude}\n${code}\n${name};`;
  return vm.runInContext(script, context);
}

test('index.html nhúng bundle core sinh tự động và phơi đủ API', () => {
  const context = loadCore();
  assert.equal(typeof context.TraceCore.cleanText, 'function');
  assert.equal(typeof context.TraceCore.checkPreservation, 'function');
  assert.equal(typeof context.TraceCore.DocumentSession, 'function');
  assert.equal(typeof context.TraceWriting.analyze, 'function');
  assert.equal(typeof context.TraceProviders.generate, 'function');
  assert.equal(context.TraceCore.__engineVersion, '2.3');
});

test('web cleanText là adapter: không chứa regex làm sạch riêng', () => {
  const block = sliceBetween('function cleanText(text, o){', 'function stripMarkdown(text){');
  assert.match(block, /TraceCore\.cleanText|core\(\)\.cleanText/, 'adapter phải gọi core');
  assert.ok(block.length < 1400, 'adapter quá dài — có thể đã nhét lại thuật toán');
  assert.doesNotMatch(block, /EMOJI|flagSeqs|PHRASES|CONTRACT|INTENS|EVAL_SWAP/);
  assert.doesNotMatch(block, /\.replace\(/, 'adapter không được tự biến đổi chuỗi');
});

test('web cleanText cho kết quả giống hệt core', () => {
  const context = loadCore();
  const cleanText = loadAdapter(context, 'function cleanText(text, o){', 'function stripMarkdown(text){', 'cleanText', 'function core(){ return TraceCore; }');
  const cases = [
    'a\u200Bb  ,c',
    'Kotlin, Java, and Python',
    'It is not just a tool.\n\n```py\nx  =  1, 2\n```',
    'See https://example.com/a,b and `a, b, and c`',
    '',
  ];
  for (const text of cases) {
    const web = cleanText(text, { markdown: true });
    const core = context.TraceCore.cleanText(text, { markdown: true });
    assert.equal(web.text, core.text, `khác core với: ${JSON.stringify(text)}`);
    assert.deepEqual(web.audit.map(a => a.index), core.audit.map(a => a.index));
  }
});

test('web cleanText tôn trọng tuỳ chọn markdown/aggressive như core', () => {
  const context = loadCore();
  const cleanText = loadAdapter(context, 'function cleanText(text, o){', 'function stripMarkdown(text){', 'cleanText', 'function core(){ return TraceCore; }');
  const text = '# Title\n\n- một\n- hai\n\n`a, b`';
  const web = cleanText(text, { markdown: false });
  const core = context.TraceCore.cleanText(text, { markdown: false });
  assert.equal(web.text, core.text);
  assert.doesNotMatch(web.text, /^#/m);
});

test('web preservationCheck dùng core, không có bản sao thuật toán', () => {
  const block = sliceBetween('function preservationCheck(original, proposed){', 'function paintPreservation(guard){');
  assert.match(block, /checkPreservation/);
  assert.ok(block.length < 1200, 'preservation của web quá dài — có thể là bản sao');
  assert.doesNotMatch(block, /escapeRe|numeric_relation_reversed|enumItems/);

  const context = loadCore();
  const check = loadAdapter(context, 'function preservationCheck(original, proposed){', 'function paintPreservation(guard){', 'preservationCheck', 'let mdKeep = true; function core(){ return TraceCore; }');

  const list = check('Built with Kotlin, Java, and Python.', 'Built with Kotlin and Python.');
  assert.equal(list.failed, true);
  assert.ok(list.issues.some(i => i.code === 'list_item_removed'));

  const neg = check('It is not available unless you enable it.', 'It is available when you enable it.');
  assert.ok(neg.issues.some(i => i.code === 'negation_removed'));

  const number = check('Startup fell from 4.2 seconds to 2.1 seconds.', 'Startup fell from 4.6 seconds to 2.1 seconds.');
  assert.ok(number.issues.some(i => i.code === 'number_missing'));

  const url = check('See https://example.com/docs.', 'See https: //example.com/docs.');
  assert.ok(url.issues.some(i => i.code === 'url_missing'));

  const same = check('The API returns 24 rows.', 'The API returns 24 rows.');
  assert.equal(same.issues.length, 0);
  assert.equal(same.failed, false);
});

test('web buildPrompt dùng registry, không còn mục tiêu CV hay câu lệnh phá nội dung', () => {
  const block = sliceBetween('function currentMode(){', 'function renderPrompt(strict){');
  assert.match(block, /P_MODES/);
  assert.match(block, /P_BASE/);
  assert.doesNotMatch(block, /CV\s*[≥>]|banned|một chỗ không hoàn hảo|thừa nhận, một giới hạn/);
  assert.doesNotMatch(block, /dao động mạnh/);
});

test('index.html không còn hằng số/prompt detector-oriented cũ', () => {
  assert.doesNotMatch(html, /Mục tiêu hệ số biến thiên CV/);
  assert.doesNotMatch(html, /bỏ dấu phẩy Oxford/);
  assert.doesNotMatch(html, /xoá mục giữa/);
});
