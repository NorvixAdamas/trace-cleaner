/**
 * packages/writing/evaluation.js — đo chất lượng gợi ý trên dataset có nhãn.
 *
 * Không dùng "điểm AI" hay "tỉ lệ né detector" làm thước đo. Ở đây đo đúng thứ
 * người dùng quan tâm:
 *   - precision / recall của finding so với nhãn người viết;
 *   - độ chính xác offset (start/end phải trỏ đúng chuỗi gốc);
 *   - false-positive trên 1000 từ (đo mức làm phiền);
 *   - bảo toàn nội dung ngoài vùng sửa.
 *
 * Nhãn nằm trong tests/fixtures/writing-eval/*.json, tách dev và held-out.
 */

import { checkPreservation } from '../core/preservation.js';
import { applySuggestions } from './grammar/index.js';

const STOP_FOR_MATCH = new Set(['id', 'category', 'original', 'replacement', 'kind']);

function wordCount(text) {
  return (String(text).match(/\S+/g) || []).length;
}

/**
 * So khớp nhãn với gợi ý thật.
 * @param {string} text
 * @param {Array<{category:string, original:string, replacement?:string, kind?:string}>} expectations
 * @param {Array<object>} suggestions
 */
export function matchExpectations(text, expectations, suggestions) {
  const used = new Set();
  const matched = [];
  const missing = [];
  for (const expected of expectations || []) {
    const index = suggestions.findIndex((item, at) => {
      if (used.has(at)) return false;
      if (item.category !== expected.category) return false;
      if (item.original !== expected.original) return false;
      if (expected.replacement !== undefined && item.replacement !== expected.replacement) return false;
      if (expected.kind !== undefined && item.kind !== expected.kind) return false;
      return true;
    });
    if (index >= 0) {
      used.add(index);
      matched.push({ expected, hit: suggestions[index] });
    } else {
      missing.push(expected);
    }
  }
  const extra = suggestions.filter((_, index) => !used.has(index));
  return { matched, missing, extra };
}

/**
 * @param {Array<object>} cases mỗi case: {id, language, text, expect:[], forbid:[], preserve:[]}
 * @param {{run:(testCase:object)=>{suggestions:Array<object>}}} options
 */
export function evaluateDataset(cases, { run }) {
  const perCase = [];
  const totals = {
    cases: 0, expected: 0, matched: 0, missing: 0, extra: 0, words: 0,
    offsetChecked: 0, offsetOk: 0, preserveChecked: 0, preserveOk: 0,
  };
  const byCategory = {};

  for (const testCase of cases || []) {
    totals.cases += 1;
    totals.words += wordCount(testCase.text);
    const suggestions = run(testCase).suggestions || [];
    const result = matchExpectations(testCase.text, testCase.expect, suggestions);
    totals.expected += (testCase.expect || []).length;
    totals.matched += result.matched.length;
    totals.missing += result.missing.length;
    totals.extra += result.extra.length;

    for (const { hit } of result.matched) {
      totals.offsetChecked += 1;
      if (testCase.text.slice(hit.start, hit.end) === hit.original) totals.offsetOk += 1;
      const key = hit.category;
      byCategory[key] = byCategory[key] || { expected: 0, matched: 0 };
      byCategory[key].matched += 1;
    }
    for (const item of testCase.expect || []) {
      const key = item.category;
      byCategory[key] = byCategory[key] || { expected: 0, matched: 0 };
      byCategory[key].expected += 1;
    }

    // Bảo toàn: áp các correction khớp nhãn rồi kiểm tra chuỗi phải còn.
    if (Array.isArray(testCase.preserve) && testCase.preserve.length) {
      totals.preserveChecked += testCase.preserve.length;
      const corrections = result.matched.map(item => item.hit).filter(item => item.kind === 'correction');
      const applied = corrections.length ? applySuggestions(testCase.text, corrections).text : testCase.text;
      for (const needle of testCase.preserve) if (applied.includes(needle)) totals.preserveOk += 1;
    }

    if (process.env.TRACE_EVAL_VERBOSE) {
      console.log(testCase.id, { missing: result.missing, extra: result.extra.map(item => [item.ruleId, item.original]) });
    }

    perCase.push({
      id: testCase.id,
      language: testCase.language,
      expected: (testCase.expect || []).length,
      matched: result.matched.length,
      missing: result.missing,
      extra: result.extra,
    });
  }

  const precision = totals.matched + totals.extra === 0 ? 1 : totals.matched / (totals.matched + totals.extra);
  const recall = totals.expected === 0 ? 1 : totals.matched / totals.expected;
  const offsetAccuracy = totals.offsetChecked === 0 ? 1 : totals.offsetOk / totals.offsetChecked;
  const preservation = totals.preserveChecked === 0 ? 1 : totals.preserveOk / totals.preserveChecked;
  return {
    ...totals,
    precision,
    recall,
    offsetAccuracy,
    preservation,
    falsePositivesPer1000Words: totals.words ? (totals.extra / totals.words) * 1000 : 0,
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([key, value]) => [
      key,
      { ...value, recall: value.expected ? value.matched / value.expected : 1 },
    ])),
    perCase,
  };
}

/** Sinh báo cáo Markdown từ kết quả evaluateDataset. */
export function formatEvaluationReport(results, { title = 'Đánh giá Writing Intelligence' } = {}) {
  const rows = results.map(result => [
    `| ${result.name} | ${result.cases} | ${result.expected} | ${result.matched} | ${result.missing} | ${result.extra} | ${(result.precision * 100).toFixed(1)}% | ${(result.recall * 100).toFixed(1)}% | ${(result.offsetAccuracy * 100).toFixed(1)}% |`,
  ].join('\n')).join('\n');
  return `# ${title}

Sinh lại: \`node tools/eval_writing.js\` · đo trên fixture có nhãn, không phải "điểm AI".

| Tập | Case | Nhãn | Khớp | Thiếu | Thừa | Precision | Recall | Offset đúng |
|---|---|---|---|---|---|---|---|---|
${rows}

## Cách đọc

- **Precision** = finding đúng / tất cả finding. Thừa (false positive) làm giảm precision.
- **Recall** = finding đúng / nhãn. Thiếu làm giảm recall.
- **Offset đúng** = gợi ý trỏ đúng chuỗi gốc (\`text.slice(start,end) === original\`).
- **Bảo toàn** = sau khi áp các correction, các chuỗi trong \`preserve\` vẫn còn.

Các ca "văn phong tự nhiên" nằm trong fixture với \`expect: []\` — mọi gợi ý trên
các câu đó đều bị tính là false positive.
`;
}
