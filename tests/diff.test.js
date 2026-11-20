import test from 'node:test';
import assert from 'node:assert/strict';

import { diffWords, diffStats, similarity, applyEdits } from '../packages/core/diff.js';

test('diff nhận ra đoạn giữ nguyên, thêm và xoá', () => {
  const ops = diffWords('The cat sat on the mat.', 'The cat slept on the mat.');
  const types = ops.map(o => o.type);
  assert.deepEqual(types, ['equal', 'delete', 'insert', 'equal']);
  assert.equal(ops[1].value, 'sat');
  assert.equal(ops[2].value, 'slept');
  assert.equal(diffStats(ops).removed, 1);
  assert.equal(diffStats(ops).added, 1);
});

test('diff văn bản giống hệt là một equal', () => {
  const ops = diffWords('a b c', 'a b c');
  assert.deepEqual(ops, [{ type: 'equal', value: 'a b c' }]);
  assert.equal(similarity('a b c', 'a b c'), 1);
});

test('similarity giảm khi sửa nhiều', () => {
  const same = similarity('one two three four', 'one two three four');
  const changed = similarity('one two three four', 'alpha beta gamma delta');
  assert.equal(same, 1);
  assert.ok(changed < 0.6);
});

test('applyEdits áp đúng vị trí và từ chối edit không tồn tại', () => {
  const result = applyEdits('Tôi thích Java.', [
    { find: 'Java', replace: 'Kotlin' },
    { find: 'Python', replace: 'Go' },
  ]);
  assert.equal(result.text, 'Tôi thích Kotlin.');
  assert.equal(result.applied.length, 1);
  assert.equal(result.rejected[0].reason, 'not_found');
});

test('applyEdits chỉ áp đúng vị trí index, không trượt sang chỗ khác', () => {
  const result = applyEdits('a a a', [{ find: 'a', replace: 'b', index: 4 }]);
  assert.equal(result.text, 'a a b');
  // index lệch một ký tự phải là conflict, không được tự tìm chỗ khác
  const wrong = applyEdits('a a a', [{ find: 'a', replace: 'b', index: 3 }]);
  assert.equal(wrong.text, 'a a a');
  assert.equal(wrong.conflicts[0].reason, 'text_mismatch');
});

test('diff giữ nguyên khoảng trắng và xuống dòng', () => {
  const before = 'Dòng một\nDòng hai';
  const after = 'Dòng một\nDòng ba';
  const ops = diffWords(before, after);
  const rebuilt = ops.filter(o => o.type !== 'delete').map(o => o.value).join('');
  assert.equal(rebuilt, after);
  assert.ok(ops.some(o => o.type === 'delete' && o.value.includes('hai')));
  assert.ok(ops.some(o => o.value.includes('\n')));
});
