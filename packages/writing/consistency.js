/**
 * packages/writing/consistency.js — nhất quán trên TOÀN tài liệu (2.3).
 *
 * Khác với grammar chạy từng đoạn: lớp này so sánh cách viết giữa các đoạn và
 * trả về finding kèm bằng chứng (offset + chuỗi thật). Không có finding nào tự
 * động sửa; những chỗ an toàn mới sinh thêm suggestion để người dùng duyệt.
 *
 * Nguyên tắc chống false positive: chỉ báo khi có ÍT NHẤT HAI cách viết cùng
 * tồn tại trong tài liệu. Một tài liệu dùng nhất quán một cách viết sẽ không bị
 * báo, kể cả khi cách đó không phải "chuẩn".
 */

import {
  CATEGORY, KIND, SEVERITY, makeSuggestion, sortSuggestions, suggestionStats,
} from './suggestions.js';

const MAX_EVIDENCE = 8;

const VARIANTS = [
  { id: 'consistency.email', forms: ['e-mail', 'email'] },
  { id: 'consistency.website', forms: ['web site', 'website'] },
  { id: 'consistency.login', forms: ['log in', 'login'] },
  { id: 'consistency.setup', forms: ['set up', 'setup'] },
  { id: 'consistency.dataset', forms: ['data set', 'dataset'] },
  { id: 'consistency.backend', forms: ['back end', 'backend'] },
  { id: 'consistency.frontend', forms: ['front end', 'frontend'] },
  { id: 'consistency.ecommerce', forms: ['e-commerce', 'ecommerce'] },
  { id: 'consistency.smartphone', forms: ['smart phone', 'smartphone'] },
  { id: 'consistency.internet', forms: ['internet', 'Internet'] },
];

const NUMERIC_THOUSANDS = [
  { id: 'consistency.thousands-comma', re: /\b\d{1,3}(?:,\d{3})+\b/g },
  { id: 'consistency.thousands-dot', re: /\b\d{1,3}(?:\.\d{3})+\b/g },
  { id: 'consistency.thousands-space', re: /\b\d{1,3}(?: \d{3})+\b/g },
];

const DATE_FORMATS = [
  { id: 'iso', re: /\b\d{4}-\d{2}-\d{2}\b/g },
  { id: 'slash', re: /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g },
  { id: 'month-name', re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/g },
];

const UNIT_RE = /\b\d+(?:[.,]\d+)?\s?(?:km|kg|cm|mm|GB|MB|KB|ms|TB|MHz|GHz|ml|kW|kWh)\b/g;
const ABBREVIATIONS = [
  { id: 'consistency.eg', dotted: 'e.g.', plain: 'eg' },
  { id: 'consistency.ie', dotted: 'i.e.', plain: 'ie' },
  { id: 'consistency.etc', dotted: 'etc.', plain: 'etc' },
];

function occurrences(source, needle, { word = true } = {}) {
  const out = [];
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = word
    ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu')
    : new RegExp(escaped, 'giu');
  let m;
  while ((m = reexec(pattern, source)) !== null && out.length < 200) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) break;
  }
  return out;
}

function reexec(pattern, source) {
  return pattern.exec(source);
}

function collectMatches(source, re, limit = 200) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(source)) !== null && out.length < limit) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

function finding(spec) {
  return {
    id: spec.id,
    category: CATEGORY.CONSISTENCY,
    title: spec.title,
    message: spec.message,
    severity: spec.severity || SEVERITY.INFO,
    confidence: Number.isFinite(spec.confidence) ? spec.confidence : 0.6,
    evidence: (spec.evidence || []).slice(0, MAX_EVIDENCE),
  };
}

function suggestionFrom(source, occurrence, replacement, spec) {
  return makeSuggestion(source, {
    category: CATEGORY.CONSISTENCY,
    kind: KIND.SUGGESTION,
    severity: SEVERITY.INFO,
    confidence: spec.confidence,
    language: spec.language,
    start: occurrence.start,
    end: occurrence.end,
    replacement,
    reason: spec.reason,
    ruleId: spec.ruleId,
  });
}

/**
 * @param {string} text
 * @param {{language?:string, maxFindings?:number}} [options]
 * @returns {{findings:Array<object>, suggestions:Array<object>, stats:object,
 *   schemaVersion:string, offsetSystem:string}}
 */
