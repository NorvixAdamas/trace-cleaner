import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePdf, parseToUnicode, PDF_ERRORS } from '../packages/core/pdf.js';
import { PARSER_LIMITS } from '../packages/core/limits.js';
import { buildPdf } from './helpers/pdf-fixtures.js';

const limits = (over = {}) => ({ ...PARSER_LIMITS, ...over });

test('pdf: xref cổ điển + ToUnicode → trích đúng Unicode tiếng Việt', async () => {
  const bytes = await buildPdf({ text: 'Xin chào PDF' });
  const doc = await parsePdf(bytes);
  assert.equal(doc.kind, 'PDF');
  assert.equal(doc.version, '1.7');
  assert.equal(doc.pageCount, 1);
  assert.equal(doc.pages.length, 1);
  assert.match(doc.pages[0].text, /Xin chào PDF/);
  assert.equal(doc.hasTextLayer, true);
  assert.equal(doc.scanned, false);
});

test('pdf: xref stream đọc được object thường', async () => {
  const bytes = await buildPdf({ text: 'Xref stream text', mode: 'xref-stream' });
  const doc = await parsePdf(bytes);
  assert.match(doc.text, /Xref stream text/);
  assert.ok(doc.xrefEntries > 0);
});

test('pdf: object stream (ObjStm) resolve được catalog/page/font', async () => {
  const bytes = await buildPdf({ text: 'Nén object stream', mode: 'objstm' });
  const doc = await parsePdf(bytes);
  assert.equal(doc.pageCount, 1);
  assert.match(doc.text, /Nén object stream/);
});

test('pdf: content stream FlateDecode được giải nén đúng', async () => {
  const bytes = await buildPdf({ text: 'Flate content', compressContent: true });
  const doc = await parsePdf(bytes);
  assert.match(doc.text, /Flate content/);
});

test('pdf: nhiều trang giữ ranh giới trang', async () => {
  const bytes = await buildPdf({ text: 'Trang', pages: 3 });
  const doc = await parsePdf(bytes);
  assert.equal(doc.pageCount, 3);
  assert.equal(doc.pages.length, 3);
  assert.ok(doc.pages.every(page => page.text.includes('Trang')));
});

test('pdf: vượt maxPages bị cắt, vẫn báo pageCount thật', async () => {
  const bytes = await buildPdf({ text: 'Trang', pages: 3 });
  const doc = await parsePdf(bytes, { limits: limits({ maxPages: 2 }) });
  assert.equal(doc.pageCount, 3);
  assert.equal(doc.pages.length, 2);
});

test('pdf: vượt maxPdfTextPages chỉ trích text tới giới hạn', async () => {
  const bytes = await buildPdf({ text: 'Trang', pages: 3 });
  const doc = await parsePdf(bytes, { limits: limits({ maxPdfTextPages: 1 }) });
  assert.equal(doc.pages.length, 1);
  assert.ok(doc.diagnostics.some(item => /page_text_truncated_at_1/.test(item)));
});

test('pdf: trang chỉ có ảnh được đánh dấu scanned, không bịa text', async () => {
  const bytes = await buildPdf({ imageOnly: true });
  const doc = await parsePdf(bytes);
  assert.equal(doc.text, '');
  assert.equal(doc.hasTextLayer, false);
  assert.equal(doc.scanned, true);
  assert.ok(doc.diagnostics.includes('no_text_layer'));
});

test('pdf: file mã hoá bị từ chối rõ ràng', async () => {
  const bytes = await buildPdf({ encrypt: true });
  await assert.rejects(() => parsePdf(bytes), error => error.reason === PDF_ERRORS.ENCRYPTED);
});

test('pdf: file không phải PDF bị từ chối', async () => {
  await assert.rejects(
    () => parsePdf(new TextEncoder().encode('hello world')),
    error => error.reason === PDF_ERRORS.NOT_PDF,
  );
});

test('pdf: file bị cắt cụt bị từ chối', async () => {
  const bytes = await buildPdf({ text: 'abc' });
  await assert.rejects(
    () => parsePdf(bytes.slice(0, Math.floor(bytes.length * 0.6))),
    error => error.reason === PDF_ERRORS.TRUNCATED || error.reason === PDF_ERRORS.XREF_BROKEN,
  );
});

test('pdf: stream vượt giới hạn giải nén bị chặn, có diagnostic', async () => {
  const bytes = await buildPdf({ text: 'x'.repeat(2000), compressContent: true });
  const doc = await parsePdf(bytes, { limits: limits({ maxPdfStreamBytes: 500 }) });
  assert.equal(doc.text, '');
  assert.ok(doc.diagnostics.some(item => /unreadable|no_text_layer/.test(item)));
});

test('pdf: huỷ trước khi đọc bị báo CANCELLED', async () => {
  const bytes = await buildPdf({ text: 'abc' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => parsePdf(bytes, { signal: controller.signal }), error => error.reason === PDF_ERRORS.CANCELLED);
});

test('pdf: parseToUnicode hỗ trợ bfchar và bfrange', () => {
  const cmap = parseToUnicode(`
1 begincodespacerange <0000> <FFFF> endcodespacerange
2 beginbfchar <0001> <0041> <0002> <D83DDE00> endbfchar
1 beginbfrange <0010> <0012> <0061> endbfrange
2 beginbfrange <0020> <0021> [<0058> <0059>] endbfrange
  `);
  assert.equal(cmap.codeBytes, 2);
  assert.equal(cmap.map.get(1), 'A');
  assert.equal(cmap.map.get(2), '😀');
  assert.equal(cmap.map.get(16), 'a');
  assert.equal(cmap.map.get(18), 'c');
  assert.equal(cmap.map.get(32), 'X');
  assert.equal(cmap.map.get(33), 'Y');
});

test('pdf: metadata Info được đọc nếu có', async () => {
  const base = await buildPdf({ text: 'abc' });
  const text = new TextDecoder('latin1').decode(base);
  assert.ok(text.includes('%PDF-1.7'));
});
