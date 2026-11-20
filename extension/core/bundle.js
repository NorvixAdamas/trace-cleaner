/* AUTO-GENERATED from packages/{core,writing,providers} — chạy: node tools/sync_assets.js
   Không sửa tay. Bundle classic-script này là core duy nhất cho Web (inline trong
   index.html), content script và side panel. tests/assets-sync.test.js kiểm tra
   artifact khớp nguồn; tests/web-core-adapter.test.js kiểm tra web gọi đúng core. */
(function () {
'use strict';
if (globalThis.TraceCore && globalThis.TraceCore.__bundleLoaded) return;
const __modules = Object.create(null);
const __cache = Object.create(null);
function __require(name) {
  if (__cache[name]) return __cache[name];
  const factory = __modules[name];
  if (!factory) throw new Error('module chưa có trong bundle: ' + name);
  const exports = __cache[name] = Object.create(null);
  factory(exports);
  return exports;
}
__modules["core/unicode.js"] = function (__exports) {
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
 *
 * QUAN TRỌNG: quét trên CHÍNH chuỗi nguồn, không normalize trước. Nếu normalize
 * trước rồi mới đếm vị trí thì `positions` không còn trỏ vào chuỗi gốc (một
 * chuỗi decomposed như "a" + U+0301 co lại thành 1 codepoint và mọi offset sau
 * đó lệch). Ở đây offset luôn là UTF-16 index trong `text` gốc.
 *
 * @param {string} text
 * @returns {Array<{cp:number,hex:string,name:string,category:string,severity:string,action:string,count:number,positions:number[],flag:boolean}>}
 */
function scan(text) {
  const source = String(text ?? '');
  const rows = new Map();
  let index = 0;
  let inFlag = false;
  for (const ch of source) {
    const cp = ch.codePointAt(0);
    const category = classify(ch, cp);
    const start = index;
    index += ch.length;
    if (category === 'tag') {
      const flag = (inFlag && isFlagTag(cp)) || isFlagSequence(source, start);
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
    if (category === 'tag' && isFlagSequence(source, start)) row.flag = true;
    if (row.positions.length < 20) row.positions.push(start);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.cp - b.cp);
}

/**
 * Hệ offset chuẩn của cả core: UTF-16 code-unit index trong CHUỖI GỐC.
 * Không phải codepoint index, không phải offset trong chuỗi đã normalize.
 * `audit[].index` luôn trỏ vào chuỗi người dùng đưa vào.
 */
const OFFSET_SYSTEM = 'utf16-source';

const COMBINING = /^\p{M}/u;

/**
 * Làm sạch văn bản, có audit từng ký tự.
 *
 * Không normalize toàn chuỗi trước khi đếm vị trí. Mỗi "run" (đoạn ký tự được
 * giữ liền nhau) được normalize NFC riêng, và run bắt đầu bằng combining mark
 * được gộp vào run trước để dấu vẫn ghép đúng. Nhờ vậy:
 *   - audit[].index luôn là offset trong chuỗi gốc;
 *   - văn bản decomposed (tiếng Việt, Ả Rập, Indic) vẫn ra NFC;
 *   - `segments` cho phép map ngược output → nguồn.
 *
 * Hàm này chỉ đổi ký tự, KHÔNG dọn khoảng trắng/dòng trống. Việc dọn văn xuôi do
 * `cleaning.js` làm theo từng đoạn, để code fence không bị chạm vào.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{text:string, log:Record<string,number>, audit:Array<object>, warnings:string[],
 *   segments:Array<{outStart:number,outEnd:number,srcStart:number,srcEnd:number}>, offsetSystem:string}}
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
  const source = String(text ?? '');
  const audit = [];
  const warnings = [];
  const log = {};
  const runs = [];
  let run = '';
  let runStart = -1;
  let runEnd = -1;
  let index = 0;
  let inFlag = false;

  const flush = () => {
    if (!run) return;
    const normalized = o.normalize ? run.normalize(o.normalize) : run;
    const previous = runs[runs.length - 1];
    if (previous && COMBINING.test(normalized)) {
      // Dấu tách khỏi ký tự gốc bởi ký tự đã bị xoá: ghép lại để vẫn ra NFC.
      previous.text = o.normalize ? (previous.text + normalized).normalize(o.normalize) : previous.text + normalized;
      previous.srcEnd = runEnd;
    } else {
      runs.push({ text: normalized, srcStart: runStart, srcEnd: runEnd });
    }
    run = '';
    runStart = -1;
    runEnd = -1;
  };
  const push = (chunk, at) => {
    if (runStart < 0) runStart = at;
    run += chunk;
    runEnd = at + 1;
  };

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
        push(ch, at);
        continue;
      }
      bump('security');
      record(category, 'removed', '', 'tag characters can hide instructions', cp, ch, at);
      flush();
      continue;
    }
    if (category === 'pua') {
      bump('security');
      record(category, 'removed', '', 'private use area', cp, ch, at);
      flush();
      continue;
    }
    if (category === 'invisible') {
      bump(cp === 0x00ad ? 'softHyphen' : 'invisible');
      record(category, 'removed', '', 'invisible character', cp, ch, at);
      flush();
      continue;
    }
    if (category === 'bidi') {
      bump('bidi');
      record(category, 'removed', '', 'bidi control reorders displayed text', cp, ch, at);
      flush();
      continue;
    }
    if (category === 'blank') {
      bump('blank');
      const replacement = o.blankToSpace ? ' ' : ch;
      record(category, o.blankToSpace ? 'replaced' : 'kept', replacement, 'unusual space', cp, ch, at);
      push(replacement, at);
      continue;
    }
    if (category === 'joiner') {
      if (o.removeJoiners) {
        bump('joinerRemoved');
        record(category, 'removed', '', 'explicitly requested', cp, ch, at);
        flush();
      } else {
        bump('joinerKept');
        push(ch, at);
      }
      continue;
    }
    if (category === 'vs') {
      if (o.removeVariationSelectors) {
        bump('vsRemoved');
        record(category, 'removed', '', 'explicitly requested', cp, ch, at);
        flush();
      } else {
        bump('vsKept');
        push(ch, at);
      }
      continue;
    }
    if (category === 'linesep') {
      bump('lineSep');
      record(category, 'replaced', '\n', 'line/paragraph separator', cp, ch, at);
      push('\n', at);
      continue;
    }
    if (category === 'homoglyph') {
      bump('homoglyph');
      const replacement = o.foldHomoglyphs ? HOMOGLYPHS[ch] : ch;
      record(category, o.foldHomoglyphs ? 'replaced' : 'kept', replacement, 'lookalike character', cp, ch, at);
      push(replacement, at);
      continue;
    }
    if (category === 'punct') {
      if (cp === 0x2014) {
        bump('emDash');
        const replacement = { comma: ', ', hyphen: ' - ', space: ' ', keep: ch }[o.emDash] ?? ', ';
        record(category, o.emDash === 'keep' ? 'kept' : 'replaced', replacement, 'em dash', cp, ch, at);
        push(replacement, at);
      } else if (cp === 0x2013) {
        bump('enDash');
        const replacement = o.emDash === 'keep' ? ch : '-';
        record(category, o.emDash === 'keep' ? 'kept' : 'replaced', replacement, 'en dash', cp, ch, at);
        push(replacement, at);
      } else if (cp === 0x2026) {
        bump('ellipsis');
        const replacement = o.straightQuotes ? '...' : ch;
        record(category, 'replaced', replacement, 'ellipsis', cp, ch, at);
        push(replacement, at);
      } else {
        bump('quotes');
        let replacement = ch;
        if (o.straightQuotes) {
          if (cp === 0x2018 || cp === 0x2019 || cp === 0x00b4 || cp === 0x02bc) replacement = "'";
          else replacement = '"';
        }
        record(category, replacement === ch ? 'kept' : 'replaced', replacement, 'typographic quote', cp, ch, at);
        push(replacement, at);
      }
      continue;
    }

    inFlag = false;
    push(ch, at);
  }
  flush();

  let out = '';
  const segments = [];
  for (const item of runs) {
    segments.push({ outStart: out.length, outEnd: out.length + item.text.length, srcStart: item.srcStart, srcEnd: item.srcEnd });
    out += item.text;
  }

  // Dọn văn xuôi ở tầng ký tự. CHỈ dùng cho đoạn chữ: `cleaning.js` gọi hàm này
  // theo từng đoạn và không bao giờ đưa code fence / URL vào đây. Muốn làm sạch
  // văn bản có code thì gọi `cleanText()`, không gọi `clean()` trực tiếp.
  out = out
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/([,;:])(?=[A-Za-zÀ-ỹ])/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');

  if (log.flagKept) warnings.push('Giữ tag char của emoji cờ (🏴) — xoá sẽ phá emoji.');
  if (log.joinerKept) warnings.push('Giữ ZWJ/ZWNJ — cần cho Ả Rập/Indic/emoji.');

  return { text: out, log, audit, warnings, segments, offsetSystem: OFFSET_SYSTEM };
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

Object.assign(__exports, { BLANK_CODE_POINTS, INVISIBLE_CODE_POINTS, BIDI_CODE_POINTS, HOMOGLYPHS, NAMES, SEVERITY, ACTION, ACTIONABLE, classify, isFlagTag, isFlagSequence, nameOf, scan, OFFSET_SYSTEM, clean, summary });
};

__modules["core/entities.js"] = function (__exports) {
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
  // Khoảng trắng GIỮA CÁC TỪ trong một mục chỉ được là space/tab: dùng \s sẽ
  // nuốt luôn "\n\nCâu tiếp theo", khiến mục cuối bị so sánh sai (false positive
  // list_item_removed khi bản gốc có ký tự vô hình trước dấu xuống dòng).
  const ITEM = '([A-Z][\\w.+#-]*(?:[ \\t]+[A-Za-z][\\w.+#-]*){0,3})';
  const re = new RegExp(`${ITEM},\\s+${ITEM},\\s+(?:and|or|và|hoặc)\\s+${ITEM}`, 'g');
  const out = [];
  let m;
  // Cắt mục tại dấu kết câu: "Java. Then we" chỉ còn "Java".
  const cut = value => value.trim().replace(/[.!?](?=\s|$)[\s\S]*$/, '').trim();
  while ((m = re.exec(text)) !== null) {
    out.push([cut(m[1]), cut(m[2]), cut(m[3])]);
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

__modules["core/markdown.js"] = function (__exports) {
'use strict';
/**
 * packages/core/markdown.js — tách văn bản Markdown thành đoạn để chỉ sửa phần chữ.
 *
 * Không phải parser Markdown đầy đủ (dự án chưa dùng thư viện nào). Mục tiêu hẹp
 * nhưng phải an toàn: bảo vệ code fence (``` và ~~~, dài bao nhiêu dấu cũng được),
 * code span, link/ảnh, autolink, blockquote lồng nhau. Phần không nhận diện được
 * vẫn đi qua như văn xuôi nhưng không bị xoá cấu trúc.
 *
 * Bất cứ cú pháp nào không chắc chắn đều được coi là "không được chạm": thà bỏ
 * sót một chỗ sửa còn hơn phá nội dung.
 */

/** Fence ``` hoặc ~~~, 3 dấu trở lên, cho phép info string. */
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
/** Fence chưa đóng ở cuối file: bảo vệ tới hết file thay vì coi là văn xuôi. */
const OPEN_FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*$/m;
const INLINE_CODE = /`[^`\n]+`/g;
const LINK = /!?\[[^\]\n]*\]\([^)\n]*\)/g;
const AUTOLINK = /<(?:https?:\/\/|mailto:)[^>\s]+>/g;
/** Thẻ HTML/XML: thuộc tính không được bị coi là văn xuôi (dấu phẩy, khoảng trắng). */
const HTML_TAG = /<\/?[A-Za-z][^>\n]{0,400}>/g;

/**
 * @param {string} text
 * @returns {Array<{type:'text'|'code'|'inlineCode'|'link'|'autolink'|'html', value:string}>}
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
  collect(HTML_TAG, 'html');

  // Fence mở mà không đóng: phần còn lại là code, không phải văn xuôi.
  const hasClosedFence = spans.some(span => span.type === 'code');
  if (!hasClosedFence) {
    const open = OPEN_FENCE.exec(source);
    if (open) spans.push({ start: open.index, end: source.length, type: 'code', value: open[0] });
  }

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
    fences: (source.match(/^[ \t]*(?:`{3,}|~{3,})/gm) || []).length,
    links: (source.match(/\[[^\]\n]+\]\([^)\n]+\)/g) || []).length,
  };
}

