/* AUTO-GENERATED from packages/core/preservation.js — chạy: python tools/sync_core.py */
/**
 * packages/core/preservation.js — kiểm tra bảo toàn nội dung sau khi viết lại.
 *
 * Chạy SAU mỗi phản hồi model, độc lập với prompt. Không có nghĩa là "bản viết
 * lại đúng": đây là các kiểm tra deterministic (số, URL, email, ngày, phủ định,
 * điều kiện, trích dẫn, cấu trúc Markdown, liệt kê). Kiểm tra ngữ nghĩa sâu
 * luôn trả `not_checked` để không tạo cảm giác an toàn giả.
 */

import {
  extractEntities,
  numberCounts,
  extractEnumerations,
  extractFromTo,
  tokenCounts,
  markdownStructure,
  NEGATIONS,
  CONDITIONS,
} from './entities.js';

export const PASSED = 'passed';
export const WARNING = 'warning';
export const FAILED = 'failed';
export const NOT_CHECKED = 'not_checked';

const words = text => (String(text).trim().match(/\S+/g) || []).length;

function diffMissing(expected, found, keyOf = v => v) {
  const pool = new Map();
  for (const item of found) {
    const key = keyOf(item);
    pool.set(key, (pool.get(key) || 0) + 1);
  }
  const missing = [];
  for (const item of expected) {
    const key = keyOf(item);
    const n = pool.get(key) || 0;
    if (n === 0) missing.push(item);
    else pool.set(key, n - 1);
  }
  return missing;
}

/**
 * @param {string} original văn bản người dùng đưa vào
 * @param {string} proposed văn bản model/cleaner trả ra
 * @param {{markdown?:boolean, minLengthRatio?:number, maxLengthRatio?:number, strict?:boolean}} [options]
 */
/** Từ có nghĩa của một mục liệt kê, đã bỏ dấu câu cuối và ký tự vô hình. */
function tokensOf(item) {
  const text = String(item ?? '')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, ' ');
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}.+#_-]*/gu) || [])
    .map(token => token.replace(/[.,;:]+$/, ''))
    .filter(token => token.length >= 2);
}

