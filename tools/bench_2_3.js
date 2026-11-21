/* Benchmark 2.3 — đo trên Node (KHÔNG phải số đo trình duyệt).
   Chạy: node tools/bench_2_3.js
   Mỗi case chạy 3 lần, báo median; mục đích là phát hiện hồi quy bậc độ lớn. */
import os from 'node:os';
import { openZip } from '../packages/core/zip.js';
import { analyzeOoxml } from '../packages/core/ooxml.js';
import { parsePdf } from '../packages/core/pdf.js';
import { verifyC2pa } from '../packages/core/c2pa.js';
import { analyze } from '../packages/writing/grammar/index.js';
import { analyzeConsistency } from '../packages/writing/consistency.js';
import { diffWords } from '../packages/core/diff.js';
import { buildDocx, buildPptx, buildXlsx } from '../tests/helpers/ooxml-fixtures.js';
import { buildPdf } from '../tests/helpers/pdf-fixtures.js';
import { buildZip } from '../tests/helpers/zip-builder.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

async function medianMs(fn, runs = 3) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const t = process.hrtime.bigint();
    await fn();
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

function bigDocx(paragraphs) {
  const body = Array.from({ length: paragraphs }, (_, i) =>
    `<w:p><w:r><w:t>Đoạn ${i + 1}: câu văn dài để kiểm tra tốc độ trích xuất và đọc cấu trúc.</w:t></w:r></w:p>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}</w:body></w:document>`;
}

const viText = Array.from({ length: 260 }, (_, i) =>
  `Đoạn ${i + 1}: tuy nhiên thì chúng tôi cũng như là đã kiểm tra kỹ càng, và kết quả cho thấy vấn đề này cần được xem xét lại.`).join('\n');
const enText = Array.from({ length: 200 }, (_, i) =>
  `Sentence ${i + 1}: their is a problem with the data, and it loose meaning when we dont check it.`).join('\n');

// Dữ liệu gần như không nén được (ratio ~1x) để đo throughput, không chạm ngưỡng ZIP bomb.
const { randomBytes } = await import('node:crypto');
const bigZip = await buildZip([{ name: 'word/document.xml', data: randomBytes(2 * 1024 * 1024).toString('base64') }]);
const docx = await buildDocx({ document: bigDocx(3000) });
const pptx = await buildPptx();
const xlsx = await buildXlsx();
const pdf = await buildPdf({ pages: 100, text: 'Trang thử nghiệm' });
const c2pa = await (async () => {
  const p = 'tests/fixtures/c2pa/signed.png';
  const fs = await import('node:fs/promises');
  return new Uint8Array(await fs.readFile(p));
})();

const rows = [];
const add = async (name, fn) => rows.push({ name, ms: +(await medianMs(fn)).toFixed(1) });

await add('ZIP: đọc entry 4 MiB (streaming inflate)', async () => {
  const zip = await openZip(bigZip);
  await zip.readText('word/document.xml');
  zip.close();
});
await add('XML: DOCX 3000 đoạn (analyzeOoxml)', async () => { await analyzeOoxml(docx, { format: 'docx' }); });
await add('OOXML: PPTX 2 slide + notes', async () => { await analyzeOoxml(pptx, { format: 'pptx' }); });
await add('OOXML: XLSX 1 sheet', async () => { await analyzeOoxml(xlsx, { format: 'xlsx' }); });
await add('PDF: 100 trang text', async () => { await parsePdf(pdf); });
await add('C2PA: xác minh chữ ký PNG đã ký', async () => { await verifyC2pa(c2pa); });
await add('Writing: grammar 260 đoạn VI', async () => { analyze(viText); });
await add('Writing: grammar 200 câu EN', async () => { analyze(enText); });
await add('Writing: consistency 260 đoạn VI', async () => { analyzeConsistency(viText, { language: 'vi' }); });
await add('Diff: 100k ký tự', async () => {
  diffWords(viText, viText.replace(/vấn đề/g, 'điểm').slice(0, 100_000));
});

const env = {
  node: process.version,
  os: `${os.type()} ${os.release()}`,
  cpu: (os.cpus()[0] || {}).model || 'unknown',
  cores: os.cpus().length,
  ramGiB: +(os.totalmem() / 1024 ** 3).toFixed(1),
  at: new Date().toISOString(),
};
console.log(JSON.stringify({ env, rows }, null, 2));
for (const row of rows) console.log(`${String(row.ms).padStart(8)} ms  ${row.name}`);
