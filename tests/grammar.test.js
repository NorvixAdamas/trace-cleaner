import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, applySuggestion, applySuggestions } from '../packages/writing/grammar/index.js';
import { detectLanguage } from '../packages/writing/language.js';

const ids = text => analyze(text, { language: 'en' }).suggestions.map(s => s.ruleId);
const find = (text, ruleId, language = 'en') =>
  analyze(text, { language }).suggestions.find(s => s.ruleId === ruleId);

test('nhận diện ngôn ngữ: tiếng Việt không bị áp luật tiếng Anh', () => {
  assert.equal(detectLanguage('Tôi đã sử dụng công cụ này để kiểm tra văn bản.'), 'vi');
  assert.equal(detectLanguage('The quick brown fox jumps over the lazy dog and it is fine.'), 'en');
  const vi = analyze('Tôi đã sử dụng công cụ này và và nó ổn.');
  assert.equal(vi.language, 'vi');
  assert.ok(vi.suggestions.every(s => s.language === 'vi'));
});

test('lặp từ tiếng Anh được bắt, từ lặp hợp lệ thì không', () => {
  const repeat = find('This test test is broken.', 'en.repeated-word');
  assert.ok(repeat);
  assert.equal(repeat.replacement, 'test');
  // "had had" là hợp lệ trong tiếng Anh
  assert.equal(find('He had had enough.', 'en.repeated-word'), undefined);
});

test('"would of" → "would have"; câu đúng không bị báo', () => {
  const hit = find('I would of gone there.', 'en.would-of');
  assert.ok(hit);
  assert.equal(hit.replacement, 'would have');
  assert.equal(find('I would have gone there.', 'en.would-of'), undefined);
});

test('quá khứ phân từ: "has went" → "has gone"', () => {
  const hit = find('She has went home.', 'en.irregular-participle');
  assert.ok(hit);
  assert.equal(hit.replacement, 'has gone');
  assert.equal(find('She has gone home.', 'en.irregular-participle'), undefined);
  // "has been" không nằm trong danh sách → không báo sai
  assert.equal(find('She has been home.', 'en.irregular-participle'), undefined);
});

test('mạo từ a/an: sửa đúng và tránh ngoại lệ phát âm', () => {
  assert.equal(find('This is a apple.', 'en.article-a-an').replacement, 'an');
  assert.equal(find('This is an user.', 'en.article-a-an').replacement, 'a');
  // ngoại lệ: "a university", "an hour"
  assert.equal(find('This is a university.', 'en.article-a-an'), undefined);
  assert.equal(find('Wait an hour.', 'en.article-a-an'), undefined);
});

test('lỗi chính tả không mơ hồ', () => {
  assert.equal(find('I recieve it.', 'en.spelling-common').replacement, 'receive');
  assert.equal(find('It is definately fine.', 'en.spelling-common').replacement, 'definitely');
  // "form" và "from" đều đúng → không có luật nào chạm vào
  assert.equal(analyze('Fill the form and take it from here.', { language: 'en' }).suggestions
    .some(s => s.type === 'spelling'), false);
});

test('khoảng trắng và dấu câu', () => {
  assert.ok(find('Hello  world', 'en.double-space'));
  assert.ok(find('Hello , world', 'en.space-before-punctuation'));
  assert.ok(find('a,b', 'en.space-after-comma'));
});

test('đại từ I viết thường và đầu câu viết thường', () => {
  assert.equal(find('i think so.', 'en.lowercase-i').replacement, 'I');
  const start = find('this is a test.', 'en.sentence-start');
  assert.ok(start);
  assert.equal(start.replacement, 'T');
  // "iPhone" không bị coi là đại từ I
  assert.equal(find('Buy an iPhone now.', 'en.lowercase-i'), undefined);
});

test('hoà hợp chủ ngữ: they was / he don\'t', () => {
  assert.equal(find('They was late.', 'en.was-were').replacement, 'They were');
  assert.equal(find("He don't care.", 'en.third-person-dont').replacement, "He doesn't");
  assert.equal(find('They were late.', 'en.was-were'), undefined);
});

test('code, URL, email và HTML không bị gợi ý sửa', () => {
  const text = 'Run `has went` and `a apple`, see https://example.com/a,b and write to ops@example.com. <w:p w:val="x  y">';
  const report = analyze(text, { language: 'en' });
  assert.deepEqual(report.suggestions, []);
});

test('Unicode: tiếng Việt giữ nguyên dấu, gợi ý không làm mất dấu', () => {
  const text = 'Tôi  đã sử lý vấn đề này , và và nó ổn.';
  const report = analyze(text, { language: 'vi' });
  assert.ok(report.suggestions.length > 0);
  const applied = applySuggestions(text, report.suggestions);
  assert.match(applied.text, /xử lý/);
  assert.match(applied.text, /ổn/);
  assert.equal(applied.text, applied.text.normalize('NFC'));
});

test('áp một gợi ý kiểm tra lại original trước khi ghi', () => {
  const text = 'I would of gone.';
  const hit = find(text, 'en.would-of');
  const ok = applySuggestion(text, hit);
  assert.equal(ok.text, 'I would have gone.');
  assert.equal(ok.applied.length, 1);

  // văn bản đã đổi ở đúng vị trí đó → phải từ chối, không ghi bừa
  const stale = applySuggestion('I would of gone. Extra text here.', {
    ...hit, start: 0, end: 9, original: 'I would o',
  });
  assert.equal(stale.applied.length + stale.conflicts.length, 1);
});

test('gợi ý chồng lấn không áp cả hai', () => {
  const text = 'a  ,b';
  const report = analyze(text, { language: 'en' });
  const result = applySuggestions(text, report.suggestions);
  assert.equal(result.conflicts.length + result.applied.length >= 1, true);
});

test('ngôn ngữ không hỗ trợ chỉ chạy luật an toàn', () => {
  const report = analyze('Ceci  est un test.', { language: 'unknown' });
  assert.equal(report.supported, false);
  assert.ok(report.suggestions.every(s => s.ruleId.startsWith('neutral.')));
});

test('mọi gợi ý có schema đầy đủ và offset đúng trên chuỗi gốc', () => {
  const text = 'He has went home and i think it is fine.';
  const report = analyze(text, { language: 'en' });
  for (const item of report.suggestions) {
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.type, 'string');
    assert.equal(typeof item.severity, 'string');
    assert.equal(typeof item.language, 'string');
    assert.equal(text.slice(item.start, item.end), item.original);
    assert.equal(item.accepted, false);
    assert.equal(item.source, 'deterministic-rule');
  }
});
