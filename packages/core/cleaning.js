/**
 * packages/core/cleaning.js — engine làm sạch deterministic dùng chung cho Web,
 * Extension và CLI.
 *
 * Nguyên tắc:
 *  - Chỉ sửa những gì giải thích được: ký tự vô hình, khoảng trắng lạ, kiểu chữ.
 *  - KHÔNG xoá mục trong danh sách, KHÔNG đảo phủ định, KHÔNG sửa câu.
 *  - Vùng có cấu trúc (URL, email, code fence, inline code, link Markdown,
 *    autolink) được bảo vệ nguyên byte, không chạy regex văn xuôi lên chúng.
 *  - ZWJ/ZWNJ/variation selector/emoji cờ mặc định được giữ (xem unicode.js).
 *  - Mọi thay đổi ghi vào audit kèm vị trí trong chuỗi gốc.
 */

import { clean as cleanUnicode, scan, classify } from './unicode.js';
import { splitMarkdown, stripMarkdown } from './markdown.js';

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const EMAIL_RE = /[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Nhãn vùng được bảo vệ, dùng cho UI/audit. */
export const PROTECTED_TYPES = Object.freeze(['code', 'inlineCode', 'link', 'autolink', 'url', 'email']);

/**
 * Tách văn bản thành đoạn chữ thường và đoạn được bảo vệ.
 * Không dùng regex văn xuôi trên đoạn bảo vệ.
 *
 * @param {string} text
 * @returns {Array<{type:'text'|'code'|'inlineCode'|'link'|'autolink'|'url'|'email', value:string, start:number, end:number}>}
 */
export function protectRegions(text) {
  const source = String(text ?? '');
  const spans = [];
  let offset = 0;
  for (const seg of splitMarkdown(source)) {
    const start = offset;
    offset += seg.value.length;
    if (seg.type !== 'text') spans.push({ type: seg.type, start, end: offset, value: seg.value });
  }

  const collect = (regex, type) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(source)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const inside = spans.some(s => start >= s.start && end <= s.end);
      if (!inside) spans.push({ type, start, end, value: m[0] });
      if (m.index === regex.lastIndex) regex.lastIndex += 1;
    }
  };
  collect(URL_RE, 'url');
  collect(EMAIL_RE, 'email');

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // chồng lấn: giữ span rộng hơn đứng trước
    kept.push(span);
    cursor = span.end;
  }
  return kept;
}

/** Tách văn bản thành các đoạn liền kề, đánh dấu đoạn nào được bảo vệ. */
export function segmentText(text) {
  const source = String(text ?? '');
  const spans = protectRegions(source);
  const out = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) out.push({ type: 'text', value: source.slice(at, span.start), start: at });
    out.push({ type: span.type, value: span.value, start: span.start });
    at = span.end;
  }
  if (at < source.length) out.push({ type: 'text', value: source.slice(at), start: at });
  return out;
}

function tidyProse(value) {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1');
}

/**
 * Làm sạch một đoạn chữ nhưng giữ nguyên khoảng trắng ở hai đầu.
 * Nếu bỏ bước này, "see " + URL sẽ dính thành "seehttps://…".
 */
function cleanProseStrict(value, options) {
  const head = (value.match(/^[ \t\n]+/) || [''])[0];
  const tail = (value.match(/[ \t\n]+$/) || [''])[0];
  const coreText = value.slice(head.length, value.length - tail.length);
  if (!coreText) return { text: value, log: {}, audit: [], warnings: [] };
  const result = cleanUnicode(coreText, options);
  return { ...result, text: head + tidyProse(result.text) + tail };
}

/**
 * Làm sạch văn bản an toàn.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.markdown=true] false = xoá marker Markdown (giữ nội dung)
 * @param {string} [options.emDash='comma'] 'comma' | 'hyphen' | 'space' | 'keep'
 * @param {boolean} [options.straightQuotes=true]
 * @param {boolean} [options.blankToSpace=true]
 * @param {boolean} [options.removeJoiners=false] chỉ khi người dùng chọn rõ
 * @param {boolean} [options.removeVariationSelectors=false]
 * @returns {{text:string, log:Record<string,number>, audit:Array<object>, warnings:string[],
 *   protectedRegions:number, stats:{vis:number,blank:number,pua:number,quotes:number,emdash:number,dbl:number}}}
 */
