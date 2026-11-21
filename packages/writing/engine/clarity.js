/**
 * packages/writing/engine/clarity.js — gợi ý rút gọn rõ nghĩa, deterministic.
 *
 * Chỉ thay cụm có nghĩa tương đương gần như tuyệt đối. Không đổi từ vựng chuyên
 * môn, không đoán chủ ý, không tách câu tự động. Mọi gợi ý là `suggestion` (màu
 * nhạt), confidence thấp hơn correction, và người dùng phải chấp nhận.
 */

import { segmentText } from '../../core/cleaning.js';
import { makeSuggestion, CATEGORY, KIND, SEVERITY } from '../suggestions.js';
import { quotedRanges, insideRanges } from '../shared/normalization.js';

export const CLARITY_SCHEMA_VERSION = '1.0';

const WORDY = [
  { id: 'clarity.in-order-to', pattern: /\bin order to\b/gi, replace: 'to', reason: '"in order to" → "to" không đổi nghĩa.' },
  { id: 'clarity.due-to-fact', pattern: /\bdue to the fact that\b/gi, replace: 'because', reason: '"due to the fact that" → "because".' },
  { id: 'clarity.at-this-point', pattern: /\bat this point in time\b/gi, replace: 'now', reason: 'Cụm thời gian dài hơn "now" mà không thêm nghĩa.' },
  { id: 'clarity.in-event-that', pattern: /\bin the event that\b/gi, replace: 'if', reason: '"in the event that" → "if" cho điều kiện.' },
  { id: 'clarity.has-ability', pattern: /\b(?:has|have|had) the ability to\b/gi, replace: 'can', reason: 'Có thể dùng "can" thay cụm "has the ability to".' },
  { id: 'clarity.for-purpose', pattern: /\bfor the purpose of\b/gi, replace: 'to', reason: '"for the purpose of" → "to".' },
  { id: 'clarity.prior-to', pattern: /\bprior to\b/gi, replace: 'before', reason: '"prior to" → "before".' },
  { id: 'clarity.subsequent-to', pattern: /\bsubsequent to\b/gi, replace: 'after', reason: '"subsequent to" → "after".' },
  { id: 'clarity.in-spite-of-fact', pattern: /\bin spite of the fact that\b/gi, replace: 'although', reason: '"in spite of the fact that" → "although".' },
  { id: 'clarity.a-large-number', pattern: /\ba large number of\b/gi, replace: 'many', reason: 'Có thể dùng "many" cho số lượng lớn đếm được.' },
  { id: 'clarity.utilize', pattern: /\butili[sz]e\b/gi, replace: 'use', reason: '"use" đơn giản và trung tính hơn "utilize".' },
];

const REDUNDANT = [
  { id: 'clarity.absolutely-essential', pattern: /\babsolutely essential\b/gi, replace: 'essential', reason: '"essential" đã bao hàm mức tuyệt đối.' },
  { id: 'clarity.advance-planning', pattern: /\badvance planning\b/gi, replace: 'planning', reason: 'Planning vốn diễn ra trước.' },
  { id: 'clarity.close-proximity', pattern: /\bclose proximity\b/gi, replace: 'proximity', reason: 'Proximity đã là gần.' },
  { id: 'clarity.end-result', pattern: /\bend result\b/gi, replace: 'result', reason: '"result" đã là kết quả cuối.' },
  { id: 'clarity.final-outcome', pattern: /\bfinal outcome\b/gi, replace: 'outcome', reason: '"outcome" đã là kết quả cuối.' },
  { id: 'clarity.free-gift', pattern: /\bfree gift\b/gi, replace: 'gift', reason: 'Gift vốn miễn phí.' },
  { id: 'clarity.past-history', pattern: /\bpast history\b/gi, replace: 'history', reason: 'History vốn là quá khứ.' },
  { id: 'clarity.personal-opinion', pattern: /\bpersonal opinion\b/gi, replace: 'opinion', reason: 'Opinion vốn là quan điểm cá nhân.' },
  { id: 'clarity.unexpected-surprise', pattern: /\bunexpected surprise\b/gi, replace: 'surprise', reason: 'Surprise vốn bất ngờ.' },
  { id: 'clarity.very-unique', pattern: /\bvery unique\b/gi, replace: 'unique', reason: 'Unique không có mức độ.' },
  { id: 'clarity.each-and-every', pattern: /\beach and every\b/gi, replace: 'every', reason: '"each and every" lặp nghĩa.' },
  { id: 'clarity.first-and-foremost', pattern: /\bfirst and foremost\b/gi, replace: 'first', reason: 'Hai từ nối cùng chức năng.' },
  { id: 'clarity.basic-fundamentals', pattern: /\bbasic fundamentals\b/gi, replace: 'fundamentals', reason: 'Fundamentals vốn là nền tảng.' },
  { id: 'clarity.repeat-again', pattern: /\brepeat again\b/gi, replace: 'repeat', reason: 'Repeat đã bao hàm "again".' },
  { id: 'clarity.return-back', pattern: /\breturn back\b/gi, replace: 'return', reason: 'Return đã bao hàm "back".' },
];

