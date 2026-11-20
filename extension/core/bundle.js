/* AUTO-GENERATED from packages/core — chạy: node tools/sync_assets.js
   Không sửa tay. Bundle này là bản classic-script của core cho content script
   và side panel; tests/extension-bundle.test.js so sánh hành vi với core. */
(function () {
'use strict';
const __modules = Object.create(null);
const __cache = Object.create(null);
function __require(name) {
  if (__cache[name]) return __cache[name];
  const factory = __modules[name];
  if (!factory) throw new Error('core module chưa có trong bundle: ' + name);
  const exports = __cache[name] = Object.create(null);
  factory(exports);
  return exports;
}
__modules["unicode.js"] = function (__exports) {
'use strict';
/**
 * packages/core/unicode.js — Unicode hygiene engine.
 *
 * Đây là nguồn duy nhất cho bảng phân loại codepoint. Python CLI
 * (tools/trace_scan.py) phải giữ bảng tương đương; tests/parity.test.js
 * so sánh hai bên trên cùng fixture.
 *
 * Nguyên tắc:
 *  - Mặc định KHÔNG xoá ZWJ/ZWNJ/variation selector: chúng bắt buộc trong
 *    tiếng Ả Rập, Indic và emoji gia đình.
 *  - Tag char của emoji cờ (🏴 + U+E0067…) được giữ, vì xoá sẽ phá emoji.
 *  - Mọi thay đổi đều ghi vào audit: vị trí, codepoint, hành động, lý do.
 */

const BLANK_CODE_POINTS = Object.freeze([
  0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000,
]);

/** Ký tự vô hình nên xoá (không gồm joiner/variation selector/bidi). */
const INVISIBLE_CODE_POINTS = Object.freeze([
  0x200b, 0x2060, 0xfeff, 0x00ad, 0x180e,
  0x2061, 0x2062, 0x2063, 0x2064,
  0x200e, 0x200f, 0x061c,
]);

/** Bidi control làm đảo chiều hiển thị. */
const BIDI_CODE_POINTS = Object.freeze([
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069,
]);

/** Homoglyph Cyrillic/Greek và dấu gạch nhìn giống ASCII. */
const HOMOGLYPHS = Object.freeze({
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c',
  '\u0445': 'x', '\u0443': 'y', '\u0455': 's', '\u0456': 'i', '\u0458': 'j',
  '\u04bb': 'h', '\u0501': 'd', '\u043a': 'k', '\u043c': 'm', '\u043d': 'h',
  '\u0442': 't', '\u0432': 'b', '\u0433': 'r',
  '\u03bf': 'o', '\u03bd': 'v', '\u03b1': 'a', '\u03b9': 'i', '\u03ba': 'k',
  '\u03c1': 'p', '\u03c5': 'u', '\u0131': 'i',
  '\u2010': '-', '\u2011': '-', '\u2212': '-',
});

const NAMES = Object.freeze({
  0x00a0: 'NO-BREAK SPACE',
  0x1680: 'OGHAM SPACE MARK',
  0x2000: 'EN QUAD',
  0x2001: 'EM QUAD',
  0x2002: 'EN SPACE',
  0x2003: 'EM SPACE',
  0x2004: 'THREE-PER-EM SPACE',
  0x2005: 'FOUR-PER-EM SPACE',
  0x2006: 'SIX-PER-EM SPACE',
  0x2007: 'FIGURE SPACE',
  0x2008: 'PUNCTUATION SPACE',
  0x2009: 'THIN SPACE',
  0x200a: 'HAIR SPACE',
  0x202f: 'NARROW NO-BREAK SPACE',
  0x205f: 'MEDIUM MATHEMATICAL SPACE',
  0x3000: 'IDEOGRAPHIC SPACE',
  0x200b: 'ZERO WIDTH SPACE',
  0x200c: 'ZERO WIDTH NON-JOINER',
  0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK',
  0x200f: 'RIGHT-TO-LEFT MARK',
  0x061c: 'ARABIC LETTER MARK',
  0x2060: 'WORD JOINER',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE / BOM',
  0x00ad: 'SOFT HYPHEN',
  0x180e: 'MONGOLIAN VOWEL SEPARATOR',
  0x2061: 'FUNCTION APPLICATION',
  0x2062: 'INVISIBLE TIMES',
  0x2063: 'INVISIBLE SEPARATOR',
  0x2064: 'INVISIBLE PLUS',
  0x2066: 'LEFT-TO-RIGHT ISOLATE',
  0x2067: 'RIGHT-TO-LEFT ISOLATE',
  0x2068: 'FIRST STRONG ISOLATE',
  0x2069: 'POP DIRECTIONAL ISOLATE',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING',
  0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING',
  0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE',
  0x2010: 'HYPHEN',
  0x2011: 'NON-BREAKING HYPHEN',
  0x2013: 'EN DASH',
  0x2014: 'EM DASH',
  0x2018: 'LEFT SINGLE QUOTATION MARK',
  0x2019: 'RIGHT SINGLE QUOTATION MARK',
  0x201c: 'LEFT DOUBLE QUOTATION MARK',
  0x201d: 'RIGHT DOUBLE QUOTATION MARK',
  0x2026: 'HORIZONTAL ELLIPSIS',
  0x2028: 'LINE SEPARATOR',
  0x2029: 'PARAGRAPH SEPARATOR',
  0x0085: 'NEXT LINE (NEL)',
  0xfe0e: 'VARIATION SELECTOR-15',
  0xfe0f: 'VARIATION SELECTOR-16',
});

const INVISIBLE = new Set(INVISIBLE_CODE_POINTS);
const BIDI = new Set(BIDI_CODE_POINTS);
const BLANKS = new Set(BLANK_CODE_POINTS);
const PUNCT = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d,
  0x2026, 0x00ab, 0x00bb, 0x00b4, 0x02bc,
]);

const SEVERITY = Object.freeze({
  tag: 'security',
  pua: 'security',
  invisible: 'high',
  bidi: 'high',
  homoglyph: 'high',
  blank: 'medium',
  linesep: 'medium',
  joiner: 'low',
  vs: 'low',
  punct: 'info',
  emoji: 'info',
  other: 'info',
});

const ACTION = Object.freeze({
  tag: 'remove — prompt injection / ASCII smuggling',
  pua: 'remove — private use area',
  invisible: 'remove',
  bidi: 'remove — display reordering',
  homoglyph: 'fold to Latin',
  blank: 'replace with space',
  linesep: 'replace with newline',
  joiner: 'keep — required by Arabic/Indic/emoji',
  vs: 'keep — emoji presentation',
  punct: 'optional typography',
  emoji: 'keep',
  other: 'keep',
});

const ACTIONABLE = Object.freeze(['tag', 'pua', 'invisible', 'bidi', 'homoglyph']);

const hex = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * Phân loại một codepoint.
 * @param {string} ch ký tự (có thể là surrogate pair)
 * @param {number} [cp] codepoint
 * @returns {string} category
 */
function classify(ch, cp = ch.codePointAt(0)) {
  if (cp < 0x80) return 'other';
  if (BLANKS.has(cp)) return 'blank';
  if (BIDI.has(cp)) return 'bidi';
  if (INVISIBLE.has(cp)) return 'invisible';
  if (cp === 0x200c || cp === 0x200d) return 'joiner';
  if (cp >= 0xe0020 && cp <= 0xe007f) return 'tag';
  if ((cp >= 0xe000 && cp <= 0xf8ff) || cp >= 0xf0000) return 'pua';
  if (cp >= 0xfe00 && cp <= 0xfe0f) return 'vs';
  if ((cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf)) return 'emoji';
  if (cp === 0x2028 || cp === 0x2029 || cp === 0x0085) return 'linesep';
  if (HOMOGLYPHS[ch]) return 'homoglyph';
  if (PUNCT.has(cp)) return 'punct';
  return 'other';
}

/** Tag char hợp lệ trong chuỗi emoji cờ (chữ, số, cancel tag). */
function isFlagTag(cp) {
  return (cp >= 0xe0030 && cp <= 0xe0039)
    || (cp >= 0xe0061 && cp <= 0xe007a)
    || cp === 0xe007f;
}

/** Tag char ngay sau 🏴 là một phần của emoji cờ, không phải payload. */
function isFlagSequence(source, index) {
  const before = Array.from(source.slice(0, index));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const cp = before[i].codePointAt(0);
    if (cp >= 0xe0020 && cp <= 0xe007f) continue;
    return cp === 0x1f3f4;
  }
  return false;
}

