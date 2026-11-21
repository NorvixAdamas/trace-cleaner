/**
 * packages/writing/engine/rewrite.js — pipeline viết lại deterministic + kiểm tra.
 *
 * Không giả vờ rằng một phép biến đổi cục bộ tạo ra "deep rewrite". Chế độ cần
 * model trả `requiresModel: true` và chỉ áp những phép an toàn (sửa lỗi, rút gọn
 * cụm từ) trước. Sau mỗi lần áp, bản kết quả được so với bản gốc bằng
 * `comparePreservation`; nếu mất số/tên/phủ định/điều kiện/cấu trúc thì toàn bộ
 * thay đổi bị huỷ và trả về bản gốc.
 */

import { segmentText } from '../../core/cleaning.js';
import { analyze, applySuggestions } from '../grammar/index.js';
import { analyzeClarity } from './clarity.js';
import { comparePreservation } from './preserve.js';
import { getMode, resolveMode } from '../prompts.js';
import { WRITING_SCHEMA_VERSION } from '../shared/schema.js';

export const REWRITE_SCHEMA_VERSION = '3.0';

const CONTRACTIONS = [
  [/\bcan't\b/gi, 'cannot'], [/\bwon't\b/gi, 'will not'],
  [/\bdon't\b/gi, 'do not'], [/\bdoesn't\b/gi, 'does not'], [/\bdidn't\b/gi, 'did not'],
  [/\bisn't\b/gi, 'is not'], [/\baren't\b/gi, 'are not'], [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'], [/\bhaven't\b/gi, 'have not'], [/\bhasn't\b/gi, 'has not'],
  [/\bhadn't\b/gi, 'had not'], [/\bwouldn't\b/gi, 'would not'], [/\bcouldn't\b/gi, 'could not'],
  [/\bshouldn't\b/gi, 'should not'], [/\bI'm\b/g, 'I am'], [/\byou're\b/gi, 'you are'],
  [/\bwe're\b/gi, 'we are'], [/\bthey're\b/gi, 'they are'],
];

function caseLike(source, replacement) {
  if (/^[A-Z]/.test(source)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function expandContractions(text) {
  const source = String(text ?? '');
  const changes = [];
  let output = '';
  for (const segment of segmentText(source)) {
    if (segment.type !== 'text') {
      output += segment.value;
      continue;
    }
    let value = segment.value;
    for (const [pattern, replacement] of CONTRACTIONS) {
      value = value.replace(pattern, match => {
        const next = caseLike(match, replacement);
        changes.push({ ruleId: 'rewrite.expand-contraction', original: match, replacement: next });
        return next;
      });
    }
    output += value;
  }
  return { text: output, changes };
}

function grammarStep(text, language) {
  const report = analyze(text, { language });
  const safe = report.suggestions.filter(item => item.kind === 'correction' && item.confidence >= 0.9);
  if (!safe.length) return { text, changes: [] };
  const applied = applySuggestions(text, safe, { sourceRevision: safe[0].revision });
  return {
    text: applied.applied.length ? applied.text : text,
    changes: applied.applied.map(item => ({
      ruleId: item.ruleId || 'grammar',
      original: text.slice(item.start, item.end),
      replacement: item.replacement || '',
    })),
  };
}

function clarityStep(text, language) {
  const report = analyzeClarity(text, { language });
  if (!report.suggestions.length) return { text, changes: [] };
  const applied = applySuggestions(text, report.suggestions, { sourceRevision: report.suggestions[0].revision });
  return {
    text: applied.applied.length ? applied.text : text,
    changes: applied.applied.map(item => ({
      ruleId: item.ruleId || 'clarity',
      original: text.slice(item.start, item.end),
      replacement: item.replacement || '',
    })),
  };
}

/**
 * @param {string} text
 * @param {{mode?:string, language?:'en'|'vi'|'unknown', customVoice?:string,
 *   applyDeterministic?:boolean}} [options]
 */
export function rewrite(text, options = {}) {
  const source = String(text ?? '');
  const key = resolveMode(options.mode || 'natural');
  const mode = getMode(key);
  const language = options.language || 'unknown';
  const changes = [];
  let current = source;
  let blocked = null;

  for (const operation of options.applyDeterministic === false ? [] : mode.deterministic) {
    let step;
    if (operation === 'grammar-corrections') step = grammarStep(current, language);
    else if (operation === 'clarity-trims') step = clarityStep(current, language);
    else if (operation === 'expand-contractions') step = expandContractions(current);
    else step = { text: current, changes: [] };
    if (step.text !== current) {
      changes.push(...step.changes);
      current = step.text;
    }
  }

  if (current !== source) {
    const preservation = comparePreservation(source, current);
    if (preservation.status === 'blocked') {
      blocked = preservation;
      current = source;
      changes.length = 0;
    }
  }

  const preservation = blocked || comparePreservation(source, current);
  return {
    schemaVersion: REWRITE_SCHEMA_VERSION,
    writingSchemaVersion: WRITING_SCHEMA_VERSION,
    mode: key,
    label: mode.label,
    text: current,
    changed: current !== source,
    changes,
    requiresModel: mode.requiresModel,
    deterministicOnly: !mode.requiresModel,
    preservation,
    note: mode.requiresModel
      ? 'Các thay đổi trên là phép deterministic an toàn. Bản viết lại đầy đủ của chế độ này cần model; prompt tương ứng nằm trong registry.'
      : 'Chế độ này chỉ chạy các phép deterministic; không gọi model.',
  };
}
