/**
 * packages/writing/suggestions.js — schema duy nhất cho mọi gợi ý sửa.
 *
 * Một gợi ý KHÔNG bao giờ tự áp vào văn bản. UI phải cho người dùng xem từng
 * gợi ý và chấp nhận/từ chối. Mọi offset là UTF-16 trong chuỗi gốc.
 *
 * Phân biệt quan trọng (2.3):
 *   kind: 'correction'  → lỗi chắc chắn, sửa không đổi nghĩa;
 *         'suggestion'  → lời khuyên về văn phong, có thể đúng ngữ cảnh.
 *   category: spelling | typo | grammar | punctuation | word-choice |
 *             redundancy | style | consistency | capitalization.
 *   confidence: 0..1, dùng để UI xếp thứ tự và để evaluation tách ngưỡng.
 */

import { documentRevision, PRESERVATION_STATUS } from './shared/schema.js';

export const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

export const CATEGORY = Object.freeze({
  SPELLING: 'spelling',
  TYPO: 'typo',
  GRAMMAR: 'grammar',
  PUNCTUATION: 'punctuation',
  WORD_CHOICE: 'word-choice',
  REDUNDANCY: 'redundancy',
  STYLE: 'style',
  CONSISTENCY: 'consistency',
  CAPITALIZATION: 'capitalization',
});

export const KIND = Object.freeze({ CORRECTION: 'correction', SUGGESTION: 'suggestion' });

/**
 * @param {string} text văn bản gốc
 * @param {{type?:string, category?:string, kind?:string, confidence?:number,
 *   severity?:string, language:string, start:number, end:number,
 *   replacement:string, reason:string, explanation?:string,
 *   source?:string, ruleId?:string, paragraph?:number, evidence?:Array<object>}} spec
 * @returns {object}
 */
export function makeSuggestion(text, spec) {
  const start = spec.start;
  const end = spec.end;
  const original = String(text).slice(start, end);
  const category = spec.category || spec.type || 'grammar';
  const kind = spec.kind || (spec.severity === SEVERITY.ERROR ? KIND.CORRECTION : KIND.SUGGESTION);
  const confidence = Number.isFinite(spec.confidence)
    ? Math.max(0, Math.min(1, Number(spec.confidence)))
    : (kind === KIND.CORRECTION ? 0.95 : 0.55);
  return {
    id: `${spec.ruleId || category}-${start}-${end}`,
    type: category,
    category,
    kind,
    confidence,
    severity: spec.severity || (kind === KIND.CORRECTION ? SEVERITY.ERROR : SEVERITY.INFO),
    language: spec.language || 'unknown',
    start,
    end,
    original,
    replacement: spec.replacement,
    reason: spec.reason,
    explanation: spec.explanation || spec.reason,
    source: spec.source || 'deterministic-rule',
    ruleId: spec.ruleId || null,
    paragraph: Number.isInteger(spec.paragraph) ? spec.paragraph : null,
    evidence: spec.evidence || null,
    revision: spec.revision || documentRevision(text),
    preservationStatus: spec.preservationStatus || PRESERVATION_STATUS.NOT_CHECKED,
    accepted: false,
  };
}

/** Sắp xếp và loại gợi ý chồng lấn (giữ gợi ý xuất hiện trước, ưu tiên lỗi). */
export function sortSuggestions(list) {
  const weight = { error: 0, warning: 1, info: 2 };
  const sorted = [...list].sort((a, b) => a.start - b.start
    || (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
    || (b.confidence || 0) - (a.confidence || 0)
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
    corrections: list.filter(item => item.kind === KIND.CORRECTION).length,
    byType: list.reduce((acc, item) => {
      acc[item.category || item.type] = (acc[item.category || item.type] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: list.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
    highConfidence: list.filter(item => (item.confidence || 0) >= 0.9).length,
  };
}