function nameOf(ch, cp = ch.codePointAt(0)) {
  if (HOMOGLYPHS[ch]) return `LOOKALIKE of '${HOMOGLYPHS[ch]}' (Cyrillic/Greek)`;
  return NAMES[cp] || hex(cp);
}

/**
 * Quét toàn văn, gộp theo codepoint.
 * @returns {Array<{cp:number,hex:string,name:string,category:string,severity:string,action:string,count:number,positions:number[],flag:boolean}>}
 */
function scan(text) {
  const rows = new Map();
  let index = 0;
  let inFlag = false;
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0);
    const category = classify(ch, cp);
    const start = index;
    index += ch.length;
    if (category === 'tag') {
      const flag = (inFlag && isFlagTag(cp)) || isFlagSequence(text, start);
      inFlag = flag;
      if (flag) {
        const existing = rows.get(cp);
        if (!existing) {
          rows.set(cp, {
            cp,
            hex: hex(cp),
            name: nameOf(ch, cp),
            category,
            severity: SEVERITY[category],
            action: ACTION[category],
            count: 1,
            positions: [start],
            flag: true,
          });
        } else {
          existing.count += 1;
          existing.flag = true;
          if (existing.positions.length < 20) existing.positions.push(start);
        }
        continue;
      }
    } else {
      inFlag = false;
    }
    if (category === 'other' || category === 'emoji') continue;
    let row = rows.get(cp);
    if (!row) {
      row = {
        cp,
        hex: hex(cp),
        name: nameOf(ch, cp),
        category,
        severity: SEVERITY[category],
        action: ACTION[category],
        count: 0,
        positions: [],
        flag: false,
      };
      rows.set(cp, row);
    }
    row.count += 1;
    if (category === 'tag' && isFlagSequence(text, start)) row.flag = true;
    if (row.positions.length < 20) row.positions.push(start);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.cp - b.cp);
}

