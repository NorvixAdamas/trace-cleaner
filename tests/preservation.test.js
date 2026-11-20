import test from 'node:test';
import assert from 'node:assert/strict';

import { checkPreservation } from '../packages/core/preservation.js';

test('bản viết lại sạch không báo lỗi, nhưng nói rõ ngữ nghĩa chưa kiểm tra', () => {
  const text = 'We migrated the billing service to Go in March 2025 and cut latency by 40%.';
  const result = checkPreservation(text, text);
  assert.equal(result.preservation.numbers, 'passed');
  assert.equal(result.preservation.urls, 'passed');
  assert.equal(result.preservation.semanticReview, 'not_checked');
  assert.equal(result.requiresManualReview, false);
  assert.deepEqual(result.issues, []);
});

test('danh sách ba mục: mất "Java" là lỗi, không phải phong cách', () => {
  const source = 'Developed Android applications using Kotlin, Java, and Python.';
  const proposal = 'Built Android apps with Kotlin and Python.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.lists, 'failed');
  const issue = result.issues.find(i => i.code === 'list_item_removed');
  assert.ok(issue, 'phải báo list_item_removed');
  assert.ok(issue.detail.includes('Java'));
  assert.equal(result.requiresManualReview, true);
});

test('số bị đổi là lỗi', () => {
  const source = 'Migration reduced startup time from 4.2 seconds to 2.1 seconds.';
  const proposal = 'Migration reduced startup time from 4.5 seconds to 2.1 seconds.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.numbers, 'failed');
  assert.equal(result.issues[0].code, 'number_missing');
});

test('đảo chiều so sánh số là lỗi', () => {
  const source = 'Migration reduced startup time from 4.2 seconds to 2.1 seconds.';
  const proposal = 'Startup time went from 2.1 seconds to 4.2 seconds after the migration.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.numbers, 'failed');
  assert.ok(result.issues.some(i => i.code === 'numeric_relation_reversed'));
});

test('phủ định và điều kiện phải còn', () => {
  const source = 'The feature is not available unless the user enables permissions.';
  const proposal = 'The feature becomes available when the user enables permissions.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.negation, 'failed');
  assert.equal(result.preservation.conditions, 'failed');
  assert.ok(result.issues.some(i => i.code === 'negation_removed'));
  assert.ok(result.issues.some(i => i.code === 'condition_removed'));
});

test('URL bị phá là lỗi', () => {
  const source = 'Visit https://example.com/docs, then open the API reference.';
  const proposal = 'Visit https: //example.com/docs then open the API reference.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.urls, 'failed');
  assert.ok(result.issues.some(i => i.code === 'url_missing'));
});

test('URL còn nguyên thì không báo', () => {
  const source = 'Visit https://example.com/docs, then open the API reference.';
  const proposal = 'Open the API reference after visiting https://example.com/docs.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.urls, 'passed');
});

test('trích dẫn bị bỏ là lỗi', () => {
  const source = 'Recent work (Smith, 2024) shows the effect is small.';
  const proposal = 'Recent work shows the effect is small.';
  const result = checkPreservation(source, proposal);
  assert.equal(result.preservation.citations, 'failed');
});

test('cấu trúc Markdown bị làm phẳng là lỗi khi bật giữ Markdown', () => {
  const source = '# Title\n\n- one\n- two\n- three\n';
  const proposal = 'Title one two three';
  const result = checkPreservation(source, proposal, { markdown: true });
  assert.equal(result.preservation.structure, 'failed');
});

test('cấu trúc bị làm phẳng chỉ là cảnh báo khi người dùng tắt Markdown', () => {
  const source = '# Title\n\n- one\n- two\n- three\n';
  const proposal = 'Title one two three';
  const result = checkPreservation(source, proposal, { markdown: false });
  assert.equal(result.preservation.structure, 'warning');
  assert.equal(result.requiresManualReview, true);
});

test('độ dài đổi quá nhiều chỉ là cảnh báo', () => {
  const source = 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.';
  const result = checkPreservation(source, 'Short.');
  const issue = result.issues.find(i => i.code === 'length_changed');
  assert.ok(issue);
  assert.equal(issue.severity, 'warning');
});