/**
 * Bỏ đúng dòng marker của fence, giữ nguyên từng byte bên trong.
 * `"```py\n a  \n\n\nb\n```"` → `" a  \n\n\nb"`.
 */
function unfence(block) {
  const raw = String(block ?? '');
  const lines = raw.split('\n');
  const fenceLine = line => /^[ \t]*(?:`{3,}|~{3,})[^\n]*$/.test(line);
  if (lines.length && fenceLine(lines[0])) lines.shift();
  if (lines.length && fenceLine(lines[lines.length - 1])) lines.pop();
  return lines.join('\n');
}

/**
 * Bỏ marker Markdown trong MỘT đoạn văn xuôi (không có code fence).
 * Dùng khi người dùng tắt "giữ Markdown"; nội dung chữ giữ nguyên.
 * @returns {{text:string, removed:number}}
 */
function stripMarkdownInline(text) {
  let removed = 0;
  const hit = () => { removed += 1; return ''; };
  let out = String(text ?? '');
  out = out.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, hit);
  out = out.replace(/^[ \t]{0,3}>[ \t]?/gm, hit);
  out = out.replace(/^[ \t]*[-*+•][ \t]+/gm, hit);
  out = out.replace(/^[ \t]*\d{1,3}[.)][ \t]+/gm, hit);
  out = out.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, hit);
  out = out.replace(/!\[([^\]\n]*)\]\(([^)\n]*)\)/g, (m, alt, url) => {
    removed += 1;
    if (!alt) return url;
    return alt === url ? alt : `${alt} (${url})`;
  });
  out = out.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (m, label, url) => {
    removed += 1;
    if (/^https?:\/\//i.test(label)) return label;
    return label === url ? label : `${label} (${url})`;
  });
  out = out.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (m, url) => { removed += 1; return url; });
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, (m, x) => { removed += 1; return x; });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, (m, x) => { removed += 1; return x; });
  out = out.replace(/__([^_\n]+)__/g, (m, x) => { removed += 1; return x; });
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, (m, pre, x) => { removed += 1; return pre + x; });
  out = out.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, (m, pre, x) => { removed += 1; return pre + x; });
  out = out.replace(/`([^`\n]+)`/g, (m, x) => { removed += 1; return x; });
  return { text: out, removed };
}

/**
 * Xoá marker toàn văn nhưng giữ NGUYÊN BYTE bên trong code fence / code span.
 * Không dọn khoảng trắng ở đây: việc đó do cleaning.js làm theo từng đoạn văn
 * xuôi, nhờ vậy tab và dòng trống trong code không bị cắt.
 */
function stripMarkdown(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  const slots = [];
  const hold = raw => {
    slots.push(raw);
    return `\u0001${slots.length - 1}\u0001`;
  };
  let removed = 0;
  let out = source.replace(FENCE, block => { removed += 1; return hold(block); });
  out = out.replace(INLINE_CODE, span => { removed += 1; return hold(span); });

  const inline = stripMarkdownInline(out);
  removed += inline.removed;
  // Chỉ cắt khoảng trắng NGOÀI placeholder: byte trong code vẫn nguyên.
  out = inline.text.replace(/^\s+|\s+$/g, '');

  out = out.replace(/\u0001(\d+)\u0001/g, (match, i) => {
    const raw = slots[Number(i)];
    if (raw === undefined) return match;
    if (/^[ \t]*(?:`{3,}|~{3,})/.test(raw)) return unfence(raw);
    return raw.slice(1, -1);
  });

  return { text: out, removed };
}

Object.assign(__exports, { splitMarkdown, transformProse, countStructure, unfence, stripMarkdownInline, stripMarkdown });
};

__modules["core/preservation.js"] = function (__exports) {
'use strict';
/**
 * packages/core/preservation.js — kiểm tra bảo toàn nội dung sau khi viết lại.
 *
 * Chạy SAU mỗi phản hồi model, độc lập với prompt. Không có nghĩa là "bản viết
 * lại đúng": đây là các kiểm tra deterministic (số, URL, email, ngày, phủ định,
 * điều kiện, trích dẫn, cấu trúc Markdown, liệt kê). Kiểm tra ngữ nghĩa sâu
 * luôn trả `not_checked` để không tạo cảm giác an toàn giả.
 */

const { extractEntities, numberCounts, extractEnumerations, extractFromTo, tokenCounts, markdownStructure, NEGATIONS, CONDITIONS } = __require("core/entities.js");

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
/** Từ có nghĩa của một mục liệt kê, đã bỏ dấu câu cuối và ký tự vô hình. */
function tokensOf(item) {
  const text = String(item ?? '')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, ' ');
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}.+#_-]*/gu) || [])
    .map(token => token.replace(/[.,;:]+$/, ''))
    .filter(token => token.length >= 2);
}

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
    /* Ranh giới mục cuối không xác định được nếu không parse câu, nên so theo
       TẬP TỪ của mục: "Zig for this." vẫn chứa "Zig". Mất hẳn một mục — ví dụ
       "Kotlin, Java, and Python" → "Kotlin and Python" — vẫn bị bắt. */
    const foundTokens = new Set(found.flatMap(item => tokensOf(item)));
    const missing = expected.filter(item => !tokensOf(item).every(token => foundTokens.has(token)));
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

  const failed = issues.some(issue => issue.severity === 'failed');
  return {
    preservation,
    issues,
    failed,
    ok: !failed,
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

__modules["core/diff.js"] = function (__exports) {
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
 * Áp một tập thay thế lên văn bản, KHÔNG áp tuần tự trên chuỗi đang đổi.
 *
 * Vấn đề của cách cũ: mỗi lần thay đổi độ dài, offset của các edit sau lệch
 * theo, và `indexOf` có thể khớp một chỗ khác cùng nội dung. Cách mới:
 *   1. Chốt vị trí trên MỘT snapshot của chuỗi gốc.
 *   2. Kiểm tra `source.slice(start, end) === find` trước khi nhận.
 *   3. Từ chối edit mơ hồ (find xuất hiện nhiều lần mà không có index/occurrence)
 *      thay vì ghi vào chỗ đầu tiên.
 *   4. Phát hiện chồng lấn và áp theo thứ tự giảm dần.
 *
 * @param {string} text
 * @param {Array<{find?:string, replace?:string, replacement?:string, index?:number,
 *   start?:number, end?:number, occurrence?:number}>} edits
 * @param {{sourceRevision?:string|null}} [options]
 * @returns {{text:string, applied:Array<object>, rejected:Array<object>, conflicts:Array<object>,
 *   sourceRevision:string|null, schemaVersion:string}}
 */
function applyEdits(text, edits, options = {}) {
  const source = String(text ?? '');
  const applied = [];
  const rejected = [];
  const conflicts = [];
  const planned = [];

  const nthIndexOf = (needle, occurrence) => {
    let at = -1;
    for (let n = 0; n < occurrence; n += 1) {
      at = source.indexOf(needle, at + 1);
      if (at < 0) return -1;
    }
    return at;
  };

  for (const raw of edits || []) {
    if (!raw || typeof raw !== 'object') {
      rejected.push({ edit: raw, reason: 'invalid_edit' });
      continue;
    }
    const edit = { ...raw };
    const find = typeof edit.find === 'string' ? edit.find : '';
    const replacement = String(edit.replace ?? edit.replacement ?? '');
    let start;
    let end;

    if (typeof edit.start === 'number' && typeof edit.end === 'number') {
      start = edit.start;
      end = edit.end;
    } else if (typeof edit.index === 'number') {
      // `index` là vị trí CHÍNH XÁC của `find` trên chuỗi gốc. Cố tình không
      // dùng indexOf(index) nữa: như vậy một index lệch sẽ trượt sang chỗ khác
      // cùng nội dung và sửa nhầm. Sai vị trí ⇒ conflict text_mismatch.
      if (edit.index < 0 || edit.index > source.length) {
        conflicts.push({ edit, reason: 'out_of_bounds', detail: `index ${edit.index} ngoài chuỗi ${source.length} ký tự.` });
        continue;
      }
      start = edit.index;
      end = start + (find ? find.length : 0);
    } else if (find) {
      const occurrence = typeof edit.occurrence === 'number' ? edit.occurrence : 0;
      if (occurrence > 0) {
        start = nthIndexOf(find, occurrence);
        if (start < 0) {
          rejected.push({ edit, reason: 'not_found' });
          continue;
        }
      } else {
        start = source.indexOf(find);
        if (start < 0) {
          rejected.push({ edit, reason: 'not_found' });
          continue;
        }
        if (source.indexOf(find, start + 1) >= 0) {
          rejected.push({ edit, reason: 'ambiguous', detail: 'find xuất hiện nhiều lần; cần index hoặc occurrence.' });
          continue;
        }
      }
      end = start + find.length;
    } else {
      rejected.push({ edit, reason: 'invalid_edit' });
      continue;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > source.length) {
      conflicts.push({ edit, reason: 'out_of_bounds', detail: `[${start}, ${end}) ngoài chuỗi ${source.length} ký tự.` });
      continue;
    }
    if (find && source.slice(start, end) !== find) {
      conflicts.push({ edit, reason: 'text_mismatch', detail: 'Đoạn tại vị trí này không khớp `find`.' });
      continue;
    }
    planned.push({ start, end, replacement, edit });
  }

  // Chồng lấn: hai edit cùng sửa một vùng thì không đoán ý — loại cả hai.
  planned.sort((a, b) => a.start - b.start || a.end - b.end);
  const accepted = [];
  let cursorEnd = -1;
  for (const item of planned) {
    if (item.start < cursorEnd) {
      conflicts.push({ edit: item.edit, reason: 'overlap', detail: `[${item.start}, ${item.end}) chồng lấn edit trước.` });
      const previous = accepted.pop();
      if (previous) conflicts.push({ edit: previous.edit, reason: 'overlap', detail: 'Bị edit sau chồng lấn.' });
      cursorEnd = accepted.length ? accepted[accepted.length - 1].end : -1;
      continue;
    }
    accepted.push(item);
    cursorEnd = item.end;
  }

  let out = source;
  for (let i = accepted.length - 1; i >= 0; i -= 1) {
    const item = accepted[i];
    out = out.slice(0, item.start) + item.replacement + out.slice(item.end);
    applied.push({ ...item.edit, index: item.start, end: item.end, replacement: item.replacement });
  }
  applied.reverse();

  return {
    text: out,
    applied,
    rejected,
    conflicts,
    sourceRevision: options.sourceRevision ?? null,
    schemaVersion: '1.0',
  };
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

__modules["core/document.js"] = function (__exports) {
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
 *
 * Bất biến quan trọng: mỗi proposal ghi lại revision gốc. Khi người dùng sửa
 * tài liệu trong lúc model đang trả lời, proposal cũ trở thành stale và KHÔNG
 * được ghi đè bản mới. Đây là lỗi mất dữ liệu thật, nên nó bị chặn ở tầng core
 * chứ không chỉ ở UI.
 */

const { diffWords, diffStats } = __require("core/diff.js");

const DOCUMENT_ERRORS = Object.freeze({
  STALE_REVISION: 'STALE_DOCUMENT_REVISION',
  NO_PROPOSAL: 'NO_PROPOSAL',
  UNKNOWN_PROPOSAL: 'UNKNOWN_PROPOSAL',
  INVALID_REVISION: 'INVALID_REVISION',
});

let counter = 0;
const nextId = prefix => `${prefix}_${Date.now().toString(36)}_${(counter += 1).toString(36)}`;

const errorResult = (code, message, extra = {}) => ({
  ok: false,
  error: { code, message, ...extra },
});

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
    /** @type {Array<object>} proposal bị từ chối vì stale, để UI hiển thị */
    this.staleProposals = [];
  }

  get revision() { return this.revisions[this.pointer].id; }

  /** Đề xuất bản mới, chưa áp dụng. Proposal luôn gắn với revision hiện tại. */
  propose(text, meta = {}) {
    const proposal = {
      id: nextId('prop'),
      at: new Date().toISOString(),
      text: String(text ?? ''),
      baseRevision: this.revision,
      baseText: this.working,
      ...meta,
    };
    this.proposed = proposal.text;
    this.lastProposal = proposal;
    return proposal;
  }

  /** Proposal này còn dùng được không? */
  isProposalCurrent(proposal) {
    if (!proposal) return false;
    return proposal.baseRevision === this.revision && proposal.baseText === this.working;
  }

  /** Đang có proposal hợp lệ chưa áp dụng? */
  pendingProposal() {
    if (!this.lastProposal) return null;
    return this.isProposalCurrent(this.lastProposal) ? this.lastProposal : null;
  }

  /**
   * Chấp nhận một proposal cụ thể (id) trên một revision cụ thể.
   * Không bao giờ ghi đè khi tài liệu đã đổi.
   *
   * @param {string} [proposalId] mặc định lấy proposal gần nhất
   * @param {{expectedRevision?:string, text?:string}} [options]
   * @returns {{ok:true, revision:object}|{ok:false, error:{code:string,message:string}}}
   */
  acceptProposal(proposalId, options = {}) {
    const proposal = this.lastProposal;
    if (!proposal) return errorResult(DOCUMENT_ERRORS.NO_PROPOSAL, 'Không có đề xuất nào để chấp nhận.');
    if (proposalId && proposalId !== proposal.id) {
      return errorResult(DOCUMENT_ERRORS.UNKNOWN_PROPOSAL, 'Đề xuất này không tồn tại hoặc đã bị thay thế.', {
        proposalId,
      });
    }
    const expected = options.expectedRevision || proposal.baseRevision;
    if (expected !== this.revision) {
      this.staleProposals.push({ ...proposal, rejectedAt: new Date().toISOString(), reason: 'revision_changed' });
      return errorResult(DOCUMENT_ERRORS.STALE_REVISION,
        'Tài liệu đã được sửa sau khi đề xuất này được tạo. Hãy tạo lại đề xuất trên bản mới nhất.',
        { expectedRevision: expected, currentRevision: this.revision, proposalId: proposal.id });
    }
    if (!this.isProposalCurrent(proposal)) {
      this.staleProposals.push({ ...proposal, rejectedAt: new Date().toISOString(), reason: 'text_changed' });
      return errorResult(DOCUMENT_ERRORS.STALE_REVISION,
        'Bản đang sửa đã khác bản mà đề xuất này dựa vào. Không áp dụng để tránh mất nội dung.',
        { expectedRevision: expected, currentRevision: this.revision, proposalId: proposal.id });
    }

    const nextText = typeof options.text === 'string' ? options.text : proposal.text;
    this.accepted = nextText;
    this.working = nextText;
    this.proposed = null;
    // Proposal đã dùng xong: không thể accept lần hai, và `pendingProposal()`
    // phải trả null ngay sau khi chấp nhận.
    this.lastProposal = null;
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept',
      proposalId: proposal.id,
      baseRevision: proposal.baseRevision,
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return { ok: true, revision };
  }

  /** Chấp nhận toàn bộ đề xuất đang có. Trả cùng shape với acceptProposal. */
  acceptAll(options = {}) {
    return this.acceptProposal(undefined, options);
  }

  /** Bỏ đề xuất, không đụng bản đang sửa. */
  reject(proposalId) {
    const rejected = this.lastProposal;
    if (proposalId && rejected && proposalId !== rejected.id) return null;
    this.proposed = null;
    if (rejected) this.lastProposal = null;
    return rejected ? rejected.text : null;
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

  /** Quay về đúng bản gốc, ghi thành một revision mới (không xoá lịch sử). */
  restoreOriginal() {
    return this.commit(this.original, 'restore-original');
  }

  /** Xuất bản hiện tại; bản gốc vẫn còn nguyên trong session. */
  export(format = 'text') {
    this.exported = { format, at: new Date().toISOString(), text: this.working, revision: this.revision };
    return this.exported;
  }

  /** So sánh bản đang sửa với bản gốc. */
  diff() {
    const ops = diffWords(this.original, this.working);
    return { ops, stats: diffStats(ops) };
  }

  /** So sánh bản đang sửa với một revision trước đó. */
  diffAgainst(revisionId) {
    const target = this.revisions.find(item => item.id === revisionId);
    if (!target) return { ops: [], stats: { added: 0, removed: 0, kept: 0 }, error: DOCUMENT_ERRORS.INVALID_REVISION };
    const ops = diffWords(target.text, this.working);
    return { ops, stats: diffStats(ops) };
  }

  history() {
    return this.revisions.map((item, index) => ({
      id: item.id,
      at: item.at,
      action: item.action,
      words: (item.text.trim().match(/\S+/g) || []).length,
      current: index === this.pointer,
    }));
  }

  snapshot() {
    return {
      id: this.id,
      original: this.original,
      working: this.working,
      proposed: this.proposed,
      accepted: this.accepted,
      exported: this.exported,
      revision: this.revision,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      pendingProposal: this.pendingProposal() ? { ...this.pendingProposal() } : null,
      staleCount: this.staleProposals.length,
    };
  }
}

function createDocument(text, meta) {
  return new DocumentSession(text, meta);
}

Object.assign(__exports, { DOCUMENT_ERRORS, DocumentSession, createDocument });
};

__modules["core/cleaning.js"] = function (__exports) {
'use strict';
/**
 * packages/core/cleaning.js — engine làm sạch deterministic dùng chung cho Web,
 * Extension và CLI.
 *
 * Nguyên tắc:
 *  - Chỉ sửa những gì giải thích được: ký tự vô hình, khoảng trắng lạ, kiểu chữ.
 *  - KHÔNG xoá mục trong danh sách, KHÔNG đảo phủ định, KHÔNG sửa câu.
 *  - Vùng có cấu trúc (URL, email, code fence, inline code, link Markdown,
 *    autolink) được bảo vệ nguyên byte. Không có bước chuẩn hoá văn xuôi nào
 *    chạy xuyên qua vùng bảo vệ: mỗi đoạn chữ được dọn riêng, nên khoảng trắng
 *    cuối dòng, dòng trống và tab bên trong code fence còn nguyên.
 *  - ZWJ/ZWNJ/variation selector/emoji cờ mặc định được giữ (xem unicode.js).
 *  - Mọi thay đổi ghi vào audit kèm vị trí UTF-16 trong chuỗi gốc.
 */

const { clean: cleanUnicode, scan, classify, OFFSET_SYSTEM } = __require("core/unicode.js");
const { splitMarkdown, stripMarkdownInline, unfence } = __require("core/markdown.js");

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const EMAIL_RE = /[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g;

/** Phiên bản schema kết quả — mọi bề mặt trả cùng shape. */
const SCHEMA_VERSION = '1.0';
/** Phiên bản engine hành vi (khác version sản phẩm/package). */
const ENGINE_VERSION = '2.2';

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

/**
 * Dọn khoảng trắng văn xuôi. Chỉ chạy trên đoạn chữ, không bao giờ trên code.
 * Không thêm khoảng trắng sau dấu phẩy chữ số ("1,234" phải giữ nguyên).
 */
function tidyProse(value) {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[A-Za-zÀ-ỹ])/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

/** Làm sạch một đoạn chữ nhưng giữ nguyên khoảng trắng ở hai đầu đoạn. */
function cleanProseStrict(value, options) {
  const head = (value.match(/^[ \t\n]+/) || [''])[0];
  const tail = (value.match(/[ \t\n]+$/) || [''])[0];
  const coreText = value.slice(head.length, value.length - tail.length);
  if (!coreText) return { text: value, log: {}, audit: [], warnings: [], segments: [] };
  const result = cleanUnicode(coreText, options);
  // cleanUnicode đếm trên `coreText`, nên phải cộng bù phần head đã cắt để
  // audit vẫn trỏ đúng vị trí trong đoạn gốc.
  const audit = result.audit.map(entry => ({ ...entry, index: entry.index + head.length }));
  return { ...result, audit, text: head + tidyProse(result.text) + tail };
}

/**
 * Làm sạch văn bản an toàn.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.markdown=true] false = xoá marker Markdown (giữ nội dung và code)
 * @param {string} [options.emDash='comma'] 'comma' | 'hyphen' | 'space' | 'keep'
 * @param {boolean} [options.straightQuotes=true]
 * @param {boolean} [options.blankToSpace=true]
 * @param {boolean} [options.foldHomoglyphs=true]
 * @param {boolean} [options.removeJoiners=false] chỉ khi người dùng chọn rõ
 * @param {boolean} [options.removeVariationSelectors=false]
 * @param {boolean} [options.trimEnds=true] cắt khoảng trắng thừa ở hai đầu tài liệu
 * @returns {{text:string, log:Record<string,number>, audit:Array<object>, warnings:string[],
 *   protectedRegions:number, stats:object, schemaVersion:string, engineVersion:string, offsetSystem:string}}
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
    trimEnds: true,
    ...options,
  };
  const source = String(text ?? '');
  const log = {};
  const warnings = [];
  const audit = [];
  let protectedRegions = 0;

  const bump = (key, n = 1) => { if (n) log[key] = (log[key] || 0) + n; };

  const pieces = [];
  for (const seg of segmentText(source)) {
    if (seg.type !== 'text') {
      protectedRegions += 1;
      bump('protected');
      let value = seg.value;
      if (!o.markdown) {
        if (seg.type === 'code') {
          value = unfence(value);
          bump('markdown');
        } else if (seg.type === 'inlineCode') {
          value = value.slice(1, -1);
          bump('markdown');
        }
      }
      // Byte bên trong vùng bảo vệ không đi qua bất kỳ phép dọn văn xuôi nào.
      pieces.push({ type: seg.type, text: value });
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
    // Vị trí audit phải tính theo chuỗi gốc, không theo đoạn và không theo bản
    // đã normalize: cleanUnicode chỉ ghi index trong chuỗi nó nhận (đoạn gốc).
    for (const entry of result.audit) audit.push({ ...entry, index: entry.index + seg.start });

    let value = result.text;
    if (!o.markdown) {
      const inline = stripMarkdownInline(value);
      value = inline.text;
      bump('markdown', inline.removed);
    }
    pieces.push({ type: 'text', text: value });
  }

  if (o.trimEnds) {
    const first = pieces.find(piece => piece.text.length);
    if (first && first.type === 'text') first.text = first.text.replace(/^[ \t\n]+/, '');
    const last = [...pieces].reverse().find(piece => piece.text.length);
    if (last && last.type === 'text') last.text = last.text.replace(/[ \t\n]+$/, '');
  }

  const out = pieces.map(piece => piece.text).join('');
  const result = {
    text: out,
    log,
    audit,
    warnings,
    protectedRegions,
    stats: countsFor(out),
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    offsetSystem: OFFSET_SYSTEM,
  };
  if (!o.markdown) {
    warnings.push('Đã xoá marker Markdown: cấu trúc heading/bullet/link không còn, chỉ giữ nội dung.');
  }
  return result;
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

Object.assign(__exports, { SCHEMA_VERSION, ENGINE_VERSION, PROTECTED_TYPES, protectRegions, segmentText, cleanText, TELL_PATTERNS, countsFor, categoryOf });
};

__modules["core/limits.js"] = function (__exports) {
'use strict';
/**
 * packages/core/limits.js — giới hạn tài nguyên cho mọi parser file.
 *
 * Mọi giá trị ở đây là giới hạn CỨNG. UI có thể cho chọn thấp hơn, không được
 * vượt. Mục tiêu: một file hỏng hoặc độc hại không thể treo tab, ăn hết RAM,
 * hay giải nén tới hàng trăm GB từ một file vài chục KB.
 */

const MB = 1024 * 1024;

const PARSER_LIMITS = Object.freeze({
  /** Kích thước file đầu vào (trang đọc cả file vào bộ nhớ). */
  maxFileBytes: 60 * MB,
  /** Số entry tối đa trong một archive OOXML. */
  maxZipEntries: 512,
  /** Kích thước một entry sau khi giải nén. */
  maxEntryBytes: 32 * MB,
  /** Tổng kích thước giải nén của cả archive. */
  maxTotalUncompressedBytes: 96 * MB,
  /** Tỉ lệ nở tối đa (uncompressed / compressed) cho một entry. */
  maxExpansionRatio: 120,
  /** Kích thước XML đưa vào regex/heuristic. */
  maxXmlBytes: 16 * MB,
  /** Độ sâu lồng thẻ tối đa (~64 vẫn dư cho OOXML hợp lệ). */
  maxXmlDepth: 64,
  /** Số trang PDF / slide PPTX / sheet XLSX được đọc. */
  maxPages: 60,
  maxSlides: 60,
  maxSheets: 40,
  /** Văn bản trích ra tối đa để hiển thị. */
  maxTextChars: 2 * MB,
  /** Thời gian parse tối đa cho một file (ms). */
  maxParsingMs: 8000,
});

/**
 * Tên entry ZIP an toàn: không đường dẫn tuyệt đối, không `..`, không NUL,
 * không backslash (Windows path), không quá dài.
 */
function validateZipEntryName(name) {
  const value = String(name ?? '');
  if (!value) return { ok: false, reason: 'empty' };
  if (value.length > 512) return { ok: false, reason: 'too_long' };
  if (value.includes('\0')) return { ok: false, reason: 'nul_byte' };
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) return { ok: false, reason: 'absolute_path' };
  if (value.includes('\\')) return { ok: false, reason: 'backslash' };
  const parts = value.split('/');
  if (parts.some(part => part === '..')) return { ok: false, reason: 'path_traversal' };
  return { ok: true };
}

/**
 * Kiểm tra ngân sách giải nén TRƯỚC khi inflate.
 * @param {Array<{name:string, size:number, compressedSize:number, method:number}>} entries
 * @param {object} [limits]
 */
function checkZipBudget(entries, limits = PARSER_LIMITS) {
  if (!Array.isArray(entries)) return { ok: false, reason: 'invalid_entries' };
  if (entries.length > limits.maxZipEntries) {
    return { ok: false, reason: 'too_many_entries', detail: `${entries.length} > ${limits.maxZipEntries}` };
  }
  let total = 0;
  for (const entry of entries) {
    const check = validateZipEntryName(entry.name);
    if (!check.ok) return { ok: false, reason: check.reason, detail: entry.name };
    if (entry.method !== 0 && entry.method !== 8) {
      return { ok: false, reason: 'unsupported_method', detail: String(entry.method) };
    }
    const size = Number(entry.size) || 0;
    const compressed = Number(entry.compressedSize) || 0;
    if (size > limits.maxEntryBytes) {
      return { ok: false, reason: 'entry_too_large', detail: `${entry.name}: ${size}` };
    }
    if (compressed > 0 && size / compressed > limits.maxExpansionRatio) {
      return { ok: false, reason: 'suspicious_expansion', detail: `${entry.name}: ${Math.round(size / compressed)}×` };
    }
    total += size;
    if (total > limits.maxTotalUncompressedBytes) {
      return { ok: false, reason: 'archive_too_large', detail: String(total) };
    }
  }
  return { ok: true, total };
}

/** Độ sâu lồng thẻ của một đoạn XML (không cần parse đầy đủ). */
function xmlDepth(xml) {
  const source = String(xml ?? '');
  let depth = 0;
  let max = 0;
  const re = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*)?(\/?)>/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const isClose = source[m.index + 1] === '/';
    const selfClosing = m[2] === '/';
    if (isClose) depth = Math.max(0, depth - 1);
    else if (!selfClosing) { depth += 1; if (depth > max) max = depth; }
  }
  return max;
}

/**
 * Chặn XML nguy hiểm trước khi chạy regex trích xuất.
 * Không có DTD/ENTITY: OOXML hợp lệ không cần, và entity là bề mặt tấn công.
 */
function assertSafeXml(xml, { name = 'xml', limits = PARSER_LIMITS } = {}) {
  const source = String(xml ?? '');
  const fail = (reason, detail) => {
    const error = new Error(`XML không an toàn (${reason}): ${detail || name}`);
    error.code = 'PARSER_ERROR';
    return error;
  };
  if (source.length > limits.maxXmlBytes) throw fail('too_large', `${source.length} ký tự`);
  if (/<!DOCTYPE/i.test(source)) throw fail('doctype', name);
  if (/<!ENTITY/i.test(source)) throw fail('entity_declaration', name);
  if (/SYSTEM\s+["'](?:https?|file):/i.test(source)) throw fail('external_entity', name);
  const depth = xmlDepth(source);
  if (depth > limits.maxXmlDepth) throw fail('too_deep', `${depth} > ${limits.maxXmlDepth}`);
  return true;
}

/** Cắt văn bản trích ra để UI không render hàng chục MB. */
function clampText(text, limits = PARSER_LIMITS) {
  const source = String(text ?? '');
  if (source.length <= limits.maxTextChars) return { text: source, truncated: false };
  return { text: source.slice(0, limits.maxTextChars), truncated: true };
}

Object.assign(__exports, { PARSER_LIMITS, validateZipEntryName, checkZipBudget, xmlDepth, assertSafeXml, clampText });
};

__modules["writing/prompts.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/prompts.js — nguồn duy nhất cho prompt viết lại.
 *
 * Web (index.html) nhận bản sinh tự động từ file này qua
 * `node tools/sync_assets.js`; extension dùng bản copy trong
 * extension/core/prompts.js do cùng tool sinh ra. Không sửa tay các bản đó.
 *
 * Nguyên tắc bắt buộc của mọi prompt:
 *  1. Giữ nghĩa và dữ kiện.
 *  2. Giữ đủ mọi mục trong danh sách, mọi phủ định và điều kiện.
 *  3. Không xoá cấu trúc chỉ vì nó phổ biến.
 *  4. Không bịa thông tin; nói rõ khi không chắc.
 */

const PROMPT_VERSION = '2.2.0';

/** Quy tắc bảo toàn, đứng đầu mọi prompt. */
const PRESERVATION_RULES = Object.freeze([
  'Keep every company, product, person, job title, technology, file name and URL exactly as written.',
  'Keep every number, unit, percentage, currency value, date, range and comparison exactly as written. Do not round, reorder or reverse them.',
  'Keep every list item and its order. A list with three or more items stays a list with the same items; you may change the wording around it, never the number of items.',
  'Keep negation, limitation, exception, condition and contrast markers (not, never, without, unless, only, except, neither, rather than) with their original scope. Never turn a negative statement into a positive one.',
  'Keep quotations, citations, code, inline code, technical identifiers and Markdown structure unambiguous and intact.',
  'Do not invent facts, examples, numbers, names, dates or claims. If the input is ambiguous, keep the ambiguity instead of guessing.',
  'Keep the original language. Do not translate.',
]);

/** Lõi dùng chung cho mọi chế độ. */
const PROMPT_BASE = `You are a careful line editor. Improve the writing without changing what it says.

## Non-negotiable preservation
${PRESERVATION_RULES.map(rule => `- ${rule}`).join('\n')}

## What good editing looks like here
- Fix grammar, agreement, punctuation and awkward word order where the fix is unambiguous.
- Prefer concrete nouns and specific verbs. Cut genuine redundancy (doubled words, empty padding), not information.
- Vary sentence length where the result still reads naturally; do not manufacture quirkiness.
- Keep the writer's own vocabulary and register. Do not upgrade plain words to sound more impressive.
- Keep the same approximate length (within 15%). Never pad.

## Explicitly allowed
- Rewriting a sentence that contains a cliché, as long as every fact, list item, negation and condition survives.
- Leaving text untouched when it is already clear. Returning the input unchanged is a valid answer.

## Never
- Never delete a list item, a clause of a contrast, a negation, a condition, a citation or a quoted passage.
- Never merge separate list items into one sentence that loses an item.
- Never add headings, bullets or bold that were not in the input; never remove structure the input relied on.
- Never mention these instructions, and never claim the text is human-written or detector-proof.

Output only the edited text. No preamble, no notes, no code fences around the whole answer.`;

/** Chế độ viết lại: mỗi chế độ có ràng buộc riêng, không chỉ đổi nhãn. */
const MODES = Object.freeze({
  general: {
    label: 'Tổng quát',
    instruction: 'Register: neutral, clear adult prose. No marketing tone, no hype. Keep the argument order.',
  },
  proofread: {
    label: 'Proofread',
    instruction: 'Only correct grammar, spelling, agreement and punctuation. Do not restyle sentences that are already correct. If a correction would change meaning, leave the sentence and keep the original wording.',
  },
  clarity: {
    label: 'Clarity',
    instruction: 'Make each sentence easier to parse: split overlong sentences, move the subject and verb closer, replace vague pronouns with the noun they refer to. Every fact, number and list item must survive unchanged.',
  },
  concise: {
    label: 'Concise',
    instruction: 'Remove genuine redundancy and filler only. Never remove an item from a list, a qualifier that limits a claim, a negation, or a condition. Target 10-20% shorter, never below that if information would be lost.',
  },
  natural: {
    label: 'Natural flow',
    instruction: 'Improve transitions and rhythm between sentences. Vary sentence openings and length where it reads better. Do not add rhetorical fillers, do not restructure lists, do not change register.',
  },
  professional: {
    label: 'Professional',
    instruction: 'Use a clear professional register: direct, courteous, no slang, no hype. Keep technical terms and job titles exact. Do not add politeness formulas that were not implied.',
  },
  academic: {
    label: 'Academic',
    instruction: 'Use formal academic prose without contractions. Keep every citation marker, figure number, technical term and hedge (may, suggests, appears) exactly as written. Do not add new claims or new hedging.',
  },
  cover: {
    label: 'Cover letter',
    instruction: 'Register: one specific person applying for one specific job. First person, 250-350 words. Name the company and the role once each. Exactly one concrete example, with its real number if the input has one. End with one plain sentence about availability.',
  },
  email: {
    label: 'Email công việc',
    instruction: 'Register: short workplace email, under 150 words. Put the ask in the first line. One ask at the end. No greeting formulas beyond a plain greeting that already exists in the input.',
  },
});

/** Chế độ hiển thị trên web (giữ đúng bốn preset cũ + các chế độ mới). */
const WEB_PRESET_KEYS = Object.freeze(['general', 'cover', 'academic', 'email']);

const MD_KEEP_CLAUSE = `

## Markdown structure (mandatory)
The input is Markdown. Preserve the structure exactly: headings (#, ##, ###), bold/italic markers, bullet and numbered list markers, links as [label](url), code spans, blank lines. Rewrite only the words inside those markers. Never delete, add or reorder a marker, never flatten bullets into prose, never drop a list item, never return plain text. This overrides any earlier instruction to remove bullets, bold lead-ins, headings or list markers.`;

const MD_PLAIN_CLAUSE = `

## Plain text (mandatory)
Return plain text only: no #, no **, no bullet symbols or list numbering, no code fences. Keep every list item's content and order, one item per line, exactly one blank line between paragraphs.`;

/** Lượt tự sửa sau khi viết lại — vẫn phải giữ dữ kiện. */
const SELF_EDIT = `Below is a draft. Edit it once more as a line editor.

- Do not change facts, names, numbers, job titles or technology names.
- Keep every list item, negation, condition and citation. If a list has three or more items, it still has the same items afterwards.
- Remove only genuine redundancy and unambiguous grammar errors.
- Keep length within 5% of the draft.
- Output only the edited text.`;

/**
 * Ghép prompt hoàn chỉnh.
 * @param {string} [mode] khoá trong MODES
 * @param {{markdown?:boolean}} [options]
 * @returns {string}
 */
function buildPrompt(mode = 'general', options = {}) {
  const chosen = MODES[mode] ? mode : 'general';
  const markdown = options.markdown !== false;
  return `${PROMPT_BASE}\n\n## Editing mode: ${MODES[chosen].label}\n${MODES[chosen].instruction}${markdown ? MD_KEEP_CLAUSE : MD_PLAIN_CLAUSE}`;
}

/** Preset cho web: cùng nội dung với MODES, chỉ lấy bốn khoá cũ. */
function webPresets() {
  const out = {};
  for (const key of WEB_PRESET_KEYS) out[key] = MODES[key].instruction;
  return out;
}

Object.assign(__exports, { PROMPT_VERSION, PRESERVATION_RULES, PROMPT_BASE, MODES, WEB_PRESET_KEYS, MD_KEEP_CLAUSE, MD_PLAIN_CLAUSE, SELF_EDIT, buildPrompt, webPresets });
};

__modules["writing/suggestions.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/suggestions.js — schema duy nhất cho mọi gợi ý sửa.
 *
 * Một gợi ý KHÔNG bao giờ tự áp vào văn bản. UI phải cho người dùng xem từng
 * gợi ý và chấp nhận/từ chối. Mọi offset là UTF-16 trong chuỗi gốc.
 */

const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

/**
 * @param {string} text văn bản gốc
 * @param {{type:string, severity?:string, language:string, start:number, end:number,
 *   replacement:string, reason:string, source?:string, ruleId?:string}} spec
 * @returns {object}
 */
function makeSuggestion(text, spec) {
  const start = spec.start;
  const end = spec.end;
  const original = String(text).slice(start, end);
  return {
    id: `${spec.ruleId || spec.type}-${start}-${end}`,
    type: spec.type,
    severity: spec.severity || SEVERITY.WARNING,
    language: spec.language || 'unknown',
    start,
    end,
    original,
    replacement: spec.replacement,
    reason: spec.reason,
    source: spec.source || 'deterministic-rule',
    ruleId: spec.ruleId || null,
    accepted: false,
  };
}

/** Sắp xếp và loại gợi ý chồng lấn (giữ gợi ý xuất hiện trước, ưu tiên lỗi). */
function sortSuggestions(list) {
  const weight = { error: 0, warning: 1, info: 2 };
  const sorted = [...list].sort((a, b) => a.start - b.start
    || (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
    || a.end - b.end);
  const out = [];
  let cursor = -1;
  for (const item of sorted) {
    if (item.start < cursor) continue;
    out.push(item);
    cursor = item.end;
  }
  return out;
}

function suggestionStats(list) {
  return {
    total: list.length,
    byType: list.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: list.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
  };
}

Object.assign(__exports, { SEVERITY, makeSuggestion, sortSuggestions, suggestionStats });
};

__modules["writing/language.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/language.js — nhận diện ngôn ngữ ở mức đủ dùng.
 *
 * Không phải language detector thống kê. Mục tiêu: KHÔNG áp luật tiếng Anh lên
 * văn bản tiếng Việt. Khi không chắc, trả 'unknown' và caller chỉ chạy các luật
 * an toàn cho mọi ngôn ngữ.
 */

/** Chữ chỉ có trong tiếng Việt (hoặc rất đặc trưng). */
const VI_SPECIFIC = /[ăâđêôơưĂÂĐÊÔƠƯ]/;
const VI_TONES = /[àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/** Từ chức năng tiếng Việt / tiếng Anh để chấm điểm. */
const VI_WORDS = /\b(và|của|là|không|được|cho|với|trong|những|các|một|này|để|khi|nếu|nhưng|vì|nên)\b/gi;
const EN_WORDS = /\b(the|and|of|to|is|are|was|were|with|for|that|this|not|from|have|has|will|would|can)\b/gi;

function detectLanguage(text) {
  const source = String(text || '');
  const letters = source.match(/\p{L}/gu) || [];
  if (!letters.length) return 'unknown';
  const ascii = letters.filter(ch => ch.codePointAt(0) < 0x80).length;
  const viHits = (source.match(VI_WORDS) || []).length;
  const enHits = (source.match(EN_WORDS) || []).length;
  const viMarkers = (source.match(new RegExp(VI_SPECIFIC.source, 'g')) || []).length
    + (source.match(VI_TONES) || []).length;

  if (viMarkers >= 2 || (viMarkers >= 1 && viHits >= 2)) return 'vi';
  if (viHits >= 3 && viHits > enHits) return 'vi';
  if (enHits >= 2 && enHits >= viHits) return 'en';
  if (ascii / letters.length > 0.95) return 'en';
  return 'unknown';
}

/** Ngôn ngữ được hỗ trợ luật deterministic. */
const SUPPORTED_LANGUAGES = Object.freeze(['en', 'vi']);

Object.assign(__exports, { detectLanguage, SUPPORTED_LANGUAGES });
};

__modules["writing/grammar/en.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/grammar/en.js — luật tiếng Anh deterministic.
 *
 * Chỉ những sửa đổi KHÔNG phụ thuộc ngữ cảnh. Không có luật nào đoán ý người
 * viết, không đổi từ đồng nghĩa, không "làm hay hơn". Mọi match đều thành gợi ý
 * để người dùng duyệt, không tự áp.
 */

const REPEAT_ALLOWED = new Set(['had', 'that', 'is', 'no', 'very', 'ha', 'so', 'by', 'on', 'out']);

const IRREGULAR = {
  went: 'gone', came: 'come', saw: 'seen', did: 'done', took: 'taken', wrote: 'written',
  spoke: 'spoken', broke: 'broken', chose: 'chosen', gave: 'given', knew: 'known',
  threw: 'thrown', began: 'begun', drank: 'drunk', ate: 'eaten', fell: 'fallen',
  forgot: 'forgotten', got: 'got', hid: 'hidden', rode: 'ridden', rang: 'rung',
  sang: 'sung', swam: 'swum', wore: 'worn', drove: 'driven', flew: 'flown',
  grew: 'grown', drew: 'drawn', stole: 'stolen', froze: 'frozen', shook: 'shaken',
};

const MISSPELLINGS = {
  alot: 'a lot', definately: 'definitely', seperate: 'separate', recieve: 'receive',
  occured: 'occurred', untill: 'until', teh: 'the', wich: 'which', thier: 'their',
  becuase: 'because', accomodate: 'accommodate', arguement: 'argument',
  enviroment: 'environment', goverment: 'government', neccessary: 'necessary',
  publically: 'publicly', refered: 'referred', succesful: 'successful',
  tommorow: 'tomorrow', wierd: 'weird', adress: 'address', calender: 'calendar',
};

const VOWEL_EXCEPTIONS = /^(uni|use|user|usu|uti|eu|one|once|ubiq)/i;
const CONSONANT_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

/** @type {Array<{id:string,type:string,severity:string,run:(text:string)=>Array<object>}>} */
const EN_RULES = [
  {
    id: 'en.repeated-word',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /\b([A-Za-z]{2,})([ \t]+)\1\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (REPEAT_ALLOWED.has(m[1].toLowerCase())) continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'en.would-of',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(would|could|should|must|might)\s+of\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({
          start: m.index, end: m.index + m[0].length,
          replacement: `${m[1]} have`,
          reason: 'Sau động từ khuyết thiếu là "have", không phải "of".',
        });
      }
      return out;
    },
  },
  {
    id: 'en.irregular-participle',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(has|have|had)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const past = m[2].toLowerCase();
        const fixed = IRREGULAR[past];
        if (!fixed || fixed === past) continue;
        out.push({
          start: m.index, end: m.index + m[0].length,
          replacement: `${m[1]} ${fixed}`,
          reason: `Thì hoàn thành cần quá khứ phân từ "${fixed}", không phải "${m[2]}".`,
        });
      }
      return out;
    },
  },
  {
    id: 'en.spelling-common',
    type: 'spelling',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b[a-z]{3,}\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const fixed = MISSPELLINGS[m[0].toLowerCase()];
        if (!fixed) continue;
        const replacement = m[0][0] === m[0][0].toUpperCase()
          ? fixed[0].toUpperCase() + fixed.slice(1)
          : fixed;
        out.push({ start: m.index, end: m.index + m[0].length, replacement, reason: `Lỗi chính tả: "${m[0]}" → "${fixed}".` });
      }
      return out;
    },
  },
  {
    id: 'en.article-a-an',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /\b(a|an)[ \t]+([A-Za-z][a-z]*)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const article = m[1].toLowerCase();
        const word = m[2];
        const vowelLetter = /^[aeiou]/i.test(word);
        // "a university" / "an hour": âm đầu quyết định, không phải chữ cái.
        const vowelSound = (vowelLetter && !VOWEL_EXCEPTIONS.test(word)) || CONSONANT_EXCEPTIONS.test(word);
        if (article === 'a' && vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'an', reason: `Trước "${word}" dùng "an".` });
        } else if (article === 'an' && !vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'a', reason: `Trước "${word}" dùng "a".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.space-before-punctuation',
    type: 'punctuation',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'en.space-after-comma',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /([,;])(?=[A-Za-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + 1, replacement: m[1] + ' ', reason: 'Cần một khoảng trắng sau dấu phẩy/chấm phẩy.' });
      }
      return out;
    },
  },
  {
    id: 'en.double-space',
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
  {
    id: 'en.lowercase-i',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /(^|[^A-Za-z])i(?=[^A-Za-z]|$)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: 'I', reason: 'Đại từ "I" luôn viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'en.sentence-start',
    type: 'capitalization',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /(^|[.!?][ \t]+)([a-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: m[2].toUpperCase(), reason: 'Đầu câu phải viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'en.was-were',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(they|we|you|these|those)\s+was\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} were`, reason: `Chủ ngữ số nhiều/ngôi hai đi với "were".` });
      }
      return out;
    },
  },
  {
    id: 'en.third-person-dont',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(he|she|it)\s+(don't|do not)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const negated = m[2].toLowerCase() === "don't" ? "doesn't" : 'does not';
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} ${negated}`, reason: 'Ngôi thứ ba số ít dùng "doesn\'t".' });
      }
      return out;
    },
  },
];


Object.assign(__exports, { IRREGULAR, MISSPELLINGS, EN_RULES });
};

__modules["writing/grammar/vi.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/grammar/vi.js — luật tiếng Việt deterministic.
 *
 * Giới hạn phải nói thẳng: đây KHÔNG phải bộ ngữ pháp tiếng Việt. Nó bắt được
 * lỗi gõ/cách khoảng trắng/lặp từ và một danh sách lỗi chính tả không mơ hồ.
 * Không đụng dấu thanh, không đổi từ đồng nghĩa, không sửa trật tự từ.
 */

/** Tiếng Việt rất ít khi lặp từ có chủ đích; không có ngoại lệ mặc định. */
const REPEAT_ALLOWED = new Set();

/** Lỗi chính tả phổ biến, nghĩa không đổi khi sửa. */
const TYPOS = {
  'sử lý': 'xử lý',
  'xử dụng': 'sử dụng',
  'sử dụng được': 'sử dụng được',
  'bỡi vì': 'bởi vì',
  'bởi zì': 'bởi vì',
  'vì zậy': 'vì vậy',
  'cũng như là': 'cũng như',
  'nói chung là': 'nói chung',
  'ngoài ra thì': 'ngoài ra',
  'tuy nhiên thì': 'tuy nhiên',
};

/** @type {Array<{id:string,type:string,severity:string,run:(text:string)=>Array<object>}>} */
const VI_RULES = [
  {
    id: 'vi.repeated-word',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /(^|[^\p{L}])([\p{L}]{2,})([ \t]+)\2(?=[^\p{L}]|$)/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (REPEAT_ALLOWED.has(m[2].toLowerCase())) continue;
        const start = m.index + m[1].length;
        out.push({ start, end: start + m[2].length, replacement: m[2], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'vi.typo-phrase',
    type: 'spelling',
    severity: 'error',
    run(text) {
      const out = [];
      for (const [wrong, right] of Object.entries(TYPOS)) {
        if (wrong === right) continue;
        const re = new RegExp(`(?<![\\p{L}])${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: right, reason: `Cách viết thường dùng: "${right}".` });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.space-before-punctuation',
    type: 'punctuation',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-comma',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /([,;:])(?=[\p{L}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + 1, replacement: m[1] + ' ', reason: 'Cần một khoảng trắng sau dấu phẩy/hai chấm.' });
      }
      return out;
    },
  },
  {
    id: 'vi.double-space',
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
  {
    id: 'vi.sentence-start',
    type: 'capitalization',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /(^|[.!?][ \t]+)([a-zàáảãạăâđêôơư])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: m[2].toUpperCase(), reason: 'Đầu câu phải viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'vi.repeated-punctuation',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /([,;:])\1+/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Dấu câu bị lặp.' });
      }
      return out;
    },
  },
];


