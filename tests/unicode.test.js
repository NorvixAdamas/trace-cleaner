import test from 'node:test';
import assert from 'node:assert/strict';

import { scan, clean, classify } from '../packages/core/unicode.js';

const FLAG = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';

test('classify tách đúng nhóm nguy hiểm', () => {
  assert.equal(classify('\u200B'), 'invisible');
  assert.equal(classify('\u200D'), 'joiner');
  assert.equal(classify('\u{E0041}'), 'tag');
  assert.equal(classify('\uE000'), 'pua');
  assert.equal(classify('\u0430'), 'homoglyph');
  assert.equal(classify('\u202E'), 'bidi');
  assert.equal(classify('\u00A0'), 'blank');
  assert.equal(classify('\u2014'), 'punct');
});

test('scan gộp theo codepoint và đánh dấu tag của emoji cờ', () => {
  const rows = scan('A\u200B\u200B ' + FLAG);
  const zwsp = rows.find(r => r.cp === 0x200b);
  const tag = rows.find(r => r.cp === 0xe0067);
  assert.equal(zwsp.count, 2);
  assert.deepEqual(zwsp.positions, [1, 2]);
  assert.equal(tag.category, 'tag');
  assert.equal(tag.flag, true);
});

test('clean xoá ký tự vô hình nhưng giữ ZWJ của emoji gia đình', () => {
  const result = clean('Nhà ' + FAMILY + ' sạch\u200B\u00AD');
  assert.ok(result.text.includes('\u200D'));
  assert.equal(result.text, 'Nhà ' + FAMILY + ' sạch');
  assert.equal(result.log.invisible, 1);
  assert.equal(result.log.softHyphen, 1);
  assert.ok(result.warnings.some(w => w.includes('ZWJ')));
});

test('clean giữ tag char của emoji cờ thay vì phá emoji', () => {
  const result = clean('Cờ ' + FLAG);
  assert.equal(result.text, 'Cờ ' + FLAG);
  assert.equal(result.log.flagKept, 6);
  assert.equal(result.log.security, undefined);
  assert.equal(result.audit.length, 6);
  assert.equal(result.audit[0].action, 'kept');
  assert.match(result.audit[0].reason, /emoji flag/);
});

test('clean xoá tag char đứng một mình và ghi audit', () => {
  const result = clean('x\u{E0041}\u{E0042}y');
  assert.equal(result.text, 'xy');
  assert.equal(result.audit.length, 2);
  assert.deepEqual(result.audit[0], {
    index: 1,
    codePoint: 0xe0041,
    hex: 'U+E0041',
    char: '\u{E0041}',
    category: 'tag',
    action: 'removed',
    replacement: '',
    reason: 'tag characters can hide instructions',
  });
});

test('clean không đụng dấu tiếng Việt', () => {
  const text = 'Tiếng Việt: ắ ệ ỡ ữ đ — Đặng Thuỳ Trâm';
  const result = clean(text, { emDash: 'keep' });
  assert.equal(result.text, text);
  assert.equal(result.audit.filter(a => a.action === 'removed').length, 0);
});

test('clean đổi em dash và ngoặc cong theo tuỳ chọn', () => {
  const result = clean('“A” — B', { emDash: 'comma' });
  assert.equal(result.text, '"A", B');
  assert.equal(result.log.quotes, 2);
  assert.equal(result.log.emDash, 1);
});

test('clean giữ nguyên ngoặc cong khi tắt straightQuotes', () => {
  const result = clean('“A”', { straightQuotes: false });
  assert.equal(result.text, '“A”');
});

test('clean idempotent với văn bản đã sạch', () => {
  const once = clean('Dòng một\n\nDòng hai, có dấu phẩy.').text;
  const twice = clean(once).text;
  assert.equal(twice, once);
});

test('clean không tự ý xoá joiner/variation selector khi không được phép', () => {
  const result = clean('tim \u2764\uFE0F và ' + FAMILY);
  assert.ok(result.text.includes('\uFE0F'));
  assert.ok(result.text.includes('\u200D'));
  assert.equal(result.log.joinerRemoved, undefined);
});
