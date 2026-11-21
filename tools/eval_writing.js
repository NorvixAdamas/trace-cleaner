#!/usr/bin/env node
/**
 * tools/eval_writing.js — chạy dataset đánh giá Writing Intelligence.
 *
 *   node tools/eval_writing.js            # in metrics + ghi docs/WRITING_EVAL.md
 *   node tools/eval_writing.js --check    # exit 1 nếu docs lệch kết quả hiện tại
 *
 * Chỉ dùng fixture tự viết trong tests/fixtures/writing-eval — không có tài liệu
 * người dùng, không có dữ liệu cá nhân.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze } from '../packages/writing/grammar/index.js';
import { analyzeConsistency } from '../packages/writing/consistency.js';
import { evaluateDataset, formatEvaluationReport } from '../packages/writing/evaluation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = join(ROOT, 'docs', 'WRITING_EVAL.md');

function load(name) {
  return JSON.parse(readFileSync(join(ROOT, 'tests', 'fixtures', 'writing-eval', `${name}.json`), 'utf8'));
}

/** Gợi ý = grammar (theo ngôn ngữ) + consistency (toàn tài liệu). */
export function runCase(testCase) {
  const grammar = analyze(testCase.text, { language: testCase.language });
  const consistency = analyzeConsistency(testCase.text, { language: testCase.language });
  return { suggestions: [...grammar.suggestions, ...consistency.suggestions] };
}

function measure(dataset) {
  return { name: dataset.name, ...evaluateDataset(dataset.cases, { run: runCase }) };
}

function main() {
  const checking = process.argv.includes('--check');
  const datasets = [load('dev'), load('heldout')].map(measure);
  const report = formatEvaluationReport(datasets);

  for (const result of datasets) {
    console.log(`${result.name}: ${result.matched}/${result.expected} nhãn · thừa ${result.extra}`
      + ` · precision ${(result.precision * 100).toFixed(1)}%`
      + ` · recall ${(result.recall * 100).toFixed(1)}%`
      + ` · offset ${(result.offsetAccuracy * 100).toFixed(1)}%`
      + ` · bảo toàn ${(result.preservation * 100).toFixed(1)}%`);
    if (result.missing.length) {
      console.log('  thiếu:', result.missing.map(item => `${item.category}:${item.original}`).join(', '));
    }
    if (result.extra.length) {
      console.log('  thừa:', result.extra.map(item => `${item.ruleId}:${item.original}`).join(', '));
    }
  }

  if (checking) {
    if (!existsSync(DOC) || readFileSync(DOC, 'utf8') !== report) {
      console.error('docs/WRITING_EVAL.md lệch kết quả: chạy node tools/eval_writing.js');
      return 1;
    }
    console.log('docs/WRITING_EVAL.md khớp kết quả');
    return 0;
  }
  writeFileSync(DOC, report, 'utf8');
  console.log(`wrote ${DOC}`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('eval_writing.js')) {
  process.exitCode = main();
}
