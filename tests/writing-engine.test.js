import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeWriting, applyWritingSuggestion, applyWritingSuggestions, rewrite,
  documentRevision, PRESERVATION_STATUS,
} from '../packages/writing/analyze.js';
import { analyzeClarity } from '../packages/writing/engine/clarity.js';
import { analyzeReadability, splitSentences, splitParagraphs } from '../packages/writing/engine/readability.js';
import { comparePreservation } from '../packages/writing/engine/preserve.js';
import { analyzeDocument } from '../packages/writing/engine/document.js';
import {
  MODES, MODE_ALIASES, CANONICAL_MODE_KEYS, PROMPT_VERSION, buildPrompt,
} from '../packages/writing/prompts.js';

test('analyzeWriting gộp grammar + clarity + revision + readability', () => {
  const text = 'This is a apple. In order to test it, we utilize a very unique tool.';
  const report = analyzeWriting(text, { language: 'en' });
  assert.equal(report.schemaVersion, '3.0');
  assert.equal(report.language, 'en');
  assert.equal(report.revision, documentRevision(text));
  assert.ok(report.suggestions.some(item => item.ruleId === 'en.article-a-an'));
  assert.ok(report.suggestions.some(item => item.ruleId === 'clarity.utilize'));
  for (const item of report.suggestions) {
    assert.equal(text.slice(item.start, item.end), item.original);
    assert.equal(item.revision, report.revision);
    assert.equal(item.preservationStatus, PRESERVATION_STATUS.NOT_CHECKED);
  }
  assert.equal(report.readability.metrics.sentences, 2);
  assert.equal(report.stats.schema.total, report.suggestions.length);
});

test('analyzeWriting tách tiếng Việt khỏi luật tiếng Anh', () => {
  const text = 'Tôi đã sử dụng công cụ này và và nó ổn.';
  const report = analyzeWriting(text);
  assert.equal(report.language, 'vi');
  assert.ok(report.suggestions.every(item => item.language === 'vi'));
  assert.ok(report.suggestions.every(item => !item.ruleId.startsWith('en.')));
});

test('applyWritingSuggestion từ chối gợi ý từ revision cũ', () => {
  const text = 'This is a apple.';
  const report = analyzeWriting(text, { language: 'en' });
  const hit = report.suggestions.find(item => item.ruleId === 'en.article-a-an');
  const stale = { ...hit, revision: documentRevision('different text') };
  const result = applyWritingSuggestion(text, stale);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'stale_revision');
  assert.equal(result.text, text);
});

test('applyWritingSuggestion trả trạng thái bảo toàn sau khi áp', () => {
  const text = 'This is a apple.';
  const hit = analyzeWriting(text, { language: 'en' }).suggestions
    .find(item => item.ruleId === 'en.article-a-an');
  const result = applyWritingSuggestion(text, hit);
  assert.equal(result.ok, true);
  assert.equal(result.text, 'This is an apple.');
  assert.equal(result.preservation.status, PRESERVATION_STATUS.PRESERVED);
  assert.equal(result.blocked, false);
});

test('applyWritingSuggestions chặn thay đổi làm mất phủ định', () => {
  const text = 'The policy is not optional.';
  const suggestion = {
    start: text.indexOf('not optional'),
    end: text.length,
    original: 'not optional.',
    replacement: 'optional.',
    revision: documentRevision(text),
  };
  const result = applyWritingSuggestions(text, [suggestion]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'preservation_blocked');
  assert.equal(result.text, text);
});

test('so sánh bảo toàn: phủ định, số, tên, danh sách, điều kiện, trích dẫn', () => {
  const base = 'Acme reported 12 errors in [3] for Kotlin, Java, and Python unless cached.';
  assert.equal(comparePreservation(base, base).status, PRESERVATION_STATUS.PRESERVED);
  for (const revised of [
    'Acme reported 12 errors in [3] for Kotlin, Java, and Python.',
    'Acme reported 13 errors in [3] for Kotlin, Java, and Python unless cached.',
    'Acme reported 12 errors in [4] for Kotlin, Java, and Python unless cached.',
    'Acme reported 12 errors in [3] for Kotlin and Python unless cached.',
    'Acme reported 12 errors in [3] for Kotlin, Java, and Python.',
    'Other reported 12 errors in [3] for Kotlin, Java, and Python unless cached.',
  ]) {
    assert.equal(comparePreservation(base, revised).status, PRESERVATION_STATUS.BLOCKED,
      `phải chặn: ${revised}`);
  }
});

