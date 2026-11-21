/**
 * packages/writing/analyze.js — entrypoint canonical của Writing Intelligence 3.0.
 *
 * Gộp grammar deterministic, clarity, consistency/document và readability thành
 * một report. Mọi gợi ý được chuẩn hoá qua schema chung, mang `revision` của
 * văn bản và `preservationStatus: not_checked` cho đến khi áp dụng.
 */

import { analyze as analyzeGrammar } from './grammar/index.js';
import { analyzeClarity } from './engine/clarity.js';
import { analyzeDocument } from './engine/document.js';
import { analyzeReadability } from './engine/readability.js';
import { comparePreservation } from './engine/preserve.js';
import { rewrite as rewriteEngine } from './engine/rewrite.js';
import { applySuggestion, applySuggestions } from './grammar/index.js';
import { sortSuggestions, suggestionStats } from './suggestions.js';
import {
  WRITING_SCHEMA_VERSION as SCHEMA_VERSION, PRESERVATION_STATUS as PRESERVATION,
  documentRevision as revisionOf, normalizeSuggestion, validateSuggestion, countSuggestions,
} from './shared/schema.js';

export const ANALYSIS_SCHEMA_VERSION = '3.0';
export const WRITING_SCHEMA_VERSION = SCHEMA_VERSION;
export const PRESERVATION_STATUS = PRESERVATION;
export const documentRevision = revisionOf;

/**
 * @param {string} text
 * @param {{language?:string, types?:string[], minConfidence?:number,
 *   maxSuggestions?:number, includeDocument?:boolean, includeReadability?:boolean}} [options]
 */
export function analyzeWriting(text, options = {}) {
  const source = String(text ?? '');
  const grammar = analyzeGrammar(source, {
    language: options.language,
    types: options.types,
    minConfidence: options.minConfidence,
    maxSuggestions: options.maxSuggestions,
  });
  const language = grammar.language;
  const clarity = analyzeClarity(source, { language });
  const document = options.includeDocument === false
    ? { findings: [], suggestions: [], stats: { findings: 0, suggestions: 0, checks: [] }, limitations: [] }
    : analyzeDocument(source, { language });
  const readability = options.includeReadability === false
    ? null
    : analyzeReadability(source, { language });
  const revision = documentRevision(source);

  const all = [...grammar.suggestions, ...clarity.suggestions, ...document.suggestions]
    .map(item => normalizeSuggestion(source, {
      ...item,
      language,
      revision,
      preservationStatus: PRESERVATION.NOT_CHECKED,
    }, { revision, language }))
    .filter(Boolean);

  const filter = Array.isArray(options.types) && options.types.length ? new Set(options.types) : null;
  const minConfidence = Number.isFinite(options.minConfidence) ? options.minConfidence : 0;
  const filtered = all.filter(item => (!filter || filter.has(item.category))
    && item.confidence >= minConfidence);
  const sorted = sortSuggestions(filtered);
  const limit = Number.isInteger(options.maxSuggestions) ? options.maxSuggestions : 500;
  const suggestions = sorted.slice(0, limit);

  const insights = [
    ...(readability ? readability.observations : []),
    ...document.findings,
    ...clarity.observations,
  ];

  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    engineVersion: '3.0',
    language,
    supported: grammar.supported,
    revision,
    offsetSystem: 'utf16-source',
    suggestions,
    truncated: sorted.length > suggestions.length,
    stats: {
      ...suggestionStats(suggestions),
      schema: countSuggestions(suggestions),
      insights: insights.length,
      warnings: suggestions.filter(item => item.severity === 'warning').length,
      errors: suggestions.filter(item => item.severity === 'error').length,
    },
    insights,
    readability,
    document: {
      findings: document.findings,
      stats: document.stats,
      limitations: document.limitations,
    },
    analysisWarnings: grammar.ruleErrors || [],
    capabilities: {
      deterministicAnalysis: true,
      modelRequired: false,
      languages: ['en', 'vi'],
      documentLevel: true,
      semanticPreservation: 'deterministic-only',
      rewriteModes: 'packages/writing/modes/index.js',
    },
    notes: [
      'Gợi ý deterministic không tự áp; người dùng phải chấp nhận từng cái.',
      'preservationStatus chỉ được kiểm tra khi áp dụng hoặc viết lại.',
    ],
  };
}

/**
 * Áp một gợi ý và trả thêm trạng thái bảo toàn của toàn văn bản.
 * Gợi ý cũ (revision khác) bị từ chối trước khi chạm văn bản.
 */
export function applyWritingSuggestion(text, suggestion) {
  const source = String(text ?? '');
  const check = validateSuggestion(source, suggestion);
  if (!check.ok) {
    return { ok: false, reason: check.reason, text: source, preservation: null };
  }
  const result = applySuggestion(source, suggestion, { sourceRevision: documentRevision(source) });
  if (!result.applied.length) {
    return { ok: false, reason: 'edit_rejected', text: source, result, preservation: null };
  }
  const preservation = comparePreservation(source, result.text);
  return {
    ok: true,
    text: result.text,
    result,
    preservation,
    blocked: preservation.status === PRESERVATION.BLOCKED,
  };
}

/**
 * Áp nhiều gợi ý; nếu kết quả mất dữ kiện deterministic thì KHÔNG trả bản đã
 * sửa, trừ khi caller chủ động `allowUnsafe: true`.
 */
export function applyWritingSuggestions(text, suggestions, options = {}) {
  const source = String(text ?? '');
  const result = applySuggestions(source, suggestions, { sourceRevision: documentRevision(source) });
  const preservation = comparePreservation(source, result.text);
  const blocked = preservation.status === PRESERVATION.BLOCKED;
  if (blocked && !options.allowUnsafe) {
    return { ok: false, reason: 'preservation_blocked', text: source, result, preservation };
  }
  return { ok: true, text: result.text, result, preservation, blocked };
}

export const rewrite = rewriteEngine;
