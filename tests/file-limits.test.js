import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARSER_LIMITS, validateZipEntryName, checkZipBudget, xmlDepth, assertSafeXml, clampText,
} from '../packages/core/limits.js';

test('tên entry hợp lệ được chấp nhận', () => {
  for (const name of ['word/document.xml', 'docProps/core.xml', 'ppt/slides/slide1.xml']) {
    assert.deepEqual(validateZipEntryName(name), { ok: true });
  }
});

test('path traversal và đường dẫn tuyệt đối bị chặn', () => {
  const bad = ['../evil.xml', 'word/../../evil.xml', '/etc/passwd', 'C:/windows/x', 'a\\b.xml', 'a\0b'];
  for (const name of bad) {
    assert.equal(validateZipEntryName(name).ok, false, `phải chặn: ${JSON.stringify(name)}`);
  }
});

test('quá nhiều entry bị từ chối trước khi giải nén', () => {
  const entries = Array.from({ length: PARSER_LIMITS.maxZipEntries + 1 }, (_, i) => ({
    name: `f${i}.xml`, size: 10, compressedSize: 10, method: 8,
  }));
  const result = checkZipBudget(entries);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_many_entries');
});

test('tỉ lệ nở đáng ngờ bị từ chối', () => {
  const result = checkZipBudget([{ name: 'bomb.xml', size: 50 * 1024 * 1024, compressedSize: 1000, method: 8 }]);
  assert.equal(result.ok, false);
  assert.ok(['suspicious_expansion', 'entry_too_large'].includes(result.reason));
});

test('tổng dung lượng giải nén vượt ngân sách bị từ chối', () => {
  const size = Math.floor(PARSER_LIMITS.maxTotalUncompressedBytes / 4) + 1;
  const entries = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}.xml`, size, compressedSize: size, method: 0 }));
  const result = checkZipBudget(entries);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'archive_too_large');
});

test('kiểu nén lạ bị từ chối', () => {
  const result = checkZipBudget([{ name: 'a.xml', size: 10, compressedSize: 10, method: 12 }]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'unsupported_method');
});

test('archive bình thường được chấp nhận', () => {
  const result = checkZipBudget([
    { name: 'word/document.xml', size: 12000, compressedSize: 3000, method: 8 },
    { name: 'docProps/core.xml', size: 900, compressedSize: 400, method: 8 },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.total, 12900);
});

test('XML có DOCTYPE hoặc ENTITY bị từ chối', () => {
  assert.throws(() => assertSafeXml('<!DOCTYPE foo><a/>'), error => error.code === 'PARSER_ERROR');
  assert.throws(() => assertSafeXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><a/>'),
    error => error.code === 'PARSER_ERROR');
});

test('XML lồng quá sâu bị từ chối', () => {
  const deep = '<a>'.repeat(PARSER_LIMITS.maxXmlDepth + 5) + '</a>'.repeat(PARSER_LIMITS.maxXmlDepth + 5);
  assert.throws(() => assertSafeXml(deep), error => error.code === 'PARSER_ERROR');
});

test('DOCX XML hợp lệ được chấp nhận', () => {
  const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(assertSafeXml(xml, { name: 'document.xml' }), true);
});

test('độ sâu XML tính đúng với thẻ tự đóng', () => {
  assert.equal(xmlDepth('<a><b/><c></c></a>'), 2);
  assert.equal(xmlDepth('<a><b><c/></b></a>'), 2);
});

test('văn bản trích ra bị cắt theo giới hạn', () => {
  const long = 'x'.repeat(PARSER_LIMITS.maxTextChars + 10);
  const result = clampText(long);
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, PARSER_LIMITS.maxTextChars);
});

test('giới hạn parser là bất biến và có đủ khoá', () => {
  assert.equal(Object.isFrozen(PARSER_LIMITS), true);
  for (const key of ['maxFileBytes', 'maxZipEntries', 'maxEntryBytes', 'maxTotalUncompressedBytes',
    'maxExpansionRatio', 'maxXmlBytes', 'maxXmlDepth', 'maxTextChars']) {
    assert.equal(typeof PARSER_LIMITS[key], 'number', key);
  }
});