test('bảo toàn lượng từ, modal và cấu trúc tương phản', () => {
  const cases = [
    ['We may proceed.', 'We proceed.'],
    ['We must proceed.', 'We should proceed.'],
    ['At least 5 files changed.', '5 files changed.'],
    ['No more than 5 files changed.', '5 files changed.'],
    ['Not only Kotlin but also Java is supported.', 'Kotlin and Java are supported.'],
    ['It is not necessarily true.', 'It is true.'],
  ];
  for (const [before, after] of cases) {
    assert.equal(comparePreservation(before, after).status, PRESERVATION_STATUS.BLOCKED,
      `phải chặn: ${before} → ${after}`);
  }
});

test('mở rộng contraction không bị coi là mất phủ định', () => {
  const result = comparePreservation("We don't accept it.", 'We do not accept it.');
  assert.equal(result.status, PRESERVATION_STATUS.PRESERVED);
});

test('readability tách câu/đoạn và chỉ tính Flesch cho tiếng Anh', () => {
  const text = 'First sentence. Second sentence!\n\nThird paragraph here.';
  assert.equal(splitSentences(text).length, 3);
  assert.equal(splitParagraphs(text).length, 2);
  const en = analyzeReadability(text, { language: 'en' });
  assert.equal(en.metrics.sentences, 3);
  assert.equal(typeof en.metrics.fleschReadingEase, 'number');
  const vi = analyzeReadability('Câu một. Câu hai.', { language: 'vi' });
  assert.equal(vi.metrics.fleschReadingEase, null);
  assert.ok(vi.notes.some(note => note.includes('tiếng Việt')));
});

test('readability không tuyên bố câu ngắn luôn tốt hơn', () => {
  const result = analyzeReadability('Short. ' .repeat(20), { language: 'en' });
  assert.ok(result.notes.some(note => note.includes('không mặc định')));
});

test('clarity chỉ gợi ý cụm an toàn và bỏ qua code/URL', () => {
  const text = 'In order to ship, we utilize `in order to` and see https://example.com/in-order-to.';
  const report = analyzeClarity(text, { language: 'en' });
  assert.ok(report.suggestions.some(item => item.ruleId === 'clarity.in-order-to'));
  assert.ok(report.suggestions.some(item => item.ruleId === 'clarity.utilize'));
  for (const item of report.suggestions) {
    assert.equal(text.slice(item.start, item.end), item.original);
    assert.equal(item.kind, 'suggestion');
    assert.ok(item.confidence <= 0.8);
  }
  assert.equal(report.suggestions.filter(item => item.ruleId === 'clarity.in-order-to').length, 1);
});

test('rewrite grammar chỉ sửa lỗi và giữ dữ kiện', () => {
  const result = rewrite('She has went home with 12 files.', { mode: 'grammar', language: 'en' });
  assert.equal(result.text, 'She has gone home with 12 files.');
  assert.equal(result.preservation.status, PRESERVATION_STATUS.PRESERVED);
  assert.equal(result.requiresModel, false);
});

test('rewrite concise rút gọn cụm từ nhưng giữ số và phủ định', () => {
  const result = rewrite('In order to fix 3 errors, we utilize a very unique tool and do not delete files.', {
    mode: 'concise', language: 'en',
  });
  assert.match(result.text, /To fix 3 errors/);
  assert.match(result.text, /use a unique tool/);
  assert.match(result.text, /do not delete files/);
  assert.equal(result.preservation.status, PRESERVATION_STATUS.PRESERVED);
  assert.equal(result.requiresModel, true);
});

test('rewrite academic mở rộng contraction, chế độ khác không tự làm', () => {
  const academic = rewrite("We don't accept it.", { mode: 'academic', language: 'en' });
  assert.equal(academic.text, 'We do not accept it.');
  const conversational = rewrite("We don't accept it.", { mode: 'conversational', language: 'en' });
  assert.equal(conversational.text, "We don't accept it.");
  assert.equal(conversational.requiresModel, true);
});

