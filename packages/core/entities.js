/**
 * packages/core/entities.js — trích xuất thực thể cần bảo toàn.
 *
 * Đây là lớp deterministic: không gọi model, không đoán. Mục đích là phát hiện
 * khi một bản viết lại làm mất/đổi số, URL, email, ngày, trích dẫn, tên riêng.
 */

export const PATTERNS = Object.freeze({
  url: /\b(?:https?:\/\/|mailto:|www\.)[^\s<>"'`]+/gi,
  email: /[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g,
  version: /\b[vV]?\d+\.\d+(?:\.\d+)*(?:[-+][\w.]+)?\b/g,
  date: /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi,
  percentage: /\b\d+(?:[.,]\d+)?\s?(?:%|percent|phần\s+trăm)\b/gi,
  currency: /(?:[$€£¥]\s?\d[\d.,]*|\b\d[\d.,]*\s?(?:USD|EUR|GBP|VND|JPY|đ|₫)\b)/gi,
  citation: /\[\d+\]|\([A-Z][A-Za-z-]+(?:\s+(?:et\s+al\.?|&|and)\s*[A-Za-z-]*)?,?\s*\d{4}[a-z]?\)/g,
  quote: /"[^"\n]{1,400}"|“[^”\n]{1,400}”|«[^»\n]{1,400}»/g,
  acronym: /\b[A-Z][A-Z0-9]{1,7}\b/g,
  properNoun: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
  number: /(?<![\p{L}_])\d+(?:[.,]\d+)*(?:\s?(?:%|‰|percent|seconds?|secs?|ms|milliseconds?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|kg|mg|km|cm|mm|GB|MB|KB|TB|Hz|kHz|MHz|GHz|USD|EUR|GBP|VND|\$|€|£|¥|đ|₫))?/gu,
});

const STOP_ACRONYMS = new Set(['I', 'A', 'OK', 'AM', 'PM', 'THE', 'AND', 'BUT', 'NOT']);

const unique = list => [...new Set(list)];

/** Bỏ dấu câu dính cuối URL: "https://x.test/a," → "https://x.test/a". */
function stripUrlTail(value) {
  return value.replace(/[.,;:!?)\]}>'\"]+$/g, '');
}

/** Chuẩn hoá số để so sánh: bỏ khoảng trắng, unify dấu trừ, giữ dấu thập phân. */
export function normalizeNumber(value) {
  return String(value)
    .replace(/\u2212/g, '-')
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[.,]$/, '')
    .toLowerCase();
}

function findAll(text, pattern) {
  const out = [];
  pattern.lastIndex = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    out.push(m[0]);
    if (m.index === pattern.lastIndex) pattern.lastIndex += 1;
  }
  return out;
}

/**
 * @param {string} text
 * @returns {{urls:string[],emails:string[],versions:string[],dates:string[],percentages:string[],
 *   currencies:string[],citations:string[],quotes:string[],acronyms:string[],properNouns:string[],
 *   numbers:string[]}}
 */
export function extractEntities(text) {
  const source = String(text || '');
  const acronyms = findAll(source, PATTERNS.acronym).filter(a => !STOP_ACRONYMS.has(a));
  const numbers = findAll(source, PATTERNS.number).map(normalizeNumber).filter(Boolean);
  return {
    urls: unique(findAll(source, PATTERNS.url).map(stripUrlTail)),
    emails: unique(findAll(source, PATTERNS.email)),
    versions: unique(findAll(source, PATTERNS.version)),
    dates: unique(findAll(source, PATTERNS.date)),
    percentages: unique(findAll(source, PATTERNS.percentage)),
    currencies: unique(findAll(source, PATTERNS.currency)),
    citations: unique(findAll(source, PATTERNS.citation)),
    quotes: unique(findAll(source, PATTERNS.quote)),
    acronyms: unique(acronyms),
    properNouns: unique(findAll(source, PATTERNS.properNoun)),
    numbers,
  };
}

/** Đếm số lần xuất hiện của từng số (multiset). */
export function numberCounts(text) {
  const map = new Map();
  for (const n of extractEntities(text).numbers) map.set(n, (map.get(n) || 0) + 1);
  return map;
}

/** Các phần tử của một phép liệt kê "A, B, and C" (tối đa 3 mục). */
export function extractEnumerations(text) {
  const re = /([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3}),\s+([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3}),\s+(?:and|or|và|hoặc)\s+([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3})/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push([m[1].trim(), m[2].trim(), m[3].trim()]);
  }
  return out;
}

/** "from 4.2 seconds to 2.1 seconds" → cặp số theo đúng thứ tự. */
export function extractFromTo(text) {
  const re = /\bfrom\s+(\d+(?:[.,]\d+)*)\s*([A-Za-z%]*)\s+to\s+(\d+(?:[.,]\d+)*)\s*([A-Za-z%]*)/gi;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ from: normalizeNumber(m[1]), to: normalizeNumber(m[3]), unit: (m[2] || m[4] || '').toLowerCase() });
  }
  return out;
}

export const NEGATIONS = /\b(?:not|no|never|cannot|can't|don't|doesn't|didn't|won't|isn't|aren't|wasn't|weren't|without|unless|except|neither|nor|none|only|không|không\s+phải|chưa|chẳng|chớ|ngoại\s+trừ|trừ\s+khi|chỉ)\b/gi;
export const CONDITIONS = /\b(?:if|unless|when|whenever|provided|assuming|otherwise|nếu|trừ\s+khi|khi|miễn\s+là|với\s+điều\s+kiện)\b/gi;

export function tokenCounts(text, pattern) {
  const map = new Map();
  pattern.lastIndex = 0;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const key = m[0].toLowerCase().replace(/\s+/g, ' ');
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/** Thống kê cấu trúc Markdown để kiểm tra không bị làm phẳng. */
export function markdownStructure(text) {
  const source = String(text || '');
  return {
    headings: (source.match(/^[ \t]{0,3}#{1,6}[ \t]+\S/gm) || []).length,
    bullets: (source.match(/^[ \t]*[-*+][ \t]+\S/gm) || []).length,
    ordered: (source.match(/^[ \t]*\d{1,3}[.)][ \t]+\S/gm) || []).length,
    fences: (source.match(/^[ \t]*```/gm) || []).length,
    links: (source.match(/\[[^\]\n]+\]\([^)\n]+\)/g) || []).length,
    bold: (source.match(/\*\*[^*\n]+\*\*/g) || []).length,
    tables: (source.match(/^[ \t]*\|.*\|[ \t]*$/gm) || []).length,
  };
}