Object.assign(__exports, { TYPOS, VI_RULES });
};

__modules["writing/grammar/index.js"] = function (__exports) {
'use strict';
/**
 * packages/writing/grammar/index.js — phân tích văn bản thành gợi ý sửa.
 *
 * Chạy trên TỪNG ĐOẠN VĂN XUÔI của core (code, URL, email, thẻ HTML được bảo vệ),
 * nên không bao giờ "sửa" nội dung code hoặc link.
 *
 * Không có gợi ý nào được tự áp: `applySuggestion()` là hành động riêng, do người
 * dùng bấm, và nó kiểm tra lại `original` trước khi ghi.
 */

const { segmentText } = __require("core/cleaning.js");
const { applyEdits } = __require("core/diff.js");
const { detectLanguage, SUPPORTED_LANGUAGES } = __require("writing/language.js");
const { makeSuggestion, sortSuggestions, suggestionStats, SEVERITY } = __require("writing/suggestions.js");
const { EN_RULES } = __require("writing/grammar/en.js");
const { VI_RULES } = __require("writing/grammar/vi.js");

const GRAMMAR_SCHEMA_VERSION = '1.0';

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
function analyze(text, options = {}) {
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
function applySuggestion(text, suggestion, options = {}) {
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
function applySuggestions(text, suggestions, options = {}) {
  const edits = (suggestions || []).map(item => ({
    start: item.start,
    end: item.end,
    find: item.original,
    replace: item.replacement,
  }));
  return applyEdits(text, edits, { sourceRevision: options.sourceRevision });
}


Object.assign(__exports, { GRAMMAR_SCHEMA_VERSION, analyze, applySuggestion, applySuggestions });
};

__modules["providers/errors.js"] = function (__exports) {
'use strict';
/**
 * packages/providers/errors.js — hợp đồng lỗi duy nhất cho mọi bề mặt.
 *
 * Web và Extension phải trả cùng mã cho cùng một kiểu hỏng. Không nơi nào được
 * ném chuỗi lỗi thô của provider ra UI, và không bao giờ đưa API key vào message.
 */

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_MODEL_UNAVAILABLE: 'PROVIDER_MODEL_UNAVAILABLE',
  PROVIDER_EMPTY_RESPONSE: 'PROVIDER_EMPTY_RESPONSE',
  PROVIDER_BAD_RESPONSE: 'PROVIDER_BAD_RESPONSE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CANCELLED: 'CANCELLED',
  STALE_DOCUMENT_REVISION: 'STALE_DOCUMENT_REVISION',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  PARSER_ERROR: 'PARSER_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const RETRYABLE = Object.freeze(new Set([
  ERROR_CODES.PROVIDER_TIMEOUT,
  ERROR_CODES.PROVIDER_UNAVAILABLE,
  ERROR_CODES.PROVIDER_RATE_LIMIT,
  ERROR_CODES.NETWORK_ERROR,
]));