/**
 * Làm sạch văn bản, có audit từng ký tự.
 * @param {string} text
 * @param {object} [options]
 * @returns {{text:string, log:Record<string,number>, audit:Array<object>, warnings:string[]}}
 */
function clean(text, options = {}) {
  const o = {
    normalize: 'NFC',
    blankToSpace: true,
    foldHomoglyphs: true,
    straightQuotes: true,
    emDash: 'comma',
    removeJoiners: false,
    removeVariationSelectors: false,
    ...options,
  };
  const source = o.normalize ? text.normalize(o.normalize) : text;
  const audit = [];
  const warnings = [];
  const log = {};
  let out = '';
  let index = 0;
  let lastKept = '';
  let inFlag = false;

  const record = (category, action, replacement, reason, cp, ch, at) => {
    audit.push({
      index: at,
      codePoint: cp,
      hex: hex(cp),
      char: ch,
      category,
      action,
      replacement,
      reason,
    });
  };
  const bump = key => { log[key] = (log[key] || 0) + 1; };

  for (const ch of source) {
    const cp = ch.codePointAt(0);
    const category = classify(ch, cp);
    const at = index;
    index += ch.length;

    if (category === 'tag') {
      const flag = (inFlag && isFlagTag(cp)) || isFlagSequence(source, at);
      inFlag = flag;
      if (flag) {
        bump('flagKept');
        record(category, 'kept', ch, 'part of emoji flag sequence', cp, ch, at);
        out += ch;
        lastKept = ch;
        continue;
      }
      bump('security');
      record(category, 'removed', '', 'tag characters can hide instructions', cp, ch, at);
      continue;
    }
    if (category === 'pua') {
      bump('security');
      record(category, 'removed', '', 'private use area', cp, ch, at);
      continue;
    }
    if (category === 'invisible') {
      bump(cp === 0x00ad ? 'softHyphen' : 'invisible');
      record(category, 'removed', '', 'invisible character', cp, ch, at);
      continue;
    }
    if (category === 'bidi') {
      bump('bidi');
      record(category, 'removed', '', 'bidi control reorders displayed text', cp, ch, at);
      continue;
    }
    if (category === 'blank') {
      bump('blank');
      const replacement = o.blankToSpace ? ' ' : ch;
      record(category, o.blankToSpace ? 'replaced' : 'kept', replacement, 'unusual space', cp, ch, at);
      out += replacement;
      lastKept = replacement;
      continue;
    }
    if (category === 'joiner') {
      if (o.removeJoiners) {
        bump('joinerRemoved');
        record(category, 'removed', '', 'explicitly requested', cp, ch, at);
      } else {
        bump('joinerKept');
        out += ch;
        lastKept = ch;
      }
      continue;
    }
    if (category === 'vs') {
      if (o.removeVariationSelectors) {
        bump('vsRemoved');
        record(category, 'removed', '', 'explicitly requested', cp, ch, at);
      } else {
        bump('vsKept');
        out += ch;
        lastKept = ch;
      }
      continue;
    }
    if (category === 'linesep') {
      bump('lineSep');
      record(category, 'replaced', '\n', 'line/paragraph separator', cp, ch, at);
      out += '\n';
      lastKept = '\n';
      continue;
    }
    if (category === 'homoglyph') {
      bump('homoglyph');
      const replacement = o.foldHomoglyphs ? HOMOGLYPHS[ch] : ch;
      record(category, o.foldHomoglyphs ? 'replaced' : 'kept', replacement, 'lookalike character', cp, ch, at);
      out += replacement;
      lastKept = replacement;
      continue;
    }
    if (category === 'punct') {
      if (cp === 0x2014) {
        bump('emDash');
        const replacement = { comma: ', ', hyphen: ' - ', space: ' ', keep: ch }[o.emDash] ?? ', ';
        record(category, o.emDash === 'keep' ? 'kept' : 'replaced', replacement, 'em dash', cp, ch, at);
        out += replacement;
        lastKept = replacement;
      } else if (cp === 0x2013) {
        bump('enDash');
        const replacement = o.emDash === 'keep' ? ch : '-';
        record(category, o.emDash === 'keep' ? 'kept' : 'replaced', replacement, 'en dash', cp, ch, at);
        out += replacement;
        lastKept = replacement;
      } else if (cp === 0x2026) {
        bump('ellipsis');
        const replacement = o.straightQuotes ? '...' : ch;
        record(category, 'replaced', replacement, 'ellipsis', cp, ch, at);
        out += replacement;
        lastKept = replacement;
      } else {
        bump('quotes');
        let replacement = ch;
        if (o.straightQuotes) {
          if (cp === 0x2018 || cp === 0x2019 || cp === 0x00b4 || cp === 0x02bc) replacement = "'";
          else replacement = '"';
        }
        record(category, replacement === ch ? 'kept' : 'replaced', replacement, 'typographic quote', cp, ch, at);
        out += replacement;
        lastKept = replacement;
      }
      continue;
    }

    inFlag = false;
    out += ch;
    lastKept = ch;
  }

  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?![ \t\n*_`)\]}\/])/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '');

  if (log.flagKept) warnings.push('Giữ tag char của emoji cờ (🏴) — xoá sẽ phá emoji.');
  if (log.joinerKept) warnings.push('Giữ ZWJ/ZWNJ — cần cho Ả Rập/Indic/emoji.');
  void lastKept;

  return { text: out, log, audit, warnings };
}

/** Đếm nhanh để hiển thị (không dùng cho kết luận tác giả). */
function summary(text) {
  const rows = scan(text);
  return {
    codepoints: rows.length,
    actionable: rows.filter(r => ACTIONABLE.includes(r.category)).reduce((n, r) => n + r.count, 0),
    bySeverity: rows.reduce((acc, r) => {
      acc[r.severity] = (acc[r.severity] || 0) + r.count;
      return acc;
    }, {}),
  };
}

Object.assign(__exports, { BLANK_CODE_POINTS, INVISIBLE_CODE_POINTS, BIDI_CODE_POINTS, HOMOGLYPHS, NAMES, SEVERITY, ACTION, ACTIONABLE, classify, isFlagTag, isFlagSequence, nameOf, scan, clean, summary });
};

__modules["entities.js"] = function (__exports) {
'use strict';
/**
 * packages/core/entities.js — trích xuất thực thể cần bảo toàn.
 *
 * Đây là lớp deterministic: không gọi model, không đoán. Mục đích là phát hiện
 * khi một bản viết lại làm mất/đổi số, URL, email, ngày, trích dẫn, tên riêng.
 */

const PATTERNS = Object.freeze({
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
function normalizeNumber(value) {
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
function extractEntities(text) {
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
function numberCounts(text) {
  const map = new Map();
  for (const n of extractEntities(text).numbers) map.set(n, (map.get(n) || 0) + 1);
  return map;
}

/** Các phần tử của một phép liệt kê "A, B, and C" (tối đa 3 mục). */
function extractEnumerations(text) {
  const re = /([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3}),\s+([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3}),\s+(?:and|or|và|hoặc)\s+([A-Z][\w.+#-]*(?:\s+[A-Za-z][\w.+#-]*){0,3})/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push([m[1].trim(), m[2].trim(), m[3].trim()]);
  }
  return out;
}

/** "from 4.2 seconds to 2.1 seconds" → cặp số theo đúng thứ tự. */
function extractFromTo(text) {
  const re = /\bfrom\s+(\d+(?:[.,]\d+)*)\s*([A-Za-z%]*)\s+to\s+(\d+(?:[.,]\d+)*)\s*([A-Za-z%]*)/gi;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ from: normalizeNumber(m[1]), to: normalizeNumber(m[3]), unit: (m[2] || m[4] || '').toLowerCase() });
  }
  return out;
}

const NEGATIONS = /\b(?:not|no|never|cannot|can't|don't|doesn't|didn't|won't|isn't|aren't|wasn't|weren't|without|unless|except|neither|nor|none|only|không|không\s+phải|chưa|chẳng|chớ|ngoại\s+trừ|trừ\s+khi|chỉ)\b/gi;
const CONDITIONS = /\b(?:if|unless|when|whenever|provided|assuming|otherwise|nếu|trừ\s+khi|khi|miễn\s+là|với\s+điều\s+kiện)\b/gi;

function tokenCounts(text, pattern) {
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
function markdownStructure(text) {
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

Object.assign(__exports, { PATTERNS, normalizeNumber, extractEntities, numberCounts, extractEnumerations, extractFromTo, NEGATIONS, CONDITIONS, tokenCounts, markdownStructure });
};

__modules["markdown.js"] = function (__exports) {
'use strict';
/**
 * packages/core/markdown.js — tách văn bản Markdown thành đoạn để chỉ sửa phần chữ.
 *
 * Không phải parser Markdown đầy đủ (dự án chưa dùng thư viện nào); đủ để bảo
 * vệ code fence, code span, link và autolink khỏi các phép biến đổi regex.
 */

const FENCE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]+`/g;
const LINK = /!?\[[^\]\n]*\]\([^)\n]*\)/g;
const AUTOLINK = /<(?:https?:\/\/|mailto:)[^>\s]+>/g;

