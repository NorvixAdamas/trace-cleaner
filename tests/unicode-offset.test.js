/**
 * Hệ offset chuẩn: UTF-16 index trong CHUỖI GỐC. Trước 2.2, `clean()` normalize
 * toàn chuỗi trước khi đếm nên một chuỗi decomposed làm mọi vị trí sau đó lệch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, scan, OFFSET_SYSTEM, isFlagSequence } from '../packages/core/unicode.js';
import { cleanText } from '../packages/core/cleaning.js';

test('hệ offset được khai báo rõ', () => {
  assert.equal(OFFSET_SYSTEM, 'utf16-source');
  assert.equal(clean('abc').offsetSystem, 'utf16-source');
});

test('ký tự decomposed trước ký tự vô hình: vị trí audit trỏ đúng nguồn', () => {
  const source = 'a\u0301\u200Bb';
  const result = clean(source);
  assert.equal(result.text, 'áb');
  assert.equal(result.audit.length, 1);
  assert.equal(result.audit[0].hex, 'U+200B');
  assert.equal(result.audit[0].index, 2, 'index phải là offset trong chuỗi gốc');
  assert.equal(source[result.audit[0].index], '\u200B');
});

test('vị trí audit đúng trên chuỗi tiếng Việt decomposed dài', () => {
  const source = 'a\u0301\u0300b\u200Bc\u200Bd';
  const result = clean(source);
  const zwsp = result.audit.filter(entry => entry.hex === 'U+200B');
  assert.equal(zwsp.length, 2);
  for (const entry of zwsp) assert.equal(source[entry.index], '\u200B');
});

test('output vẫn là NFC sau khi ghép dấu', () => {
  const result = clean('a\u0301b');
  assert.equal(result.text, 'áb');
  assert.equal(result.text, result.text.normalize('NFC'));
});

test('ZWJ/ZWNJ trong Ả Rập và Indic không bị xoá, offset vẫn đúng', () => {
  const arabic = 'می\u200Cخواهم\u200B!';
  const result = clean(arabic);
  assert.ok(result.text.includes('\u200C'), 'ZWNJ bị xoá');
  assert.equal(result.audit[0].index, arabic.indexOf('\u200B'));
});

test('emoji cờ (tag sequence) sau văn bản decomposed vẫn được giữ', () => {
  const scotland = '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
  const source = 'a\u0301' + scotland;
  const result = clean(source);
  assert.ok(result.text.endsWith(scotland), 'tag char của emoji cờ bị xoá');
  assert.equal(result.log.flagKept > 0, true);
});

test('scan báo vị trí trong chuỗi gốc, không phải chuỗi đã normalize', () => {
  const source = 'a\u0301\u200Bx';
  const rows = scan(source);
  const zwsp = rows.find(row => row.hex === 'U+200B');
  assert.ok(zwsp);
  assert.equal(zwsp.positions[0], source.indexOf('\u200B'));
});

test('surrogate pair (emoji) không bị cắt nửa', () => {
  const source = '😀\u200B😀';
  const result = clean(source);
  assert.equal(result.text, '😀😀');
  assert.equal(result.audit[0].index, 2);
  assert.equal(Array.from(result.text).length, 2);
});

test('isFlagSequence đọc đúng chuỗi nguồn chưa normalize', () => {
  const source = '🏴\u{E0067}\u{E0062}';
  assert.equal(isFlagSequence(source, 2), true);
  assert.equal(isFlagSequence('ab', 1), false);
});

test('cleanText giữ audit offset trong nguồn khi có code fence phía trước', () => {
  const source = '```\nx\n```\n\na\u0301\u200Bb';
  const result = cleanText(source);
  const entry = result.audit.find(item => item.hex === 'U+200B');
  assert.ok(entry);
  assert.equal(source[entry.index], '\u200B');
});