export function cleanText(text, options = {}) {
  const o = {
    markdown: true,
    emDash: 'comma',
    straightQuotes: true,
    blankToSpace: true,
    foldHomoglyphs: true,
    removeJoiners: false,
    removeVariationSelectors: false,
    ...options,
  };
  const source = String(text ?? '');
  let working = source;
  if (!o.markdown) working = stripMarkdown(working).text;

  const log = {};
  const warnings = [];
  const audit = [];
  let protectedRegions = 0;

  const bump = (key, n = 1) => { log[key] = (log[key] || 0) + n; };

  let out = '';
  for (const seg of segmentText(working)) {
    if (seg.type !== 'text') {
      protectedRegions += 1;
      bump('protected');
      out += seg.value;
      continue;
    }
    if (!seg.value) continue;
    const result = cleanProseStrict(seg.value, {
      blankToSpace: o.blankToSpace,
      foldHomoglyphs: o.foldHomoglyphs,
      straightQuotes: o.straightQuotes,
      emDash: o.emDash,
      removeJoiners: o.removeJoiners,
      removeVariationSelectors: o.removeVariationSelectors,
    });
    for (const [key, value] of Object.entries(result.log)) bump(key, value);
    for (const note of result.warnings) {
      if (!warnings.includes(note)) warnings.push(note);
    }
    // Vị trí audit phải tính theo chuỗi gốc, không theo đoạn.
    for (const entry of result.audit) audit.push({ ...entry, index: entry.index + seg.start });
    out += result.text;
  }

  out = out
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');

  return {
    text: out,
    log,
    audit,
    warnings,
    protectedRegions,
    stats: countsFor(out),
  };
}

/** Các cụm "tell" chỉ để ĐO, không bao giờ dùng để xoá. */
export const TELL_PATTERNS = Object.freeze([
  [/\bnot just\b[^.]{0,40}\bbut\b/gi, 'not just … but'],
  [/\bnot only\b[^.]{0,40}\bbut also\b/gi, 'not only … but also'],
  [/\brather than\b/gi, 'rather than'],
  [/\b(robust|seamless|scalable|cutting-edge|world-class|holistic|pivotal|vital|crucial|comprehensive|meticulous|passionate)\b/gi, 'marketing word'],
  [/\b(furthermore|moreover|additionally|ultimately|in conclusion)\b/gi, 'signpost'],
  [/\b(delve|tapestry|realm|journey)\b/gi, 'empty metaphor'],
]);

/**
 * Đếm đặc trưng để hiển thị trên UI. Không phải xác suất, không phải kết luận
 * về tác giả.
 */
export function countsFor(text) {
  const source = String(text ?? '');
  const rows = scan(source);
  const count = category => rows
    .filter(row => row.category === category)
    .reduce((n, row) => n + row.count, 0);
  let tells = 0;
  for (const [regex] of TELL_PATTERNS) {
    regex.lastIndex = 0;
    tells += (source.match(regex) || []).length;
  }
  return {
    vis: count('invisible') + count('tag') + count('bidi'),
    blank: count('blank'),
    pua: count('pua'),
    quotes: (source.match(/[\u201C\u201D\u2018\u2019\u00AB\u00BB]/g) || []).length,
    emdash: (source.match(/\u2014/g) || []).length,
    dbl: (source.match(/ {2,}/g) || []).length,
    tells,
    joinerKept: count('joiner'),
    vsKept: count('vs'),
  };
}

/** Phân loại nhanh một ký tự để UI/CLI hiển thị cùng một nhãn. */
export function categoryOf(ch) {
  return classify(ch, ch.codePointAt(0));
}