/**
 * @param {string} text
 * @returns {Array<{type:'text'|'code'|'inlineCode'|'link'|'autolink', value:string}>}
 */
function splitMarkdown(text) {
  const source = String(text ?? '');
  const spans = [];
  const collect = (regex, type) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(source)) !== null) {
      spans.push({ start: m.index, end: m.index + m[0].length, type, value: m[0] });
      if (m.index === regex.lastIndex) regex.lastIndex += 1;
    }
  };
  collect(FENCE, 'code');
  collect(INLINE_CODE, 'inlineCode');
  collect(LINK, 'link');
  collect(AUTOLINK, 'autolink');

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // nằm trong đoạn đã giữ
    kept.push(span);
    cursor = span.end;
  }

  const out = [];
  let at = 0;
  for (const span of kept) {
    if (span.start > at) out.push({ type: 'text', value: source.slice(at, span.start) });
    out.push({ type: span.type, value: span.value });
    at = span.end;
  }
  if (at < source.length) out.push({ type: 'text', value: source.slice(at) });
  return out;
}

/**
 * Chỉ áp dụng `transform` lên các đoạn chữ thường; code/link giữ nguyên bytes.
 * @param {string} text
 * @param {(text:string)=>string} transform
 */
function transformProse(text, transform) {
  return splitMarkdown(text)
    .map(seg => (seg.type === 'text' ? transform(seg.value) : seg.value))
    .join('');
}

