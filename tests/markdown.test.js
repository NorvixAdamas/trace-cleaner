import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentSession } from '../packages/core/document.js';
import { splitMarkdown, transformProse, stripMarkdown, countStructure } from '../packages/core/markdown.js';

test('bản gốc không bao giờ bị ghi đè', () => {
  const doc = new DocumentSession('Bản gốc có 4.2 giây.');
  doc.propose('Bản mới có 4.2 giây.');
  doc.acceptAll();
  assert.equal(doc.original, 'Bản gốc có 4.2 giây.');
  assert.equal(doc.working, 'Bản mới có 4.2 giây.');
  assert.equal(doc.accepted, 'Bản mới có 4.2 giây.');
});

test('reject không đổi bản đang sửa', () => {
  const doc = new DocumentSession('gốc');
  doc.propose('đề xuất');
  const rejected = doc.reject();
  assert.equal(rejected, 'đề xuất');
  assert.equal(doc.working, 'gốc');
  assert.equal(doc.proposed, null);
});

test('undo/redo đi qua lịch sử revision', () => {
  const doc = new DocumentSession('v1');
  assert.equal(doc.canUndo(), false);
  doc.commit('v2', 'edit');
  assert.equal(doc.working, 'v2');
  assert.equal(doc.undo(), 'v1');
  assert.equal(doc.canRedo(), true);
  assert.equal(doc.redo(), 'v2');
});

test('commit sau khi undo cắt nhánh redo', () => {
  const doc = new DocumentSession('v1');
  doc.commit('v2');
  doc.undo();
  doc.commit('v3');
  assert.equal(doc.canRedo(), false);
  assert.equal(doc.working, 'v3');
});

test('export trả bản hiện tại và giữ lịch sử', () => {
  const doc = new DocumentSession('gốc');
  doc.commit('đã sửa');
  const out = doc.export('md');
  assert.equal(out.text, 'đã sửa');
  assert.equal(doc.original, 'gốc');
  assert.ok(doc.revisions.length >= 2);
});

test('diff trong document so với bản gốc', () => {
  const doc = new DocumentSession('one two three');
  doc.commit('one three');
  const { ops, stats } = doc.diff();
  assert.ok(stats.removed >= 1);
  assert.ok(ops.some(o => o.type === 'delete' && o.value.includes('two')));
});

test('Markdown: biến đổi chữ không chạm code fence, inline code và link', () => {
  const text = 'Xin chào `code` [link](https://example.com/a?b=1)\n\n```js\nconst a = 1;\n```\n';
  const upper = transformProse(text, s => s.toUpperCase());
  assert.ok(upper.includes('`code`'));
  assert.ok(upper.includes('[link](https://example.com/a?b=1)'));
  assert.ok(upper.includes('const a = 1;'));
  assert.ok(upper.startsWith('XIN CHÀO'));
});

test('splitMarkdown phân loại đoạn', () => {
  const segments = splitMarkdown('a `b` [c](d) <https://e.f>');
  assert.deepEqual(segments.map(s => s.type), ['text', 'inlineCode', 'text', 'link', 'text', 'autolink']);
});

test('stripMarkdown giữ nội dung và URL', () => {
  const { text, removed } = stripMarkdown('# Tiêu đề\n\n- **một**\n- [hai](https://x.test)\n');
  assert.ok(removed > 0);
  assert.equal(text, 'Tiêu đề\n\nmột\nhai (https://x.test)');
});

test('countStructure đếm heading, bullet, fence, link', () => {
  const counts = countStructure('# A\n\n- b\n```\nx\n```\n[q](r)');
  assert.deepEqual(counts, { headings: 1, bullets: 1, fences: 2, links: 1 });
});
