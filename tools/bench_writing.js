#!/usr/bin/env node
/**
 * tools/bench_writing.js — đo hiệu năng thật của Writing Intelligence 3.0.
 *
 * Chạy: node tools/bench_writing.js
 * Ghi:  docs/HUMANIZE_3_BENCHMARKS.md
 *
 * Đây là benchmark vi mô trên máy đang chạy, không phải benchmark đại diện cho
 * mọi máy. Không có số liệu mô phỏng: mọi con số lấy từ performance.now() và
 * process.memoryUsage() của tiến trình Node hiện tại.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeWriting } from '../packages/writing/analyze.js';
import { rewrite } from '../packages/writing/engine/rewrite.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'HUMANIZE_3_BENCHMARKS.md');

const PARAGRAPH = 'The release note explains that the parser rejects overlapping zip entries, keeps every number '
  + 'and citation intact, and reports the exact revision to the editor. In order to test the change, the team '
  + 'utilized a very unique fixture with 12 files, but it did not remove any list item. '
  + 'Người viết cũng kiểm tra văn bản tiếng Việt và giữ nguyên dấu thanh trong câu. ';

function textOfWords(target) {
  let out = '';
  while ((out.match(/\S+/g) || []).length < target) out += PARAGRAPH;
  const words = out.match(/\S+/g) || [];
  return words.slice(0, target).join(' ');
}

function measure(text, iterations = 5) {
  // warm-up
  analyzeWriting(text, { language: 'en' });
  rewrite(text, { mode: 'concise', language: 'en' });
  const analyzeTimes = [];
  const rewriteTimes = [];
  for (let i = 0; i < iterations; i += 1) {
    let started = performance.now();
    analyzeWriting(text, { language: 'en' });
    analyzeTimes.push(performance.now() - started);
    started = performance.now();
    rewrite(text, { mode: 'concise', language: 'en' });
    rewriteTimes.push(performance.now() - started);
  }
  const avg = values => values.reduce((a, b) => a + b, 0) / values.length;
  return {
    analyzeMs: avg(analyzeTimes),
    rewriteMs: avg(rewriteTimes),
    analyzeMaxMs: Math.max(...analyzeTimes),
    rewriteMaxMs: Math.max(...rewriteTimes),
  };
}

const targets = [500, 1000, 3000, 5000];
const rows = [];
const memoryBefore = process.memoryUsage();
const rssBefore = memoryBefore.rss;
for (const target of targets) {
  const text = textOfWords(target);
  const result = measure(text);
  rows.push({ target, chars: text.length, ...result });
  console.log(`${target} words: analyze ${result.analyzeMs.toFixed(1)} ms · rewrite ${result.rewriteMs.toFixed(1)} ms`);
}
const memoryAfter = process.memoryUsage();
const rssAfter = memoryAfter.rss;
const deltaMb = (rssAfter - rssBefore) / (1024 * 1024);
const heapDeltaMb = (memoryAfter.heapUsed - memoryBefore.heapUsed) / (1024 * 1024);

const lines = [
  '# Humanize 3.0 — benchmark thật',
  '',
  `Sinh lại: \`node tools/bench_writing.js\` · Node ${process.version} · ${process.platform}/${process.arch}`,
  `CPU: ${process.env.PROCESSOR_IDENTIFIER || 'không đọc được'} · thời điểm: ${new Date().toISOString()}`,
  '',
  '| Từ | Ký tự | analyze trung bình | analyze max | rewrite trung bình | rewrite max |',
  '|---|---|---|---|---|---|',
  ...rows.map(row => `| ${row.target} | ${row.chars} | ${row.analyzeMs.toFixed(1)} ms | ${row.analyzeMaxMs.toFixed(1)} ms | ${row.rewriteMs.toFixed(1)} ms | ${row.rewriteMaxMs.toFixed(1)} ms |`),
  '',
  `RSS tăng trong lúc chạy: **${deltaMb.toFixed(1)} MiB**; heapUsed tăng: **${heapDeltaMb.toFixed(1)} MiB** (không phải peak; V8 có thể chưa trả bộ nhớ).`,
  '',
  '## Giới hạn của phép đo',
  '',
  '- Chạy trên một máy, một tiến trình; không phải benchmark matrix đa phần cứng.',
  '- `rewrite` ở đây là phần deterministic (grammar/clarity/contraction). Chế độ cần model không được đo vì không có API key và không được bịa số.',
  '- Không đo cancellation latency: engine deterministic không có request mạng; cancellation của provider đã có test riêng.',
  '- Kết quả thay đổi theo CPU, Node và tải máy; con số chỉ dùng để phát hiện hồi quy tương đối.',
  '',
];

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`wrote ${OUT}`);