export function checkPreservation(original, proposed, options = {}) {
  const o = {
    markdown: true,
    minLengthRatio: 0.55,
    maxLengthRatio: 1.45,
    strict: false,
    ...options,
  };
  const src = String(original ?? '');
  const out = String(proposed ?? '');
  const issues = [];
  const preservation = {};
  const checksRun = [];
  const before = extractEntities(src);
  const after = extractEntities(out);

  const run = (key, fn) => {
    checksRun.push(key);
    preservation[key] = PASSED;
    fn();
  };
  const report = (key, severity, code, detail, extra = {}) => {
    issues.push({ check: key, severity, code, detail, ...extra });
    if (severity === 'failed') preservation[key] = FAILED;
    else if (severity === 'warning' && preservation[key] !== FAILED) preservation[key] = WARNING;
  };

  run('numbers', () => {
    const expected = numberCounts(src);
    const found = numberCounts(out);
    const missing = [];
    for (const [value, count] of expected) {
      const got = found.get(value) || 0;
      for (let i = got; i < count; i += 1) missing.push(value);
    }
    if (missing.length) {
      report('numbers', 'failed', 'number_missing', `Mất ${missing.length} giá trị số.`, {
        expected: missing.slice(0, 12),
      });
    }
    for (const pair of extractFromTo(src)) {
      const relation = new RegExp(
        `from\\s+${pair.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,60}?to\\s+${pair.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i',
      );
      const reversed = new RegExp(
        `from\\s+${pair.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,60}?to\\s+${pair.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i',
      );
      if (reversed.test(out) && !relation.test(out)) {
        report('numbers', 'failed', 'numeric_relation_reversed',
          `Chiều so sánh bị đảo: "${pair.from} → ${pair.to}".`, pair);
      }
    }
  });

  run('urls', () => {
    const missing = diffMissing(before.urls, after.urls);
    if (missing.length) {
      report('urls', 'failed', 'url_missing', `Mất ${missing.length} URL.`, { expected: missing });
    }
  });

  run('emails', () => {
    const missing = diffMissing(before.emails, after.emails);
    if (missing.length) {
      report('emails', 'failed', 'email_missing', `Mất ${missing.length} email.`, { expected: missing });
    }
  });

  run('dates', () => {
    const missing = diffMissing(before.dates, after.dates);
    if (missing.length) {
      report('dates', 'failed', 'date_missing', `Mất/đổi ${missing.length} ngày.`, { expected: missing });
    }
  });

  run('entities', () => {
    const expected = [...before.quotes, ...before.citations, ...before.acronyms, ...before.properNouns];
    const found = [...after.quotes, ...after.citations, ...after.acronyms, ...after.properNouns];
    const missing = diffMissing(expected, found);
    if (missing.length) {
      report('entities', 'warning', 'entity_missing',
        `${missing.length} tên/trích dẫn/acronym không còn trong bản mới.`,
        { expected: missing.slice(0, 12) });
    }
  });

  run('negation', () => {
    const expected = tokenCounts(src, NEGATIONS);
    const found = tokenCounts(out, NEGATIONS);
    const lost = [];
    for (const [token, count] of expected) {
      if ((found.get(token) || 0) < count) lost.push(token);
    }
    if (lost.length) {
      report('negation', 'failed', 'negation_removed',
        `Phủ định bị mất hoặc giảm: ${lost.join(', ')}.`, { expected: lost });
    }
  });

  run('conditions', () => {
    const expected = tokenCounts(src, CONDITIONS);
    const found = tokenCounts(out, CONDITIONS);
    const lost = [];
    for (const [token, count] of expected) {
      if ((found.get(token) || 0) < count) lost.push(token);
    }
    if (lost.length) {
      report('conditions', 'failed', 'condition_removed',
        `Điều kiện bị mất hoặc giảm: ${lost.join(', ')}.`, { expected: lost });
    }
  });

  run('citations', () => {
    const missing = diffMissing(before.citations, after.citations);
    if (missing.length) {
      report('citations', 'failed', 'citation_missing', `Mất ${missing.length} trích dẫn.`, { expected: missing });
    }
  });

  run('structure', () => {
    const mdBefore = markdownStructure(src);
    const mdAfter = markdownStructure(out);
    const lost = Object.entries(mdBefore)
      .filter(([key, value]) => value > 0 && mdAfter[key] < value)
      .map(([key, value]) => `${key}: ${value} → ${mdAfter[key]}`);
    if (lost.length) {
      const severity = o.markdown ? 'failed' : 'warning';
      report('structure', severity, 'structure_lost',
        `Cấu trúc Markdown bị giảm (${lost.join(', ')}).`, { expected: lost });
    }
  });

  run('lists', () => {
    const expected = extractEnumerations(src).flat();
    const found = extractEnumerations(out).flat();
    /* Ranh giới mục cuối không xác định được nếu không parse câu, nên so theo
       TẬP TỪ của mục: "Zig for this." vẫn chứa "Zig". Mất hẳn một mục — ví dụ
       "Kotlin, Java, and Python" → "Kotlin and Python" — vẫn bị bắt. */
    const foundTokens = new Set(found.flatMap(item => tokensOf(item)));
    const missing = expected.filter(item => !tokensOf(item).every(token => foundTokens.has(token)));
    if (missing.length) {
      report('lists', 'failed', 'list_item_removed',
        `Mục trong danh sách bị mất: ${missing.join(', ')}.`, { expected: missing });
    }
  });

  const wordsBefore = words(src);
  const wordsAfter = words(out);
  const ratio = wordsBefore ? wordsAfter / wordsBefore : 1;
  checksRun.push('length');
  preservation.length = PASSED;
  if (wordsBefore >= 20 && (ratio < o.minLengthRatio || ratio > o.maxLengthRatio)) {
    report('length', 'warning', 'length_changed',
      `Độ dài đổi ${(ratio * 100).toFixed(0)}% (${wordsBefore} → ${wordsAfter} từ).`,
      { expected: `${o.minLengthRatio}–${o.maxLengthRatio}` });
  }

  // Không có kiểm tra ngữ nghĩa tự động đáng tin: phải nói thẳng là chưa chạy.
  preservation.semanticReview = NOT_CHECKED;

  const failed = issues.some(issue => issue.severity === 'failed');
  return {
    preservation,
    issues,
    failed,
    ok: !failed,
    requiresManualReview: issues.length > 0 || o.strict,
    checksRun,
  };
}

/** Câu ngắn để hiển thị trên UI. */
export function preservationLine(result) {
  if (!result) return '';
  const failed = result.issues.filter(i => i.severity === 'failed');
  const warned = result.issues.filter(i => i.severity === 'warning');
  if (failed.length) return `Kiểm tra bảo toàn: ${failed.length} lỗi nội dung — xem chi tiết.`;
  if (warned.length) return `Kiểm tra bảo toàn: ${warned.length} cảnh báo.`;
  return 'Kiểm tra bảo toàn: số/URL/ngày/phủ định/trích dẫn khớp. Ngữ nghĩa chưa được kiểm tra tự động.';
}