test('mọi chế độ canonical có mục tiêu và prompt riêng', () => {
  assert.equal(CANONICAL_MODE_KEYS.length, 12);
  const instructions = new Set();
  for (const key of CANONICAL_MODE_KEYS) {
    const mode = MODES[key];
    assert.ok(mode, `thiếu mode ${key}`);
    assert.ok(mode.purpose.length > 10, `${key} thiếu purpose`);
    assert.ok(mode.instruction.length > 50, `${key} thiếu instruction`);
    assert.ok(Array.isArray(mode.deterministic), `${key} thiếu deterministic ops`);
    instructions.add(mode.instruction);
  }
  assert.equal(instructions.size, 12);
  assert.equal(MODE_ALIASES.general, 'natural');
  assert.equal(MODE_ALIASES.proofread, 'grammar');
  assert.match(PROMPT_VERSION, /^3\./);
});

test('custom voice chỉ là style, nằm trong prompt custom', () => {
  const prompt = buildPrompt('custom', { customVoice: 'Short sentences. No contractions.' });
  assert.match(prompt, /Voice profile/);
  assert.match(prompt, /Short sentences/);
  assert.match(prompt, /cannot override preservation/i);
  assert.doesNotMatch(buildPrompt('academic', { customVoice: 'x' }), /Voice profile/);
});

test('không sửa chữ bên trong trích dẫn trực tiếp', () => {
  const direct = 'She said "I would of gone" and left.';
  const quoted = analyzeWriting(direct, { language: 'en' });
  assert.equal(quoted.suggestions.some(item => item.ruleId === 'en.would-of'), false);
  const curly = 'Cô ấy nói “in order to test” rồi đi.';
  const clarity = analyzeClarity(curly, { language: 'vi' });
  assert.equal(clarity.suggestions.length, 0);
  assert.equal(analyzeWriting('She said "in order to" once.', { language: 'en' }).suggestions
    .some(item => item.ruleId === 'clarity.in-order-to'), false);
});

test('analyzeWriting báo lỗi luật thay vì im lặng', () => {
  const report = analyzeWriting('Clean text.', { language: 'en' });
  assert.deepEqual(report.analysisWarnings, []);
});

test('đầu vào rỗng, Markdown, code và danh sách lồng không làm hỏng engine', () => {
  for (const text of ['', '   \n\n', '- item one\n  - nested item\n- item two', '```js\nconst a = "would of";\n```']) {
    const report = analyzeWriting(text);
    assert.equal(typeof report.language, 'string');
    assert.ok(Array.isArray(report.suggestions));
    assert.ok(Array.isArray(report.insights));
  }
  assert.equal(analyzeWriting('```js\nconst a = "would of";\n```', { language: 'en' }).suggestions.length, 0);
});

test('văn bản trộn Việt/Anh không crash và không áp luật sai ngôn ngữ', () => {
  const report = analyzeWriting('The API returns JSON. Tôi đã kiểm tra 12 tệp và không thấy lỗi.');
  assert.ok(['vi', 'en'].includes(report.language));
  if (report.language === 'en') {
    assert.ok(report.suggestions.every(item => !item.ruleId.startsWith('vi.')));
  }
});

test('document insights: viết tắt, câu lặp, giá trị số khác nhau', () => {
  const text = 'Acme Corp announced the QZX system. Acme Corp announced the QZX system. Revenue was 10 USD. Revenue was 12 USD.';
  const report = analyzeDocument(text, { language: 'en' });
  const ids = report.findings.map(item => item.id);
  assert.ok(ids.some(id => id.includes('QZX')), 'phải báo viết tắt chưa giải thích');
  assert.ok(ids.some(id => id.includes('repeated-sentence')), 'phải báo câu lặp');
  assert.ok(ids.some(id => id.includes('numeric-claim')), 'phải báo giá trị số khác nhau');
  assert.ok(report.limitations.length > 0);
});

test('document insights không tự chọn bên đúng khi số liệu mâu thuẫn', () => {
  const report = analyzeDocument('Revenue was 10 USD. Revenue was 12 USD.', { language: 'en' });
  const claim = report.findings.find(item => item.id.includes('numeric-claim'));
  assert.ok(claim);
  assert.match(claim.message, /Không tự chọn/);
  assert.equal(report.suggestions.some(item => item.ruleId && item.ruleId.includes('numeric')), false);
});
