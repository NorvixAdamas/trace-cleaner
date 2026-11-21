/**
 * packages/writing/shared/schema.js — schema chung cho Writing Intelligence 3.0.
 *
 * Mọi gợi ý từ grammar, clarity, consistency, rewrite đều đi qua đây để có cùng
 * một shape. Offset vẫn là UTF-16 trong chuỗi gốc; `revision` là hash nội dung
 * tại thời điểm phân tích, để UI từ chối gợi ý cũ.
 */

export const WRITING_SCHEMA_VERSION = '3.0';

export const PRESERVATION_STATUS = Object.freeze({
  PRESERVED: 'preserved',
  REVIEW: 'review',
  BLOCKED: 'blocked',
  NOT_CHECKED: 'not_checked',
});

export const SUGGESTION_SOURCE = Object.freeze({
  DETERMINISTIC: 'deterministic-rule',
  MODEL: 'model',
  CONSISTENCY: 'deterministic-rule',
});

/** FNV-1a 32-bit: hash ổn định, không cần crypto, đủ để phát hiện stale. */
export function documentRevision(text) {
  const source = String(text ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `w3-${(hash >>> 0).toString(16).padStart(8, '0')}-${source.length}`;
}

export function isPreservationStatus(value) {
  return Object.values(PRESERVATION_STATUS).includes(value);
}

/**
 * Chuẩn hoá một gợi ý. Không tin field lạ từ rule: chỉ giữ schema đã biết.
 * Trả null nếu offset không trỏ đúng chuỗi gốc — thà bỏ gợi ý còn hơn ghi sai.
 */
export function normalizeSuggestion(text, item, options = {}) {
  const source = String(text ?? '');
  if (!item || !Number.isInteger(item.start) || !Number.isInteger(item.end)) return null;
  if (item.start < 0 || item.end <= item.start || item.end > source.length) return null;
  const original = source.slice(item.start, item.end);
  if (item.original !== undefined && item.original !== original) return null;
  if (typeof item.replacement !== 'string') return null;
  const revision = options.revision || item.revision || documentRevision(source);
  const preservationStatus = isPreservationStatus(item.preservationStatus)
    ? item.preservationStatus
    : PRESERVATION_STATUS.NOT_CHECKED;
  return Object.freeze({
    id: String(item.id || `${item.ruleId || item.category || 'suggestion'}-${item.start}-${item.end}`),
    type: item.type || item.category || 'style',
    category: item.category || item.type || 'style',
    kind: item.kind === 'correction' ? 'correction' : 'suggestion',
    severity: item.severity || 'info',
    confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.5,
    language: item.language || options.language || 'unknown',
    start: item.start,
    end: item.end,
    original,
    replacement: item.replacement,
    reason: item.reason || item.explanation || '',
    explanation: item.explanation || item.reason || '',
    source: item.source || SUGGESTION_SOURCE.DETERMINISTIC,
    ruleId: item.ruleId || null,
    paragraph: Number.isInteger(item.paragraph) ? item.paragraph : null,
    evidence: Array.isArray(item.evidence) ? item.evidence : null,
    revision,
    preservationStatus,
    accepted: false,
  });
}

/** Kiểm tra lại một gợi ý trước khi áp vào văn bản hiện tại. */
export function validateSuggestion(text, suggestion) {
  if (!suggestion) return { ok: false, reason: 'missing_suggestion' };
  const source = String(text ?? '');
  if (!Number.isInteger(suggestion.start) || !Number.isInteger(suggestion.end)) {
    return { ok: false, reason: 'invalid_offsets' };
  }
  if (suggestion.start < 0 || suggestion.end <= suggestion.start || suggestion.end > source.length) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  if (source.slice(suggestion.start, suggestion.end) !== suggestion.original) {
    return { ok: false, reason: 'stale_text' };
  }
  if (suggestion.revision && suggestion.revision !== documentRevision(source)) {
    return { ok: false, reason: 'stale_revision' };
  }
  return { ok: true };
}

export function countSuggestions(list) {
  const items = Array.isArray(list) ? list : [];
  return {
    total: items.length,
    corrections: items.filter(item => item.kind === 'correction').length,
    suggestions: items.filter(item => item.kind === 'suggestion').length,
    byCategory: items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}),
    byPreservation: items.reduce((acc, item) => {
      acc[item.preservationStatus] = (acc[item.preservationStatus] || 0) + 1;
      return acc;
    }, {}),
  };
}
