#!/usr/bin/env node
/**
 * tools/bench.js — đo hiệu năng thật của core/writing.
 *
 *   node tools/bench.js            # in bảng
 *   node tools/bench.js --write    # ghi docs/BENCHMARKS.md
 *
 * Nguyên tắc: chỉ báo số đo được trên máy đang chạy, kèm cấu hình máy. Không
 * suy diễn "nhanh hơn", không so sánh với phiên bản chưa đo.
 */
import { writeFileSync } from 'node:fs';
import { cpus, platform, arch, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanText } from '../packages/core/cleaning.js';
import { scan } from '../packages/core/unicode.js';
import { checkPreservation } from '../packages/core/preservation.js';
import { splitMarkdown } from '../packages/core/markdown.js';
import { diffWords } from '../packages/core/diff.js';
import { DocumentSession } from '../packages/core/document.js';
import { analyze } from '../packages/writing/grammar/index.js';
import { generate } from '../packages/providers/registry.js';
import { checkZipBudget, assertSafeXml } from '../packages/core/limits.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const paragraph = 'Trace Cleaner kiểm tra văn bản, giữ nguyên số liệu 4.2 giây và URL https://example.com/a,b, '
  + 'không xoá mục danh sách, không đảo phủ định. It also keeps ${placeholders} and `inline code` intact.\n\n';

function documentOf(words) {
  const chunk = paragraph.split(/\s+/).length;
  const copies = Math.ceil(words / chunk);
  return paragraph.repeat(copies);
}

const SIZES = [
  { label: '2k từ', text: documentOf(2000) },
  { label: '20k từ', text: documentOf(20000) },
];

function timeIt(fn, runs = 5) {
  fn(); // warmup
  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[Math.floor(samples.length / 2)], min: samples[0], max: samples[samples.length - 1] };
}

const rows = [];
const record = (name, size, result, extra = '') => rows.push({ name, size, ...result, extra });

for (const { label, text } of SIZES) {
  record('unicode scan', label, timeIt(() => scan(text)), `${text.length} ký tự`);
  record('cleanText (markdown)', label, timeIt(() => cleanText(text, { markdown: true })));
  record('cleanText (plain)', label, timeIt(() => cleanText(text, { markdown: false })));
  record('preservation check', label, timeIt(() => checkPreservation(text, text, { markdown: true })));
  record('markdown split', label, timeIt(() => splitMarkdown(text)));
  record('word diff (self)', label, timeIt(() => diffWords(text, text)));
  record('grammar analyze', label, timeIt(() => analyze(text, { language: 'vi' }), 3));
  record('document session', label, timeIt(() => {
    const session = new DocumentSession(text);
    session.propose(text.replace('4.2', '4,2'), { id: 'p1' });
    session.acceptProposal('p1');
  }, 3));
}

const big = documentOf(50000);
const diffStart = process.hrtime.bigint();
diffWords(big, big.replaceAll('example', 'samples'));
const diffMs = Number(process.hrtime.bigint() - diffStart) / 1e6;

const zipEntries = Array.from({ length: 120 }, (_, i) => ({
  name: `word/part${i}.xml`, size: 40_000, compressedSize: 8_000, method: 8,
}));
record('zip budget (120 entry)', '—', timeIt(() => checkZipBudget(zipEntries)));
record('xml safety (16 KB)', '—', timeIt(() => assertSafeXml(`<w:document>${'<w:p><w:r><w:t>x</w:t></w:r></w:p>'.repeat(400)}</w:document>`)));
record('provider overhead (mock)', '—', timeIt(() => {
  generate(
    { provider: 'google', key: 'bench-key-1234', model: 'gemini-3.8-flash' },
    {
      text: 'hello', prompt: 'p',
      fetchImpl: async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 }),
    },
  );
}, 3));

const fmt = value => `${value.toFixed(2)} ms`;
const table = [
  '| Phép đo | Kích thước | Trung vị | Min | Max | Ghi chú |',
  '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.name} | ${r.size} | ${fmt(r.median)} | ${fmt(r.min)} | ${fmt(r.max)} | ${r.extra} |`),
].join('\n');

const summary = rows.filter(r => r.name === 'cleanText (markdown)')
  .map(r => `${r.size}: ${fmt(r.median)}`).join(' · ');

console.log(table);
console.log(`\nword diff 50k từ (so với chính nó, có thay đổi): ${fmt(diffMs)}`);
console.log(`cleanText: ${summary}`);

if (process.argv.includes('--write')) {
  const md = `# Benchmarks — Trace Cleaner 2.2

Số đo thật, sinh bởi \`node tools/bench.js --write\` ngày ${new Date().toISOString().slice(0, 10)}.

- Máy: ${cpus()[0]?.model?.trim() || 'unknown'} · ${platform()} ${arch()} · ${(totalmem() / 1024 ** 3).toFixed(0)} GB RAM
- Node: ${process.version}
- Mỗi phép đo: 1 lần warmup + 5 lần (grammar/document/provider: 3 lần), báo trung vị.
- Không có số liệu trình duyệt trong bảng này; chi phí render/DOM chưa được đo.

${table}

- word diff 50k từ (so với chính nó, có thay đổi): ${fmt(diffMs)}
- cleanText (markdown): ${summary}

## Giới hạn đã biết

- \`diffWords\` dùng DP O(n·m) với trần 4.000.000 ô; vượt trần thì rơi về chế độ thay cả khối (một delete + một insert) — chính xác về nội dung nhưng thô hơn khi review.
- \`cleanText\` chạy đồng bộ trên main thread; văn bản rất lớn nên chia nhỏ trước khi dán vào web app.
- ZIP giải nén bằng \`DecompressionStream\`; đã chặn theo metadata + kiểm tra lại sau khi inflate, nhưng không huỷ được giữa chừng một entry đang nở (Web API không cho ngắt stream theo byte).
`;
  writeFileSync(join(ROOT, 'docs/BENCHMARKS.md'), md, 'utf8');
  console.log('\n→ docs/BENCHMARKS.md');
}