/**
 * @param {string} code mã trong ERROR_CODES
 * @param {string} message câu cho người dùng, không chứa key
 * @param {{retryable?:boolean, status?:number|null, model?:string|null}} [extra]
 */
function providerError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.retryable = extra.retryable ?? RETRYABLE.has(code);
  if (extra.status != null) error.status = extra.status;
  if (extra.model) error.model = extra.model;
  return error;
}

/** Che key nếu provider lỡ nhét vào body lỗi. */
function redactSecrets(text, key) {
  let out = String(text ?? '');
  if (key && typeof key === 'string' && key.length >= 8) {
    out = out.split(key).join('[redacted-key]');
  }
  return out
    .replace(/\b(AIza|AQ\.|sk-)[A-Za-z0-9_\-]{6,}/g, '[redacted-key]')
    .replace(/("?(?:api[_-]?key|authorization|x-goog-api-key)"?\s*[:=]\s*)"?[^",\s}]{8,}"?/gi, '$1"[redacted-key]"');
}

/** HTTP status → mã lỗi ổn định. */
function errorFromStatus(status, body, key) {
  const detail = redactSecrets(String(body ?? ''), key).slice(0, 180);
  if (status === 401 || status === 403) {
    return providerError(ERROR_CODES.PROVIDER_AUTH_ERROR, `HTTP ${status} — API key sai hoặc không có quyền. ${detail}`.trim(), { status });
  }
  if (status === 429) {
    return providerError(ERROR_CODES.PROVIDER_RATE_LIMIT, `HTTP 429 — hết lượt gọi hoặc bị giới hạn tốc độ. ${detail}`.trim(), { status, retryable: true });
  }
  if (status === 404) {
    return providerError(ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE, `HTTP 404 — model không tồn tại hoặc không phục vụ generateContent. ${detail}`.trim(), { status });
  }
  if (status === 400 || status === 422) {
    return providerError(ERROR_CODES.VALIDATION_ERROR, `HTTP ${status} — request bị từ chối. ${detail}`.trim(), { status });
  }
  if (status >= 500) {
    return providerError(ERROR_CODES.PROVIDER_UNAVAILABLE, `HTTP ${status} — nhà cung cấp đang lỗi. ${detail}`.trim(), { status, retryable: true });
  }
  return providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, `HTTP ${status} — ${detail}`.trim(), { status });
}

