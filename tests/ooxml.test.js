import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeOoxml, resolveRelationshipTarget, parseRelationships, isDateFormatCode,
  excelSerialToIso, sheetDimensions, OOXML_ERRORS,
} from '../packages/core/ooxml.js';
import { parseXml } from '../packages/core/xml.js';
import { PARSER_LIMITS } from '../packages/core/limits.js';
import { buildDocx, buildPptx, buildXlsx } from './helpers/ooxml-fixtures.js';

const limits = (over = {}) => ({ ...PARSER_LIMITS, ...over });

test('ooxml: resolve Target tương đối và tuyệt đối', () => {
  assert.equal(resolveRelationshipTarget('ppt/presentation.xml', 'slides/slide1.xml'), 'ppt/slides/slide1.xml');
  assert.equal(resolveRelationshipTarget('ppt/slides/slide2.xml', '../notesSlides/notesSlide1.xml'), 'ppt/notesSlides/notesSlide1.xml');
  assert.equal(resolveRelationshipTarget('word/document.xml', '/customXml/item1.xml'), 'customXml/item1.xml');
});

test('ooxml: parseRelationships đọc Id/Type/Target', () => {
  const { root } = parseXml(`<Relationships><Relationship Id="rId1" Type="http://x/officeDocument" Target="word/document.xml"/></Relationships>`);
  const list = parseRelationships(root, '');
  assert.equal(list[0].id, 'rId1');
  assert.equal(list[0].typeShort, 'officeDocument');
  assert.equal(list[0].target, 'word/document.xml');
});

test('docx: đọc metadata thật', async () => {
  const doc = await analyzeOoxml(await buildDocx(), { format: 'docx' });
  assert.equal(doc.metadata.creator, 'Người viết');
  assert.equal(doc.metadata.lastModifiedBy, 'Người sửa');
  assert.equal(doc.metadata.revision, 7);
  assert.equal(doc.metadata.totalTimeMinutes, 42);
  assert.equal(doc.metadata.application, 'Microsoft Office Word');
});

test('docx: tracked changes giữ khác biệt ins/del + tác giả + thời gian', async () => {
  const doc = await analyzeOoxml(await buildDocx(), { format: 'docx' });
  const first = doc.docx.paragraphs[0];
  assert.equal(first.text, 'Câu gốc chèn mới kết thúc');
  assert.ok(first.withDeleted.includes('bỏ đi'), first.withDeleted);
  assert.equal(doc.docx.revisions.inserted.length, 1);
  assert.equal(doc.docx.revisions.deleted.length, 1);
  assert.equal(doc.docx.revisions.inserted[0].author, 'An');
  assert.equal(doc.docx.revisions.inserted[0].date, '2026-01-03T10:00:00Z');
  assert.equal(doc.docx.revisions.deleted[0].author, 'Bình');
  assert.deepEqual(doc.docx.revisions.authors.sort(), ['An', 'Bình']);
});

test('docx: comments có id, tác giả và neo đúng đoạn', async () => {
  const doc = await analyzeOoxml(await buildDocx(), { format: 'docx' });
  assert.equal(doc.docx.comments.length, 1);
  const comment = doc.docx.comments[0];
  assert.equal(comment.id, '0');
  assert.equal(comment.author, 'Reviewer');
  assert.equal(comment.text, 'Sửa lại câu này');
  assert.equal(comment.anchoredParagraph, 1);
  assert.match(comment.anchoredText, /Đoạn có comment/);
});

test('docx: văn bản gồm cả đoạn trong bảng, đúng thứ tự', async () => {
  const doc = await analyzeOoxml(await buildDocx(), { format: 'docx' });
  assert.match(doc.text, /Câu gốc chèn mới kết thúc/);
  assert.match(doc.text, /Ô trong bảng/);
  assert.ok(doc.partsRead.includes('word/comments.xml'));
  assert.ok(doc.partsRead.includes('docProps/core.xml'));
});

test('docx: part XML hỏng bị từ chối thay vì bỏ qua', async () => {
  const document = '<w:document><w:body><w:p></w:body></w:document>';
  await assert.rejects(
    () => analyzeOoxml(buildDocx({ document }), { format: 'docx' }),
    error => error.code === 'PARSER_ERROR',
  );
});

test('docx: thiếu part chính bị báo rõ', async () => {
  const { buildZip } = await import('./helpers/zip-builder.js');
  const bytes = await buildZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: '_rels/.rels', data: '<Relationships><Relationship Id="rId1" Type="http://x/officeDocument" Target="word/document.xml"/></Relationships>' },
  ]);
  await assert.rejects(
    () => analyzeOoxml(bytes, { format: 'docx' }),
    error => error.reason === OOXML_ERRORS.MISSING_MAIN_PART,
  );
});

test('pptx: slide đọc theo thứ tự sldIdLst, không theo tên file', async () => {
  const ppt = await analyzeOoxml(await buildPptx(), { format: 'pptx' });
  assert.equal(ppt.pptx.slides.length, 2);
  assert.equal(ppt.pptx.slides[0].part, 'ppt/slides/slide2.xml');
  assert.equal(ppt.pptx.slides[0].text, 'Nội dung hai');
  assert.equal(ppt.pptx.slides[1].part, 'ppt/slides/slide1.xml');
  assert.equal(ppt.pptx.slides[1].title, 'Tiêu đề một');
});

