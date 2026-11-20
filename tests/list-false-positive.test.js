/**
 * Hồi quy: mục cuối của phép liệt kê bị regex `\s` nuốt sang câu sau, nên văn
 * bản gần như không đổi vẫn bị báo `list_item_removed`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEnumerations } from '../packages/core/entities.js';
import { checkPreservation } from '../packages/core/preservation.js';
import { cleanText } from '../packages/core/cleaning.js';

test('mục cuối không nuốt câu tiếp theo', () => {
  const rows = extractEnumerations('Built with Kotlin, Java, and Python.\n\nNot safe unless you opt in.');
  assert.deepEqual(rows, [['Built with Kotlin', 'Java', 'Python']]);
});

test('có ký tự vô hình trước xuống dòng vẫn không báo mất mục', () => {
  const src = 'Build with Kotlin, Java, and Python.\u200b\n\nNot safe unless you opt in.\n\nSee https://example.com/a,b';
  const out = cleanText(src, { markdown: true }).text;
  const report = checkPreservation(src, out, { markdown: true });
  assert.equal(report.failed, false, JSON.stringify(report.issues));
});

test('mất mục thật vẫn bị bắt', () => {
  const report = checkPreservation(
    'Built with Kotlin, Java, and Python.\n\nThen we shipped.',
    'Built with Kotlin and Python.\n\nThen we shipped.',
    { markdown: true },
  );
  assert.ok(report.issues.some(issue => issue.code === 'list_item_removed'));
});

test('liệt kê ba mục vẫn được nhận và mục đầu giữ đúng ranh giới', () => {
  const rows = extractEnumerations('Use Rust, Go, and Zig for this.');
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'Use Rust');
  assert.equal(rows[0][1], 'Go');
  assert.ok(rows[0][2].startsWith('Zig'));
});

test('so khớp theo tập từ: đổi đuôi câu không báo mất mục', () => {
  const report = checkPreservation(
    'Built with Kotlin, Java, and Python. Then we shipped.',
    'Built with Kotlin, Java, and Python. After that we shipped.',
    { markdown: true },
  );
  assert.equal(report.issues.some(issue => issue.code === 'list_item_removed'), false);
});