export function analyzeConsistency(text, options = {}) {
  const source = String(text ?? '');
  const language = options.language || 'unknown';
  const findings = [];
  const suggestions = [];

  // 1. Biến thể thuật ngữ đã biết (email/e-mail…).
  for (const variant of VARIANTS) {
    const groups = variant.forms.map(form => ({ form, hits: occurrences(source, form, { word: /\s/.test(form) || /^[a-z]/i.test(form) }) }));
    const present = groups.filter(group => group.hits.length > 0);
    if (present.length < 2) continue;
    const total = present.reduce((sum, group) => sum + group.hits.length, 0);
    const majority = present.reduce((best, group) => (group.hits.length > best.hits.length ? group : best), present[0]);
    findings.push(finding({
      id: `${variant.id}.mixed`,
      title: `Cách viết không nhất quán: ${present.map(group => `“${group.form}”`).join(' vs ')}`,
      message: `${present.map(group => `${group.form}: ${group.hits.length}`).join(' · ')}. Chọn một cách viết và dùng thống nhất.`,
      confidence: total >= 3 ? 0.7 : 0.5,
      evidence: present.flatMap(group => group.hits),
    }));
    for (const group of present) {
      if (group === majority) continue;
      for (const hit of group.hits.slice(0, 20)) {
        suggestions.push(suggestionFrom(source, hit, majority.form, {
          confidence: 0.45,
          language,
          ruleId: `${variant.id}.unify`,
          reason: `Tài liệu dùng “${majority.form}” ${majority.hits.length} lần; “${group.form}” ${group.hits.length} lần. Đây là lựa chọn nhất quán, không phải lỗi.`,
        }));
      }
    }
  }

  // 2. Viết hoa không nhất quán cho cùng một từ.
  const tokens = new Map();
  const tokenRe = /\b[A-Za-z][A-Za-z0-9+#._-]{2,}\b/g;
  let tokenMatch;
  while ((tokenMatch = tokenRe.exec(source)) !== null) {
    const value = tokenMatch[0];
    const key = value.toLowerCase();
    if (!tokens.has(key)) tokens.set(key, new Map());
    const forms = tokens.get(key);
    forms.set(value, (forms.get(value) || 0) + 1);
    if (tokens.size > 4000) break;
  }
  for (const [key, forms] of tokens) {
    if (forms.size < 2) continue;
    const entries = [...forms.entries()].filter(([form]) => /[A-Z]/.test(form) || /^[A-Z]{2,}$/.test(form));
    if (entries.length < 2) continue;
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    if (total < 3) continue;
    // Bỏ qua nếu khác biệt chỉ là chữ đầu câu (không đủ bằng chứng).
    const midSentence = entries.filter(([form]) => {
      const hit = occurrences(source, form, { word: true })[0];
      if (!hit) return false;
      const before = source.slice(Math.max(0, hit.start - 2), hit.start);
      return !/(^|[.!?]\s|\n)$/.test(before);
    });
    if (midSentence.length < 2) continue;
    findings.push(finding({
      id: `consistency.case.${key}`,
      title: `Viết hoa không nhất quán: ${midSentence.map(([form]) => form).join(' / ')}`,
      message: `Cùng một từ xuất hiện với ${midSentence.length} cách viết hoa khác nhau. Kiểm tra tên riêng/thuật ngữ.`,
      confidence: 0.55,
      evidence: midSentence.flatMap(([form]) => occurrences(source, form, { word: true }).slice(0, 3)),
    }));
  }

  // 3. Định dạng ngày.
  const dateGroups = DATE_FORMATS
    .map(format => ({ id: format.id, hits: collectMatches(source, format.re) }))
    .filter(group => group.hits.length);
  if (dateGroups.length >= 2) {
    findings.push(finding({
      id: 'consistency.date-format',
      title: 'Nhiều định dạng ngày trong cùng tài liệu',
      message: `${dateGroups.map(group => `${group.id}: ${group.hits.length}`).join(' · ')}. Nên chọn một định dạng; lưu ý dd/mm và mm/dd có thể bị đọc nhầm.`,
      confidence: 0.65,
      evidence: dateGroups.flatMap(group => group.hits.slice(0, 3)),
    }));
  }

  // 4. Định dạng số/thousands separator.
  const numberGroups = NUMERIC_THOUSANDS
    .map(format => ({ id: format.id, hits: collectMatches(source, format.re) }))
    .filter(group => group.hits.length);
  if (numberGroups.length >= 2) {
    findings.push(finding({
      id: 'consistency.number-format',
      title: 'Cách viết số không nhất quán',
      message: `${numberGroups.map(group => `${group.id.replace('consistency.', '')}: ${group.hits.length}`).join(' · ')}. Dùng một quy ước để tránh hiểu nhầm 1,000 / 1.000.`,
      confidence: 0.6,
      evidence: numberGroups.flatMap(group => group.hits.slice(0, 3)),
    }));
  }

  // 5. Đơn vị đo: dính hay có khoảng trắng.
  const unitHits = collectMatches(source, UNIT_RE);
  const spaced = unitHits.filter(hit => /\s/.test(hit.text));
  const attached = unitHits.filter(hit => !/\s/.test(hit.text));
  if (spaced.length && attached.length) {
    const majority = spaced.length >= attached.length ? 'spaced' : 'attached';
    findings.push(finding({
      id: 'consistency.unit-style',
      title: 'Cách viết đơn vị không nhất quán',
      message: `Có ${spaced.length} chỗ viết "10 km" và ${attached.length} chỗ viết "10km".`,
      confidence: 0.6,
      evidence: [...spaced.slice(0, 3), ...attached.slice(0, 3)],
    }));
    for (const hit of (majority === 'spaced' ? attached : spaced).slice(0, 20)) {
      const replacement = majority === 'spaced'
        ? hit.text.replace(/^(\d+(?:[.,]\d+)?)\s*/, '$1 ')
        : hit.text.replace(/^(\d+(?:[.,]\d+)?)\s+/, '$1');
      if (replacement !== hit.text) {
        suggestions.push(suggestionFrom(source, hit, replacement, {
          confidence: 0.4,
          language,
          ruleId: 'consistency.unit-style.unify',
          reason: `Đa số dùng dạng ${majority === 'spaced' ? 'có khoảng trắng' : 'dính liền'}. Đây là lựa chọn nhất quán.`,
        }));
      }
    }
  }

  // 6. Viết tắt có/không có dấu chấm.
  for (const abbreviation of ABBREVIATIONS) {
    const dotted = occurrences(source, abbreviation.dotted, { word: false });
    const plain = occurrences(source, abbreviation.plain, { word: true })
      .filter(hit => !hit.text.endsWith('.'));
    if (!dotted.length || !plain.length) continue;
    findings.push(finding({
      id: `${abbreviation.id}.mixed`,
      title: `Viết tắt không nhất quán: ${abbreviation.dotted} / ${abbreviation.plain}`,
      message: `${dotted.length} lần có dấu chấm, ${plain.length} lần không.`,
      confidence: 0.6,
      evidence: [...dotted.slice(0, 3), ...plain.slice(0, 3)],
    }));
    for (const hit of plain.slice(0, 10)) {
      suggestions.push(suggestionFrom(source, hit, abbreviation.dotted, {
        confidence: 0.45,
        language,
        ruleId: `${abbreviation.id}.unify`,
        reason: `Tài liệu cũng dùng “${abbreviation.dotted}”. Chọn một cách viết.`,
      }));
    }
  }

  // 7. Heading: có/không dấu hai chấm cuối, hoặc có/không đánh số.
  const headings = [];
  const headingRe = /^(#{1,6})[ \t]+(.+)$/gm;
  let headingMatch;
  while ((headingMatch = headingRe.exec(source)) !== null) {
    headings.push({
      start: headingMatch.index,
      end: headingMatch.index + headingMatch[0].length,
      text: headingMatch[2].trim(),
      level: headingMatch[1].length,
    });
  }
  if (headings.length >= 3) {
    const withColon = headings.filter(item => /[:：]$/.test(item.text));
    if (withColon.length && withColon.length < headings.length) {
      findings.push(finding({
        id: 'consistency.heading-colon',
        title: 'Heading dùng dấu hai chấm không đồng nhất',
        message: `${withColon.length}/${headings.length} heading kết thúc bằng dấu hai chấm.`,
        confidence: 0.45,
        evidence: withColon.slice(0, MAX_EVIDENCE),
      }));
    }
    const numbered = headings.filter(item => /^\d+[.)]\s/.test(item.text));
    if (numbered.length && numbered.length < headings.length) {
      findings.push(finding({
        id: 'consistency.heading-numbering',
        title: 'Heading đánh số không đồng nhất',
        message: `${numbered.length}/${headings.length} heading có số thứ tự.`,
        confidence: 0.4,
        evidence: numbered.slice(0, MAX_EVIDENCE),
      }));
    }
  }

  // 8. Trích dẫn cong và thẳng lẫn lộn.
  const curly = collectMatches(source, /[“”]/g);
  const straight = collectMatches(source, /"/g);
  if (curly.length && straight.length) {
    findings.push(finding({
      id: 'consistency.quote-style',
      title: 'Trộn dấu trích dẫn cong và thẳng',
      message: `${curly.length} dấu cong, ${straight.length} dấu thẳng.`,
      confidence: 0.5,
      evidence: [...curly.slice(0, 3), ...straight.slice(0, 3)],
    }));
  }

  const maxFindings = Number.isInteger(options.maxFindings) ? options.maxFindings : 40;
  const limited = findings.slice(0, maxFindings);
  const sorted = sortSuggestions(suggestions).slice(0, 200);
  return {
    findings: limited,
    suggestions: sorted,
    stats: {
      ...suggestionStats(sorted),
      findings: limited.length,
      byCheck: limited.reduce((acc, item) => {
        const key = item.id.split('.').slice(0, 2).join('.');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    },
    schemaVersion: '1.0',
    offsetSystem: 'utf16-source',
  };
}