/**
 * Chuẩn hoá bất kỳ lỗi nào thành mã ổn định.
 * @param {unknown} error
 * @param {{timeoutMs?:number, key?:string, cancelled?:boolean}} [context]
 */
function normalizeError(error, context = {}) {
  if (!error) return providerError(ERROR_CODES.INTERNAL_ERROR, 'lỗi không xác định');
  if (error.code && ERROR_CODES[error.code]) return error;
  const timeoutMs = context.timeoutMs ?? 60000;
  if (error.name === 'AbortError' || /aborted/i.test(String(error.message || ''))) {
    return context.cancelled
      ? providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.', { retryable: false })
      : providerError(ERROR_CODES.PROVIDER_TIMEOUT, `Quá ${Math.round(timeoutMs / 1000)}s không có phản hồi.`, { retryable: true });
  }
  const message = redactSecrets(String(error.message || error), context.key);
  if (/Failed to fetch|NetworkError|net::ERR|ENOTFOUND|ECONNREFUSED|CORS/i.test(message)) {
    return providerError(ERROR_CODES.NETWORK_ERROR, 'Không kết nối được tới API — kiểm tra mạng, Base URL hoặc CORS.', { retryable: true });
  }
  if (/JSON/i.test(message)) return providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi không phải JSON hợp lệ.');
  return providerError(ERROR_CODES.INTERNAL_ERROR, message);
}