function countStructure(text) {
  const source = String(text ?? '');
  return {
    headings: (source.match(/^[ \t]{0,3}#{1,6}[ \t]+\S/gm) || []).length,
    bullets: (source.match(/^[ \t]*[-*+][ \t]+\S/gm) || []).length,
    fences: (source.match(/^[ \t]*```/gm) || []).length,
    links: (source.match(/\[[^\]\n]+\]\([^)\n]+\)/g) || []).length,
  };
}

/** Xoá marker, giữ nội dung; code fence giữ nguyên code bên trong. */
function stripMarkdown(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  let removed = 0;
  let out = source.replace(FENCE, block => {
    removed += 1;
    return block.replace(/^[ \t]*```[^\n]*\n?/gm, '').replace(/^[ \t]*```[ \t]*$/gm, '').replace(/\n{2,}/g, '\n');
  });
  out = out.replace(LINK, (match, offset, whole) => {
    removed += 1;
    const label = match.replace(/^!?\[/, '').replace(/\]\([^)]*\)$/, '');
    const url = (match.match(/\]\(([^)]*)\)$/) || [])[1] || '';
    if (label === url) return label;
    void whole;
    void offset;
    return url ? `${label} (${url})` : label;
  });
  out = out
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]{0,3}>[ \t]?/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]*[-*+][ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]*\d{1,3}[.)][ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/\*\*([^*\n]+)\*\*/g, (m, inner) => { removed += 1; return inner; })
    .replace(/__([^_\n]+)__/g, (m, inner) => { removed += 1; return inner; })
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, (m, pre, inner) => { removed += 1; return pre + inner; })
    .replace(/`([^`\n]+)`/g, (m, inner) => { removed += 1; return inner; })
    .replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, () => { removed += 1; return ''; });
  out = out
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
  return { text: out, removed };
}

Object.assign(__exports, { splitMarkdown, transformProse, countStructure, stripMarkdown });
};

__modules["preservation.js"] = function (__exports) {
'use strict';
/**
 * packages/core/preservation.js — kiểm tra bảo toàn nội dung sau khi viết lại.
 *
 * Chạy SAU mỗi phản hồi model, độc lập với prompt. Không có nghĩa là "bản viết
 * lại đúng": đây là các kiểm tra deterministic (số, URL, email, ngày, phủ định,
 * điều kiện, trích dẫn, cấu trúc Markdown, liệt kê). Kiểm tra ngữ nghĩa sâu
 * luôn trả `not_checked` để không tạo cảm giác an toàn giả.
 */

const { extractEntities, numberCounts, extractEnumerations, extractFromTo, tokenCounts, markdownStructure, NEGATIONS, CONDITIONS } = __require("entities.js");

const PASSED = 'passed';
const WARNING = 'warning';
const FAILED = 'failed';
const NOT_CHECKED = 'not_checked';

const words = text => (String(text).trim().match(/\S+/g) || []).length;

function diffMissing(expected, found, keyOf = v => v) {
  const pool = new Map();
  for (const item of found) {
    const key = keyOf(item);
    pool.set(key, (pool.get(key) || 0) + 1);
  }
  const missing = [];
  for (const item of expected) {
    const key = keyOf(item);
    const n = pool.get(key) || 0;
    if (n === 0) missing.push(item);
    else pool.set(key, n - 1);
  }
  return missing;
}

/**
 * @param {string} original văn bản người dùng đưa vào
 * @param {string} proposed văn bản model/cleaner trả ra
 * @param {{markdown?:boolean, minLengthRatio?:number, maxLengthRatio?:number, strict?:boolean}} [options]
 */
function checkPreservation(original, proposed, options = {}) {
  const o = {
    markdown: true,
    minLengthRatio: 0.55,
    maxLengthRatio: 1.45,
    strict: false,
    ...options,
  };
  const src = String(original ?? '');
  const out = String(proposed ?? '');
  const issues = [];
  const preservation = {};
  const checksRun = [];
  const before = extractEntities(src);
  const after = extractEntities(out);

  const run = (key, fn) => {
    checksRun.push(key);
    preservation[key] = PASSED;
    fn();
  };
  const report = (key, severity, code, detail, extra = {}) => {
    issues.push({ check: key, severity, code, detail, ...extra });
    if (severity === 'failed') preservation[key] = FAILED;
    else if (severity === 'warning' && preservation[key] !== FAILED) preservation[key] = WARNING;
  };

  run('numbers', () => {
    const expected = numberCounts(src);
    const found = numberCounts(out);
    const missing = [];
    for (const [value, count] of expected) {
      const got = found.get(value) || 0;
      for (let i = got; i < count; i += 1) missing.push(value);
    }
    if (missing.length) {
      report('numbers', 'failed', 'number_missing', `Mất ${missing.length} giá trị số.`, {
        expected: missing.slice(0, 12),
      });
    }
    for (const pair of extractFromTo(src)) {
      const relation = new RegExp(
        `from\\s+${pair.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,60}?to\\s+${pair.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i',
      );
      const reversed = new RegExp(
        `from\\s+${pair.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]{0,60}?to\\s+${pair.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'i',
      );
      if (reversed.test(out) && !relation.test(out)) {
        report('numbers', 'failed', 'numeric_relation_reversed',
          `Chiều so sánh bị đảo: "${pair.from} → ${pair.to}".`, pair);
      }
    }
  });

  run('urls', () => {
    const missing = diffMissing(before.urls, after.urls);
    if (missing.length) {
      report('urls', 'failed', 'url_missing', `Mất ${missing.length} URL.`, { expected: missing });
    }
  });

  run('emails', () => {
    const missing = diffMissing(before.emails, after.emails);
    if (missing.length) {
      report('emails', 'failed', 'email_missing', `Mất ${missing.length} email.`, { expected: missing });
    }
  });

  run('dates', () => {
    const missing = diffMissing(before.dates, after.dates);
    if (missing.length) {
      report('dates', 'failed', 'date_missing', `Mất/đổi ${missing.length} ngày.`, { expected: missing });
    }
  });

  run('entities', () => {
    const expected = [...before.quotes, ...before.citations, ...before.acronyms, ...before.properNouns];
    const found = [...after.quotes, ...after.citations, ...after.acronyms, ...after.properNouns];
    const missing = diffMissing(expected, found);
    if (missing.length) {
      report('entities', 'warning', 'entity_missing',
        `${missing.length} tên/trích dẫn/acronym không còn trong bản mới.`,
        { expected: missing.slice(0, 12) });
    }
  });

  run('negation', () => {
    const expected = tokenCounts(src, NEGATIONS);
    const found = tokenCounts(out, NEGATIONS);
    const lost = [];
    for (const [token, count] of expected) {
      if ((found.get(token) || 0) < count) lost.push(token);
    }
    if (lost.length) {
      report('negation', 'failed', 'negation_removed',
        `Phủ định bị mất hoặc giảm: ${lost.join(', ')}.`, { expected: lost });
    }
  });

  run('conditions', () => {
    const expected = tokenCounts(src, CONDITIONS);
    const found = tokenCounts(out, CONDITIONS);
    const lost = [];
    for (const [token, count] of expected) {
      if ((found.get(token) || 0) < count) lost.push(token);
    }
    if (lost.length) {
      report('conditions', 'failed', 'condition_removed',
        `Điều kiện bị mất hoặc giảm: ${lost.join(', ')}.`, { expected: lost });
    }
  });

  run('citations', () => {
    const missing = diffMissing(before.citations, after.citations);
    if (missing.length) {
      report('citations', 'failed', 'citation_missing', `Mất ${missing.length} trích dẫn.`, { expected: missing });
    }
  });

  run('structure', () => {
    const mdBefore = markdownStructure(src);
    const mdAfter = markdownStructure(out);
    const lost = Object.entries(mdBefore)
      .filter(([key, value]) => value > 0 && mdAfter[key] < value)
      .map(([key, value]) => `${key}: ${value} → ${mdAfter[key]}`);
    if (lost.length) {
      const severity = o.markdown ? 'failed' : 'warning';
      report('structure', severity, 'structure_lost',
        `Cấu trúc Markdown bị giảm (${lost.join(', ')}).`, { expected: lost });
    }
  });

  run('lists', () => {
    const expected = extractEnumerations(src).flat();
    const found = extractEnumerations(out).flat();
    const missing = diffMissing(expected, found, item => item.toLowerCase());
    if (missing.length) {
      report('lists', 'failed', 'list_item_removed',
        `Mục trong danh sách bị mất: ${missing.join(', ')}.`, { expected: missing });
    }
  });

  const wordsBefore = words(src);
  const wordsAfter = words(out);
  const ratio = wordsBefore ? wordsAfter / wordsBefore : 1;
  checksRun.push('length');
  preservation.length = PASSED;
  if (wordsBefore >= 20 && (ratio < o.minLengthRatio || ratio > o.maxLengthRatio)) {
    report('length', 'warning', 'length_changed',
      `Độ dài đổi ${(ratio * 100).toFixed(0)}% (${wordsBefore} → ${wordsAfter} từ).`,
      { expected: `${o.minLengthRatio}–${o.maxLengthRatio}` });
  }

  // Không có kiểm tra ngữ nghĩa tự động đáng tin: phải nói thẳng là chưa chạy.
  preservation.semanticReview = NOT_CHECKED;

  return {
    preservation,
    issues,
    requiresManualReview: issues.length > 0 || o.strict,
    checksRun,
  };
}

/** Câu ngắn để hiển thị trên UI. */
function preservationLine(result) {
  if (!result) return '';
  const failed = result.issues.filter(i => i.severity === 'failed');
  const warned = result.issues.filter(i => i.severity === 'warning');
  if (failed.length) return `Kiểm tra bảo toàn: ${failed.length} lỗi nội dung — xem chi tiết.`;
  if (warned.length) return `Kiểm tra bảo toàn: ${warned.length} cảnh báo.`;
  return 'Kiểm tra bảo toàn: số/URL/ngày/phủ định/trích dẫn khớp. Ngữ nghĩa chưa được kiểm tra tự động.';
}

Object.assign(__exports, { PASSED, WARNING, FAILED, NOT_CHECKED, checkPreservation, preservationLine });
};

__modules["diff.js"] = function (__exports) {
'use strict';
/**
 * packages/core/diff.js — word-level diff để so sánh bản gốc và bản đề xuất.
 * Không phụ thuộc thư viện, không render HTML (UI tự escape).
 */

const MAX_CELLS = 4_000_000;

function tokenize(text) {
  return String(text ?? '').match(/\s+|[^\s]+/g) || [];
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {Array<{type:'equal'|'insert'|'delete', value:string}>}
 */
function diffWords(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const ops = [];
  const push = (type, value) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.value += value;
    else ops.push({ type, value });
  };

  if (start) push('equal', a.slice(0, start).join(''));
  if (midA.length * midB.length > MAX_CELLS) {
    if (midA.length) push('delete', midA.join(''));
    if (midB.length) push('insert', midB.join(''));
  } else if (midA.length || midB.length) {
    const n = midA.length;
    const m = midB.length;
    const width = m + 1;
    const dp = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        dp[i * width + j] = midA[i] === midB[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push('equal', midA[i]);
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        push('delete', midA[i]);
        i += 1;
      } else {
        push('insert', midB[j]);
        j += 1;
      }
    }
    while (i < n) { push('delete', midA[i]); i += 1; }
    while (j < m) { push('insert', midB[j]); j += 1; }
  }
  if (endA < a.length) push('equal', a.slice(endA).join(''));
  return ops;
}

function diffStats(ops) {
  let added = 0;
  let removed = 0;
  let kept = 0;
  for (const op of ops) {
    const n = tokenize(op.value).length;
    if (op.type === 'insert') added += n;
    else if (op.type === 'delete') removed += n;
    else kept += n;
  }
  return { added, removed, kept };
}

/** 0..1, dựa trên số token giữ nguyên. */
function similarity(before, after) {
  const a = tokenize(before).length;
  const b = tokenize(after).length;
  if (!a && !b) return 1;
  const { kept } = diffStats(diffWords(before, after));
  return (2 * kept) / (a + b) || 0;
}

/**
 * Áp một tập thay thế lên văn bản, kiểm tra vị trí để không ghi sai chỗ.
 * @param {string} text
 * @param {Array<{find:string, replace:string, index?:number}>} edits
 */
function applyEdits(text, edits) {
  let out = String(text);
  const applied = [];
  const rejected = [];
  for (const edit of edits || []) {
    const at = typeof edit.index === 'number' ? out.indexOf(edit.find, edit.index) : out.indexOf(edit.find);
    if (!edit.find || at < 0) {
      rejected.push({ edit, reason: 'not_found' });
      continue;
    }
    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
    applied.push({ ...edit, index: at });
  }
  return { text: out, applied, rejected };
}

/** Chuyển diff thành mảng dòng có nhãn để UI hiển thị. */
function diffLines(ops, width = 72) {
  const lines = [];
  for (const op of ops) {
    const prefix = op.type === 'insert' ? '+ ' : op.type === 'delete' ? '- ' : '  ';
    const chunks = String(op.value).split('\n');
    chunks.forEach((chunk, i) => {
      const tail = i < chunks.length - 1 ? '' : '';
      if (!chunk.trim() && !tail) return;
      for (let k = 0; k < chunk.length; k += width) {
        lines.push(prefix + chunk.slice(k, k + width));
      }
    });
  }
  return lines;
}

Object.assign(__exports, { tokenize, diffWords, diffStats, similarity, applyEdits, diffLines });
};

__modules["document.js"] = function (__exports) {
'use strict';
/**
 * packages/core/document.js — vòng đời tài liệu, không ghi đè bản gốc.
 *
 * Trạng thái tách biệt:
 *   original  → người dùng nhập, không bao giờ bị sửa
 *   working   → bản đang sửa (mọi accept mới đổi)
 *   proposed  → bản model/cleaner đề xuất, chưa chấp nhận
 *   accepted  → snapshot của lần accept gần nhất
 *   exported  → snapshot tại thời điểm xuất file
 */

const { diffWords, diffStats } = __require("diff.js");

let counter = 0;
const nextId = prefix => `${prefix}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;

class DocumentSession {
  /** @param {string} text @param {Record<string, unknown>} [meta] */
  constructor(text, meta = {}) {
    this.id = nextId('doc');
    this.meta = { language: null, format: 'text', ...meta };
    this.original = String(text ?? '');
    this.working = this.original;
    this.proposed = null;
    this.accepted = null;
    this.exported = null;
    this.revisions = [{
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'create',
      text: this.working,
      proposalId: null,
    }];
    this.pointer = 0;
    this.lastProposal = null;
  }

  /** Đề xuất bản mới, chưa áp dụng. Trả về proposal có id ổn định. */
  propose(text, meta = {}) {
    this.proposed = String(text ?? '');
    this.lastProposal = {
      id: nextId('prop'),
      at: new Date().toISOString(),
      text: this.proposed,
      baseRevision: this.revisions[this.pointer].id,
      ...meta,
    };
    return this.lastProposal;
  }

  /** Chấp nhận toàn bộ đề xuất hiện tại. */
  acceptAll() {
    if (this.proposed == null) return null;
    this.accepted = this.proposed;
    this.working = this.proposed;
    this.proposed = null;
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept',
      proposalId: this.lastProposal ? this.lastProposal.id : null,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return revision;
  }

  /** Bỏ đề xuất, không đụng bản đang sửa. */
  reject() {
    const rejected = this.proposed;
    this.proposed = null;
    return rejected;
  }

  /** Áp một bản đã được người dùng duyệt (ví dụ sau khi sửa tay). */
  commit(text, action = 'edit') {
    this.working = String(text ?? '');
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action,
      proposalId: null,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return revision;
  }

  canUndo() { return this.pointer > 0; }
  canRedo() { return this.pointer < this.revisions.length - 1; }

  undo() {
    if (!this.canUndo()) return this.working;
    this.pointer -= 1;
    this.working = this.revisions[this.pointer].text;
    return this.working;
  }

  redo() {
    if (!this.canRedo()) return this.working;
    this.pointer += 1;
    this.working = this.revisions[this.pointer].text;
    return this.working;
  }

  /** Xuất bản hiện tại; bản gốc vẫn còn nguyên trong session. */
  export(format = 'text') {
    this.exported = { format, at: new Date().toISOString(), text: this.working };
    return this.exported;
  }

  /** So sánh bản đang sửa với bản gốc. */
  diff() {
    const ops = diffWords(this.original, this.working);
    return { ops, stats: diffStats(ops) };
  }

  snapshot() {
    return {
      id: this.id,
      original: this.original,
      working: this.working,
      proposed: this.proposed,
      accepted: this.accepted,
      exported: this.exported,
      revision: this.revisions[this.pointer].id,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

function createDocument(text, meta) {
  return new DocumentSession(text, meta);
}

Object.assign(__exports, { DocumentSession, createDocument });
};

__modules["cleaning.js"] = function (__exports) {
'use strict';
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

const { clean: cleanUnicode, scan, classify } = __require("unicode.js");
const { splitMarkdown, stripMarkdown } = __require("markdown.js");

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const EMAIL_RE = /[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Nhãn vùng được bảo vệ, dùng cho UI/audit. */
const PROTECTED_TYPES = Object.freeze(['code', 'inlineCode', 'link', 'autolink', 'url', 'email']);

/**
 * Tách văn bản thành đoạn chữ thường và đoạn được bảo vệ.
 * Không dùng regex văn xuôi trên đoạn bảo vệ.
 *
 * @param {string} text
 * @returns {Array<{type:'text'|'code'|'inlineCode'|'link'|'autolink'|'url'|'email', value:string, start:number, end:number}>}
 */
function protectRegions(text) {
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
function segmentText(text) {
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
function cleanText(text, options = {}) {
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
const TELL_PATTERNS = Object.freeze([
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
function countsFor(text) {
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
function categoryOf(ch) {
  return classify(ch, ch.codePointAt(0));
}

Object.assign(__exports, { PROTECTED_TYPES, protectRegions, segmentText, cleanText, TELL_PATTERNS, countsFor, categoryOf });
};

globalThis.TraceCore = Object.assign(
  Object.create(null),
  __require("unicode.js"),
  __require("entities.js"),
  __require("markdown.js"),
  __require("preservation.js"),
  __require("diff.js"),
  __require("document.js"),
  __require("cleaning.js"),
);
})();
