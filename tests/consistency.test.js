import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeConsistency } from '../packages/writing/consistency.js';

const finding = (report, id) => report.findings.find(item => item.id.startsWith(id));
const rules = report => report.suggestions.map(item => item.ruleId);

test('consistency: e-mail/email lẫn lộn sinh finding + gợi ý thống nhất', () => {
  const text = 'Gửi e-mail cho tôi. Sau đó kiểm tra email khác. Email cuối đã đọc.';
  const report = analyzeConsistency(text, { language: 'vi' });
  const item = finding(report, 'consistency.email');
  assert.ok(item, JSON.stringify(report.findings));
  assert.ok(item.evidence.length >= 3);
  assert.ok(report.suggestions.some(s => s.category === 'consistency' && s.replacement === 'email'));
  for (const suggestion of report.suggestions) {
    assert.equal(text.slice(suggestion.start, suggestion.end), suggestion.original);
  }
});

test('consistency: dùng nhất quán một cách viết thì không báo', () => {
  const report = analyzeConsistency('Gửi email cho tôi. Email thứ hai đã đọc. Email cuối cùng đã lưu.', { language: 'vi' });
  assert.equal(finding(report, 'consistency.email'), undefined);
});

test('consistency: nhiều định dạng ngày bị báo kèm bằng chứng', () => {
  const text = 'Ngày 2026-01-05 là hạn đầu tiên. Hạn thứ hai là 07/01/2026.';
  const report = analyzeConsistency(text, { language: 'vi' });
  const item = finding(report, 'consistency.date-format');
  assert.ok(item);
  assert.ok(item.evidence.length >= 2);
  assert.match(item.message, /iso|slash/);
});

test('consistency: cách viết số 1,000 và 1.000 bị báo', () => {
  const report = analyzeConsistency('Doanh thu 1,000 USD và chi phí 2.500 USD.', { language: 'vi' });
  assert.ok(finding(report, 'consistency.number-format'));
});

test('consistency: đơn vị "10 km" và "10km" bị báo, có gợi ý', () => {
  const text = 'Đi 10 km rồi chạy 5km tiếp.';
  const report = analyzeConsistency(text, { language: 'vi' });
  assert.ok(finding(report, 'consistency.unit-style'));
  assert.ok(rules(report).some(rule => rule && rule.includes('unit-style')));
  assert.ok(report.suggestions.some(item => item.replacement === '5 km'));
});

test('consistency: heading có/không dấu hai chấm', () => {
  const text = '# Giới thiệu\n\nNội dung.\n\n## Phạm vi:\n\nNội dung.\n\n## Kết luận\n\nNội dung.';
  const report = analyzeConsistency(text);
  assert.ok(finding(report, 'consistency.heading-colon'));
});

test('consistency: viết hoa thuật ngữ không nhất quán (API/Api)', () => {
  const text = 'The API is stable. We call the Api twice. Another API call works.';
  const report = analyzeConsistency(text);
  assert.ok(finding(report, 'consistency.case'));
  const item = finding(report, 'consistency.case');
  assert.ok(item.evidence.some(entry => entry.text === 'Api' || entry.text === 'API'));
});

test('consistency: trích dẫn cong và thẳng lẫn lộn', () => {
  const report = analyzeConsistency('Anh ấy nói “được” rồi bảo "không".');
  assert.ok(finding(report, 'consistency.quote-style'));
});

test('consistency: viết tắt eg/e.g. bị báo và gợi ý dấu chấm', () => {
  const report = analyzeConsistency('Dùng eg cho ví dụ, và e.g. cho danh sách.', { language: 'vi' });
  assert.ok(finding(report, 'consistency.eg'));
  assert.ok(report.suggestions.some(item => item.replacement === 'e.g.'));
});

test('consistency: tài liệu ngắn không báo bừa', () => {
  const report = analyzeConsistency('Một câu duy nhất.', { language: 'vi' });
  assert.equal(report.findings.length, 0);
  assert.equal(report.suggestions.length, 0);
});