/** Kết quả lỗi để trả qua message passing / UI (không chứa stack, không chứa key). */
function errorPayload(error, context) {
  const normalized = normalizeError(error, context);
  return { error: normalized.message, code: normalized.code, retryable: !!normalized.retryable };
}

Object.assign(__exports, { ERROR_CODES, RETRYABLE, providerError, redactSecrets, errorFromStatus, normalizeError, errorPayload });
};

__modules["providers/request.js"] = function (__exports) {
'use strict';
/**
 * packages/providers/request.js — timeout, huỷ, đọc JSON, chống request trùng.
 *
 * Timeout KHÁC huỷ: timeout do đồng hồ, huỷ do người dùng. Hai nguyên nhân phải
 * ra hai mã lỗi khác nhau, nếu không UI không thể nói đúng chuyện gì xảy ra.
 */

const { providerError, errorFromStatus, ERROR_CODES, normalizeError } = __require("providers/errors.js");

const DEFAULT_TIMEOUT_MS = 60000;
/** Chỉ cho phép http:// với loopback khi phát triển. */
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chạy một tác vụ có signal với timeout + huỷ ngoài.
 * @template T
 * @param {(signal:AbortSignal)=>Promise<T>} run
 * @param {{timeoutMs?:number, signal?:AbortSignal, key?:string}} [options]
 * @returns {Promise<T>}
 */
async function withTimeout(run, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let cancelled = false;
  let timedOut = false;

  const onExternalAbort = () => { cancelled = true; controller.abort(); };
  if (options.signal) {
    if (options.signal.aborted) {
      throw providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.');
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (cancelled) throw providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.');
    if (timedOut) {
      throw providerError(ERROR_CODES.PROVIDER_TIMEOUT,
        `Quá ${Math.round(timeoutMs / 1000)}s không có phản hồi.`, { retryable: true });
    }
    throw normalizeError(error, { timeoutMs, key: options.key });
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);
  }
}

/** Đọc body có giới hạn kích thước, rồi parse JSON. */
async function readJson(res, { key, maxBytes = 1_000_000 } = {}) {
  const text = await res.text();
  if (text.length > maxBytes) {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi quá lớn để xử lý an toàn.');
  }
  if (!res.ok) throw errorFromStatus(res.status, text, key);
  try {
    return JSON.parse(text);
  } catch {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi không phải JSON hợp lệ.');
  }
}

/** Base URL: bắt buộc https, trừ loopback khi phát triển. */
function validateBaseUrl(base) {
  const value = String(base ?? '').trim();
  if (!value) return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Thiếu Base URL.') };
  let url;
  try { url = new URL(value); } catch {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Base URL không hợp lệ.') };
  }
  if (url.protocol === 'https:') return { ok: true, url };
  if (url.protocol === 'http:' && LOOPBACK.test(value)) return { ok: true, url, insecureLocalhost: true };
  return {
    ok: false,
    error: providerError(ERROR_CODES.CONFIG_ERROR,
      'Base URL phải dùng https:// (chỉ http://localhost được phép khi phát triển).'),
  };
}

/**
 * Sổ request đang chạy: chống gửi trùng, cho phép huỷ đúng request,
 * và đảm bảo phản hồi cũ không ghi đè kết quả mới.
 */
class RequestRegistry {
  constructor() { this.items = new Map(); }

  /** @returns {{id:string, signal:AbortSignal}|null} null nếu id đã tồn tại */
  start(id) {
    if (this.items.has(id)) return null;
    const controller = new AbortController();
    this.items.set(id, controller);
    return { id, signal: controller.signal };
  }

  isRunning(id) { return this.items.has(id); }

  cancel(id) {
    const controller = this.items.get(id);
    if (!controller) return false;
    controller.abort();
    this.items.delete(id);
    return true;
  }

  finish(id) { this.items.delete(id); }

  /** Huỷ tất cả (dùng khi trang đóng / extension reload). */
  cancelAll() {
    const ids = [...this.items.keys()];
    for (const id of ids) this.cancel(id);
    return ids;
  }

  get size() { return this.items.size; }
}

/** Tạo id request ổn định cho UI. */
function requestId(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}


Object.assign(__exports, { DEFAULT_TIMEOUT_MS, LOOPBACK, sleep, withTimeout, readJson, validateBaseUrl, RequestRegistry, requestId });
};

