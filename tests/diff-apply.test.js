import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEdits } from '../packages/core/diff.js';

test('nhiều edit lệch độ dài không làm ghi sai chỗ', () => {
  const source = 'alpha beta gamma';
  const result = applyEdits(source, [
    { find: 'alpha', replace: 'ALPHA-EXPANDED' },
    { find: 'gamma', replace: 'G' },
  ]);
  assert.equal(result.text, 'ALPHA-EXPANDED beta G');
  assert.equal(result.applied.length, 2);
  assert.equal(result.conflicts.length, 0);
});

test('edit ở giữa chuỗi không làm lệch edit phía sau (áp giảm dần)', () => {
  const source = 'one two three four';
  const result = applyEdits(source, [
    { find: 'two', replace: '2' },
    { find: 'four', replace: '4-expanded' },
  ]);
  assert.equal(result.text, 'one 2 three 4-expanded');
});

test('chuỗi lặp lại: từ chối khi mơ hồ, nhận khi có occurrence', () => {
  const source = 'a a a';
  const ambiguous = applyEdits(source, [{ find: 'a', replace: 'b' }]);
  assert.equal(ambiguous.text, source);
  assert.equal(ambiguous.rejected.length, 1);
  assert.equal(ambiguous.rejected[0].reason, 'ambiguous');

  const second = applyEdits(source, [{ find: 'a', replace: 'b', occurrence: 2 }]);
  assert.equal(second.text, 'a b a');
});

test('index sai vị trí bị coi là conflict, không ghi bừa', () => {
  const result = applyEdits('hello world', [{ find: 'world', replace: 'x', index: 0 }]);
  assert.equal(result.text, 'hello world');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].reason, 'text_mismatch');
  assert.equal(result.applied.length, 0);
});

test('index ngoài biên bị từ chối', () => {
  const result = applyEdits('abc', [{ find: 'abc', replace: 'x', index: 99 }]);
  assert.equal(result.conflicts[0].reason, 'out_of_bounds');
  assert.equal(result.text, 'abc');
});

test('hai edit chồng lấn không được áp cái nào', () => {
  const result = applyEdits('abcdef', [
    { start: 0, end: 4, replace: 'X' },
    { start: 2, end: 6, replace: 'Y' },
  ]);
  assert.equal(result.text, 'abcdef');
  assert.ok(result.conflicts.some(c => c.reason === 'overlap'));
});

test('edit liền kề không bị coi là chồng lấn', () => {
  const result = applyEdits('abcdef', [
    { start: 0, end: 2, replace: 'X' },
    { start: 2, end: 4, replace: 'Y' },
  ]);
  assert.equal(result.text, 'XYef');
  assert.equal(result.conflicts.length, 0);
});

test('sourceRevision được trả lại để UI kiểm tra', () => {
  const result = applyEdits('abc', [{ find: 'b', replace: 'B' }], { sourceRevision: 'rev_1' });
  assert.equal(result.sourceRevision, 'rev_1');
  assert.equal(result.schemaVersion, '1.0');
});

test('edit sai dạng bị từ chối thay vì ném lỗi', () => {
  const result = applyEdits('abc', [null, 42, { replace: 'x' }]);
  assert.equal(result.text, 'abc');
  assert.ok(result.rejected.length >= 2);
});
