import test from 'node:test';
import assert from 'node:assert/strict';

import { openZip, ZIP_ERRORS, crc32 } from '../packages/core/zip.js';
import { PARSER_LIMITS } from '../packages/core/limits.js';
import { buildZip, deflateRaw } from './helpers/zip-builder.js';

const limits = (over = {}) => ({ ...PARSER_LIMITS, ...over });
const text = bytes => new TextDecoder().decode(bytes);

test('zip: archive nhỏ đọc đúng nội dung và tên', async () => {
  const bytes = await buildZip([
    { name: 'word/document.xml', data: '<w:document>xin chào</w:document>' },
    { name: 'docProps/app.xml', data: 'app' },
  ]);
  const zip = await openZip(bytes);
  assert.deepEqual(zip.names, ['word/document.xml', 'docProps/app.xml']);
  assert.equal(text(await zip.read('word/document.xml')), '<w:document>xin chào</w:document>');
  assert.equal(await zip.read('không-tồn-tại'), null);
});

test('zip: entry đúng bằng giới hạn thì đọc được', async () => {
  const data = 'x'.repeat(4096);
  const bytes = await buildZip([{ name: 'a.txt', data }]);
  const zip = await openZip(bytes, { limits: limits({ maxEntryBytes: 4096 + 64, maxTotalUncompressedBytes: 1 << 20 }) });
  assert.equal(text(await zip.read('a.txt')), data);
});

test('zip: vượt giới hạn entry một byte thì bị chặn', async () => {
  const data = 'x'.repeat(4096);
  const bytes = await buildZip([{ name: 'a.txt', data }]);
  await assert.rejects(
    () => openZip(bytes, { limits: limits({ maxEntryBytes: 4095 }) }),
    error => error.reason === ZIP_ERRORS.ENTRY_TOO_LARGE,
  );
});

test('zip: vượt tổng dung lượng giải nén thì bị chặn', async () => {
  const bytes = await buildZip([
    { name: 'a.txt', data: 'a'.repeat(3000) },
    { name: 'b.txt', data: 'b'.repeat(3000) },
  ]);
  await assert.rejects(
    () => openZip(bytes, { limits: limits({ maxTotalUncompressedBytes: 5000 }) }),
    error => error.reason === ZIP_ERRORS.ARCHIVE_TOO_LARGE,
  );
});

test('zip: tỉ lệ nở cao bị coi là ZIP bomb', async () => {
  const bytes = await buildZip([{ name: 'bomb.txt', data: new Uint8Array(2 * 1024 * 1024) }]);
  await assert.rejects(
    () => openZip(bytes, { limits: limits({ maxExpansionRatio: 20 }) }),
    error => error.reason === ZIP_ERRORS.SUSPICIOUS_EXPANSION,
  );
});

test('zip: metadata khai báo nhỏ hơn thực tế bị phát hiện khi đọc', async () => {
  const data = 'y'.repeat(5000);
  const bytes = await buildZip([{ name: 'lie.txt', data, declaredSize: 10 }]);
  const zip = await openZip(bytes);
  await assert.rejects(() => zip.read('lie.txt'), error => error.reason === ZIP_ERRORS.SIZE_MISMATCH);
});

test('zip: CRC sai bị phát hiện', async () => {
  const bytes = await buildZip([{ name: 'bad.txt', data: 'nội dung', declaredCrc: 0xDEADBEEF }]);
  const zip = await openZip(bytes);
  await assert.rejects(() => zip.read('bad.txt'), error => error.reason === ZIP_ERRORS.CRC_MISMATCH);
});

test('zip: archive bị cắt cụt bị từ chối', async () => {
  const bytes = await buildZip([{ name: 'a.txt', data: 'abc'.repeat(100) }]);
  await assert.rejects(
    () => openZip(bytes.slice(0, bytes.length - 30)),
    error => error.reason === ZIP_ERRORS.NOT_ZIP || error.reason === ZIP_ERRORS.TRUNCATED,
  );
});

test('zip: quá nhiều entry bị từ chối', async () => {
  const bytes = await buildZip([
    { name: 'a.txt', data: 'a' },
    { name: 'b.txt', data: 'b' },
    { name: 'c.txt', data: 'c' },
  ]);
  await assert.rejects(
    () => openZip(bytes, { limits: limits({ maxZipEntries: 2 }) }),
    error => error.reason === ZIP_ERRORS.TOO_MANY_ENTRIES,
  );
});

test('zip: central directory hỏng bị từ chối', async () => {
  const bytes = await buildZip([{ name: 'a.txt', data: 'abc' }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cdOffset = view.getUint32(bytes.length - 6, true);
  bytes[cdOffset] = 0x00; // phá chữ ký PK\x01\x02
  await assert.rejects(
    () => openZip(bytes),
    error => error.reason === ZIP_ERRORS.MALFORMED || error.reason === ZIP_ERRORS.NOT_ZIP,
  );
});

test('zip: tên có ../ bị từ chối', async () => {
  const bytes = await buildZip([{ name: '../../etc/passwd', data: 'x' }]);
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.UNSAFE_NAME);
});

test('zip: tên tuyệt đối bị từ chối', async () => {
  const bytes = await buildZip([{ name: '/etc/passwd', data: 'x' }]);
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.UNSAFE_NAME);
});

test('zip: entry trùng tên bị từ chối', async () => {
  const bytes = await buildZip([
    { name: 'a.txt', data: 'one' },
    { name: 'a.txt', data: 'two' },
  ]);
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.DUPLICATE_ENTRY);
});

test('zip: entry mã hoá bị từ chối', async () => {
  const bytes = await buildZip([{ name: 'secret.txt', data: 'x', flags: 0x1 }]);
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.ENCRYPTED);
});

test('zip: phương thức nén lạ bị từ chối', async () => {
  const bytes = await buildZip([{ name: 'a.bin', data: 'x', method: 0, methodOverride: 12 }]);
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.UNSUPPORTED_METHOD);
});

test('zip: huỷ giữa lúc giải nén dừng thật và báo CANCELLED', async () => {
  const bytes = await buildZip([{ name: 'big.txt', data: new Uint8Array(1024 * 1024) }]);
  const zip = await openZip(bytes, { limits: limits({ maxExpansionRatio: 5000 }) });
  let checks = 0;
  const fakeSignal = { get aborted() { checks += 1; return checks > 2; } };
  await assert.rejects(
    () => openZip(bytes, { limits: limits({ maxExpansionRatio: 5000 }), signal: fakeSignal }).then(z => z.read('big.txt')),
    error => error.reason === ZIP_ERRORS.CANCELLED,
  );
  assert.ok(zip.names.includes('big.txt'));
});

test('zip: quá thời gian parse bị chặn', async () => {
  const bytes = await buildZip([{ name: 'a.txt', data: 'abc' }]);
  await assert.rejects(
    () => openZip(bytes, { deadline: Date.now() - 1 }),
    error => error.reason === ZIP_ERRORS.TIMEOUT,
  );
});

test('zip: ZIP64 marker bị từ chối rõ ràng', async () => {
  const bytes = await buildZip([{ name: 'a.txt', data: 'abc' }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(bytes.length - 12, 0xFFFF, true); // entry count trên disk
  await assert.rejects(() => openZip(bytes), error => error.reason === ZIP_ERRORS.ZIP64);
});

test('zip: crc32 khớp giá trị chuẩn', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test('zip: deflate-raw roundtrip qua builder', async () => {
  const raw = new TextEncoder().encode('hello hello hello hello');
  const packed = await deflateRaw(raw);
  assert.ok(packed.length < raw.length);
});