__modules["providers/google.js"] = function (__exports) {
'use strict';
/**
 * packages/providers/google.js — Google Gemini / Generative Language API.
 *
 * Không giữ state, không đọc localStorage: caller truyền key và base URL.
 * `fetchImpl` cho phép test bằng fetch giả mà không cần API key thật.
 */

const { providerError, ERROR_CODES, redactSecrets } = __require("providers/errors.js");
const { withTimeout, readJson, validateBaseUrl, DEFAULT_TIMEOUT_MS } = __require("providers/request.js");

const GOOGLE_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GOOGLE_DEFAULT_MODEL = 'gemini-3.8-flash';
/** 11/2026: gemma-* trả 404 trên v1beta; model 2.5 chỉ còn cho key cũ. */
const GOOGLE_FALLBACK_MODELS = Object.freeze([
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
]);

const SYSTEM = 'You are a precise line editor. Never invent facts, names, numbers, technologies or URLs. '
  + 'Never delete a list item, a negation, a condition or a citation.';

function validateConfiguration(cfg = {}) {
  if (!String(cfg.key ?? '').trim()) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Chưa có API key cho Google Gemini.') };
  }
  const base = String(cfg.base || GOOGLE_DEFAULT_BASE).trim();
  const validated = validateBaseUrl(base);
  if (!validated.ok) return validated;
  const model = String(cfg.model || GOOGLE_DEFAULT_MODEL).replace(/^models\//, '');
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model)) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Tên model không hợp lệ.') };
  }
  return { ok: true, base: base.replace(/\/+$/, ''), model, key: String(cfg.key).trim() };
}

/**
 * @param {{key:string, base?:string, model:string, prompt:string, text:string,
 *   signal?:AbortSignal, timeoutMs?:number, fetchImpl?:Function,
 *   temperature?:number, maxOutputTokens?:number}} options
 * @returns {Promise<{text:string, model:string}>}
 */