test('pptx: speaker notes được trích đúng và bỏ số trang', async () => {
  const ppt = await analyzeOoxml(await buildPptx(), { format: 'pptx' });
  const first = ppt.pptx.slides[0];
  assert.equal(first.notesPart, 'ppt/notesSlides/notesSlide1.xml');
  assert.equal(first.notes, 'Ghi chú cho slide 1\nDòng hai');
  assert.ok(!first.notes.includes('7'));
  assert.equal(ppt.pptx.slides[1].notes, null);
  assert.equal(ppt.pptx.notesFound, 1);
  assert.match(ppt.text, /\[notes\] Ghi chú cho slide 1/);
});

test('pptx: notes XML hỏng bị từ chối', async () => {
  const bytes = await buildPptx({ notes: '<p:notes><p:cSld><p:spTree>' });
  await assert.rejects(() => analyzeOoxml(bytes, { format: 'pptx' }), error => error.code === 'PARSER_ERROR');
});

test('pptx: vượt maxSlides bị cắt và có cảnh báo', async () => {
  const ppt = await analyzeOoxml(await buildPptx(), { format: 'pptx', limits: limits({ maxSlides: 1 }) });
  assert.equal(ppt.pptx.slides.length, 1);
  assert.ok(ppt.diagnostics.some(item => /chỉ đọc 1/.test(item)));
});

test('xlsx: đọc sheet theo workbook order và giữ tên/hidden', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx' });
  assert.deepEqual(book.xlsx.sheets.map(s => s.name), ['Dữ liệu', 'Ẩn', 'Trống']);
  assert.equal(book.xlsx.sheets[1].hidden, true);
  assert.equal(book.xlsx.sheets[0].hidden, false);
  assert.equal(book.xlsx.declaredSheets, 3);
});

test('xlsx: shared string, inline string, số, boolean, ô rỗng', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx' });
  const sheet = book.xlsx.sheets[0];
  const cell = ref => sheet.cells.find(item => item.ref === ref);
  assert.equal(cell('A1').display, 'Xin chào');
  assert.equal(cell('A2').display, 'Đậm thường');
  assert.equal(cell('C1').display, 'Chuỗi nội tuyến');
  assert.equal(cell('B2').value, 2.5);
  assert.equal(cell('A3').value, true);
  assert.equal(cell('A3').display, 'TRUE');
  assert.equal(sheet.rows, 3);
});

test('xlsx: ngày theo numFmt được đổi thành ISO', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx' });
  const cell = book.xlsx.sheets[0].cells.find(item => item.ref === 'B1');
  assert.deepEqual(cell.value, { serial: 45000, iso: '2023-03-15' });
  assert.equal(cell.display, '2023-03-15');
});

test('xlsx: formula được giữ là formula, không thực thi', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx' });
  const cell = book.xlsx.sheets[0].cells.find(item => item.ref === 'D1');
  assert.equal(cell.formula, 'SUM(A2:A3)');
  assert.equal(cell.display, '5');
  assert.equal(cell.value, 5);
});

test('xlsx: sheet trống vẫn có tên nhưng không có dòng', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx' });
  const empty = book.xlsx.sheets[2];
  assert.equal(empty.name, 'Trống');
  assert.equal(empty.rows, 0);
  assert.equal(sheetDimensions(empty).cells, 0);
});

test('xlsx: vượt maxSheets bị cắt và có cảnh báo', async () => {
  const book = await analyzeOoxml(await buildXlsx(), { format: 'xlsx', limits: limits({ maxSheets: 2 }) });
  assert.equal(book.xlsx.sheets.length, 2);
  assert.ok(book.diagnostics.some(item => /worksheet/.test(item)));
});

test('xlsx: relationship hỏng không làm sập, ghi diagnostic', async () => {
  const bytes = await buildXlsx();
  // Đổi tên part để target không còn tồn tại.
  const { buildZip } = await import('./helpers/zip-builder.js');
  const entries = [
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: '_rels/.rels', data: '<Relationships><Relationship Id="rId1" Type="http://x/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    {
      name: 'xl/workbook.xml',
      data: '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets><sheet name="Mất" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: '<Relationships><Relationship Id="rId1" Type="http://x/worksheet" Target="worksheets/khong-co.xml"/></Relationships>',
    },
  ];
  const broken = await buildZip(entries);
  assert.ok(bytes.length > 0);
  const book = await analyzeOoxml(broken, { format: 'xlsx' });
  assert.equal(book.xlsx.sheets.length, 1);
  assert.match(book.xlsx.sheets[0].diagnostics.join(' '), /Không resolve/);
});

test('xlsx: nhận diện format ngày và serial 1904', () => {
  assert.equal(isDateFormatCode('dd/mm/yyyy'), true);
  assert.equal(isDateFormatCode('0.00'), false);
  assert.equal(isDateFormatCode('"ngày" dd'), true);
  assert.equal(excelSerialToIso(1), '1900-01-01');
  assert.equal(excelSerialToIso(45000), '2023-03-15');
  assert.equal(excelSerialToIso(0, { date1904: true }), '1904-01-01');
  assert.equal(excelSerialToIso(0.5).endsWith('12:00:00Z'), true);
});