function matchCase(source, replacement) {
  if (!source) return replacement;
  if (source === source.toUpperCase() && source.length > 1) return replacement.toUpperCase();
  if (/^[A-Z]/.test(source)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function applyRules(text, language, rules, category, confidence, quotes) {
  const out = [];
  for (const segment of segmentText(String(text ?? ''))) {
    if (segment.type !== 'text') continue;
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(segment.value)) !== null) {
        const start = segment.start + match.index;
        const end = start + match[0].length;
        if (insideRanges(start, end, quotes)) continue;
        const replacement = matchCase(match[0], rule.replace);
        if (replacement === match[0]) continue;
        out.push(makeSuggestion(text, {
          category,
          kind: KIND.SUGGESTION,
          severity: SEVERITY.INFO,
          confidence,
          language,
          start,
          end,
          replacement,
          reason: rule.reason,
          ruleId: rule.id,
          source: 'deterministic-rule',
          preservationStatus: 'not_checked',
        }));
        if (match[0].length === 0) rule.pattern.lastIndex += 1;
      }
    }
  }
  return out;
}

/** Quan sát nhịp mở đầu câu, không tự sửa. */
function openingObservation(text, language) {
  const sentences = (String(text ?? '').match(/[^.!?…\n]+[.!?…]?/g) || [])
    .map(value => value.trim())
    .filter(value => value.length > 12);
  if (sentences.length < 6) return null;
  const counts = new Map();
  for (const sentence of sentences) {
    const first = (sentence.match(/^[\p{L}\p{N}]+/u) || [''])[0].toLowerCase();
    if (!first) continue;
    counts.set(first, (counts.get(first) || 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);
  if (!repeated.length) return null;
  return {
    id: 'clarity.repeated-opening',
    category: 'clarity',
    severity: 'info',
    title: 'Nhiều câu mở đầu giống nhau',
    message: `${repeated.length} từ mở đầu được lặp từ 3 câu trở lên (${repeated.slice(0, 3).map(([word, count]) => `${word}: ${count}`).join(' · ')}). Đây là quan sát nhịp điệu, không phải lỗi.`,
    language,
  };
}

/**
 * @param {string} text
 * @param {{language?:string}} [options]
 */
export function analyzeClarity(text, options = {}) {
  const source = String(text ?? '');
  const language = options.language || 'unknown';
  const quotes = quotedRanges(source);
  const suggestions = [
    ...applyRules(source, language, WORDY, CATEGORY.STYLE, 0.7, quotes),
    ...applyRules(source, language, REDUNDANT, CATEGORY.REDUNDANCY, 0.75, quotes),
  ];
  const observations = [];
  const opening = openingObservation(source, language);
  if (opening) observations.push(opening);
  return {
    schemaVersion: CLARITY_SCHEMA_VERSION,
    language,
    suggestions,
    observations,
    rules: WORDY.length + REDUNDANT.length,
    offsetSystem: 'utf16-source',
  };
}
