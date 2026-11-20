/**
 * packages/writing/grammar/index.js — phân tích văn bản thành gợi ý sửa.
 *
 * Chạy trên TỪNG ĐOẠN VĂN XUÔI của core (code, URL, email, thẻ HTML được bảo vệ),
 * nên không bao giờ "sửa" nội dung code hoặc link.
 *
 * Không có gợi ý nào được tự áp: `applySuggestion()` là hành động riêng, do người
 * dùng bấm, và nó kiểm tra lại `original` trước khi ghi.
 */

import { segmentText } from '../../core/cleaning.js';
import { applyEdits } from '../../core/diff.js';
import { detectLanguage, SUPPORTED_LANGUAGES } from '../language.js';
import { makeSuggestion, sortSuggestions, suggestionStats, SEVERITY } from '../suggestions.js';
import { EN_RULES } from './en.js';
import { VI_RULES } from './vi.js';

export const GRAMMAR_SCHEMA_VERSION = '1.0';

/** Luật an toàn cho mọi ngôn ngữ (không phụ thuộc ngữ pháp). */
const NEUTRAL_RULES = [
  {
    id: 'neutral.double-space',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /[ \t]{2,}/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: ' ', reason: 'Nhiều khoảng trắng liên tiếp.' });
      }
      return out;
    },
  },
];

/**
 * @param {string} text
 * @param {{language?:'en'|'vi'|'unknown', maxSuggestions?:number, types?:string[]}} [options]
 * @returns {{language:string, supported:boolean, suggestions:Array<object>, stats:object,
 *   schemaVersion:string, offsetSystem:string}}
 */
export function analyze(text, options = {}) {
  const source = String(text ?? '');
  const language = options.language && options.language !== 'auto'
    ? options.language
    : detectLanguage(source);
  const rules = language === 'vi' ? VI_RULES : language === 'en' ? EN_RULES : NEUTRAL_RULES;
  const filter = Array.isArray(options.types) && options.types.length ? new Set(options.types) : null;
  const collected = [];

  for (const seg of segmentText(source)) {
    if (seg.type !== 'text' || !seg.value) continue;
    for (const rule of rules) {
      if (filter && !filter.has(rule.type)) continue;
      let hits = [];
      try {
        hits = rule.run(seg.value) || [];
      } catch {
        hits = []; // một luật hỏng không được làm hỏng cả báo cáo
      }
      for (const hit of hits) {
        if (!Number.isInteger(hit.start) || !Number.isInteger(hit.end) || hit.end <= hit.start) continue;
        const suggestion = makeSuggestion(source, {
          type: rule.type,
          severity: hit.severity || rule.severity || SEVERITY.WARNING,
          language,
          start: seg.start + hit.start,
          end: seg.start + hit.end,
          replacement: hit.replacement,
          reason: hit.reason,
          ruleId: rule.id,
        });
        if (suggestion.original && suggestion.original !== suggestion.replacement) collected.push(suggestion);
      }
    }
  }

  const deduped = new Map();
  for (const item of sortSuggestions(collected)) deduped.set(item.id, item);
  const list = [...deduped.values()];
  const limit = Number.isInteger(options.maxSuggestions) ? options.maxSuggestions : 500;
  const suggestions = list.slice(0, limit);

  return {
    language,
    supported: SUPPORTED_LANGUAGES.includes(language),
    suggestions,
    truncated: list.length > suggestions.length,
    stats: suggestionStats(suggestions),
    schemaVersion: GRAMMAR_SCHEMA_VERSION,
    offsetSystem: 'utf16-source',
  };
}

/**
 * Áp MỘT gợi ý đã được người dùng chấp nhận.
 * @param {string} text
 * @param {object} suggestion
 * @param {{sourceRevision?:string}} [options]
 * @returns {ReturnType<typeof applyEdits>}
 */
export function applySuggestion(text, suggestion, options = {}) {
  if (!suggestion || typeof suggestion.start !== 'number') {
    return { text: String(text ?? ''), applied: [], rejected: [{ edit: suggestion, reason: 'invalid_edit' }], conflicts: [], sourceRevision: options.sourceRevision ?? null, schemaVersion: '1.0' };
  }
  return applyEdits(text, [{
    start: suggestion.start,
    end: suggestion.end,
    find: suggestion.original,
    replace: suggestion.replacement,
  }], { sourceRevision: options.sourceRevision });
}

/** Áp nhiều gợi ý trong một lần, kiểm tra chồng lấn. */
export function applySuggestions(text, suggestions, options = {}) {
  const edits = (suggestions || []).map(item => ({
    start: item.start,
    end: item.end,
    find: item.original,
    replace: item.replacement,
  }));
  return applyEdits(text, edits, { sourceRevision: options.sourceRevision });
}

