/**
 * packages/writing/suggestions.js — schema duy nhất cho mọi gợi ý sửa.
 *
 * Một gợi ý KHÔNG bao giờ tự áp vào văn bản. UI phải cho người dùng xem từng
 * gợi ý và chấp nhận/từ chối. Mọi offset là UTF-16 trong chuỗi gốc.
 */

export const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

/**
 * @param {string} text văn bản gốc
 * @param {{type:string, severity?:string, language:string, start:number, end:number,
 *   replacement:string, reason:string, source?:string, ruleId?:string}} spec
 * @returns {object}
 */
export function makeSuggestion(text, spec) {
  const start = spec.start;
  const end = spec.end;
  const original = String(text).slice(start, end);
  return {
    id: `${spec.ruleId || spec.type}-${start}-${end}`,
    type: spec.type,
    severity: spec.severity || SEVERITY.WARNING,
    language: spec.language || 'unknown',
    start,
    end,
    original,
    replacement: spec.replacement,
    reason: spec.reason,
    source: spec.source || 'deterministic-rule',
    ruleId: spec.ruleId || null,
    accepted: false,
  };
}

/** Sắp xếp và loại gợi ý chồng lấn (giữ gợi ý xuất hiện trước, ưu tiên lỗi). */
export function sortSuggestions(list) {
  const weight = { error: 0, warning: 1, info: 2 };
  const sorted = [...list].sort((a, b) => a.start - b.start
    || (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
    || a.end - b.end);
  const out = [];
  let cursor = -1;
  for (const item of sorted) {
    if (item.start < cursor) continue;
    out.push(item);
    cursor = item.end;
  }
  return out;
}

export function suggestionStats(list) {
  return {
    total: list.length,
    byType: list.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: list.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
  };
}