async function generate(options) {
  const check = validateConfiguration(options);
  if (!check.ok) throw check.error;
  const { key, base, model } = check;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw providerError(ERROR_CODES.CONFIG_ERROR, 'Môi trường không có fetch.');
  }
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;

  const json = await withTimeout(async signal => {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `${options.prompt}\n\n---\n${options.text}` }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.85,
          topP: 0.95,
          maxOutputTokens: options.maxOutputTokens ?? 4096,
        },
      }),
    });
    return readJson(res, { key });
  }, { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options.signal, key });

  if (json?.promptFeedback?.blockReason) {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE,
      `Bị safety filter chặn: ${redactSecrets(json.promptFeedback.blockReason, key)}`);
  }
  const candidate = (json?.candidates || [])[0];
  if (!candidate) throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE, 'Model không trả candidate nào.');
  const parts = candidate?.content?.parts || [];
  const out = parts.map(part => part.text || '').join('').trim();
  if (!out) {
    throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE,
      `Model trả về rỗng (finishReason: ${candidate.finishReason || '?'}).`);
  }
  return { text: out, model };
}

/** Danh sách model khai báo generateContent. */
async function listModels(options = {}) {
  const check = validateConfiguration({ ...options, model: options.model || GOOGLE_DEFAULT_MODEL });
  if (!check.ok) throw check.error;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const base = String(options.base || GOOGLE_DEFAULT_BASE).replace(/\/+$/, '');
  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/models?pageSize=200`, {
      signal,
      headers: { 'x-goog-api-key': check.key },
    });
    return readJson(res, { key: check.key });
  }, { timeoutMs: options.timeoutMs ?? 20000, signal: options.signal, key: check.key });
  return (json?.models || [])
    .filter(model => (model.supportedGenerationMethods || []).includes('generateContent'))
    .map(model => String(model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
}


Object.assign(__exports, { GOOGLE_DEFAULT_BASE, GOOGLE_DEFAULT_MODEL, GOOGLE_FALLBACK_MODELS, validateConfiguration, generate, listModels });
};

__modules["providers/openai-compatible.js"] = function (__exports) {
'use strict';
/**
 * packages/providers/openai-compatible.js — /chat/completions.
 *
 * Dùng được cho OpenAI, OpenRouter, Groq, Ollama… miễn là tương thích.
 * Base URL vẫn phải https, trừ loopback khi phát triển (Ollama ở localhost).
 */

const { providerError, ERROR_CODES } = __require("providers/errors.js");
const { withTimeout, readJson, validateBaseUrl, DEFAULT_TIMEOUT_MS } = __require("providers/request.js");

const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM = 'You are a precise line editor. Never invent facts, names, numbers, technologies or URLs. '
  + 'Never delete a list item, a negation, a condition or a citation.';

function validateConfiguration(cfg = {}) {
  if (!String(cfg.key ?? '').trim()) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Chưa có API key cho nhà cung cấp này.') };
  }
  const base = String(cfg.base || OPENAI_DEFAULT_BASE).trim();
  const validated = validateBaseUrl(base);
  if (!validated.ok) return validated;
  const model = String(cfg.model || OPENAI_DEFAULT_MODEL).trim();
  if (!model || model.length > 120) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Tên model không hợp lệ.') };
  }
  return { ok: true, base: base.replace(/\/+$/, ''), model, key: String(cfg.key).trim() };
}

async function generate(options) {
  const check = validateConfiguration(options);
  if (!check.ok) throw check.error;
  const { key, base, model } = check;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw providerError(ERROR_CODES.CONFIG_ERROR, 'Môi trường không có fetch.');
  }

  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.85,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${options.prompt}\n\n---\n${options.text}` },
        ],
      }),
    });
    return readJson(res, { key });
  }, { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options.signal, key });

  const content = json?.choices?.[0]?.message?.content;
  const out = typeof content === 'string' ? content.trim() : '';
  if (!out) throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE, 'Model không trả nội dung.');
  return { text: out.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim(), model };
}

async function listModels(options = {}) {
  const check = validateConfiguration({ ...options, model: options.model || OPENAI_DEFAULT_MODEL });
  if (!check.ok) throw check.error;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const base = String(options.base || OPENAI_DEFAULT_BASE).replace(/\/+$/, '');
  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/models`, {
      signal,
      headers: { Authorization: `Bearer ${check.key}` },
    });
    return readJson(res, { key: check.key });
  }, { timeoutMs: options.timeoutMs ?? 20000, signal: options.signal, key: check.key });
  return (json?.data || []).map(model => model.id).filter(Boolean);
}

Object.assign(__exports, { OPENAI_DEFAULT_BASE, OPENAI_DEFAULT_MODEL, validateConfiguration, generate, listModels });
};

__modules["providers/registry.js"] = function (__exports) {
'use strict';
/**
 * packages/providers/registry.js — một API duy nhất cho Web và Extension.
 *
 * `generate()` chuẩn hoá: chọn provider, tự đổi model khi 404, thử lại một lần
 * khi 5xx, và luôn trả cùng shape. Caller không cần biết provider nào.
 */

const { generate: googleGenerate, listModels: googleListModels, validateConfiguration: googleValidate, GOOGLE_FALLBACK_MODELS } = __require("providers/google.js");
const { generate: openaiGenerate, listModels: openaiListModels, validateConfiguration: openaiValidate } = __require("providers/openai-compatible.js");
const { providerError, ERROR_CODES, normalizeError } = __require("providers/errors.js");
const { sleep } = __require("providers/request.js");

const SCHEMA_VERSION = '1.0';

const MODULES = Object.freeze({
  google: { generate: googleGenerate, listModels: googleListModels, validateConfiguration: googleValidate },
  openai: { generate: openaiGenerate, listModels: openaiListModels, validateConfiguration: openaiValidate },
});

function resolveProvider(name) {
  const key = name === 'openai' || name === 'openai-compatible' ? 'openai' : 'google';
  return { name: key, module: MODULES[key] };
}

/** @returns {{ok:true, provider:string, base:string, model:string, key:string}|{ok:false, error:Error}} */
function validateConfiguration(cfg = {}) {
  const { name, module } = resolveProvider(cfg.provider);
  const check = module.validateConfiguration(cfg);
  if (!check.ok) return check;
  return { ...check, provider: name };
}

async function listModels(cfg = {}, options = {}) {
  const { module } = resolveProvider(cfg.provider);
  const models = await module.listModels({ ...cfg, ...options });
  return [...new Set(models)].sort();
}

/**
 * Sinh văn bản.
 * @param {object} cfg {provider, key, base, model}
 * @param {{text:string, prompt:string, signal?:AbortSignal, timeoutMs?:number,
 *   fetchImpl?:Function, retryDelayMs?:number, requestId?:string, onModelSwitch?:Function}} options
 * @returns {Promise<{text:string, model:string, provider:string, requestId:string|null, schemaVersion:string}>}
 */
async function generate(cfg = {}, options = {}) {
  const check = validateConfiguration(cfg);
  if (!check.ok) throw check.error;
  const { name, module } = resolveProvider(check.provider);
  const retryDelayMs = options.retryDelayMs ?? 1800;
  const requestId = options.requestId ?? null;

  if (name !== 'google') {
    const result = await module.generate({
      ...cfg,
      key: check.key,
      base: check.base,
      model: check.model,
      prompt: options.prompt,
      text: options.text,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    return { ...result, provider: name, requestId, schemaVersion: SCHEMA_VERSION };
  }

  const models = [check.model, ...GOOGLE_FALLBACK_MODELS]
    .filter((model, index, all) => model && all.indexOf(model) === index);
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        if (model !== check.model && typeof options.onModelSwitch === 'function') {
          options.onModelSwitch(model, check.model);
        }
        const result = await module.generate({
          ...cfg,
          key: check.key,
          base: check.base,
          model,
          prompt: options.prompt,
          text: options.text,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          fetchImpl: options.fetchImpl,
        });
        return { ...result, provider: name, requestId, schemaVersion: SCHEMA_VERSION };
      } catch (error) {
        const normalized = normalizeError(error, { timeoutMs: options.timeoutMs, key: check.key });
        lastError = normalized;
        // Huỷ và hết quota không nên thử model khác: người dùng cần biết ngay.
        if (normalized.code === ERROR_CODES.CANCELLED
          || normalized.code === ERROR_CODES.PROVIDER_AUTH_ERROR
          || normalized.code === ERROR_CODES.PROVIDER_RATE_LIMIT
          || normalized.code === ERROR_CODES.PROVIDER_TIMEOUT) {
          throw normalized;
        }
        if (normalized.code === ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE) break; // đổi model
        if (normalized.code === ERROR_CODES.PROVIDER_UNAVAILABLE && attempt === 0) {
          if (retryDelayMs > 0) await sleep(retryDelayMs);
          continue;
        }
        if (normalized.code === ERROR_CODES.VALIDATION_ERROR) throw normalized;
        if (normalized.code === ERROR_CODES.NETWORK_ERROR) throw normalized;
        break;
      }
    }
  }

  const tried = models.length > 1 ? ` (đã thử: ${models.join(', ')})` : '';
  throw providerError(
    lastError?.code || ERROR_CODES.PROVIDER_UNAVAILABLE,
    `${lastError?.message || 'không gọi được model nào'}${tried}`,
    { retryable: !!lastError?.retryable },
  );
}


Object.assign(__exports, { SCHEMA_VERSION, resolveProvider, validateConfiguration, listModels, generate });
};
globalThis.TraceCore = Object.assign(Object.create(null),
  __require("core/unicode.js"),
  __require("core/entities.js"),
  __require("core/markdown.js"),
  __require("core/preservation.js"),
  __require("core/diff.js"),
  __require("core/document.js"),
  __require("core/cleaning.js"),
  __require("core/limits.js"),
);
globalThis.TraceWriting = Object.assign(Object.create(null),
  __require("writing/prompts.js"),
  __require("writing/suggestions.js"),
  __require("writing/language.js"),
  __require("writing/grammar/index.js"),
);
globalThis.TraceProviders = Object.assign(Object.create(null),
  __require("providers/registry.js"),
  __require("providers/errors.js"),
  __require("providers/request.js"),
);
globalThis.TraceProviders.google = __require('providers/google.js');
globalThis.TraceProviders.openai = __require('providers/openai-compatible.js');
globalThis.TraceProviders.openaiCompatible = globalThis.TraceProviders.openai;
globalThis.TraceCore.__bundleLoaded = true;
globalThis.TraceCore.__engineVersion = '2.2';
})();
