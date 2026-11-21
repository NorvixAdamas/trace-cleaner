/**
 * packages/writing/engine/document.js — phân tích toàn tài liệu.
 *
 * Tái dùng `consistency.js` cho thuật ngữ/ngày/số/đơn vị, rồi thêm các phát
 * hiện hẹp: viết tắt không giải thích, câu lặp, mở đoạn lặp, cùng chủ thể với
 * giá trị số khác nhau. Không tự chọn bên nào là "đúng" khi có mâu thuẫn.
 */

import { analyzeConsistency } from '../consistency.js';
import { CATEGORY, SEVERITY } from '../suggestions.js';
import { splitSentences, splitParagraphs } from './readability.js';

export const DOCUMENT_SCHEMA_VERSION = '3.0';

const COMMON_ABBREVIATIONS = new Set([
  'AI', 'API', 'CSS', 'CSV', 'CLI', 'CPU', 'DB', 'DNS', 'FAQ', 'GPU', 'HTML', 'HTTP',
  'HTTPS', 'ID', 'JSON', 'KB', 'MB', 'GB', 'ML', 'NLP', 'OK', 'PDF', 'RAM', 'SDK',
  'SQL', 'UI', 'URL', 'UX', 'XML', 'ZIP', 'C2PA', 'PNG', 'JPEG', 'JPG',
  'USD', 'EUR', 'GBP', 'VND', 'JPY',
]);

function finding(spec) {
  return {
    id: spec.id,
    category: CATEGORY.CONSISTENCY,
    title: spec.title,
    message: spec.message,
    severity: spec.severity || SEVERITY.INFO,
    confidence: Number.isFinite(spec.confidence) ? spec.confidence : 0.5,
    evidence: Array.isArray(spec.evidence) ? spec.evidence.slice(0, 8) : [],
    source: 'deterministic-rule',
  };
}

function normalizeSentence(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
}

function abbreviations(source) {
  const counts = new Map();
  const re = /\b[A-Z][A-Z0-9]{1,5}\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    if (COMMON_ABBREVIATIONS.has(match[0])) continue;
    counts.set(match[0], (counts.get(match[0]) || 0) + 1);
  }
  const defined = new Set();
  const defineRe = /\b([A-Z][A-Z0-9]{1,5})\s*\([^)]{2,80}\)|\(([A-Z][A-Z0-9]{1,5})\)/g;
  while ((match = defineRe.exec(source)) !== null) defined.add(match[1] || match[2]);
  return [...counts.entries()]
    .filter(([value, count]) => count >= 2 && !defined.has(value) && !/^\d+$/.test(value))
    .map(([value, count]) => finding({
      id: `document.abbreviation.${value}`,
      title: `Viết tắt chưa giải thích: ${value}`,
      message: `“${value}” xuất hiện ${count} lần nhưng không có định nghĩa trong ngoặc. Nếu người đọc ngoài chuyên ngành, hãy giải thích lần đầu.`,
      confidence: 0.45,
    }));
}

function repeatedSentences(source) {
  const seen = new Map();
  for (const sentence of splitSentences(source)) {
    const key = normalizeSentence(sentence.text);
    if (key.length < 20) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(sentence);
  }
  return [...seen.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([key, list]) => finding({
      id: `document.repeated-sentence.${key.slice(0, 24)}`,
      title: 'Câu bị lặp nguyên văn',
      message: `Một câu dài ${list.length} lần xuất hiện nguyên văn. Kiểm tra xem đây là cố ý hay lỗi dán.`,
      confidence: 0.7,
      evidence: list.slice(0, 4).map(item => ({ start: item.start, end: item.end, text: item.text.slice(0, 100) })),
    }));
}

function repeatedIntroductions(source) {
  const paragraphs = splitParagraphs(source).filter(item => item.text.length > 40);
  if (paragraphs.length < 3) return [];
  const groups = new Map();
  for (const paragraph of paragraphs) {
    const key = normalizeSentence(paragraph.text).split(' ').slice(0, 4).join(' ');
    if (key.split(' ').length < 4) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(paragraph);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([key, list]) => finding({
      id: `document.repeated-introduction.${key.slice(0, 24)}`,
      title: 'Nhiều đoạn mở đầu giống nhau',
      message: `${list.length} đoạn bắt đầu bằng “${key}…”. Có thể là chủ ý hoặc phần mở đoạn bị lặp.`,
      confidence: 0.45,
      evidence: list.slice(0, 4).map(item => ({ start: item.start, end: item.end, text: item.text.slice(0, 100) })),
    }));
}

function numericClaims(source) {
  const claims = new Map();
  const re = /\b([A-Z][\p{L} -]{2,40}?)\s+(?:is|was|were|equals?|reached|total(?:ed|s)?)\s+(?:about\s+|approximately\s+)?(\d[\d.,]*)/gu;
  let match;
  while ((match = re.exec(source)) !== null) {
    const subject = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const value = match[2].replace(/[.,]$/, '');
    if (!claims.has(subject)) claims.set(subject, new Set());
    claims.get(subject).add(value);
  }
  return [...claims.entries()]
    .filter(([, values]) => values.size >= 2)
    .map(([subject, values]) => finding({
      id: `document.numeric-claim.${subject.slice(0, 24)}`,
      title: 'Cùng một chủ thể, giá trị số khác nhau',
      message: `“${subject}” được gán ${[...values].join(' / ')}. Không tự chọn giá trị đúng; cần người viết xác nhận.`,
      confidence: 0.4,
    }));
}

/**
 * @param {string} text
 * @param {{language?:string, maxFindings?:number}} [options]
 */
export function analyzeDocument(text, options = {}) {
  const source = String(text ?? '');
  const language = options.language || 'unknown';
  const consistency = analyzeConsistency(source, { language });
  const findings = [
    ...consistency.findings,
    ...abbreviations(source),
    ...repeatedSentences(source),
    ...repeatedIntroductions(source),
    ...numericClaims(source),
  ];
  const limit = Number.isInteger(options.maxFindings) ? options.maxFindings : 60;
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    language,
    findings: findings.slice(0, limit),
    suggestions: consistency.suggestions,
    stats: {
      findings: Math.min(findings.length, limit),
      suggestions: consistency.suggestions.length,
      checks: ['terminology', 'dates', 'numbers', 'units', 'abbreviations',
        'repeated-sentences', 'repeated-introductions', 'numeric-claims'],
    },
    limitations: [
      'Không tự kết luận mâu thuẫn nào đúng; mọi bất đồng số liệu chỉ được đánh dấu.',
      'Không đánh giá luận điểm có được chứng minh hay không — việc đó cần người đọc.',
    ],
    offsetSystem: 'utf16-source',
  };
}
