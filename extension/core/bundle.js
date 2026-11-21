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

const { diffWords, diffStats, applyEdits } = __require("core/diff.js");

const DOCUMENT_ERRORS = Object.freeze({
  STALE_REVISION: 'STALE_DOCUMENT_REVISION',
  NO_PROPOSAL: 'NO_PROPOSAL',
  UNKNOWN_PROPOSAL: 'UNKNOWN_PROPOSAL',
  INVALID_REVISION: 'INVALID_REVISION',
  EDIT_REJECTED: 'EDIT_REJECTED',
});

/**
 * Metadata được phép gắn vào proposal. Mọi field khác bị bỏ — đây là lá chắn
 * chống việc caller (hoặc response của provider) ghi đè id/text/baseRevision
 * của proposal, tức là phá bất biến mà cơ chế chống stale dựa vào.
 */
const PROPOSAL_META_ALLOWED = Object.freeze([
  'source', 'provider', 'model', 'mode', 'language', 'requestId', 'reason', 'kind', 'confidence',
]);

function sanitizeProposalMeta(meta) {
  const out = {};
  if (!meta || typeof meta !== 'object') return out;
  for (const key of PROPOSAL_META_ALLOWED) {
    if (Object.prototype.hasOwnProperty.call(meta, key) && meta[key] !== undefined) out[key] = meta[key];
  }
  // `kind` và `confidence` có miền giá trị hữu hạn: giá trị lạ bị bỏ, không đoán.
  if (out.kind !== undefined && !['replace', 'suggestion', 'edit'].includes(out.kind)) delete out.kind;
  if (out.confidence !== undefined) {
    const value = Number(out.confidence);
    if (!Number.isFinite(value) || value < 0 || value > 1) delete out.confidence;
    else out.confidence = value;
  }
  return out;
}

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
    /** @type {Array<object>} proposal người dùng chủ động bỏ (không áp dụng) */
    this.rejectedProposals = [];
  }

  get revision() { return this.revisions[this.pointer].id; }

  /**
   * Đề xuất bản mới, chưa áp dụng. Proposal luôn gắn với revision hiện tại.
   * Metadata chỉ được phép ở `PROPOSAL_META_ALLOWED`; `id`, `text`,
   * `baseRevision`, `baseText` không thể bị ghi đè từ bên ngoài.
   */
  propose(text, meta = {}) {
    const proposal = Object.freeze({
      id: nextId('prop'),
      at: new Date().toISOString(),
      kind: 'replace',
      text: String(text ?? ''),
      baseRevision: this.revision,
      baseText: this.working,
      ...sanitizeProposalMeta(meta),
    });
    this.proposed = proposal.text;
    this.lastProposal = proposal;
    return proposal;
  }

  /**
   * Đề xuất từ một tập edit cục bộ (thay vì cả văn bản). Edit được áp trên bản
   * đang sửa; edit lệch vị trí bị từ chối, không đoán.
   */
  proposeEdits(edits, options = {}) {
    const result = applyEdits(this.working, edits, { sourceRevision: this.revision });
    if (!result.applied.length) {
      return errorResult(DOCUMENT_ERRORS.EDIT_REJECTED,
        'Không áp được edit nào: vị trí/nội dung không khớp bản hiện tại.',
        { rejected: result.rejected, conflicts: result.conflicts });
    }
    const proposal = this.propose(result.text, { ...options.meta, source: options.source || 'local-edit' });
    return { ok: true, proposal, applied: result.applied, rejected: result.rejected };
  }

  /**
   * Áp MỘT edit cục bộ đã được người dùng duyệt, không cần proposal toàn văn.
   * Dùng cho danh sách gợi ý grammar/style: mỗi gợi ý là một edit độc lập.
   * Offset sai hoặc nội dung đã đổi ⇒ từ chối, không ghi bừa.
   */
  applyLocalEdit(edit, meta = {}) {
    const result = applyEdits(this.working, [{
      start: edit.start,
      end: edit.end,
      find: edit.original ?? edit.find,
      replace: edit.replacement ?? edit.replace,
    }], { sourceRevision: this.revision });
    if (!result.applied.length || result.rejected.length || result.conflicts.length) {
      return errorResult(DOCUMENT_ERRORS.EDIT_REJECTED,
        'Gợi ý không còn khớp văn bản hiện tại (offset hoặc nội dung đã đổi).',
        { rejected: result.rejected, conflicts: result.conflicts });
    }
    this.accepted = result.text;
    this.working = result.text;
    this.proposed = null;
    this.lastProposal = null; // gợi ý còn lại dùng offset cũ → không còn hiệu lực
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept-suggestion',
      proposalId: null,
      ruleId: edit.ruleId || null,
      category: edit.category || null,
      edit: {
        start: edit.start,
        end: edit.end,
        original: edit.original ?? edit.find,
        replacement: edit.replacement ?? edit.replace,
      },
      meta: sanitizeProposalMeta(meta),
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return { ok: true, revision };
  }

  /**
   * Chấp nhận MỘT gợi ý (grammar/style) trên proposal hiện tại.
   * Đây là đường đi riêng cho "duyệt từng gợi ý": không thay cả tài liệu.
   */
  acceptEdit(proposalId, edit, meta = {}) {
    const proposal = this.lastProposal;
    if (!proposal) return errorResult(DOCUMENT_ERRORS.NO_PROPOSAL, 'Không có đề xuất nào để chấp nhận.');
    if (proposalId && proposalId !== proposal.id) {
      return errorResult(DOCUMENT_ERRORS.UNKNOWN_PROPOSAL, 'Đề xuất này không còn hiệu lực.', { proposalId });
    }
    if (!this.isProposalCurrent(proposal)) {
      this.staleProposals.push({ ...proposal, rejectedAt: new Date().toISOString(), reason: 'stale' });
      this.lastProposal = null;
      return errorResult(DOCUMENT_ERRORS.STALE_REVISION,
        'Tài liệu đã đổi sau khi gợi ý này được tạo. Hãy phân tích lại.',
        { proposalId: proposal.id, currentRevision: this.revision });
    }
    const result = applyEdits(this.working, [{
      start: edit.start,
      end: edit.end,
      find: edit.original ?? edit.find,
      replace: edit.replacement ?? edit.replace,
    }], { sourceRevision: this.revision });
    if (!result.applied.length || result.rejected.length || result.conflicts.length) {
      return errorResult(DOCUMENT_ERRORS.EDIT_REJECTED,
        'Gợi ý không còn khớp văn bản hiện tại (offset hoặc nội dung đã đổi).',
        { rejected: result.rejected, conflicts: result.conflicts });
    }
    this.accepted = result.text;
    this.working = result.text;
    this.proposed = null;
    // Sau khi sửa một chỗ, các gợi ý còn lại có offset cũ → không còn hợp lệ.
    this.lastProposal = null;
    const revision = {
      id: nextId('rev'),
      at: new Date().toISOString(),
      action: 'accept-suggestion',
      proposalId: proposal.id,
      ruleId: edit.ruleId || null,
      edit: { start: edit.start, end: edit.end, original: edit.original ?? edit.find, replacement: edit.replacement ?? edit.replace },
      meta: sanitizeProposalMeta(meta),
      text: this.working,
    };
    this.revisions = this.revisions.slice(0, this.pointer + 1).concat(revision);
    this.pointer = this.revisions.length - 1;
    return { ok: true, revision };
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

  /** Bỏ đề xuất, không đụng bản đang sửa. Lịch sử từ chối được giữ để rà soát. */
  reject(proposalId) {
    const rejected = this.lastProposal;
    if (proposalId && rejected && proposalId !== rejected.id) return null;
    this.proposed = null;
    if (rejected) {
      this.rejectedProposals.push({
        id: rejected.id,
        at: new Date().toISOString(),
        source: rejected.source || null,
        words: (rejected.text.trim().match(/\S+/g) || []).length,
      });
      this.lastProposal = null;
    }
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

  /**
   * So sánh hai revision bất kỳ (C6). Không đụng bản đang sửa.
   * @returns {{from:object|null, to:object|null, ops:Array<object>, stats:object, error?:string}}
   */
  compare(revisionA, revisionB) {
    const from = this.revisions.find(item => item.id === revisionA);
    const to = this.revisions.find(item => item.id === revisionB);
    if (!from || !to) return { from: null, to: null, ops: [], stats: { added: 0, removed: 0, kept: 0 }, error: DOCUMENT_ERRORS.INVALID_REVISION };
    const ops = diffWords(from.text, to.text);
    return { from: { id: from.id, at: from.at, action: from.action }, to: { id: to.id, at: to.at, action: to.action }, ops, stats: diffStats(ops) };
  }

  /** Khôi phục nội dung của một revision cũ thành revision MỚI (không xoá lịch sử). */
  restoreRevision(revisionId) {
    const target = this.revisions.find(item => item.id === revisionId);
    if (!target) return errorResult(DOCUMENT_ERRORS.INVALID_REVISION, 'Revision không tồn tại.', { revisionId });
    const revision = this.commit(target.text, 'restore-revision');
    revision.restoredFrom = target.id;
    return { ok: true, revision };
  }

  history() {
    return this.revisions.map((item, index) => ({
      id: item.id,
      at: item.at,
      action: item.action,
      words: (item.text.trim().match(/\S+/g) || []).length,
      proposalId: item.proposalId || null,
      ruleId: item.ruleId || null,
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
      rejectedCount: this.rejectedProposals.length,
      revisionCount: this.revisions.length,
    };
  }
}

function createDocument(text, meta) {
  return new DocumentSession(text, meta);
}

Object.assign(__exports, { DOCUMENT_ERRORS, PROPOSAL_META_ALLOWED, DocumentSession, createDocument });
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
const ENGINE_VERSION = '2.3';

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
  /** Số element tối đa trong một part XML. */
  maxXmlNodes: 400000,
  /** Số thuộc tính tối đa trong một part XML. */
  maxXmlAttributes: 800000,
  /** Số đoạn văn/bản ghi tối đa đọc từ một part (ghi chú, comment, cell). */
  maxXmlBlocks: 20000,
  /** Số trang PDF / slide PPTX / sheet XLSX được đọc. */
  maxPages: 60,
  maxSlides: 60,
  maxSheets: 40,
  /** Văn bản trích ra tối đa để hiển thị. */
  maxTextChars: 2 * MB,
  /** Thời gian parse tối đa cho một file (ms). */
  maxParsingMs: 8000,
  /** Số trang PDF tối đa đọc text (thấp hơn maxPages vì tốn CPU hơn). */
  maxPdfTextPages: 40,
  /** Số ký tự tối đa của một trang PDF sau khi trích. */
  maxPageTextChars: 200000,
  /** Số byte tối đa của một stream PDF sau khi giải nén. */
  maxPdfStreamBytes: 24 * MB,
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
  const bytes = xml instanceof Uint8Array ? xml.byteLength : utf8Size(String(xml ?? ''));
  const source = xml instanceof Uint8Array ? '' : String(xml ?? '');
  const fail = (reason, detail) => {
    const error = new Error(`XML không an toàn (${reason}): ${detail || name}`);
    error.code = 'PARSER_ERROR';
    error.reason = reason;
    return error;
  };
  if (bytes > limits.maxXmlBytes) throw fail('too_large', `${bytes} byte > ${limits.maxXmlBytes}`);
  if (/<!DOCTYPE/i.test(source)) throw fail('doctype', name);
  if (/<!ENTITY/i.test(source)) throw fail('entity_declaration', name);
  if (/SYSTEM\s+["'](?:https?|file):/i.test(source)) throw fail('external_entity', name);
  const depth = xmlDepth(source);
  if (depth > limits.maxXmlDepth) throw fail('too_deep', `${depth} > ${limits.maxXmlDepth}`);
  return true;
}

/** Độ dài UTF-8, không cấp phát bản encode. */
function utf8Size(value) {
  const source = String(value ?? '');
  let bytes = 0;
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < source.length
      && source.charCodeAt(i + 1) >= 0xDC00 && source.charCodeAt(i + 1) <= 0xDFFF) { bytes += 4; i += 1; }
    else bytes += 3;
  }
  return bytes;
}

/** Cắt văn bản trích ra để UI không render hàng chục MB. */
function clampText(text, limits = PARSER_LIMITS) {
  const source = String(text ?? '');
  if (source.length <= limits.maxTextChars) return { text: source, truncated: false };
  return { text: source.slice(0, limits.maxTextChars), truncated: true };
}

Object.assign(__exports, { PARSER_LIMITS, validateZipEntryName, checkZipBudget, xmlDepth, assertSafeXml, utf8Size, clampText });
};

__modules["core/zip.js"] = function (__exports) {
'use strict';
/**
 * packages/core/zip.js — đọc ZIP/OOXML với giới hạn được áp TRONG LÚC giải nén.
 *
 * Vì sao không dùng `new Response(stream).arrayBuffer()`: cách đó giải nén hết
 * entry rồi mới so `byteLength`, nên một entry 4 GB vẫn được cấp phát trước khi
 * bị từ chối. Ở đây từng chunk được đếm, và reader bị `cancel()` ngay khi vượt
 * ngân sách — bộ nhớ không bao giờ vượt quá giới hạn + một chunk.
 *
 * Giới hạn cứng lấy từ `limits.js`. Metadata trong central directory chỉ là gợi
 * ý: kích thước THẬT luôn được đếm lại, và lệch với khai báo là lỗi, không phải
 * chuyện bỏ qua.
 */

const { PARSER_LIMITS, validateZipEntryName } = __require("core/limits.js");

const ZIP_ERRORS = Object.freeze({
  NOT_ZIP: 'not_zip',
  ZIP64: 'zip64_unsupported',
  TRUNCATED: 'truncated',
  MALFORMED: 'malformed',
  ENCRYPTED: 'encrypted',
  UNSUPPORTED_METHOD: 'unsupported_method',
  TOO_MANY_ENTRIES: 'too_many_entries',
  ENTRY_TOO_LARGE: 'entry_too_large',
  ARCHIVE_TOO_LARGE: 'archive_too_large',
  SUSPICIOUS_EXPANSION: 'suspicious_expansion',
  SIZE_MISMATCH: 'size_mismatch',
  CRC_MISMATCH: 'crc_mismatch',
  DUPLICATE_ENTRY: 'duplicate_entry',
  OVERLAP: 'overlapping_data',
  UNSAFE_NAME: 'unsafe_name',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
});

/** Dưới ngưỡng này, tỉ lệ nở không đủ tin cậy để kết luận (text nhỏ nén rất tốt). */
const RATIO_MIN_BYTES = 1024 * 1024;

const ERROR_TEXT = {
  [ZIP_ERRORS.NOT_ZIP]: 'File không phải ZIP/OOXML hợp lệ (không thấy EOCD).',
  [ZIP_ERRORS.ZIP64]: 'Archive ZIP64 chưa được hỗ trợ — hãy lưu lại ở định dạng ZIP thường.',
  [ZIP_ERRORS.TRUNCATED]: 'Archive bị cắt cụt.',
  [ZIP_ERRORS.MALFORMED]: 'Cấu trúc archive không hợp lệ.',
  [ZIP_ERRORS.ENCRYPTED]: 'Entry được mã hoá — không đọc được khi chưa có mật khẩu.',
  [ZIP_ERRORS.UNSUPPORTED_METHOD]: 'Kiểu nén không hỗ trợ (chỉ store/deflate).',
  [ZIP_ERRORS.TOO_MANY_ENTRIES]: 'Archive có quá nhiều entry.',
  [ZIP_ERRORS.ENTRY_TOO_LARGE]: 'Một entry giải nén vượt giới hạn cho phép.',
  [ZIP_ERRORS.ARCHIVE_TOO_LARGE]: 'Tổng dung lượng giải nén vượt giới hạn cho phép.',
  [ZIP_ERRORS.SUSPICIOUS_EXPANSION]: 'Tỉ lệ nở của entry bất thường (nghi ZIP bomb).',
  [ZIP_ERRORS.SIZE_MISMATCH]: 'Kích thước giải nén thật khác metadata khai báo.',
  [ZIP_ERRORS.CRC_MISMATCH]: 'CRC32 không khớp — entry bị hỏng hoặc bị sửa.',
  [ZIP_ERRORS.DUPLICATE_ENTRY]: 'Archive có hai entry trùng tên.',
  [ZIP_ERRORS.OVERLAP]: 'Dữ liệu hai entry chồng lấn hoặc nằm ngoài vùng dữ liệu.',
  [ZIP_ERRORS.UNSAFE_NAME]: 'Tên entry không an toàn (đường dẫn tuyệt đối hoặc `..`).',
  [ZIP_ERRORS.CANCELLED]: 'Đã huỷ khi đang giải nén.',
  [ZIP_ERRORS.TIMEOUT]: 'Quá thời gian cho phép khi giải nén.',
};

/** Lỗi parse có mã máy đọc được; UI map sang thông điệp, không đoán từ message. */
function zipError(reason, detail) {
  const error = new Error(`${ERROR_TEXT[reason] || 'Lỗi archive.'}${detail ? ` (${detail})` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/** CRC32 (IEEE) trên một Uint8Array. */
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

/** Nguồn ReadableStream theo chunk, không copy cả entry vào Blob. */
function chunkStream(bytes, size = 65536) {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = Math.min(offset + size, bytes.length);
      controller.enqueue(bytes.subarray(offset, end));
      offset = end;
    },
  });
}

function checkDeadline(deadline) {
  if (deadline && Date.now() > deadline) throw zipError(ZIP_ERRORS.TIMEOUT);
}

function checkSignal(signal) {
  if (signal && signal.aborted) throw zipError(ZIP_ERRORS.CANCELLED);
}

/** Hợp nhất signal của archive và signal riêng của một lần đọc. */
function mergeSignals(a, b) {
  if (!a) return b || null;
  if (!b || a === b) return a;
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b]);
  }
  const merged = new AbortController();
  const forward = () => { try { merged.abort(); } catch { /* đã huỷ */ } };
  if (a.aborted || b.aborted) forward();
  else {
    a.addEventListener('abort', forward, { once: true });
    b.addEventListener('abort', forward, { once: true });
  }
  return merged.signal;
}

/**
 * Giải nén một entry với ngân sách được áp theo từng chunk.
 * @returns {Promise<Uint8Array>}
 */
async function inflateBounded(raw, { limits, budget, signal, deadline, name, maxBytes, isClosed }) {
  if (typeof DecompressionStream !== 'function') {
    throw zipError(ZIP_ERRORS.UNSUPPORTED_METHOD, 'môi trường không có DecompressionStream');
  }
  const stream = chunkStream(raw).pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  /* Abort phải tác động lên reader đang chờ, không chỉ được kiểm giữa hai
     vòng lặp: một chunk 64 KB vẫn có thể đang được inflate khi signal bắn. */
  const onAbort = () => { try { reader.cancel(); } catch { /* đã đóng */ } };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      checkSignal(signal);
      checkDeadline(deadline);
      if (isClosed && isClosed()) throw zipError(ZIP_ERRORS.MALFORMED, 'archive đã đóng khi đang đọc');
      const { done, value } = await reader.read();
      if (done) break;
      checkSignal(signal);
      total += value.byteLength;
      if (total > maxBytes) {
        throw zipError(ZIP_ERRORS.ENTRY_TOO_LARGE, `${name}: > ${maxBytes} byte`);
      }
      if (budget.observed + total > limits.maxTotalUncompressedBytes) {
        throw zipError(ZIP_ERRORS.ARCHIVE_TOO_LARGE, `${budget.observed + total} byte`);
      }
      chunks.push(value);
    }
  } catch (error) {
    // Huỷ phần còn lại: DecompressionStream dừng thật, không chạy tiếp ngầm.
    try { await reader.cancel(); } catch { /* reader đã đóng */ }
    if (signal && signal.aborted && error && error.reason !== ZIP_ERRORS.CANCELLED) {
      throw zipError(ZIP_ERRORS.CANCELLED, name);
    }
    throw error;
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
  checkSignal(signal);
  budget.observed += total;
  return concatChunks(chunks, total);
}

/** Đọc entry stored theo chunk, vẫn đếm và vẫn kiểm tra biên. */
async function copyBounded(raw, { limits, budget, signal, deadline, name, maxBytes, isClosed }) {
  const chunks = [];
  let total = 0;
  for (let offset = 0; offset < raw.length; offset += 65536) {
    checkSignal(signal);
    checkDeadline(deadline);
    if (isClosed && isClosed()) throw zipError(ZIP_ERRORS.MALFORMED, 'archive đã đóng khi đang đọc');
    const chunk = raw.subarray(offset, Math.min(offset + 65536, raw.length));
    total += chunk.byteLength;
    if (total > maxBytes) throw zipError(ZIP_ERRORS.ENTRY_TOO_LARGE, `${name}: > ${maxBytes} byte`);
    if (budget.observed + total > limits.maxTotalUncompressedBytes) {
      throw zipError(ZIP_ERRORS.ARCHIVE_TOO_LARGE, `${budget.observed + total} byte`);
    }
    chunks.push(chunk);
  }
  checkSignal(signal);
  budget.observed += total;
  return concatChunks(chunks, total);
}

function decodeName(u8) {
  /* OOXML yêu cầu tên part là UTF-8/ASCII. Trước đây rơi về latin1 khi decode
     lỗi, tức là chấp nhận tên không hợp lệ và có thể né kiểm tra traversal. */
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch { throw zipError(ZIP_ERRORS.MALFORMED, 'tên entry không phải UTF-8 hợp lệ'); }
}

/**
 * Mở archive và trả API đọc có giới hạn.
 *
 * @param {Uint8Array} input
 * @param {{limits?:object, signal?:AbortSignal, timeoutMs?:number}} [options]
 * @returns {Promise<{names:string[], entries:Array<object>, read:(name:string, opts?:{maxBytes?:number})=>Promise<Uint8Array|null>, readText:(name:string, opts?:object)=>Promise<string|null>, close:()=>void, stats:object}>}
 */
async function openZip(input, options = {}) {
  const limits = options.limits || PARSER_LIMITS;
  const signal = options.signal;
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : (options.deadline || 0);
  checkSignal(signal);
  if (!(input instanceof Uint8Array)) throw zipError(ZIP_ERRORS.MALFORMED, 'input không phải Uint8Array');
  const u8 = input;
  if (u8.length > limits.maxFileBytes) throw zipError(ZIP_ERRORS.ENTRY_TOO_LARGE, 'file đầu vào quá lớn');
  if (u8.length < 22) throw zipError(ZIP_ERRORS.NOT_ZIP);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  // EOCD: quét từ cuối, tôn trọng comment length thay vì chấp nhận mọi vị trí.
  let eocd = -1;
  const floor = Math.max(0, u8.length - 65557);
  for (let i = u8.length - 22; i >= floor; i--) {
    if (dv.getUint32(i, true) === 0x06054b50 && i + 22 + dv.getUint16(i + 20, true) <= u8.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw zipError(ZIP_ERRORS.NOT_ZIP);

  const diskNumber = dv.getUint16(eocd + 4, true);
  const cdDisk = dv.getUint16(eocd + 6, true);
  if (diskNumber !== 0 || cdDisk !== 0) throw zipError(ZIP_ERRORS.ZIP64, 'multi-disk');
  const declared = dv.getUint16(eocd + 10, true);
  const cdSize = dv.getUint32(eocd + 12, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdEntries = dv.getUint16(eocd + 8, true);
  if (declared === 0xFFFF || cdEntries === 0xFFFF || cdOffset === 0xFFFFFFFF || cdSize === 0xFFFFFFFF) {
    throw zipError(ZIP_ERRORS.ZIP64);
  }
  if (declared !== cdEntries) throw zipError(ZIP_ERRORS.MALFORMED, 'entry count không khớp');
  if (declared > limits.maxZipEntries) {
    throw zipError(ZIP_ERRORS.TOO_MANY_ENTRIES, `${declared} > ${limits.maxZipEntries}`);
  }
  if (cdOffset + cdSize > u8.length) throw zipError(ZIP_ERRORS.TRUNCATED, 'central directory');

  const map = new Map();
  const entries = [];
  let off = cdOffset;
  let declaredTotal = 0;
  for (let i = 0; i < declared; i++) {
    checkSignal(signal);
    checkDeadline(deadline);
    if (off + 46 > u8.length) throw zipError(ZIP_ERRORS.TRUNCATED, 'central directory header');
    if (dv.getUint32(off, true) !== 0x02014b50) throw zipError(ZIP_ERRORS.MALFORMED, 'chữ ký central directory sai');
    const flags = dv.getUint16(off + 8, true);
    const method = dv.getUint16(off + 10, true);
    const crc = dv.getUint32(off + 16, true);
    const compressedSize = dv.getUint32(off + 20, true);
    const size = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    if (off + 46 + nameLen > u8.length) throw zipError(ZIP_ERRORS.TRUNCATED, 'tên entry');
    const name = decodeName(u8.subarray(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commentLen;
    if (off > cdOffset + cdSize && i === declared - 1) {
      // Cho phép đúng bằng cuối central directory, lệch là cấu trúc hỏng.
      if (off - cdOffset - cdSize > 4) throw zipError(ZIP_ERRORS.MALFORMED, 'central directory vượt biên');
    }

    const nameCheck = validateZipEntryName(name);
    if (!nameCheck.ok) throw zipError(ZIP_ERRORS.UNSAFE_NAME, `${nameCheck.reason}: ${name.slice(0, 80)}`);
    if (map.has(name)) throw zipError(ZIP_ERRORS.DUPLICATE_ENTRY, name);
    if (flags & 0x1) throw zipError(ZIP_ERRORS.ENCRYPTED, name);
    if (method !== 0 && method !== 8) throw zipError(ZIP_ERRORS.UNSUPPORTED_METHOD, `${method} (${name})`);
    if (size > limits.maxEntryBytes) throw zipError(ZIP_ERRORS.ENTRY_TOO_LARGE, `${name}: ${size}`);
    // Tỉ lệ nở chỉ có ý nghĩa với entry lớn: một file text vài KB nén 200x là
    // bình thường, còn 32 MB nở ra từ 100 KB mới là dấu hiệu bomb.
    if (size > RATIO_MIN_BYTES && compressedSize > 0 && size / compressedSize > limits.maxExpansionRatio) {
      throw zipError(ZIP_ERRORS.SUSPICIOUS_EXPANSION, `${name}: ${Math.round(size / compressedSize)}x`);
    }
    declaredTotal += size;
    if (declaredTotal > limits.maxTotalUncompressedBytes) {
      throw zipError(ZIP_ERRORS.ARCHIVE_TOO_LARGE, String(declaredTotal));
    }
    const entry = { name, method, size, compressedSize, crc, lho, flags };
    map.set(name, entry);
    entries.push(entry);
  }

  /* Kiểm tra local header + vùng dữ liệu NGAY khi mở, dùng một lần cho mọi
     read: offset/length khai báo trong central directory không được tin mà
     không đối chiếu, và hai entry không được chồng lấn hay lấn central dir. */
  const ranges = [];
  for (const entry of entries) {
    if (entry.lho + 30 > cdOffset) throw zipError(ZIP_ERRORS.OVERLAP, `${entry.name}: local header sau central directory`);
    if (dv.getUint32(entry.lho, true) !== 0x04034b50) throw zipError(ZIP_ERRORS.MALFORMED, `local header ${entry.name}`);
    if (dv.getUint16(entry.lho + 8, true) !== entry.method) throw zipError(ZIP_ERRORS.MALFORMED, `method lệch ở ${entry.name}`);
    const nameLen = dv.getUint16(entry.lho + 26, true);
    const extraLen = dv.getUint16(entry.lho + 28, true);
    if (entry.lho + 30 + nameLen + extraLen > cdOffset) throw zipError(ZIP_ERRORS.TRUNCATED, `local header ${entry.name}`);
    const localName = decodeName(u8.subarray(entry.lho + 30, entry.lho + 30 + nameLen));
    if (localName !== entry.name) throw zipError(ZIP_ERRORS.MALFORMED, `tên lệch ở ${entry.name}`);
    const start = entry.lho + 30 + nameLen + extraLen;
    const end = start + entry.compressedSize;
    if (end > cdOffset) throw zipError(ZIP_ERRORS.TRUNCATED, `dữ liệu ${entry.name}`);
    entry.dataStart = start;
    ranges.push({ name: entry.name, start, end });
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      throw zipError(ZIP_ERRORS.OVERLAP, `${ranges[i - 1].name} ↔ ${ranges[i].name}`);
    }
  }

  const budget = { observed: 0 };
  let closed = false;
  /* Hàng đợi tuần tự: ngân sách archive là trạng thái dùng chung, nên mỗi lần
     đọc phải thấy `observed` đã cập nhật của lần trước. Không cache, không
     hàng đợi dài vô hạn ngoài số promise caller tự tạo. */
  let queue = Promise.resolve();

  async function readEntry(name, opts = {}) {
    if (closed) throw zipError(ZIP_ERRORS.MALFORMED, 'archive đã đóng');
    const entry = map.get(name);
    if (!entry) return null; // part không bắt buộc: caller quyết định
    const readSignal = mergeSignals(signal, opts.signal);
    checkSignal(readSignal);
    checkDeadline(deadline);
    const localFlags = dv.getUint16(entry.lho + 6, true);
    const start = entry.dataStart;
    if (start + entry.compressedSize > u8.length) throw zipError(ZIP_ERRORS.TRUNCATED, `dữ liệu ${name}`);
    if ((localFlags & 0x1) || (entry.flags & 0x1)) throw zipError(ZIP_ERRORS.ENCRYPTED, name);
    const raw = u8.subarray(start, start + entry.compressedSize);

    const remaining = limits.maxTotalUncompressedBytes - budget.observed;
    const maxBytes = Math.min(
      limits.maxEntryBytes,
      Number.isFinite(opts.maxBytes) && opts.maxBytes > 0 ? opts.maxBytes : limits.maxEntryBytes,
      remaining,
    );
    if (maxBytes <= 0) throw zipError(ZIP_ERRORS.ARCHIVE_TOO_LARGE);

    const out = entry.method === 8
      ? await inflateBounded(raw, { limits, budget, signal: readSignal, deadline, name, maxBytes, isClosed: () => closed })
      : await copyBounded(raw, { limits, budget, signal: readSignal, deadline, name, maxBytes, isClosed: () => closed });

    if (out.byteLength !== entry.size) {
      throw zipError(ZIP_ERRORS.SIZE_MISMATCH, `${name}: khai báo ${entry.size}, thật ${out.byteLength}`);
    }
    // Kiểm tra tỉ lệ nở trên số liệu THẬT, không chỉ metadata.
    if (out.byteLength > RATIO_MIN_BYTES && entry.compressedSize > 0
      && out.byteLength / entry.compressedSize > limits.maxExpansionRatio) {
      throw zipError(ZIP_ERRORS.SUSPICIOUS_EXPANSION, `${name}: ${Math.round(out.byteLength / entry.compressedSize)}x thực tế`);
    }
    if (crc32(out) !== entry.crc) throw zipError(ZIP_ERRORS.CRC_MISMATCH, name);
    return out;
  }

  function read(name, opts = {}) {
    const task = queue.then(() => readEntry(name, opts));
    queue = task.then(() => undefined, () => undefined);
    return task;
  }

  async function readText(name, opts = {}) {
    const bytes = await read(name, opts);
    if (!bytes) return null;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }

  return {
    names: entries.map(entry => entry.name),
    entries,
    read,
    readText,
    has: name => map.has(name),
    close() { closed = true; },
    stats: () => ({ entries: entries.length, declaredTotal, observed: budget.observed }),
  };
}

Object.assign(__exports, { ZIP_ERRORS, zipError, crc32, openZip });
};

__modules["core/xml.js"] = function (__exports) {
'use strict';
/**
 * packages/core/xml.js — parser XML nghiêm ngặt, không phụ thuộc nền tảng.
 *
 * Vì sao không dùng regex: regex không kiểm tra được well-formedness, không thấy
 * thẻ chưa đóng, không phát hiện thuộc tính trùng, và không chặn được DTD/ENTITY
 * một cách chắc chắn. Đây là tokenizer + parser thật:
 *
 *   - từ chối DOCTYPE và mọi khai báo ENTITY (OOXML hợp lệ không cần);
 *   - chỉ giải mã 5 entity định nghĩa sẵn và tham chiếu số, nên XXE là bất khả
 *     thi về mặt cấu trúc (không có nguồn ngoài nào được đọc);
 *   - giới hạn độ sâu, số node, số thuộc tính, độ dài text;
 *   - kiểm tra thẻ đóng khớp, thuộc tính trùng, dữ liệu ngoài root.
 *
 * Giới hạn: không resolve namespace (tên giữ nguyên như `w:p`), không validate
 * schema, không hỗ trợ DTD. Đó là giới hạn có chủ ý, được ghi trong
 * docs/TRACE_CLEANER_2_3_RELEASE_REPORT.md.
 */

const { PARSER_LIMITS } = __require("core/limits.js");

const XML_ERRORS = Object.freeze({
  TOO_LARGE: 'xml_too_large',
  DOCTYPE: 'xml_doctype',
  ENTITY: 'xml_entity',
  MALFORMED: 'xml_malformed',
  TOO_DEEP: 'xml_too_deep',
  TOO_MANY_NODES: 'xml_too_many_nodes',
  TEXT_TOO_LARGE: 'xml_text_too_large',
  UNKNOWN_ENTITY: 'xml_unknown_entity',
});

const ERROR_TEXT = {
  [XML_ERRORS.TOO_LARGE]: 'XML vượt giới hạn kích thước.',
  [XML_ERRORS.DOCTYPE]: 'XML có DOCTYPE — bị từ chối vì an toàn.',
  [XML_ERRORS.ENTITY]: 'XML khai báo ENTITY — bị từ chối vì an toàn.',
  [XML_ERRORS.MALFORMED]: 'XML không well-formed.',
  [XML_ERRORS.TOO_DEEP]: 'XML lồng quá sâu.',
  [XML_ERRORS.TOO_MANY_NODES]: 'XML có quá nhiều node.',
  [XML_ERRORS.TEXT_TOO_LARGE]: 'XML có đoạn text quá lớn.',
  [XML_ERRORS.UNKNOWN_ENTITY]: 'XML chứa entity không được hỗ trợ.',
};

function xmlError(reason, detail) {
  const error = new Error(`${ERROR_TEXT[reason] || 'Lỗi XML.'}${detail ? ` (${detail})` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const PREDEFINED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Độ dài UTF-8 thật, không cấp phát bản encode. */
function utf8ByteLength(value) {
  const source = String(value ?? '');
  let bytes = 0;
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < source.length
      && source.charCodeAt(i + 1) >= 0xDC00 && source.charCodeAt(i + 1) <= 0xDFFF) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Chuẩn hoá input XML thành string, áp giới hạn BYTE trước khi decode.
 * Chính sách encoding: UTF-8 (có/không BOM). UTF-16/UTF-32 bị từ chối rõ ràng
 * thay vì decode mò; OOXML trong thực tế là UTF-8/ASCII.
 */
function decodeXmlInput(input, { maxBytes = PARSER_LIMITS.maxXmlBytes, name = 'xml' } = {}) {
  if (input instanceof Uint8Array) {
    if (input.byteLength > maxBytes) throw xmlError(XML_ERRORS.TOO_LARGE, `${name}: ${input.byteLength} > ${maxBytes} byte`);
    if (input.length >= 2 && ((input[0] === 0xFF && input[1] === 0xFE) || (input[0] === 0xFE && input[1] === 0xFF))) {
      throw xmlError(XML_ERRORS.MALFORMED, `${name}: UTF-16 không được hỗ trợ`);
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(input); }
    catch { throw xmlError(XML_ERRORS.MALFORMED, `${name}: byte không phải UTF-8 hợp lệ`); }
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }
  const source = String(input ?? '');
  const bytes = utf8ByteLength(source);
  if (bytes > maxBytes) throw xmlError(XML_ERRORS.TOO_LARGE, `${name}: ${bytes} > ${maxBytes} byte`);
  return source.charCodeAt(0) === 0xFEFF ? source.slice(1) : source;
}

/** Ký tự không hợp lệ trong XML 1.0 và surrogate lẻ. */
function assertXmlCharacters(source, name) {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(source)) {
    throw xmlError(XML_ERRORS.MALFORMED, `${name}: control character không hợp lệ`);
  }
  const pair = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  if (pair.test(source)) throw xmlError(XML_ERRORS.MALFORMED, `${name}: surrogate lẻ`);
}

function isNameStart(ch) {
  return /[A-Za-z_:\u00C0-\uFFFF]/.test(ch);
}
function isNameChar(ch) {
  return /[A-Za-z0-9_:.\-\u00B7\u00C0-\uFFFF]/.test(ch);
}

/** Giải mã entity; từ chối mọi tên lạ, không im lặng bỏ qua. */
function decodeXmlEntities(value, { maxLength = Infinity } = {}) {
  const source = String(value ?? '');
  if (source.indexOf('&') < 0) return source;
  let out = '';
  let last = 0;
  const re = /&([^;&\s]{1,32});/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    out += source.slice(last, m.index);
    const body = m[1];
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const digits = hex ? body.slice(2) : body.slice(1);
      if (!/^[0-9a-fA-F]+$/.test(digits)) throw xmlError(XML_ERRORS.MALFORMED, `char ref ${m[0]}`);
      const cp = parseInt(digits, hex ? 16 : 10);
      if (!Number.isFinite(cp) || cp === 0 || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) {
        throw xmlError(XML_ERRORS.MALFORMED, `char ref ngoài Unicode ${m[0]}`);
      }
      out += String.fromCodePoint(cp);
    } else if (Object.prototype.hasOwnProperty.call(PREDEFINED, body)) {
      out += PREDEFINED[body];
    } else {
      throw xmlError(XML_ERRORS.UNKNOWN_ENTITY, body);
    }
    last = m.index + m[0].length;
    if (out.length > maxLength) throw xmlError(XML_ERRORS.TEXT_TOO_LARGE);
  }
  out += source.slice(last);
  // '&' còn lại không theo dạng entity: XML không hợp lệ.
  if (/&(?![A-Za-z#])/.test(out) || /&[A-Za-z#][^;]{0,32}(?![;])/.test(out.replace(/&(amp|lt|gt|quot|apos);/g, ''))) {
    if (/&[^;\s]{0,32}$/.test(out)) throw xmlError(XML_ERRORS.MALFORMED, 'entity không đóng');
  }
  if (out.length > maxLength) throw xmlError(XML_ERRORS.TEXT_TOO_LARGE);
  return out;
}

/** Node: {type:'element', name, localName, attrs:{}, children:[], line} */
function makeElement(name, line) {
  const colon = name.indexOf(':');
  return {
    type: 'element',
    name,
    localName: colon >= 0 ? name.slice(colon + 1) : name,
    prefix: colon >= 0 ? name.slice(0, colon) : '',
    attrs: Object.create(null),
    children: [],
    line,
  };
}

/* Số dòng được tính tăng dần trong lúc parse. Trước đây mỗi element quét lại
   từ đầu chuỗi ⇒ O(n²): DOCX 3000 đoạn mất 3.3 s. Giờ là O(n) tổng cộng. */
function lineCounter(source) {
  let cursor = 0;
  let line = 1;
  return index => {
    if (index < cursor) return line;
    for (let i = cursor; i < index; i++) if (source.charCodeAt(i) === 10) line++;
    cursor = index;
    return line;
  };
}

/**
 * Parse một document XML.
 * @param {string} text
 * @param {{limits?:object, name?:string, maxBytes?:number}} [options]
 * @returns {{root:object, stats:{nodes:number, depth:number, attrs:number, textLength:number, bytes:number}}}
 */
function parseXml(text, options = {}) {
  const limits = options.limits || PARSER_LIMITS;
  const name = options.name || 'xml';
  const maxBytes = options.maxBytes || limits.maxXmlBytes;
  const source = decodeXmlInput(text, { maxBytes, name });
  assertXmlCharacters(source, name);
  let i = 0;
  const n = source.length;
  const stack = [];
  let root = null;
  const lineAt = lineCounter(source);
  const stats = { nodes: 0, depth: 0, attrs: 0, textLength: 0, bytes: utf8ByteLength(source) };

  const top = () => (stack.length ? stack[stack.length - 1] : null);
  const addText = value => {
    if (!value) return;
    const parent = top();
    if (!parent) {
      if (value.trim()) throw xmlError(XML_ERRORS.MALFORMED, 'text ngoài root');
      return;
    }
    stats.textLength += value.length;
    if (stats.textLength > maxBytes) throw xmlError(XML_ERRORS.TEXT_TOO_LARGE, name);
    parent.children.push(value);
  };

  while (i < n) {
    const lt = source.indexOf('<', i);
    if (lt < 0) {
      addText(decodeXmlEntities(source.slice(i), { maxLength: maxBytes }));
      break;
    }
    if (lt > i) {
      const raw = source.slice(i, lt);
      if (raw.indexOf('&') >= 0) addText(decodeXmlEntities(raw, { maxLength: maxBytes }));
      else addText(raw);
    }

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt + 4);
      if (end < 0) throw xmlError(XML_ERRORS.MALFORMED, 'comment không đóng');
      i = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt + 9);
      if (end < 0) throw xmlError(XML_ERRORS.MALFORMED, 'CDATA không đóng');
      addText(source.slice(lt + 9, end));
      i = end + 3;
      continue;
    }
    if (source.startsWith('<?', lt)) {
      const end = source.indexOf('?>', lt + 2);
      if (end < 0) throw xmlError(XML_ERRORS.MALFORMED, 'processing instruction không đóng');
      const body = source.slice(lt + 2, end);
      if (/^xml\s/i.test(body) && lt !== source.indexOf('<?')) {
        throw xmlError(XML_ERRORS.MALFORMED, 'khai báo XML không ở đầu');
      }
      i = end + 2;
      continue;
    }
    if (/^<!DOCTYPE/i.test(source.slice(lt, lt + 9))) throw xmlError(XML_ERRORS.DOCTYPE, name);
    if (/^<!ENTITY/i.test(source.slice(lt, lt + 8))) throw xmlError(XML_ERRORS.ENTITY, name);
    if (source.startsWith('<!', lt)) throw xmlError(XML_ERRORS.MALFORMED, 'khai báo <! không hỗ trợ');

    if (source.startsWith('</', lt)) {
      let j = lt + 2;
      while (j < n && isNameChar(source[j])) j++;
      const closing = source.slice(lt + 2, j);
      while (j < n && /\s/.test(source[j])) j++;
      if (source[j] !== '>') throw xmlError(XML_ERRORS.MALFORMED, `thẻ đóng ${closing}`);
      const open = stack.pop();
      if (!open || open.name !== closing) {
        throw xmlError(XML_ERRORS.MALFORMED, `đóng </${closing}> không khớp <${open ? open.name : 'none'}>`);
      }
      i = j + 1;
      continue;
    }

    // Thẻ mở.
    let j = lt + 1;
    if (!isNameStart(source[j])) throw xmlError(XML_ERRORS.MALFORMED, `ký tự sau < không hợp lệ ở dòng ${lineAt(lt)}`);
    while (j < n && isNameChar(source[j])) j++;
    const elementName = source.slice(lt + 1, j);
    const element = makeElement(elementName, lineAt(lt));
    let selfClosing = false;
    for (;;) {
      while (j < n && /\s/.test(source[j])) j++;
      if (j >= n) throw xmlError(XML_ERRORS.MALFORMED, `thẻ ${elementName} chưa đóng`);
      if (source[j] === '>') { j++; break; }
      if (source[j] === '/' && source[j + 1] === '>') { selfClosing = true; j += 2; break; }
      if (!isNameStart(source[j])) throw xmlError(XML_ERRORS.MALFORMED, `thuộc tính của ${elementName}`);
      const attrStart = j;
      while (j < n && isNameChar(source[j])) j++;
      const attrName = source.slice(attrStart, j);
      while (j < n && /\s/.test(source[j])) j++;
      if (source[j] !== '=') throw xmlError(XML_ERRORS.MALFORMED, `thuộc tính ${attrName} thiếu =`);
      j++;
      while (j < n && /\s/.test(source[j])) j++;
      const quote = source[j];
      if (quote !== '"' && quote !== "'") throw xmlError(XML_ERRORS.MALFORMED, `giá trị ${attrName} thiếu quote`);
      const end = source.indexOf(quote, j + 1);
      if (end < 0) throw xmlError(XML_ERRORS.MALFORMED, `quote chưa đóng ở ${attrName}`);
      if (Object.prototype.hasOwnProperty.call(element.attrs, attrName)) {
        throw xmlError(XML_ERRORS.MALFORMED, `thuộc tính trùng ${attrName}`);
      }
      const rawValue = source.slice(j + 1, end);
      if (rawValue.indexOf('<') >= 0) throw xmlError(XML_ERRORS.MALFORMED, `< trong giá trị ${attrName}`);
      element.attrs[attrName] = decodeXmlEntities(rawValue, { maxLength: maxBytes });
      stats.attrs++;
      if (stats.attrs > limits.maxXmlAttributes) throw xmlError(XML_ERRORS.TOO_MANY_NODES, 'thuộc tính');
      j = end + 1;
    }

    stats.nodes++;
    if (stats.nodes > limits.maxXmlNodes) throw xmlError(XML_ERRORS.TOO_MANY_NODES, `${stats.nodes}`);
    const parent = top();
    if (parent) parent.children.push(element);
    else if (!root) root = element;
    else throw xmlError(XML_ERRORS.MALFORMED, 'nhiều root');

    if (selfClosing) {
      if (!parent && !root) throw xmlError(XML_ERRORS.MALFORMED, 'root rỗng');
    } else {
      stack.push(element);
      if (stack.length > stats.depth) stats.depth = stack.length;
      if (stats.depth > limits.maxXmlDepth) throw xmlError(XML_ERRORS.TOO_DEEP, `${stats.depth} > ${limits.maxXmlDepth}`);
    }
    i = j;
  }

  if (stack.length) throw xmlError(XML_ERRORS.MALFORMED, `chưa đóng ${stack[stack.length - 1].name}`);
  if (!root) throw xmlError(XML_ERRORS.MALFORMED, 'không có phần tử root');
  return { root, stats };
}

/** Con trực tiếp đầu tiên theo tên (chấp nhận cả tên có prefix). */
function child(node, name) {
  if (!node || !Array.isArray(node.children)) return null;
  for (const item of node.children) {
    if (item && item.type === 'element' && (item.name === name || item.localName === name)) return item;
  }
  return null;
}

/** Tất cả con trực tiếp theo tên. */
function childrenOf(node, name) {
  if (!node || !Array.isArray(node.children)) return [];
  return node.children.filter(item => item && item.type === 'element' && (item.name === name || item.localName === name));
}

/** Mọi hậu duệ theo tên, dừng ở `limit` để không nổ bộ nhớ. */
function descendants(node, name, limit = 10000) {
  const out = [];
  if (!node) return out;
  const stack = [...(node.children || [])].reverse();
  while (stack.length && out.length < limit) {
    const item = stack.pop();
    if (!item || item.type !== 'element') continue;
    if (item.name === name || item.localName === name) out.push(item);
    const kids = item.children || [];
    for (let k = kids.length - 1; k >= 0; k--) stack.push(kids[k]);
  }
  return out;
}

function attr(node, name) {
  if (!node || !node.attrs) return null;
  if (Object.prototype.hasOwnProperty.call(node.attrs, name)) return node.attrs[name];
  const local = name.indexOf(':') >= 0 ? name.slice(name.indexOf(':') + 1) : name;
  for (const key of Object.keys(node.attrs)) {
    if (key === local || key.slice(key.indexOf(':') + 1) === local) return node.attrs[key];
  }
  return null;
}

/**
 * Text của node theo đúng thứ tự tài liệu.
 * @param {object} node
 * @param {{paragraphBreak?:string, tab?:string}} [options]
 */
function textContent(node, options = {}) {
  const paraBreak = options.paragraphBreak ?? '\n';
  const tab = options.tab ?? '\t';
  const out = [];
  const walk = item => {
    if (typeof item === 'string') { out.push(item); return; }
    if (!item || item.type !== 'element') return;
    const local = item.localName;
    if (local === 'tab') out.push(tab);
    if (local === 'br' || local === 'cr') out.push('\n');
    for (const kid of item.children || []) walk(kid);
    if (local === 'p') out.push(paraBreak);
  };
  walk(node);
  return out.join('');
}

/** Duyệt mọi element, theo thứ tự tài liệu. */
function elements(node, visit) {
  if (!node) return;
  const stack = [node];
  while (stack.length) {
    const item = stack.pop();
    if (typeof item === 'string') continue;
    visit(item);
    const kids = item.children || [];
    for (let k = kids.length - 1; k >= 0; k--) {
      if (kids[k] && kids[k].type === 'element') stack.push(kids[k]);
    }
  }
}

Object.assign(__exports, { XML_ERRORS, xmlError, utf8ByteLength, decodeXmlInput, decodeXmlEntities, parseXml, child, childrenOf, descendants, attr, textContent, elements });
};

__modules["core/ooxml.js"] = function (__exports) {
'use strict';
/**
 * packages/core/ooxml.js — đọc DOCX / PPTX / XLSX ở mức cấu trúc.
 *
 * Nguyên tắc:
 *   - mọi part được đọc đều đi qua `parseXml` (có giới hạn + chặn DTD/ENTITY),
 *   - quan hệ (relationships) được resolve thật, không đoán tên file,
 *   - thứ tự slide/sheet lấy theo presentation.xml / workbook.xml,
 *   - tracked changes và comments được GIỮ khác biệt, không flatten,
 *   - giới hạn slide/sheet/trang/ký tự lấy từ `limits.js`.
 *
 * Không hỗ trợ (được ghi rõ trong release report): chart/SmartArt text, macro
 * (vbaProject), OLE objects, chữ trong shape group lồng quá sâu, XLSX pivot.
 */

const { openZip } = __require("core/zip.js");
const { parseXml, child, childrenOf, descendants, attr, textContent } = __require("core/xml.js");
const { PARSER_LIMITS, clampText } = __require("core/limits.js");

const OOXML_ERRORS = Object.freeze({
  MISSING_MAIN_PART: 'missing_main_part',
  MISSING_CONTENT_TYPES: 'missing_content_types',
  INVALID_RELATIONSHIPS: 'invalid_relationships',
  SLIDE_LIMIT: 'slide_limit_exceeded',
  SHEET_LIMIT: 'sheet_limit_exceeded',
  TEXT_LIMIT: 'text_limit_exceeded',
  BAD_DOCUMENT: 'invalid_document',
});

function ooxmlError(reason, detail) {
  const messages = {
    [OOXML_ERRORS.MISSING_MAIN_PART]: 'Thiếu part chính của tài liệu',
    [OOXML_ERRORS.MISSING_CONTENT_TYPES]: 'Thiếu [Content_Types].xml',
    [OOXML_ERRORS.INVALID_RELATIONSHIPS]: 'Quan hệ (relationships) không hợp lệ',
    [OOXML_ERRORS.SLIDE_LIMIT]: 'Vượt giới hạn số slide',
    [OOXML_ERRORS.SHEET_LIMIT]: 'Vượt giới hạn số worksheet',
    [OOXML_ERRORS.TEXT_LIMIT]: 'Văn bản trích ra vượt giới hạn',
    [OOXML_ERRORS.BAD_DOCUMENT]: 'Tài liệu không hợp lệ',
  };
  const error = new Error(`${messages[reason] || 'Lỗi tài liệu'}${detail ? `: ${detail}` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function baseDir(path) {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at + 1);
}

/** Resolve Target tương đối (hoặc tuyệt đối trong package) thành tên entry. */
function resolveRelationshipTarget(sourcePart, target) {
  const raw = String(target || '').replace(/\\/g, '/');
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.slice(1);
  const segments = (baseDir(sourcePart) + raw).split('/');
  const out = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/** Quan hệ của một part: [{id, type, target, mode}] */
function parseRelationships(root, sourcePart) {
  const list = [];
  for (const item of childrenOf(root, 'Relationship')) {
    const id = attr(item, 'Id');
    const type = attr(item, 'Type');
    const target = attr(item, 'Target');
    const mode = attr(item, 'TargetMode');
    if (!id || !type) continue;
    list.push({
      id,
      type,
      typeShort: String(type).split('/').pop(),
      target: mode === 'External' ? target : resolveRelationshipTarget(sourcePart, target),
      external: mode === 'External',
    });
  }
  return list;
}

function relsPath(part) {
  const dir = baseDir(part);
  const file = part.slice(dir.length);
  return `${dir}_rels/${file}.rels`;
}

function checkDeadline(deadline) {
  if (deadline && Date.now() > deadline) {
    const error = new Error('Quá thời gian cho phép khi đọc tài liệu.');
    error.code = 'PARSER_ERROR';
    error.reason = 'timeout';
    throw error;
  }
}

/**
 * @param {Uint8Array} input
 * @param {{format:'docx'|'pptx'|'xlsx', limits?:object, signal?:AbortSignal, timeoutMs?:number}} options
 */
async function analyzeOoxml(input, options = {}) {
  const format = options.format || 'docx';
  const limits = options.limits || PARSER_LIMITS;
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : (options.deadline || 0);
  const signal = options.signal;
  const zip = await openZip(input, { limits, signal, deadline });
  const ctx = { limits, signal, deadline, partsRead: [], partsSkipped: [], truncated: false, diagnostics: [] };

  async function readPart(name, keepRaw = false) {
    if (!name || !zip.has(name)) { if (name) ctx.partsSkipped.push(name); return null; }
    checkDeadline(deadline);
    if (signal && signal.aborted) throw new Error('Đã huỷ khi đọc tài liệu.');
    // Đọc bytes và áp trần XML NGAY trong lúc inflate, trước khi decode.
    const bytes = await zip.read(name, { maxBytes: limits.maxXmlBytes });
    if (!bytes) { ctx.partsSkipped.push(name); return null; }
    ctx.partsRead.push(name);
    const { root } = parseXml(bytes, { limits, name });
    // Giữ raw main part để tính rsid (heuristic Word) mà không đọc lại zip.
    if (keepRaw) ctx.mainXmlText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return root;
  }

  if (!zip.has('[Content_Types].xml')) throw ooxmlError(OOXML_ERRORS.MISSING_CONTENT_TYPES);
  const rootRels = await readPart('_rels/.rels');
  if (!rootRels) throw ooxmlError(OOXML_ERRORS.INVALID_RELATIONSHIPS, '_rels/.rels');
  const rels = parseRelationships(rootRels, '');

  const mainRel = rels.find(rel => rel.typeShort === 'officeDocument');
  const defaultMain = { docx: 'word/document.xml', pptx: 'ppt/presentation.xml', xlsx: 'xl/workbook.xml' }[format];
  const mainPart = mainRel && mainRel.target && zip.has(mainRel.target) ? mainRel.target : defaultMain;
  if (!zip.has(mainPart)) throw ooxmlError(OOXML_ERRORS.MISSING_MAIN_PART, mainPart);
  const mainRoot = await readPart(mainPart, true);
  if (!mainRoot) throw ooxmlError(OOXML_ERRORS.MISSING_MAIN_PART, mainPart);

  const metadata = await readMetadata(zip, ctx);
  const result = {
    format,
    kind: { docx: 'DOCX / OOXML', pptx: 'PPTX / OOXML', xlsx: 'XLSX / OOXML' }[format],
    mainPart,
    metadata,
    partsRead: ctx.partsRead,
    partsSkipped: ctx.partsSkipped,
    diagnostics: [],
    text: '',
    truncated: false,
  };

  if (format === 'docx') Object.assign(result, await readDocx(zip, ctx, mainPart, mainRoot));
  else if (format === 'pptx') Object.assign(result, await readPptx(zip, ctx, mainPart, mainRoot));
  else Object.assign(result, await readXlsx(zip, ctx, mainPart, mainRoot));

  if (format === 'docx' && ctx.mainXmlText) {
    result.rsidCount = new Set(ctx.mainXmlText.match(/w:rsid[A-Za-z]*="([0-9A-Fa-f]{8})"/g) || []).size;
    delete ctx.mainXmlText;
  }
  const clamped = clampText(result.text, limits);
  result.truncated = clamped.truncated;
  result.text = clamped.text;
  if (result.truncated) result.diagnostics.push('Văn bản trích ra bị cắt ở giới hạn maxTextChars.');
  result.partsRead = ctx.partsRead;
  result.partsSkipped = ctx.partsSkipped;
  result.diagnostics = ctx.diagnostics;
  zip.close();
  return result;
}

/* ───────────────────────── metadata ───────────────────────── */

function firstValue(root, localName, limit = 4000) {
  if (!root) return null;
  const node = descendants(root, localName, 1)[0];
  if (!node) return null;
  const text = textContent(node).trim();
  return text ? text.slice(0, limit) : null;
}

async function readMetadata(zip, ctx) {
  const metadata = {
    creator: null, lastModifiedBy: null, created: null, modified: null, revision: null,
    title: null, subject: null, application: null, appVersion: null, company: null,
    totalTimeMinutes: null, wordsDeclared: null, pagesDeclared: null, slidesDeclared: null,
  };
  if (zip.has('docProps/core.xml')) {
    const text = await zip.readText('docProps/core.xml');
    const { root } = parseXml(text, { limits: ctx.limits, name: 'docProps/core.xml' });
    ctx.partsRead.push('docProps/core.xml');
    metadata.creator = firstValue(root, 'creator');
    metadata.lastModifiedBy = firstValue(root, 'lastModifiedBy');
    metadata.created = firstValue(root, 'created');
    metadata.modified = firstValue(root, 'modified');
    metadata.title = firstValue(root, 'title');
    metadata.subject = firstValue(root, 'subject');
    const revision = firstValue(root, 'revision');
    metadata.revision = revision && /^\d+$/.test(revision) ? Number(revision) : null;
  }
  if (zip.has('docProps/app.xml')) {
    const text = await zip.readText('docProps/app.xml');
    const { root } = parseXml(text, { limits: ctx.limits, name: 'docProps/app.xml' });
    ctx.partsRead.push('docProps/app.xml');
    metadata.application = firstValue(root, 'Application');
    metadata.appVersion = firstValue(root, 'AppVersion');
    metadata.company = firstValue(root, 'Company');
    const minutes = firstValue(root, 'TotalTime');
    metadata.totalTimeMinutes = minutes !== null && /^[0-9.,]+$/.test(minutes)
      ? parseFloat(minutes.replace(',', '.')) : null;
    const words = firstValue(root, 'Words');
    metadata.wordsDeclared = words && /^\d+$/.test(words) ? Number(words) : null;
    const pages = firstValue(root, 'Pages');
    metadata.pagesDeclared = pages && /^\d+$/.test(pages) ? Number(pages) : null;
    const slides = firstValue(root, 'Slides');
    metadata.slidesDeclared = slides && /^\d+$/.test(slides) ? Number(slides) : null;
  }
  return metadata;
}

/* ───────────────────────── DOCX ───────────────────────── */

function paragraphText(paragraph, { includeDeleted = false, revisionFilter = null } = {}) {
  let out = '';
  const walk = (node, revision) => {
    if (typeof node === 'string') { out += node; return; }
    if (!node || node.type !== 'element') return;
    const local = node.localName;
    if (local === 'p') {
      for (const kid of node.children || []) walk(kid, revision);
      return;
    }
    let active = revision;
    if (local === 'ins' || local === 'del' || local === 'moveFrom' || local === 'moveTo') {
      const type = local === 'ins' || local === 'moveTo' ? 'ins' : 'del';
      active = {
        type,
        author: attr(node, 'w:author') || attr(node, 'author'),
        date: attr(node, 'w:date') || attr(node, 'date'),
        id: attr(node, 'w:id') || attr(node, 'id'),
      };
      if (type === 'del' && !includeDeleted) return;
      if (revisionFilter && active.type !== revisionFilter) return;
    }
    if (local === 'delText' && !includeDeleted) return;
    if (local === 'tab') { out += '\t'; return; }
    if (local === 'br' || local === 'cr') { out += '\n'; return; }
    if (local === 'noBreakHyphen') { out += '-'; return; }
    for (const kid of node.children || []) walk(kid, active);
  };
  walk(paragraph, null);
  return out;
}

function revisionList(paragraph) {
  const list = [];
  const walk = node => {
    if (!node || typeof node === 'string') return;
    const local = node.localName;
    if (local === 'ins' || local === 'del' || local === 'moveFrom' || local === 'moveTo') {
      const deleted = local === 'del' || local === 'moveFrom';
      const text = paragraphText(node, { includeDeleted: true }).trim();
      if (text) {
        list.push({
          type: deleted ? 'deleted' : 'inserted',
          kind: local,
          author: attr(node, 'w:author') || attr(node, 'author') || null,
          date: attr(node, 'w:date') || attr(node, 'date') || null,
          text,
        });
      }
    }
    for (const kid of node.children || []) walk(kid);
  };
  walk(paragraph);
  return list;
}

async function readDocx(zip, ctx, mainPart, mainRoot) {
  const body = child(mainRoot, 'w:body') || mainRoot;
  const paragraphs = [];
  for (const p of descendants(body, 'w:p', ctx.limits.maxXmlBlocks)) {
    const text = paragraphText(p);
    const withDeleted = paragraphText(p, { includeDeleted: true });
    const revisions = revisionList(p);
    const pPr = child(p, 'w:pPr');
    const style = attr(pPr ? child(pPr, 'w:pStyle') : null, 'w:val');
    const commentIds = [];
    for (const start of descendants(p, 'w:commentRangeStart', 200)) {
      const id = attr(start, 'w:id');
      if (id) commentIds.push(id);
    }
    if (text.trim() || revisions.length) {
      paragraphs.push({ index: paragraphs.length, text, withDeleted, style: style || null, revisions, commentIds });
    }
    if (paragraphs.length >= ctx.limits.maxXmlBlocks) { ctx.truncated = true; break; }
  }

  const comments = [];
  const documentRels = await readRelationshipsOf(zip, mainPart, ctx);
  const commentsRel = documentRels.find(rel => rel.typeShort === 'comments' && !rel.external);
  if (commentsRel && zip.has(commentsRel.target)) {
    const { root } = await readPartRoot(zip, ctx, commentsRel.target);
    for (const node of childrenOf(root, 'w:comment')) {
      comments.push({
        id: attr(node, 'w:id'),
        author: attr(node, 'w:author'),
        date: attr(node, 'w:date'),
        initials: attr(node, 'w:initials'),
        text: descendants(node, 'w:t', 500).map(t => textContent(t)).join('').trim(),
      });
    }
  }
  const commentById = new Map(comments.map(item => [String(item.id), item]));
  for (const comment of comments) {
    const anchor = paragraphs.find(p => p.commentIds.includes(String(comment.id)));
    comment.anchoredText = anchor ? anchor.text.slice(0, 400) : null;
    comment.anchoredParagraph = anchor ? anchor.index : null;
  }

  const revisions = paragraphs.flatMap(p => p.revisions.map(item => ({ ...item, paragraph: p.index })));
  const inserted = revisions.filter(item => item.type === 'inserted');
  const deleted = revisions.filter(item => item.type === 'deleted');

  return {
    docx: {
      paragraphs,
      comments,
      commentById: Object.fromEntries(commentById),
      revisions: {
        inserted,
        deleted,
        authors: [...new Set(revisions.map(item => item.author).filter(Boolean))],
      },
    },
    text: paragraphs.map(p => p.text).join('\n'),
  };
}

async function readPartRoot(zip, ctx, name) {
  const bytes = await zip.read(name, { maxBytes: ctx.limits.maxXmlBytes });
  ctx.partsRead.push(name);
  return parseXml(bytes, { limits: ctx.limits, name });
}

/* ───────────────────────── PPTX ───────────────────────── */

function shapeText(shape) {
  const parts = [];
  for (const p of descendants(shape, 'a:p', 2000)) {
    const line = descendants(p, 'a:t', 500).map(t => textContent(t)).join('');
    if (line.trim()) parts.push(line);
  }
  return parts.join('\n');
}

function shapeIsTitle(shape) {
  const ph = descendants(shape, 'p:ph', 4)[0];
  const type = ph ? attr(ph, 'type') : null;
  return type === 'title' || type === 'ctrTitle';
}

async function readRelationshipsOf(zip, part, ctx) {
  const path = relsPath(part);
  if (!zip.has(path)) return [];
  const { root } = await readPartRoot(zip, ctx, path);
  return parseRelationships(root, part);
}

async function readPptx(zip, ctx, mainPart, mainRoot) {
  const rels = await readRelationshipsOf(zip, mainPart, ctx);
  const byId = new Map(rels.map(rel => [rel.id, rel]));
  const slideIds = descendants(mainRoot, 'p:sldId', 1000);
  if (slideIds.length > ctx.limits.maxSlides) {
    ctx.diagnostics.push(`Có ${slideIds.length} slide, chỉ đọc ${ctx.limits.maxSlides}.`);
  }
  const slides = [];
  let notesFound = 0;
  for (const sldId of slideIds.slice(0, ctx.limits.maxSlides)) {
    checkDeadline(ctx.deadline);
    const rid = attr(sldId, 'r:id') || attr(sldId, 'id');
    const rel = rid ? byId.get(rid) : null;
    const part = rel && !rel.external ? rel.target : null;
    if (!part || !zip.has(part)) {
      slides.push({ index: slides.length, part: null, title: null, text: '', notes: null, notesPart: null, missing: true });
      continue;
    }
    const { root } = await readPartRoot(zip, ctx, part);
    const shapes = descendants(root, 'p:sp', 2000);
    let title = null;
    const lines = [];
    for (const shape of shapes) {
      const text = shapeText(shape).trim();
      if (!text) continue;
      if (!title && shapeIsTitle(shape)) title = text;
      lines.push(text);
    }
    const slideRels = await readRelationshipsOf(zip, part, ctx);
    const notesRel = slideRels.find(item => item.typeShort === 'notesSlide' && !item.external);
    let notes = null;
    let notesPart = null;
    if (notesRel && zip.has(notesRel.target)) {
      notesPart = notesRel.target;
      const { root: notesRoot } = await readPartRoot(zip, ctx, notesPart);
      const body = child(notesRoot, 'p:notes') || notesRoot;
      const noteLines = [];
      for (const shape of descendants(body, 'p:sp', 200)) {
        const isNumber = descendants(shape, 'p:ph', 4).some(ph => attr(ph, 'type') === 'sldNum');
        if (isNumber) continue;
        const text = shapeText(shape).trim();
        if (text) noteLines.push(text);
      }
      notes = noteLines.join('\n');
      if (notes) notesFound += 1;
    }
    slides.push({
      index: slides.length,
      part,
      title,
      text: lines.join('\n'),
      notes,
      notesPart,
      missing: false,
    });
  }

  const text = slides.map((slide, index) => {
    const head = `## Slide ${index + 1}${slide.title ? `: ${slide.title}` : ''}`;
    return [head, slide.text, slide.notes ? `[notes] ${slide.notes}` : ''].filter(Boolean).join('\n');
  }).join('\n\n');

  return {
    pptx: {
      slides,
      slideCount: slides.length,
      declaredSlideCount: slideIds.length,
      notesFound,
      relationships: rels.map(rel => ({ id: rel.id, type: rel.typeShort, target: rel.target })),
    },
    text,
  };
}

/* ───────────────────────── XLSX ───────────────────────── */

const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Đoán định dạng ngày từ numFmt code (bỏ phần trong quote và []). */
function isDateFormatCode(code) {
  const cleaned = String(code || '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  if (!/[ymdhs]/i.test(cleaned)) return false;
  if (/^[#0.,\s%]+$/.test(cleaned)) return false;
  return /(^|[^\\])[ymdhs]/i.test(cleaned);
}

function columnIndex(ref) {
  const letters = String(ref || '').match(/^[A-Z]+/i);
  if (!letters) return -1;
  let value = 0;
  for (const ch of letters[0].toUpperCase()) value = value * 26 + (ch.charCodeAt(0) - 64);
  return value - 1;
}

function rowIndex(ref) {
  const digits = String(ref || '').match(/(\d+)$/);
  return digits ? Number(digits[1]) : -1;
}

/** Serial Excel → ISO (hệ 1900 với leap-year bug, hoặc 1904). */
function excelSerialToIso(serial, { date1904 = false } = {}) {
  const value = Number(serial);
  if (!Number.isFinite(value)) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  // Excel 1900 giả định 29/02/1900 tồn tại: serial < 60 phải cộng thêm 1 ngày.
  const adjusted = !date1904 && value < 60 ? value + 1 : value;
  const ms = epoch + Math.round(adjusted * 86400000);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return value % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19) + 'Z';
}

function readSharedStrings(root) {
  if (!root) return [];
  const out = [];
  for (const si of childrenOf(root, 'si')) {
    const pieces = [];
    const walk = node => {
      if (!node || typeof node === 'string') return;
      if (node.localName === 't') { pieces.push(textContent(node)); return; }
      if (node.localName === 'rPh') return; // phonetic: không phải nội dung hiển thị
      for (const kid of node.children || []) walk(kid);
    };
    walk(si);
    out.push(pieces.join(''));
  }
  return out;
}

function readStyles(root) {
  const custom = new Map();
  const xfFormats = [];
  if (!root) return { custom, xfFormats };
  for (const fmt of descendants(root, 'numFmt', 5000)) {
    const id = Number(attr(fmt, 'numFmtId'));
    if (Number.isFinite(id)) custom.set(id, attr(fmt, 'formatCode') || '');
  }
  for (const xf of descendants(root, 'xf', 20000)) {
    const id = Number(attr(xf, 'numFmtId'));
    xfFormats.push(Number.isFinite(id) ? id : 0);
  }
  return { custom, xfFormats };
}

function isDateStyle(styleId, styles) {
  const id = styles.xfFormats[styleId];
  if (id === undefined) return false;
  if (DATE_FORMAT_IDS.has(id)) return true;
  const code = styles.custom.get(id);
  return code ? isDateFormatCode(code) : false;
}

async function readXlsx(zip, ctx, mainPart, mainRoot) {
  const workbookPr = child(mainRoot, 'workbookPr');
  const date1904 = String(attr(workbookPr, 'date1904') || '').toLowerCase() === 'true'
    || String(attr(workbookPr, 'date1904') || '') === '1';
  const rels = await readRelationshipsOf(zip, mainPart, ctx);
  const byId = new Map(rels.map(rel => [rel.id, rel]));

  const sharedPart = rels.find(rel => rel.typeShort === 'sharedStrings');
  const sharedRoot = sharedPart && zip.has(sharedPart.target) ? (await readPartRoot(zip, ctx, sharedPart.target)).root : null;
  const sharedStrings = readSharedStrings(sharedRoot);

  const stylesPart = rels.find(rel => rel.typeShort === 'styles');
  const stylesRoot = stylesPart && zip.has(stylesPart.target) ? (await readPartRoot(zip, ctx, stylesPart.target)).root : null;
  const styles = readStyles(stylesRoot);

  const sheetNodes = descendants(mainRoot, 'sheet', 5000);
  if (sheetNodes.length > ctx.limits.maxSheets) {
    ctx.diagnostics.push(`Có ${sheetNodes.length} worksheet, chỉ đọc ${ctx.limits.maxSheets}.`);
  }
  const sheets = [];
  for (const sheetNode of sheetNodes.slice(0, ctx.limits.maxSheets)) {
    checkDeadline(ctx.deadline);
    const name = attr(sheetNode, 'name') || `Sheet${sheets.length + 1}`;
    const state = attr(sheetNode, 'state') || 'visible';
    const rid = attr(sheetNode, 'r:id');
    const rel = rid ? byId.get(rid) : null;
    const part = rel && !rel.external ? rel.target : null;
    const sheet = {
      index: sheets.length, name, state, part,
      hidden: state === 'hidden' || state === 'veryHidden',
      rows: 0, cells: [], text: '', diagnostics: [],
    };
    if (!part || !zip.has(part)) {
      sheet.diagnostics.push('Không resolve được worksheet part.');
      sheets.push(sheet);
      continue;
    }
    const { root } = await readPartRoot(zip, ctx, part);
    const rows = [];
    let cellCount = 0;
    for (const row of descendants(root, 'row', ctx.limits.maxXmlBlocks)) {
      const rowNumber = Number(attr(row, 'r')) || rows.length + 1;
      const values = [];
      for (const c of childrenOf(row, 'c')) {
        cellCount += 1;
        if (cellCount > ctx.limits.maxXmlBlocks * 4) break;
        const ref = attr(c, 'r') || '';
        const type = attr(c, 't') || 'n';
        const styleId = Number(attr(c, 's') || 0);
        const formulaNode = child(c, 'f');
        const formula = formulaNode ? textContent(formulaNode).trim() : null;
        const vNode = child(c, 'v');
        const raw = vNode ? textContent(vNode) : null;
        let value = null;
        let display = '';
        if (type === 's') {
          const idx = raw === null ? NaN : Number(raw);
          value = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
          display = value;
        } else if (type === 'inlineStr') {
          const is = child(c, 'is');
          value = is ? descendants(is, 't', 200).map(t => textContent(t)).join('') : '';
          display = value;
        } else if (type === 'b') {
          value = raw === '1';
          display = value ? 'TRUE' : 'FALSE';
        } else if (type === 'e') {
          value = raw;
          display = raw || '#ERROR';
        } else if (type === 'str') {
          value = raw || '';
          display = value;
        } else if (raw !== null && raw !== '') {
          const num = Number(raw);
          if (Number.isFinite(num)) {
            value = num;
            if (isDateStyle(styleId, styles)) {
              value = { serial: num, iso: excelSerialToIso(num, { date1904 }) };
              display = value.iso || String(num);
            } else {
              display = String(num);
            }
          } else {
            value = raw;
            display = raw;
          }
        }
        if (display === '' && formula) display = `=${formula}`;
        if (display !== '') values.push({ ref, column: columnIndex(ref), display });
        sheet.cells.push({
          ref, row: rowNumber, column: columnIndex(ref), type, styleId,
          value, formula, display,
        });
      }
      if (values.length) {
        rows.push({ row: rowNumber, values });
        sheet.rows += 1;
      }
    }
    sheet.text = rows.map(item => item.values.map(v => v.display).join('\t')).join('\n');
    sheets.push(sheet);
  }

  const text = sheets.map(sheet => `## Sheet: ${sheet.name}${sheet.hidden ? ' (hidden)' : ''}\n${sheet.text}`.trim()).join('\n\n');
  return {
    xlsx: {
      sheets,
      sharedStrings: sharedStrings.length,
      date1904,
      declaredSheets: sheetNodes.length,
    },
    text,
  };
}

/** Đếm nhanh số dòng/cột có dữ liệu (dùng cho báo cáo). */
function sheetDimensions(sheet) {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of sheet.cells || []) {
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.column > maxCol) maxCol = cell.column;
  }
  return { rows: maxRow, columns: maxCol + 1, cells: (sheet.cells || []).length };
}

Object.assign(__exports, { OOXML_ERRORS, ooxmlError, resolveRelationshipTarget, parseRelationships, analyzeOoxml, isDateFormatCode, excelSerialToIso, sheetDimensions });
};

__modules["core/pdf.js"] = function (__exports) {
'use strict';
/**
 * packages/core/pdf.js — parser PDF có cấu trúc (không dùng regex làm parser).
 *
 * Hỗ trợ:
 *   - bảng xref cổ điển và xref stream (PDF 1.5+), chuỗi /Prev;
 *   - object stream (/Type /ObjStm);
 *   - FlateDecode (kèm PNG predictor), ASCIIHexDecode, ASCII85Decode;
 *   - cây trang /Pages → /Kids, giữ ranh giới trang;
 *   - font đơn giản + Type0, /ToUnicode CMap;
 *   - text operator: Tj, TJ, ', ", Td, TD, Tm, T*, TL, BT/ET.
 *
 * Không hỗ trợ (báo trung thực, không giả vờ đã trích):
 *   - file mã hoá (/Encrypt) → lỗi `pdf_encrypted`;
 *   - LZW/JPX/CCITT decoder → diagnostic `unsupported_filter`;
 *   - OCR: PDF scan không có text layer chỉ được đánh dấu `no_text_layer`;
 *   - reading order phức tạp (nhiều cột, xoay trang) chỉ là xấp xỉ theo toán tử.
 *
 * Mọi vòng lặp có deadline + signal + giới hạn bộ nhớ; stream giải nén bị cắt
 * ngay khi vượt `maxPdfStreamBytes` thay vì giải nén hết rồi kiểm tra.
 */

const { PARSER_LIMITS } = __require("core/limits.js");

const PDF_ERRORS = Object.freeze({
  NOT_PDF: 'pdf_not_pdf',
  ENCRYPTED: 'pdf_encrypted',
  TRUNCATED: 'pdf_truncated',
  XREF_BROKEN: 'pdf_xref_broken',
  TOO_DEEP: 'pdf_too_deep',
  STREAM_TOO_LARGE: 'pdf_stream_too_large',
  CANCELLED: 'pdf_cancelled',
  TIMEOUT: 'pdf_timeout',
});

function pdfError(reason, detail) {
  const messages = {
    [PDF_ERRORS.NOT_PDF]: 'File không phải PDF hợp lệ.',
    [PDF_ERRORS.ENCRYPTED]: 'PDF được mã hoá — cần mật khẩu, chưa hỗ trợ.',
    [PDF_ERRORS.TRUNCATED]: 'PDF bị cắt cụt.',
    [PDF_ERRORS.XREF_BROKEN]: 'Không đọc được bảng xref.',
    [PDF_ERRORS.TOO_DEEP]: 'Cấu trúc PDF lồng quá sâu.',
    [PDF_ERRORS.STREAM_TOO_LARGE]: 'Stream PDF vượt giới hạn giải nén.',
    [PDF_ERRORS.CANCELLED]: 'Đã huỷ khi đọc PDF.',
    [PDF_ERRORS.TIMEOUT]: 'Quá thời gian cho phép khi đọc PDF.',
  };
  const error = new Error(`${messages[reason] || 'Lỗi PDF'}${detail ? ` (${detail})` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const WS = new Uint8Array(256);
for (const code of [0, 9, 10, 12, 13, 32]) WS[code] = 1;
const DELIM = new Uint8Array(256);
for (const ch of '()<>[]{}/%') DELIM[ch.charCodeAt(0)] = 1;

const latin1 = bytes => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return out;
};

class Ref {
  constructor(num, gen) { this.num = num; this.gen = gen; }
  get isRef() { return true; }
}
const isRef = value => value instanceof Ref;

class Name {
  constructor(value) { this.value = value; }
  toString() { return `/${this.value}`; }
}
const isName = value => value instanceof Name;
const nameIs = (value, expected) => isName(value) && value.value === expected;

class Dict {
  constructor(map) { this.map = map || new Map(); }
  get(key) { return this.map.get(key); }
  has(key) { return this.map.has(key); }
}

/** Byte-level object parser. */
class PdfParser {
  constructor(bytes) { this.bytes = bytes; this.pos = 0; this.depth = 0; }

  skip() {
    const { bytes } = this;
    while (this.pos < bytes.length) {
      const ch = bytes[this.pos];
      if (WS[ch]) { this.pos++; continue; }
      if (ch === 0x25) { // %
        while (this.pos < bytes.length && bytes[this.pos] !== 10 && bytes[this.pos] !== 13) this.pos++;
        continue;
      }
      break;
    }
  }

  readName() {
    const { bytes } = this;
    this.pos++; // '/'
    let out = '';
    while (this.pos < bytes.length && !WS[bytes[this.pos]] && !DELIM[bytes[this.pos]]) {
      const ch = bytes[this.pos];
      if (ch === 0x23 && this.pos + 2 < bytes.length) { // #xx
        const hex = String.fromCharCode(bytes[this.pos + 1], bytes[this.pos + 2]);
        const code = parseInt(hex, 16);
        if (Number.isFinite(code)) { out += String.fromCharCode(code); this.pos += 3; continue; }
      }
      out += String.fromCharCode(ch);
      this.pos++;
    }
    return new Name(out);
  }

  readLiteralString() {
    const { bytes } = this;
    this.pos++; // '('
    let depth = 1;
    const out = [];
    while (this.pos < bytes.length) {
      const ch = bytes[this.pos++];
      if (ch === 0x5C) { // backslash
        const next = bytes[this.pos++];
        const map = { 0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12 };
        if (map[next] !== undefined) out.push(map[next]);
        else if (next >= 0x30 && next <= 0x37) {
          let value = next - 0x30;
          for (let k = 0; k < 2 && bytes[this.pos] >= 0x30 && bytes[this.pos] <= 0x37; k++) {
            value = value * 8 + (bytes[this.pos++] - 0x30);
          }
          out.push(value & 0xFF);
        } else if (next === 0x0A) { /* line continuation */ }
        else if (next === 0x0D) { if (bytes[this.pos] === 0x0A) this.pos++; }
        else out.push(next);
        continue;
      }
      if (ch === 0x28) depth++;
      else if (ch === 0x29) { depth--; if (depth === 0) break; }
      out.push(ch);
    }
    return new Uint8Array(out);
  }

  readHexString() {
    const { bytes } = this;
    this.pos++; // '<'
    const digits = [];
    while (this.pos < bytes.length && bytes[this.pos] !== 0x3E) {
      const ch = bytes[this.pos++];
      const hex = String.fromCharCode(ch);
      if (/[0-9A-Fa-f]/.test(hex)) digits.push(hex);
    }
    if (bytes[this.pos] === 0x3E) this.pos++;
    if (digits.length % 2) digits.push('0');
    const out = new Uint8Array(digits.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(digits[i * 2] + digits[i * 2 + 1], 16);
    return out;
  }

  readArray() {
    this.pos++; // '['
    const out = [];
    for (;;) {
      this.skip();
      if (this.pos >= this.bytes.length) break;
      if (this.bytes[this.pos] === 0x5D) { this.pos++; break; }
      out.push(this.parseObject());
      if (out.length > 200000) throw pdfError(PDF_ERRORS.TOO_DEEP, 'array quá lớn');
    }
    return out;
  }

  readDict() {
    this.pos += 2; // '<<'
    const map = new Map();
    for (;;) {
      this.skip();
      if (this.pos >= this.bytes.length) break;
      if (this.bytes[this.pos] === 0x3E && this.bytes[this.pos + 1] === 0x3E) { this.pos += 2; break; }
      if (this.bytes[this.pos] !== 0x2F) { this.pos++; continue; }
      const key = this.readName().value;
      this.skip();
      map.set(key, this.parseObject());
      if (map.size > 50000) throw pdfError(PDF_ERRORS.TOO_DEEP, 'dict quá lớn');
    }
    return new Dict(map);
  }

  /** @returns {any} giá trị PDF; keyword là string (vd 'obj', 'stream'). */
  parseObject() {
    if (this.depth > 64) throw pdfError(PDF_ERRORS.TOO_DEEP);
    this.skip();
    const { bytes } = this;
    if (this.pos >= bytes.length) return undefined;
    const ch = bytes[this.pos];
    if (ch === 0x2F) return this.readName();
    if (ch === 0x28) return this.readLiteralString();
    if (ch === 0x3C) {
      if (bytes[this.pos + 1] === 0x3C) {
        this.depth++;
        const dict = this.readDict();
        this.depth--;
        return dict;
      }
      return this.readHexString();
    }
    if (ch === 0x5B) {
      this.depth++;
      const array = this.readArray();
      this.depth--;
      return array;
    }
    if (ch === 0x5D || ch === 0x3E || ch === 0x29) { this.pos++; return undefined; }

    // number / ref / keyword
    const start = this.pos;
    while (this.pos < bytes.length && !WS[bytes[this.pos]] && !DELIM[bytes[this.pos]]) this.pos++;
    if (this.pos === start) { this.pos++; return undefined; }
    const token = latin1(bytes.subarray(start, this.pos));
    if (/^[+-]?\d+$/.test(token)) {
      // Có thể là "num gen R"
      const save = this.pos;
      this.skip();
      const beforeGen = this.pos;
      while (this.pos < bytes.length && !WS[bytes[this.pos]] && !DELIM[bytes[this.pos]]) this.pos++;
      const genToken = latin1(bytes.subarray(beforeGen, this.pos));
      if (/^\d+$/.test(genToken)) {
        this.skip();
        if (bytes[this.pos] === 0x52 && (this.pos + 1 >= bytes.length || WS[bytes[this.pos + 1]] || DELIM[bytes[this.pos + 1]])) {
          this.pos++;
          return new Ref(Number(token), Number(genToken));
        }
      }
      this.pos = save;
      return Number(token);
    }
    if (/^[+-]?(\d+\.\d*|\.\d+)$/.test(token)) return Number(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    return token; // keyword: obj, endobj, stream, ...
  }
}

/** Giải nén zlib/deflate có giới hạn, huỷ ngay khi vượt ngân sách. */
async function inflateBounded(bytes, maxBytes, { signal, deadline, format = 'deflate' } = {}) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const ds = new DecompressionStream(format);
  const reader = source.pipeThrough(ds).getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      if (signal && signal.aborted) throw pdfError(PDF_ERRORS.CANCELLED);
      if (deadline && Date.now() > deadline) throw pdfError(PDF_ERRORS.TIMEOUT);
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw pdfError(PDF_ERRORS.STREAM_TOO_LARGE, `${total} > ${maxBytes}`);
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* đã đóng */ }
    throw error;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

function applyPredictor(data, params) {
  const predictor = Number(params && params.get('Predictor')) || 1;
  if (predictor < 10) return data;
  const colors = Number(params.get('Colors')) || 1;
  const bits = Number(params.get('BitsPerComponent')) || 8;
  const columns = Number(params.get('Columns')) || 1;
  const bpp = Math.max(1, Math.ceil((colors * bits) / 8));
  const rowLength = Math.ceil((colors * bits * columns) / 8);
  const rows = Math.floor(data.length / (rowLength + 1));
  const out = new Uint8Array(rows * rowLength);
  let prev = new Uint8Array(rowLength);
  for (let r = 0; r < rows; r++) {
    const filter = data[r * (rowLength + 1)];
    const row = data.subarray(r * (rowLength + 1) + 1, (r + 1) * (rowLength + 1));
    const current = new Uint8Array(rowLength);
    for (let i = 0; i < rowLength; i++) {
      const left = i >= bpp ? current[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let value = row[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      current[i] = value & 0xFF;
    }
    out.set(current, r * rowLength);
    prev = current;
  }
  return out;
}

const CP1252_EXTRA = {
  0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152,
  0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A,
  0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178,
};

/** Parse CMap ToUnicode → {map: Map<code,string>, codeBytes}. */
function parseToUnicode(text) {
  const map = new Map();
  let codeBytes = 0;
  const hexToCode = hex => parseInt(hex, 16);
  const hexToString = hex => {
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    if (hex.length % 4) out += String.fromCharCode(parseInt(hex.slice(-(hex.length % 4)).padEnd(4, '0'), 16));
    return out;
  };
  for (const block of text.matchAll(/begincodespacerange([\s\S]*?)endcodespacerange/g)) {
    const first = block[1].match(/<([0-9A-Fa-f]+)>/);
    if (first) codeBytes = Math.max(codeBytes, Math.ceil(first[1].length / 2));
  }
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const line of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(hexToCode(line[1]), hexToString(line[2]));
      if (!codeBytes) codeBytes = Math.ceil(line[1].length / 2);
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const line of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[([^\]]*)\])/g)) {
      const from = hexToCode(line[1]);
      const to = hexToCode(line[2]);
      if (!codeBytes) codeBytes = Math.ceil(line[1].length / 2);
      if (to < from || to - from > 65535) continue;
      if (line[4]) {
        const base = line[4];
        const prefix = base.slice(0, Math.max(0, base.length - 4));
        const last = parseInt(base.slice(-4), 16);
        for (let code = from; code <= to; code++) {
          const next = (last + (code - from)).toString(16).toUpperCase().padStart(4, '0');
          map.set(code, hexToString(prefix + next));
        }
      } else if (line[5]) {
        const items = [...line[5].matchAll(/<([0-9A-Fa-f]+)>/g)].map(m => m[1]);
        items.forEach((item, index) => map.set(from + index, hexToString(item)));
      }
    }
  }
  return { map, codeBytes: codeBytes || 1 };
}

class PdfDocument {
  constructor(bytes, options) {
    this.bytes = bytes;
    this.limits = options.limits || PARSER_LIMITS;
    this.signal = options.signal;
    this.deadline = options.timeoutMs ? Date.now() + options.timeoutMs : (options.deadline || 0);
    this.xref = new Map();
    this.cache = new Map();
    this.trailer = new Dict();
    this.diagnostics = [];
    this.pages = [];
    this.version = null;
    this.encrypted = false;
  }

  check() {
    if (this.signal && this.signal.aborted) throw pdfError(PDF_ERRORS.CANCELLED);
    if (this.deadline && Date.now() > this.deadline) throw pdfError(PDF_ERRORS.TIMEOUT);
  }

  async load() {
    this.check();
    const head = latin1(this.bytes.subarray(0, Math.min(2048, this.bytes.length)));
    const versionMatch = head.match(/%PDF-(\d\.\d)/);
    if (!versionMatch) throw pdfError(PDF_ERRORS.NOT_PDF);
    this.version = versionMatch[1];
    const tail = latin1(this.bytes.subarray(Math.max(0, this.bytes.length - 4096)));
    const at = tail.lastIndexOf('startxref');
    if (at < 0) throw pdfError(PDF_ERRORS.TRUNCATED, 'không có startxref');
    const offsetMatch = tail.slice(at).match(/startxref\s+(\d+)/);
    if (!offsetMatch) throw pdfError(PDF_ERRORS.XREF_BROKEN, 'startxref không có offset');
    let offset = Number(offsetMatch[1]);
    const seen = new Set();
    let first = true;
    while (offset >= 0 && !seen.has(offset) && seen.size < 16) {
      seen.add(offset);
      this.check();
      if (offset >= this.bytes.length) throw pdfError(PDF_ERRORS.TRUNCATED, 'xref offset ngoài file');
      const parsed = await this.readXrefSection(offset, first);
      first = false;
      const prev = parsed && parsed.get('Prev');
      offset = Number.isFinite(prev) ? Number(prev) : -1;
    }
    if (!this.xref.size) throw pdfError(PDF_ERRORS.XREF_BROKEN);

    const encrypt = this.trailer.get('Encrypt');
    if (encrypt) {
      this.encrypted = true;
      throw pdfError(PDF_ERRORS.ENCRYPTED);
    }
    if (!this.trailer.get('Root')) {
      // Một số file hỏng nhẹ: thử lại bằng cách scan object.
      this.rebuildXref();
      if (!this.trailer.get('Root')) throw pdfError(PDF_ERRORS.XREF_BROKEN, 'thiếu /Root');
    }
  }

  async readXrefSection(offset, isFirst) {
    const probe = new PdfParser(this.bytes);
    probe.pos = offset;
    probe.skip();
    const head = latin1(this.bytes.subarray(probe.pos, Math.min(probe.pos + 32, this.bytes.length)));
    if (head.startsWith('xref')) {
      probe.pos += 4;
      for (;;) {
        probe.skip();
        const save = probe.pos;
        const startToken = this.readRawToken(probe);
        if (startToken === 'trailer') {
          const trailer = probe.parseObject();
          if (trailer instanceof Dict) {
            if (isFirst) this.trailer = trailer;
            return trailer;
          }
          return new Dict();
        }
        const countToken = this.readRawToken(probe);
        const start = Number(startToken);
        const count = Number(countToken);
        if (!Number.isFinite(start) || !Number.isFinite(count)) { probe.pos = save; return new Dict(); }
        probe.skip();
        for (let i = 0; i < count; i++) {
          this.check();
          const entryOffset = Number(this.readRawToken(probe));
          this.readRawToken(probe); // generation
          const type = this.readRawToken(probe);
          if (type === 'n' && !this.xref.has(start + i)) {
            this.xref.set(start + i, { type: 1, offset: entryOffset, gen: 0 });
          } else if (type === 'f' && !this.xref.has(start + i)) {
            this.xref.set(start + i, { type: 0 });
          }
        }
      }
    }

    // xref stream: "num gen obj << ... >> stream"
    const object = await this.parseIndirectAt(offset);
    if (!object || !(object.value instanceof Dict)) return new Dict();
    const dict = object.value;
    if (!nameIs(dict.get('Type'), 'XRef')) {
      this.diagnostics.push('startxref không trỏ tới xref table/stream; đã thử scan.');
      return new Dict();
    }
    if (isFirst) this.trailer = dict;
    const stream = await this.streamBytes(object);
    if (!stream) return dict;
    const widths = (dict.get('W') || []).map(Number);
    if (widths.length < 3 || widths.some(w => !Number.isFinite(w) || w < 0 || w > 8)) return dict;
    const index = dict.get('Index');
    const pairs = Array.isArray(index) && index.length >= 2
      ? index.map(Number)
      : [0, Number(dict.get('Size')) || 0];
    const rowLength = widths[0] + widths[1] + widths[2];
    let cursor = 0;
    const readField = (at, width, fallback) => {
      if (!width) return fallback;
      let value = 0;
      for (let i = 0; i < width; i++) value = value * 256 + stream[at + i];
      return value;
    };
    for (let p = 0; p + 1 < pairs.length; p += 2) {
      const start = pairs[p];
      const count = pairs[p + 1];
      for (let i = 0; i < count; i++) {
        this.check();
        if (cursor + rowLength > stream.length) break;
        const type = readField(cursor, widths[0], 1);
        const field2 = readField(cursor + widths[0], widths[1], 0);
        const field3 = readField(cursor + widths[0] + widths[1], widths[2], 0);
        const num = start + i;
        if (!this.xref.has(num)) {
          if (type === 1) this.xref.set(num, { type: 1, offset: field2, gen: field3 });
          else if (type === 2) this.xref.set(num, { type: 2, objStm: field2, index: field3 });
          else this.xref.set(num, { type: 0 });
        }
        cursor += rowLength;
      }
    }
    return dict;
  }

  readRawToken(parser) {
    parser.skip();
    const start = parser.pos;
    while (parser.pos < this.bytes.length && !WS[this.bytes[parser.pos]] && !DELIM[this.bytes[parser.pos]]) parser.pos++;
    return latin1(this.bytes.subarray(start, parser.pos));
  }

  rebuildXref() {
    this.diagnostics.push('Bảng xref hỏng: đã scan lại object (chế độ phục hồi, có thể thiếu object).');
    const text = latin1(this.bytes);
    const re = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;
    let match;
    let found = 0;
    while ((match = re.exec(text)) !== null && found < 20000) {
      const num = Number(match[1]);
      if (!this.xref.has(num)) {
        this.xref.set(num, { type: 1, offset: match.index + (match[0].length - match[0].trimStart().length) - 0, gen: Number(match[2]) });
        found++;
      }
      const trailerAt = text.indexOf('trailer', re.lastIndex);
      if (trailerAt >= 0 && trailerAt < re.lastIndex + 4096) {
        const parser = new PdfParser(this.bytes);
        parser.pos = trailerAt + 7;
        const trailer = parser.parseObject();
        if (trailer instanceof Dict && trailer.get('Root')) this.trailer = trailer;
      }
    }
    if (!found) throw pdfError(PDF_ERRORS.XREF_BROKEN);
  }

  async parseIndirectAt(offset) {
    const parser = new PdfParser(this.bytes);
    parser.pos = offset;
    parser.skip();
    const num = parser.parseObject();
    const gen = parser.parseObject();
    const keyword = parser.parseObject();
    if (!Number.isFinite(num) || !Number.isFinite(gen) || keyword !== 'obj') return null;
    const value = parser.parseObject();
    parser.skip();
    const after = latin1(this.bytes.subarray(parser.pos, Math.min(parser.pos + 12, this.bytes.length)));
    if (after.startsWith('stream')) {
      let streamStart = parser.pos + 6;
      if (this.bytes[streamStart] === 0x0D) streamStart++;
      if (this.bytes[streamStart] === 0x0A) streamStart++;
      return { num, gen, value, streamStart, dict: value instanceof Dict ? value : new Dict() };
    }
    return { num, gen, value, streamStart: -1, dict: value instanceof Dict ? value : new Dict() };
  }

  async getObject(num, depth = 0) {
    if (depth > 24) throw pdfError(PDF_ERRORS.TOO_DEEP, `object ${num}`);
    if (this.cache.has(num)) return this.cache.get(num);
    this.check();
    const entry = this.xref.get(num);
    if (!entry || entry.type === 0) return null;
    if (entry.type === 1) {
      const parsed = await this.parseIndirectAt(entry.offset);
      const value = parsed ? parsed.value : null;
      this.cache.set(num, parsed);
      return parsed;
    }
    // object stream
    const stm = await this.getObject(entry.objStm, depth + 1);
    if (!stm || stm.streamStart < 0) return null;
    const data = await this.streamBytes(stm);
    if (!data) return null;
    const dict = stm.value instanceof Dict ? stm.value : new Dict();
    const count = Number(dict.get('N')) || 0;
    const first = Number(dict.get('First')) || 0;
    if (!count || count > 100000) return null;
    const headerParser = new PdfParser(data);
    const offsets = [];
    for (let i = 0; i < count; i++) {
      const objNum = headerParser.parseObject();
      const objOffset = headerParser.parseObject();
      if (!Number.isFinite(objNum) || !Number.isFinite(objOffset)) break;
      offsets.push({ num: objNum, offset: objOffset });
    }
    const target = offsets.find(item => item.num === num);
    if (!target) return null;
    const parser = new PdfParser(data);
    parser.pos = first + target.offset;
    const value = parser.parseObject();
    const packed = { num, gen: 0, value, streamStart: -1, dict: value instanceof Dict ? value : new Dict(), compressed: true };
    this.cache.set(num, packed);
    return packed;
  }

  async resolve(value, depth = 0) {
    if (!isRef(value)) return value;
    if (depth > 24) return null;
    const object = await this.getObject(value.num, depth);
    return object ? object.value : null;
  }

  async streamBytes(object) {
    if (!object || object.streamStart < 0) return null;
    let length = object.dict.get('Length');
    if (isRef(length)) length = await this.resolve(length);
    length = Number(length);
    const start = object.streamStart;
    let end = Number.isFinite(length) && length >= 0 ? start + length : -1;
    if (end < 0 || end > this.bytes.length) {
      const tail = latin1(this.bytes.subarray(start, Math.min(start + this.limits.maxPdfStreamBytes + 64, this.bytes.length)));
      const at = tail.indexOf('endstream');
      if (at < 0) throw pdfError(PDF_ERRORS.TRUNCATED, 'stream không có endstream');
      end = start + at;
    }
    const raw = this.bytes.subarray(start, Math.min(end, this.bytes.length));
    return this.decodeStream(raw, object.dict);
  }

  async decodeStream(raw, dict) {
    let filter = await this.resolve(dict.get('Filter'));
    const params = await this.resolve(dict.get('DecodeParms'));
    const filters = filter == null ? [] : Array.isArray(filter) ? filter : [filter];
    let data = raw;
    for (let i = 0; i < filters.length; i++) {
      const name = isName(filters[i]) ? filters[i].value : String(filters[i]);
      if (name === 'FlateDecode' || name === 'Fl') {
        const param = Array.isArray(params) ? await this.resolve(params[i]) : params;
        let inflated;
        try {
          inflated = await inflateBounded(data, this.limits.maxPdfStreamBytes, { signal: this.signal, deadline: this.deadline, format: 'deflate' });
        } catch (error) {
          if (error && error.code === 'PARSER_ERROR' && error.reason === PDF_ERRORS.STREAM_TOO_LARGE) throw error;
          // Một số file dùng raw deflate không header zlib.
          inflated = await inflateBounded(data, this.limits.maxPdfStreamBytes, { signal: this.signal, deadline: this.deadline, format: 'deflate-raw' });
        }
        data = applyPredictor(inflated, param instanceof Dict ? param : null);
      } else if (name === 'ASCIIHexDecode' || name === 'AHx') {
        data = decodeAsciiHex(data);
      } else if (name === 'ASCII85Decode' || name === 'A85') {
        data = decodeAscii85(data);
      } else {
        this.diagnostics.push(`unsupported_filter:${name}`);
        return null;
      }
    }
    return data;
  }
}

function decodeAsciiHex(bytes) {
  const digits = [];
  for (const ch of bytes) {
    const text = String.fromCharCode(ch);
    if (text === '>') break;
    if (/[0-9A-Fa-f]/.test(text)) digits.push(text);
  }
  if (digits.length % 2) digits.push('0');
  const out = new Uint8Array(digits.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(digits[i * 2] + digits[i * 2 + 1], 16);
  return out;
}

function decodeAscii85(bytes) {
  const text = latin1(bytes).replace(/\s+/g, '');
  const out = [];
  let buffer = 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '~') break;
    if (ch === 'z' && count === 0) { out.push(0, 0, 0, 0); continue; }
    const code = ch.charCodeAt(0) - 33;
    if (code < 0 || code > 84) continue;
    buffer = buffer * 85 + code;
    count++;
    if (count === 5) {
      out.push((buffer >>> 24) & 0xFF, (buffer >>> 16) & 0xFF, (buffer >>> 8) & 0xFF, buffer & 0xFF);
      buffer = 0;
      count = 0;
    }
  }
  if (count > 1) {
    for (let i = count; i < 5; i++) buffer = buffer * 85 + 84;
    const chunk = [(buffer >>> 24) & 0xFF, (buffer >>> 16) & 0xFF, (buffer >>> 8) & 0xFF, buffer & 0xFF];
    out.push(...chunk.slice(0, count - 1));
  }
  return new Uint8Array(out);
}

/* ─────────────── text extraction ─────────────── */

function decodeSimpleString(bytes, encodingMap) {
  let out = '';
  for (const ch of bytes) {
    if (encodingMap && encodingMap.has(ch)) out += encodingMap.get(ch);
    else out += String.fromCharCode(CP1252_EXTRA[ch] || ch);
  }
  return out;
}

function decodeCompositeString(bytes, cmap) {
  const width = Math.max(1, cmap.codeBytes || 2);
  let out = '';
  for (let i = 0; i + width <= bytes.length; i += width) {
    let code = 0;
    for (let k = 0; k < width; k++) code = (code << 8) | bytes[i + k];
    out += cmap.map.get(code) ?? '';
  }
  return out;
}

/** Tách text từ một content stream đã giải nén. */
async function extractTextFromContent(content, fonts, context = {}) {
  const parser = new PdfParser(content);
  const out = [];
  let font = null;
  let pending = null;
  let lastY = null;
  const ops = [];
  const flushOp = () => {
    if (!pending) return;
    const op = pending;
    const args = ops.splice(0, ops.length);
    try {
      if (op === 'Tf') {
        const key = isName(args[0]) ? args[0].value : null;
        font = key && fonts ? fonts.get(key) || null : null;
      } else if (op === 'BT') {
        lastY = null;
      } else if (op === 'Td' || op === 'TD') {
        const dy = Number(args[1]);
        if (Number.isFinite(dy) && Math.abs(dy) > 0.5) out.push('\n');
      } else if (op === 'Tm') {
        const y = Number(args[5]);
        if (lastY !== null && Math.abs(y - lastY) > 0.5) out.push('\n');
        lastY = Number.isFinite(y) ? y : lastY;
      } else if (op === 'T*' || op === "'" || op === '"') {
        out.push('\n');
        if (op !== 'T*') {
          const textArg = args[args.length - 1];
          if (textArg instanceof Uint8Array) out.push(decodeBytes(textArg, font));
        }
      } else if (op === 'Tj') {
        const textArg = args[0];
        if (textArg instanceof Uint8Array) out.push(decodeBytes(textArg, font));
      } else if (op === 'TJ') {
        const array = args[0];
        if (Array.isArray(array)) {
          for (const item of array) {
            if (item instanceof Uint8Array) out.push(decodeBytes(item, font));
            else if (typeof item === 'number' && item < -120) out.push(' ');
          }
        }
      }
    } catch { /* một operator hỏng không làm hỏng cả trang */ }
    pending = null;
  };

  const maxOps = 400000;
  for (let step = 0; step < maxOps; step++) {
    parser.skip();
    if (parser.pos >= content.length) break;
    const value = parser.parseObject();
    if (typeof value === 'string') {
      pending = value;
      flushOp();
    } else if (value !== undefined) {
      ops.push(value);
      if (ops.length > 64) ops.shift();
    } else if (parser.pos >= content.length) break;
  }
  if (context.signal && context.signal.aborted) throw pdfError(PDF_ERRORS.CANCELLED);
  return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function decodeBytes(bytes, font) {
  if (!font) return decodeSimpleString(bytes);
  if (font.cmap && font.cmap.map.size) return decodeCompositeString(bytes, font.cmap);
  return decodeSimpleString(bytes, font.encodingMap);
}

async function loadFont(doc, fontDict) {
  const font = { cmap: null, encodingMap: null };
  if (!(fontDict instanceof Dict)) return font;
  const toUnicodeRef = fontDict.get('ToUnicode');
  const streamObj = isRef(toUnicodeRef) ? await doc.getObject(toUnicodeRef.num) : null;
  if (streamObj && streamObj.streamStart >= 0) {
    const data = await doc.streamBytes(streamObj);
    if (data) font.cmap = parseToUnicode(latin1(data));
  }
  return font;
}

/** @returns {{text:string, pageNumber:number, chars:number}} */
async function extractPage(doc, pageDict) {
  const contents = await doc.resolve(pageDict.get('Contents'));
  const parts = Array.isArray(contents) ? contents : [pageDict.get('Contents')];
  const chunks = [];
  for (const part of parts) {
    const object = isRef(part) ? await doc.getObject(part.num) : null;
    if (!object || object.streamStart < 0) continue;
    const data = await doc.streamBytes(object);
    if (data) chunks.push(data);
  }
  if (!chunks.length) return { text: '', chars: 0 };

  const resources = (await doc.resolve(pageDict.get('Resources'))) || new Dict();
  const fontDict = resources instanceof Dict ? await doc.resolve(resources.get('Font')) : null;
  const fonts = new Map();
  if (fontDict instanceof Dict) {
    for (const [key, value] of fontDict.map.entries()) {
      const dict = await doc.resolve(value);
      fonts.set(key, await loadFont(doc, dict));
    }
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { merged.set(chunk, at); at += chunk.length; }
  const text = await extractTextFromContent(merged, fonts, { signal: doc.signal });
  return { text, chars: text.length };
}

/** Đi qua cây trang, trả danh sách /Type /Page theo thứ tự. */
async function collectPages(doc, rootRef) {
  const pages = [];
  const visited = new Set();
  const walk = async (nodeRef, depth) => {
    if (pages.length >= doc.limits.maxPages || depth > 32) return;
    doc.check();
    const key = isRef(nodeRef) ? `ref:${nodeRef.num}` : null;
    if (key) {
      if (visited.has(key)) return;
      visited.add(key);
    }
    const node = await doc.resolve(nodeRef);
    if (!(node instanceof Dict)) return;
    const type = node.get('Type');
    const kids = await doc.resolve(node.get('Kids'));
    if (nameIs(type, 'Pages') || (Array.isArray(kids) && !nameIs(type, 'Page'))) {
      for (const kid of Array.isArray(kids) ? kids : []) {
        if (pages.length >= doc.limits.maxPages) break;
        await walk(kid, depth + 1);
      }
    } else if (nameIs(type, 'Page') || node.has('Contents')) {
      pages.push(node);
    }
  };
  await walk(rootRef, 0);
  return pages;
}

/**
 * @param {Uint8Array} input
 * @param {{limits?:object, signal?:AbortSignal, timeoutMs?:number, extractText?:boolean}} [options]
 */
async function parsePdf(input, options = {}) {
  if (!(input instanceof Uint8Array)) throw pdfError(PDF_ERRORS.NOT_PDF);
  const doc = new PdfDocument(input, options);
  await doc.load();
  const catalog = await doc.resolve(doc.trailer.get('Root'));
  if (!(catalog instanceof Dict)) throw pdfError(PDF_ERRORS.XREF_BROKEN, 'Root không phải dict');
  const pageRefs = await collectPages(doc, catalog.get('Pages'));
  const pagesRoot = await doc.resolve(catalog.get('Pages'));
  const declaredCount = Number(pagesRoot instanceof Dict ? pagesRoot.get('Count') : NaN) || pageRefs.length;

  const infoDict = await doc.resolve(doc.trailer.get('Info'));
  const info = {};
  if (infoDict instanceof Dict) {
    for (const [key, value] of infoDict.map.entries()) {
      const resolved = await doc.resolve(value);
      if (typeof resolved === 'string') info[key] = resolved;
      else if (resolved instanceof Uint8Array) info[key] = decodeSimpleString(resolved);
      else if (typeof resolved === 'number') info[key] = resolved;
    }
  }

  const pages = [];
  const textPages = Math.min(pageRefs.length, doc.limits.maxPdfTextPages);
  let imageOnly = 0;
  for (let index = 0; index < textPages; index++) {
    doc.check();
    const pageDict = pageRefs[index];
    const resources = (await doc.resolve(pageDict.get('Resources'))) || new Dict();
    const xobjects = resources instanceof Dict ? await doc.resolve(resources.get('XObject')) : null;
    let images = 0;
    if (xobjects instanceof Dict) {
      for (const value of xobjects.map.values()) {
        const xobj = await doc.resolve(value);
        if (xobj instanceof Dict && nameIs(xobj.get('Subtype'), 'Image')) images += 1;
      }
    }
    let extracted = { text: '', chars: 0 };
    try {
      extracted = await extractPage(doc, pageDict);
    } catch (error) {
      if (error && error.reason === PDF_ERRORS.CANCELLED) throw error;
      doc.diagnostics.push(`page_${index + 1}_unreadable: ${error && error.message}`);
    }
    const clamped = extracted.text.length > doc.limits.maxPageTextChars
      ? extracted.text.slice(0, doc.limits.maxPageTextChars) : extracted.text;
    if (clamped.length > doc.limits.maxPageTextChars) doc.diagnostics.push('page_text_truncated');
    if (!clamped.trim() && images) imageOnly += 1;
    const mediaBox = (await doc.resolve(pageDict.get('MediaBox'))) || [];
    pages.push({
      index,
      text: clamped,
      chars: clamped.length,
      images,
      rotated: Number(await doc.resolve(pageDict.get('Rotate'))) || 0,
      width: Number(mediaBox[2] - mediaBox[0]) || null,
      height: Number(mediaBox[3] - mediaBox[1]) || null,
    });
  }

  const text = pages.map(page => page.text).join('\n\n').trim();
  if (!text) doc.diagnostics.push('no_text_layer');
  if (!text && imageOnly) doc.diagnostics.push('scanned_or_image_only');
  if (pageRefs.length > textPages) doc.diagnostics.push(`page_text_truncated_at_${textPages}`);

  return {
    kind: 'PDF',
    version: doc.version,
    pageCount: declaredCount,
    parsedPages: pages.length,
    textPages: textPages,
    pages,
    text,
    metadata: info,
    encrypted: false,
    manufacturer: { producer: info.Producer || null, creator: info.Creator || null },
    diagnostics: doc.diagnostics,
    xrefEntries: doc.xref.size,
    hasTextLayer: text.length > 0,
    scanned: !text && imageOnly > 0,
  };
}

Object.assign(__exports, { PDF_ERRORS, pdfError, parseToUnicode, extractTextFromContent, parsePdf });
};

__modules["core/c2pa.js"] = function (__exports) {
'use strict';
/**
 * packages/core/c2pa.js — xác minh C2PA ở mức mật mã, không chỉ dò marker.
 *
 * Đây là phần dễ bị thổi phồng nhất trong mọi sản phẩm "forensics". Module này
 * cố tình tách bạch từng bước và trả trạng thái riêng:
 *
 *   1. có container JUMBF/C2PA hay không;
 *   2. manifest có parse được không;
 *   3. chữ ký COSE_Sign1 có hợp lệ với public key trong x5chain không;
 *   4. hard-binding hash của asset có khớp không (asset đã bị sửa sau khi ký?);
 *   5. signer có nằm trong trust store TƯỜNG MINH của người dùng không.
 *
 * Giới hạn có chủ ý (không được giấu):
 *   - không validate chuỗi chứng chỉ tới root CA của hệ điều hành;
 *   - không kiểm tra CRL/OCSP/timestamp;
 *   - không đọc mọi loại assertion của C2PA (chỉ hard binding + hashed URI);
 *   - JUMBF parser hỗ trợ box thường/superbox, không hỗ trợ box nén.
 *
 * Vì vậy "signature_valid_untrusted" KHÔNG phải "ảnh thật", và
 * "verified_trusted" chỉ có nghĩa "khớp trust policy do người dùng cung cấp".
 */

const C2PA_STATES = Object.freeze({
  NOT_DETECTED: 'not_detected',
  UNSUPPORTED: 'unsupported',
  DETECTED_UNVERIFIED: 'detected_unverified',
  MANIFEST_INVALID: 'manifest_invalid',
  SIGNATURE_INVALID: 'signature_invalid',
  SIGNATURE_VALID_UNTRUSTED: 'signature_valid_untrusted',
  SIGNATURE_VALID_PINNED: 'signature_valid_pinned',
  CERTIFICATE_EXPIRED: 'certificate_expired',
  VERIFIED_TRUSTED: 'verified_trusted',
  TAMPERED: 'asset_modified_after_signing',
});

const C2PA_LIMITS = Object.freeze({
  /** Kích thước asset đầu vào tối đa. */
  maxAssetBytes: 100 * 1024 * 1024,
  /** Tổng payload manifest sau khi ghép các chunk. */
  maxManifestBytes: 4 * 1024 * 1024,
  /** Một box JUMBF. */
  maxBoxBytes: 4 * 1024 * 1024,
  maxBoxes: 512,
  maxDepth: 12,
  maxCborDepth: 24,
  maxCborItems: 50000,
  maxCollectionLength: 5000,
  maxStringBytes: 1024 * 1024,
  maxExclusions: 100,
  maxCertBytes: 64 * 1024,
  maxChainLength: 8,
  maxTotalCertBytes: 256 * 1024,
  maxProcessingMs: 3000,
});

function c2paError(reason, message) {
  const error = new Error(message || reason);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  return error;
}

function checkDeadline(deadline) {
  if (deadline && Date.now() > deadline) throw c2paError('c2pa_timeout', 'Xác minh C2PA vượt quá thời gian cho phép.');
}

/* ───────────────────────── CBOR ───────────────────────── */

class CborTag { constructor(tag, value) { this.tag = tag; this.value = value; } }
class CborMap { constructor(entries) { this.entries = entries || []; } get(key) { const hit = this.entries.find(item => item[0] === key); return hit ? hit[1] : undefined; } has(key) { return this.entries.some(item => item[0] === key); } }

function readUint(bytes, at, length) {
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + bytes[at + i];
  return value;
}

/**
 * Decoder CBOR có ngân sách: depth, tổng item, collection length, chuỗi, byte.
 * Mọi length được kiểm với số byte còn lại TRƯỚC khi lặp/cấp phát. Definite và
 * indefinite dùng cùng một budget; trailing bytes chỉ được bỏ qua khi caller
 * không yêu cầu complete.
 *
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 * @param {{limits?:object, requireComplete?:boolean, deadline?:number}} [options]
 */
function decodeCbor(bytes, offset = 0, options = {}) {
  if (!(bytes instanceof Uint8Array)) throw c2paError('cbor_invalid', 'CBOR: input không phải Uint8Array');
  const limits = options.limits || C2PA_LIMITS;
  const budget = { items: 0, stringBytes: 0, depth: 0 };
  const deadline = options.deadline || 0;
  const encoder = new TextDecoder('utf-8', { fatal: true });

  const readLength = (info, at) => {
    if (info < 24) return { length: info, cursor: at + 1 };
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0;
    if (!size) throw c2paError('cbor_invalid', `CBOR: length info ${info} không hợp lệ`);
    if (at + 1 + size > bytes.length) throw c2paError('cbor_truncated', 'CBOR: length vượt biên');
    let length = 0;
    for (let i = 0; i < size; i++) length = length * 256 + bytes[at + 1 + i];
    if (!Number.isSafeInteger(length)) throw c2paError('cbor_invalid', 'CBOR: length vượt Number.MAX_SAFE_INTEGER');
    return { length, cursor: at + 1 + size };
  };

  const readItem = (at, depth) => {
    checkDeadline(deadline);
    if (depth > limits.maxCborDepth) throw c2paError('cbor_too_deep', `CBOR: depth > ${limits.maxCborDepth}`);
    if (at >= bytes.length) throw c2paError('cbor_truncated', 'CBOR: hết dữ liệu');
    if (++budget.items > limits.maxCborItems) throw c2paError('cbor_too_many_items', 'CBOR: quá nhiều item');
    const initial = bytes[at];
    const major = initial >> 5;
    const info = initial & 0x1F;
    if (info === 31) {
      // break chỉ hợp lệ bên trong indefinite container; các container tự xử lý.
      throw c2paError('cbor_invalid', 'CBOR: break ngoài cấu trúc');
    }
    const { length, cursor } = readLength(info, at);

    if (major === 0) return { value: length, offset: cursor };
    if (major === 1) return { value: -1 - length, offset: cursor };
    if (major === 2 || major === 3) {
      if (length > limits.maxStringBytes) throw c2paError('cbor_string_too_large', `CBOR: chuỗi ${length} byte`);
      if (cursor + length > bytes.length) throw c2paError('cbor_truncated', 'CBOR: chuỗi vượt biên');
      const slice = bytes.subarray(cursor, cursor + length);
      if (major === 2) {
        budget.stringBytes += length;
        if (budget.stringBytes > limits.maxManifestBytes) throw c2paError('cbor_string_too_large', 'CBOR: tổng bstr quá lớn');
        return { value: slice, offset: cursor + length };
      }
      let text;
      try { text = encoder.decode(slice); }
      catch { throw c2paError('cbor_invalid_utf8', 'CBOR: text string không phải UTF-8 hợp lệ'); }
      budget.stringBytes += length;
      if (budget.stringBytes > limits.maxManifestBytes) throw c2paError('cbor_string_too_large', 'CBOR: tổng tstr quá lớn');
      return { value: text, offset: cursor + length };
    }
    if (major === 4 || major === 5) {
      const isMap = major === 5;
      const entries = [];
      const items = [];
      const keys = new Set();
      const readPair = (atPos, nested) => {
        const key = readItem(atPos, nested);
        const scalar = (typeof key.value === 'string' || typeof key.value === 'number') ? `${typeof key.value}:${key.value}` : null;
        if (scalar !== null && keys.has(scalar)) throw c2paError('cbor_duplicate_key', 'CBOR: map có key trùng.');
        if (scalar !== null) keys.add(scalar);
        const value = readItem(key.offset, nested);
        entries.push([key.value, value.value]);
        return value.offset;
      };
      const readElement = (atPos, nested) => {
        const item = readItem(atPos, nested);
        items.push(item.value);
        return item.offset;
      };
      let cursorAt = cursor;
      if (length === -1) {
        for (;;) {
          checkDeadline(deadline);
          if (cursorAt >= bytes.length) throw c2paError('cbor_truncated', 'CBOR: indefinite chưa đóng');
          if (bytes[cursorAt] === 0xFF) { cursorAt += 1; break; }
          if (entries.length + items.length >= limits.maxCollectionLength) {
            throw c2paError('cbor_collection_too_large', 'CBOR: collection quá lớn');
          }
          cursorAt = isMap ? readPair(cursorAt, depth + 1) : readElement(cursorAt, depth + 1);
        }
      } else {
        if (length > limits.maxCollectionLength) throw c2paError('cbor_collection_too_large', `CBOR: length ${length}`);
        if (length > bytes.length - cursor) throw c2paError('cbor_truncated', 'CBOR: collection vượt biên');
        for (let i = 0; i < length; i++) {
          cursorAt = isMap ? readPair(cursorAt, depth + 1) : readElement(cursorAt, depth + 1);
        }
      }
      return isMap
        ? { value: new CborMap(entries), offset: cursorAt }
        : { value: items, offset: cursorAt };
    }
    if (major === 6) {
      if (length > Number.MAX_SAFE_INTEGER) throw c2paError('cbor_invalid', 'CBOR: tag không hợp lệ');
      const item = readItem(cursor, depth + 1);
      return { value: new CborTag(length, item.value), offset: item.offset };
    }
    // major 7: simple / float.
    if (info === 20) return { value: false, offset: cursor };
    if (info === 21) return { value: true, offset: cursor };
    if (info === 22) return { value: null, offset: cursor };
    if (info === 23) return { value: undefined, offset: cursor };
    if (info === 25) {
      if (cursor + 2 > bytes.length) throw c2paError('cbor_truncated', 'CBOR: float16 vượt biên');
      const half = (bytes[at + 1] << 8) | bytes[at + 2];
      const sign = half & 0x8000 ? -1 : 1;
      const exponent = (half >> 10) & 0x1F;
      const fraction = half & 0x3FF;
      const value = exponent === 0 ? sign * fraction * 2 ** -24
        : exponent === 31 ? (fraction ? NaN : sign * Infinity)
          : sign * (1 + fraction / 1024) * 2 ** (exponent - 15);
      return { value, offset: cursor + 2 };
    }
    if (info === 26) {
      if (cursor + 4 > bytes.length) throw c2paError('cbor_truncated', 'CBOR: float32 vượt biên');
      return { value: new DataView(bytes.buffer, bytes.byteOffset + cursor, 4).getFloat32(0), offset: cursor + 4 };
    }
    if (info === 27) {
      if (cursor + 8 > bytes.length) throw c2paError('cbor_truncated', 'CBOR: float64 vượt biên');
      return { value: new DataView(bytes.buffer, bytes.byteOffset + cursor, 8).getFloat64(0), offset: cursor + 8 };
    }
    throw c2paError('cbor_invalid', `CBOR: simple value ${info} không hỗ trợ`);
  };

  const result = readItem(offset, 0);
  if (options.requireComplete && result.offset !== bytes.length) {
    throw c2paError('cbor_trailing_data', 'CBOR: còn byte thừa sau payload.');
  }
  return result;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, item) => sum + item.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

/* ───────────────────────── DER / X.509 ───────────────────────── */

function readTlv(bytes, pos) {
  if (pos + 2 > bytes.length) throw new Error('DER: thiếu header');
  const tag = bytes[pos];
  let cursor = pos + 1;
  let length = bytes[cursor++];
  if (length & 0x80) {
    const count = length & 0x7F;
    if (count === 0 || count > 4) throw new Error('DER: length không hỗ trợ');
    if (cursor + count > bytes.length) throw new Error('DER: length vượt biên');
    length = readUint(bytes, cursor, count);
    cursor += count;
  }
  if (cursor + length > bytes.length) throw new Error('DER: vượt biên');
  return { tag, rawStart: pos, start: cursor, end: cursor + length, next: cursor + length };
}

function derChildren(bytes, node) {
  const out = [];
  let at = node.start;
  while (at < node.end) {
    const child = readTlv(bytes, at);
    out.push(child);
    at = child.next;
    if (out.length > 500) throw new Error('DER: quá nhiều node');
  }
  return out;
}

const OID_NAMES = {
  '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C', '1.2.840.113549.1.9.1': 'emailAddress',
};

function decodeOid(bytes) {
  if (!bytes.length) return '';
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
  let value = 0;
  for (let i = 1; i < bytes.length; i++) {
    value = value * 128 + (bytes[i] & 0x7F);
    if (!(bytes[i] & 0x80)) { parts.push(value); value = 0; }
  }
  return parts.join('.');
}

function decodeDerString(node, bytes) {
  const raw = bytes.subarray(node.start, node.end);
  if (node.tag === 0x1E) { // BMPString
    let out = '';
    for (let i = 0; i + 1 < raw.length; i += 2) out += String.fromCharCode((raw[i] << 8) | raw[i + 1]);
    return out;
  }
  if (node.tag === 0x0C) return new TextDecoder('utf-8').decode(raw); // UTF8String
  return String.fromCharCode.apply(null, raw);
}

function parseName(bytes, node) {
  const out = {};
  for (const rdn of derChildren(bytes, node)) {
    for (const attr of derChildren(bytes, rdn)) {
      const parts = derChildren(bytes, attr);
      if (parts.length < 2) continue;
      const oid = decodeOid(bytes.subarray(parts[0].start, parts[0].end));
      const key = OID_NAMES[oid];
      if (key) out[key] = decodeDerString(parts[1], bytes);
    }
  }
  return out;
}

function parseDerTime(bytes, node) {
  const text = String.fromCharCode.apply(null, bytes.subarray(node.start, node.end));
  const match = text.match(/^(\d{2}|\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/);
  if (!match) return null;
  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  const date = new Date(Date.UTC(year, Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse chứng chỉ DER: subject/issuer, hiệu lực, SPKI, fingerprint.
 * Không kiểm tra chữ ký của CA — việc đó cần trust store và thuộc policy.
 */
async function parseCertificate(der) {
  const bytes = der instanceof Uint8Array ? der : new Uint8Array(der);
  if (bytes.length > C2PA_LIMITS.maxCertBytes) throw new Error('chứng chỉ quá lớn');
  const certificate = readTlv(bytes, 0);
  if (certificate.tag !== 0x30) throw new Error('chứng chỉ không phải SEQUENCE');
  const parts = derChildren(bytes, certificate);
  if (parts.length < 3) throw new Error('chứng chỉ thiếu trường');
  const tbs = parts[0];
  const fields = derChildren(bytes, tbs);
  let index = 0;
  if (fields[0] && fields[0].tag === 0xA0) index = 1; // version
  const serialNode = fields[index];
  const issuerNode = fields[index + 2];
  const validityNode = fields[index + 3];
  const subjectNode = fields[index + 4];
  const spkiNode = fields[index + 5];
  if (!validityNode || !subjectNode || !spkiNode) throw new Error('chứng chỉ thiếu validity/subject/SPKI');
  const validity = derChildren(bytes, validityNode);
  return {
    serial: serialNode ? [...bytes.subarray(serialNode.start, serialNode.end)].map(b => b.toString(16).padStart(2, '0')).join('') : null,
    issuer: issuerNode ? parseName(bytes, issuerNode) : {},
    subject: subjectNode ? parseName(bytes, subjectNode) : {},
    notBefore: validity[0] ? parseDerTime(bytes, validity[0]) : null,
    notAfter: validity[1] ? parseDerTime(bytes, validity[1]) : null,
    spkiDer: bytes.subarray(spkiNode.rawStart, spkiNode.end),
    fingerprintSha256: await sha256Hex(bytes),
    der: bytes,
  };
}

/* ───────────────────────── JUMBF ───────────────────────── */

/**
 * JUMBF box: LBox(4) TBox(4) [XLBox(8)] payload.
 * jumd: 16-byte UUID + toggles(1) + label (null-terminated) [+ id].
 *
 * Mọi box đều được kiểm biên và ngân sách trước khi đọc; cấu trúc hỏng ném lỗi
 * thay vì trả về cây parse dở. Box `jumb` lồng quá maxDepth cũng là lỗi.
 */
function parseJumbf(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const depth = options.depth || 0;
  const deadline = options.deadline || 0;
  const limits = options.limits || C2PA_LIMITS;
  const maxBoxes = options.maxBoxes || limits.maxBoxes;
  const maxBoxBytes = options.maxBoxBytes || limits.maxBoxBytes;
  const budget = options.budget || { boxes: 0 };
  if (depth > limits.maxDepth) throw c2paError('jumbf_too_deep', `JUMBF: depth > ${limits.maxDepth}`);
  const boxes = [];
  let at = 0;
  while (at < bytes.length) {
    checkDeadline(deadline);
    if (bytes.length - at < 8) throw c2paError('jumbf_truncated', 'JUMBF: thiếu box header');
    const view = new DataView(bytes.buffer, bytes.byteOffset + at, 8);
    let length = view.getUint32(0);
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    let cursor = at + 8;
    if (length === 1) {
      if (bytes.length - at < 16) throw c2paError('jumbf_truncated', 'JUMBF: XLBox thiếu 8 byte');
      const high = view.getUint32(8);
      const low = view.getUint32(12);
      length = high * 4294967296 + low;
      if (!Number.isSafeInteger(length)) throw c2paError('jumbf_invalid', 'JUMBF: XLBox tràn số');
      cursor = at + 16;
    } else if (length === 0) {
      // Box kéo tới hết buffer: chỉ hợp lệ như box cuối.
      length = bytes.length - at;
    }
    if (length < cursor - at) throw c2paError('jumbf_invalid', `JUMBF: LBox ${length} nhỏ hơn header`);
    if (length > maxBoxBytes) throw c2paError('jumbf_box_too_large', `JUMBF: box ${length} > ${maxBoxBytes} byte`);
    if (at + length > bytes.length) throw c2paError('jumbf_truncated', `JUMBF: box ${type} vượt biên`);
    if (++budget.boxes > maxBoxes) throw c2paError('jumbf_too_many_boxes', `JUMBF: > ${maxBoxes} box`);
    const payload = bytes.subarray(cursor, at + length);
    const box = { type, offset: at, length, data: payload };
    if (type === 'jumd') {
      if (payload.length < 17) throw c2paError('jumbf_invalid', 'JUMBF: jumd descriptor quá ngắn');
      box.uuid = [...payload.subarray(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
      box.toggles = payload[16];
      let end = payload.indexOf(0, 17);
      if (end < 0) end = payload.length;
      try { box.label = new TextDecoder('utf-8', { fatal: true }).decode(payload.subarray(17, end)); }
      catch { throw c2paError('jumbf_invalid', 'JUMBF: label không phải UTF-8'); }
    } else if (type === 'jumb') {
      if (depth >= limits.maxDepth) throw c2paError('jumbf_too_deep', `JUMBF: depth >= ${limits.maxDepth}`);
      box.children = parseJumbf(payload, { ...options, depth: depth + 1, budget });
      const descriptor = box.children.find(item => item.type === 'jumd');
      if (descriptor) {
        box.label = descriptor.label;
        box.uuid = descriptor.uuid;
      }
      const content = box.children.filter(item => item.type !== 'jumd');
      box.content = content.length ? concatBytes(content.map(item => item.data)) : null;
    }
    boxes.push(box);
    at += length;
  }
  return boxes;
}

function walkJumbf(boxes, visit, depth = 0) {
  for (const box of boxes) {
    visit(box, depth);
    if (box.children) walkJumbf(box.children, visit, depth + 1);
  }
}

/* ───────────────────────── container ───────────────────────── */

/** Tìm payload C2PA trong JPEG (APP11) hoặc PNG (caBX). */
function extractC2paPayload(bytes, { maxBytes = C2PA_LIMITS.maxManifestBytes } = {}) {
  const u8 = bytes;
  if (!(u8 instanceof Uint8Array) || u8.length < 8) return { found: false };
  if (u8[0] === 0xFF && u8[1] === 0xD8) {
    let at = 2;
    const parts = [];
    let total = 0;
    while (at + 4 <= u8.length) {
      if (u8[at] !== 0xFF) { at += 1; continue; }
      const marker = u8[at + 1];
      if (marker === 0xDA || marker === 0xD9) break;
      if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { at += 2; continue; }
      if (marker === 0xFF) { at += 1; continue; }
      if (at + 4 > u8.length) return { found: false, container: 'jpeg', invalid: 'truncated_segment' };
      const length = (u8[at + 2] << 8) | u8[at + 3];
      if (length < 2) return { found: false, container: 'jpeg', invalid: 'invalid_segment_length' };
      if (at + 2 + length > u8.length) return { found: false, container: 'jpeg', invalid: 'truncated_segment' };
      if (marker === 0xEB) {
        const start = at + 4;
        const end = at + 2 + length;
        if (u8[start] === 0x4A && u8[start + 1] === 0x50) {
          const chunk = u8.subarray(start + 2, end);
          if (chunk.length > maxBytes || total + chunk.length > maxBytes) {
            return { found: false, container: 'jpeg', invalid: 'manifest_too_large' };
          }
          total += chunk.length;
          parts.push(chunk);
        }
      }
      at += 2 + length;
    }
    if (!parts.length) return { found: false, container: 'jpeg' };
    return { found: true, container: 'jpeg', payload: concatBytes(parts) };
  }
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47) {
    let at = 8;
    while (at + 8 <= u8.length) {
      const length = ((u8[at] << 24) | (u8[at + 1] << 16) | (u8[at + 2] << 8) | u8[at + 3]) >>> 0;
      const type = String.fromCharCode(u8[at + 4], u8[at + 5], u8[at + 6], u8[at + 7]);
      if (length > maxBytes) {
        return type === 'caBX'
          ? { found: false, container: 'png', invalid: 'manifest_too_large' }
          : { found: false, container: 'png', invalid: 'chunk_too_large' };
      }
      if (at + 12 + length > u8.length) return { found: false, container: 'png', invalid: 'truncated_chunk' };
      if (type === 'caBX') {
        return { found: true, container: 'png', payload: u8.subarray(at + 8, at + 8 + length), chunkOffset: at, chunkLength: 12 + length };
      }
      if (type === 'IEND') break;
      at += 12 + length;
    }
    return { found: false, container: 'png' };
  }
  return { found: false, container: 'unknown' };
}

/* ───────────────────────── verification ───────────────────────── */

const ALG_INFO = {
  '-7': { name: 'ECDSA', hash: 'SHA-256', importAlg: 'ECDSA', curve: 'P-256' },
};
// Chỉ ES256 được kiểm bằng fixture độc lập trong bộ test. Thuật toán chưa có
// bằng chứng kiểm thử bị từ chối với trạng thái unsupported thay vì "có thể đúng".

function encodeCborText(text) {
  const bytes = new TextEncoder().encode(text);
  return concatBytes([new Uint8Array([0x60 | bytes.length]), bytes]);
}

/** Sig_structure = ["Signature1", protected, external_aad, payload] */
function buildSigStructure(protectedBytes, payload) {
  const header = new TextEncoder().encode('Signature1');
  const parts = [
    new Uint8Array([0x84]),                 // array(4)
    concatBytes([new Uint8Array([0x60 | header.length]), header]),
    concatBytes([new Uint8Array([0x40 | protectedBytes.length]), protectedBytes]),
    new Uint8Array([0x40]),                 // external_aad: bstr rỗng
    concatBytes([new Uint8Array([0x40 | payload.length]), payload]),
  ];
  // Payload có thể > 23 byte: cần header CBOR đúng độ dài.
  parts[4] = encodeCborByteString(payload);
  parts[2] = encodeCborByteString(protectedBytes);
  return concatBytes(parts);
}

function encodeCborByteString(bytes) {
  if (bytes.length < 24) return concatBytes([new Uint8Array([0x40 | bytes.length]), bytes]);
  if (bytes.length < 256) return concatBytes([new Uint8Array([0x58, bytes.length]), bytes]);
  if (bytes.length < 65536) {
    return concatBytes([new Uint8Array([0x59, bytes.length >> 8, bytes.length & 0xFF]), bytes]);
  }
  const header = new Uint8Array(5);
  header[0] = 0x5A;
  new DataView(header.buffer).setUint32(1, bytes.length);
  return concatBytes([header, bytes]);
}

function toHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Hash asset với các khoảng loại trừ (exclusions) của hard binding. */
async function hashWithExclusions(asset, exclusions, alg = 'sha256') {
  const field = (item, key) => (item instanceof CborMap ? item.get(key) : item ? item[key] : undefined);
  const algorithm = { sha256: 'SHA-256', sha384: 'SHA-384', sha512: 'SHA-512' }[alg];
  if (!algorithm) throw c2paError('unsupported_hash_algorithm', `Hash algorithm không hỗ trợ: ${alg}`);
  if (!Array.isArray(exclusions || [])) throw c2paError('invalid_exclusions', 'exclusions phải là array.');
  if ((exclusions || []).length > C2PA_LIMITS.maxExclusions) {
    throw c2paError('invalid_exclusions', `Quá nhiều exclusion (> ${C2PA_LIMITS.maxExclusions}).`);
  }
  const ranges = (exclusions || []).map(item => {
    const start = Number(field(item, 'start'));
    const length = Number(field(item, 'length'));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0) {
      throw c2paError('invalid_exclusions', 'Exclusion có start/length không hợp lệ.');
    }
    if (start > asset.length || start + length > asset.length) {
      throw c2paError('invalid_exclusions', 'Exclusion vượt quá kích thước asset.');
    }
    return { start, end: start + length };
  }).sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) throw c2paError('invalid_exclusions', 'Exclusion chồng lấn.');
  }
  const chunks = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) chunks.push(asset.subarray(cursor, range.start));
    cursor = range.end;
  }
  if (cursor < asset.length) chunks.push(asset.subarray(cursor));
  const digest = await crypto.subtle.digest(algorithm, concatBytes(chunks));
  return toHex(new Uint8Array(digest));
}

async function importPublicKey(spkiDer, algInfo) {
  const keyBytes = spkiDer instanceof Uint8Array ? spkiDer : new Uint8Array(spkiDer);
  if (algInfo.name === 'ECDSA') {
    return crypto.subtle.importKey('spki', keyBytes, { name: 'ECDSA', namedCurve: algInfo.curve }, false, ['verify']);
  }
  if (algInfo.name === 'Ed25519') {
    return crypto.subtle.importKey('spki', keyBytes, { name: 'Ed25519' }, false, ['verify']);
  }
  return crypto.subtle.importKey('spki', keyBytes, { name: algInfo.name, hash: algInfo.hash }, false, ['verify']);
}

function normalizeEcdsaSignature(signature, algInfo) {
  const sizes = { 'P-256': 64, 'P-384': 96, 'P-521': 132 };
  const expected = sizes[algInfo.curve];
  if (signature.length === expected) return signature;
  // DER ECDSA → raw r||s (một số implementation dùng DER).
  if (signature[0] === 0x30) {
    const tlv = readTlv(signature, 0);
    const parts = derChildren(signature, tlv);
    if (parts.length === 2) {
      const size = expected / 2;
      const out = new Uint8Array(expected);
      out.set(signature.subarray(parts[0].start + Math.max(0, parts[0].end - parts[0].start - size), parts[0].end), 0);
      out.set(signature.subarray(parts[1].start + Math.max(0, parts[1].end - parts[1].start - size), parts[1].end), size);
      return out;
    }
  }
  return signature;
}

/**
 * @param {Uint8Array} asset toàn bộ file
 * @param {{trustedFingerprints?:string[], trustedCertificates?:Uint8Array[]}} [options]
 */
async function verifyC2pa(asset, options = {}) {
  const result = {
    state: C2PA_STATES.NOT_DETECTED,
    found: false,
    container: null,
    signatureValid: false,
    hashValid: null,
    trusted: false,
    expired: false,
    signer: null,
    issuer: null,
    notBefore: null,
    notAfter: null,
    claimGenerator: null,
    assertionCount: 0,
    errors: [],
    diagnostics: [],
    trustMode: 'none',
    pinned: false,
    chainStatus: 'not_evaluated',
    chainLength: 0,
    trustPolicy: options.trustedFingerprints || options.trustedCertificates ? 'explicit' : 'none',
  };
  const byteArray = asset instanceof Uint8Array ? asset : new Uint8Array(asset);
  if (byteArray.byteLength > C2PA_LIMITS.maxAssetBytes) {
    result.state = C2PA_STATES.UNSUPPORTED;
    result.errors.push(`Asset ${byteArray.byteLength} byte vượt giới hạn ${C2PA_LIMITS.maxAssetBytes}.`);
    return result;
  }
  const deadline = Date.now() + (Number(options.maxProcessingMs) || C2PA_LIMITS.maxProcessingMs);
  const extracted = extractC2paPayload(byteArray);
  result.container = extracted.container || null;
  if (extracted.invalid) {
    result.found = true;
    result.state = C2PA_STATES.MANIFEST_INVALID;
    result.errors.push(`Container C2PA không hợp lệ: ${extracted.invalid}`);
    return result;
  }
  if (!extracted.found) return result;
  result.found = true;
  result.state = C2PA_STATES.DETECTED_UNVERIFIED;

  let boxes;
  try {
    boxes = parseJumbf(extracted.payload, { deadline });
  } catch (error) {
    result.state = C2PA_STATES.MANIFEST_INVALID;
    result.errors.push(`JUMBF: ${error.message}`);
    return result;
  }

  const all = [];
  walkJumbf(boxes, box => all.push(box));
  const manifest = all.find(box => box.type === 'jumb' && box.label && box.label.startsWith('urn:uuid:'));
  const claimBox = all.find(box => box.label === 'c2pa.claim' && box.content && box.content.length);
  const signatureBox = all.find(box => box.label === 'c2pa.signature' && box.content && box.content.length);
  if (!manifest || !claimBox || !signatureBox) {
    result.state = C2PA_STATES.MANIFEST_INVALID;
    result.errors.push('Thiếu box c2pa.claim/c2pa.signature chuẩn.');
    return result;
  }

  // COSE_Sign1
  let cose;
  try {
    const decoded = decodeCbor(signatureBox.content, 0, { requireComplete: true, deadline });
    const value = decoded.value instanceof CborTag ? decoded.value.value : decoded.value;
    if (!Array.isArray(value) || value.length < 4) throw new Error('COSE_Sign1 phải là array 4 phần tử');
    if (value.length > 4) throw new Error('COSE_Sign1 có phần tử thừa');
    cose = {
      protectedBytes: value[0] instanceof Uint8Array ? value[0] : new Uint8Array(0),
      unprotected: value[1] instanceof CborMap ? value[1] : new CborMap([]),
      payload: value[2] instanceof Uint8Array ? value[2] : claimBox.content,
      signature: value[3] instanceof Uint8Array ? value[3] : new Uint8Array(0),
    };
  } catch (error) {
    result.state = C2PA_STATES.MANIFEST_INVALID;
    result.errors.push(`COSE: ${error.message}`);
    return result;
  }

  let protectedHeader = new CborMap([]);
  try {
    if (cose.protectedBytes.length) {
      protectedHeader = decodeCbor(cose.protectedBytes, 0, { requireComplete: true, deadline }).value;
      if (!(protectedHeader instanceof CborMap)) throw new Error('protected header phải là map');
    }
  } catch (error) {
    result.state = C2PA_STATES.MANIFEST_INVALID;
    result.errors.push(`protected header không đọc được: ${error.message}`);
    return result;
  }
  // COSE yêu cầu alg nằm trong protected header; không chọn thuật toán từ header
  // không được ký, vì kẻ tấn công có thể đổi nó mà không phá chữ ký.
  const algKey = protectedHeader.has(1) ? String(protectedHeader.get(1)) : '';
  if (!algKey) {
    result.state = C2PA_STATES.SIGNATURE_INVALID;
    result.errors.push('COSE thiếu alg trong protected header.');
    return result;
  }
  if (cose.unprotected.has(1) && String(cose.unprotected.get(1)) !== algKey) {
    result.state = C2PA_STATES.SIGNATURE_INVALID;
    result.errors.push('alg ở protected và unprotected header mâu thuẫn.');
    return result;
  }
  const algInfo = ALG_INFO[algKey];
  const x5chain = (() => {
    const fromProtected = protectedHeader.get('x5chain');
    const fromUnprotected = cose.unprotected.get('x5chain');
    const chain = fromProtected || fromUnprotected || cose.unprotected.get(33) || protectedHeader.get(33);
    if (!chain) return [];
    return Array.isArray(chain) ? chain : [chain];
  })();

  if (!algInfo) {
    result.state = C2PA_STATES.UNSUPPORTED;
    result.errors.push(`Thuật toán COSE chưa hỗ trợ: ${algKey || '?'}`);
    return result;
  }
  if (!x5chain.length) {
    result.state = C2PA_STATES.SIGNATURE_INVALID;
    result.errors.push('Không có x5chain để lấy public key.');
    return result;
  }
  if (x5chain.length > C2PA_LIMITS.maxChainLength) {
    result.state = C2PA_STATES.UNSUPPORTED;
    result.errors.push(`x5chain có ${x5chain.length} chứng chỉ, vượt giới hạn ${C2PA_LIMITS.maxChainLength}.`);
    return result;
  }
  let chainBytes = 0;
  for (const item of x5chain) {
    if (!(item instanceof Uint8Array)) {
      result.state = C2PA_STATES.MANIFEST_INVALID;
      result.errors.push('x5chain chứa phần tử không phải byte string.');
      return result;
    }
    chainBytes += item.byteLength;
    if (item.byteLength > C2PA_LIMITS.maxCertBytes || chainBytes > C2PA_LIMITS.maxTotalCertBytes) {
      result.state = C2PA_STATES.UNSUPPORTED;
      result.errors.push('Chuỗi chứng chỉ vượt giới hạn byte.');
      return result;
    }
  }
  result.chainLength = x5chain.length;

  let leaf;
  try {
    leaf = await parseCertificate(x5chain[0]);
  } catch (error) {
    result.state = C2PA_STATES.SIGNATURE_INVALID;
    result.errors.push(`Chứng chỉ: ${error.message}`);
    return result;
  }
  result.signer = leaf.subject.CN || null;
  result.issuer = leaf.issuer.CN || null;
  result.notBefore = leaf.notBefore;
  result.notAfter = leaf.notAfter;
  const now = Date.now();
  result.expired = Boolean((leaf.notAfter && Date.parse(leaf.notAfter) < now) || (leaf.notBefore && Date.parse(leaf.notBefore) > now));

  // Chữ ký trên claim.
  try {
    const key = await importPublicKey(leaf.spkiDer, algInfo);
    const signature = algInfo.name === 'ECDSA' ? normalizeEcdsaSignature(cose.signature, algInfo) : cose.signature;
    const verifyParams = algInfo.name === 'ECDSA'
      ? { name: 'ECDSA', hash: algInfo.hash }
      : algInfo.name === 'RSA-PSS'
        ? { name: 'RSA-PSS', saltLength: algInfo.saltLength }
        : { name: algInfo.name };
    result.signatureValid = await crypto.subtle.verify(
      verifyParams,
      key,
      signature,
      buildSigStructure(cose.protectedBytes, cose.payload),
    );
  } catch (error) {
    result.signatureValid = false;
    result.errors.push(`Xác minh chữ ký: ${error.message}`);
  }
  if (!result.signatureValid) {
    result.state = C2PA_STATES.SIGNATURE_INVALID;
    return result;
  }

  // Claim + hard binding.
  let claim = null;
  try {
    claim = decodeCbor(cose.payload, 0, { requireComplete: true, deadline }).value;
    if (claim instanceof CborMap) {
      result.claimGenerator = claim.get('claim_generator') || claim.get('claimGenerator') || null;
    }
  } catch (error) {
    result.diagnostics.push(`claim CBOR không đọc được: ${error.message}`);
  }

  const assertionBoxes = all.filter(box => box.label && box.label.startsWith('c2pa.')
    && !['c2pa.claim', 'c2pa.signature', 'c2pa.assertions'].includes(box.label)
    && box.content && box.content.length);
  result.assertionCount = assertionBoxes.length;

  // Hashed URI của assertion trong claim (nếu có) — kiểm tra thật.
  if (claim instanceof CborMap) {
    const declared = claim.get('assertions');
    if (Array.isArray(declared)) {
      for (const item of declared) {
        if (!(item instanceof CborMap)) continue;
        const hash = item.get('hash');
        if (!(hash instanceof Uint8Array)) continue;
        const target = assertionBoxes.find(box => box.label === 'c2pa.hash.data') || assertionBoxes[0];
        if (!target) continue;
        const actual = await sha256Hex(target.content);
        if (actual !== toHex(hash)) {
          result.hashValid = false;
          result.state = C2PA_STATES.MANIFEST_INVALID;
          result.errors.push('Hash của assertion không khớp claim: manifest đã bị sửa.');
          return result;
        }
      }
    }
  }

  // Hard binding: hash asset với exclusions.
  const hashBox = assertionBoxes.find(box => box.label === 'c2pa.hash.data');
  if (hashBox) {
    try {
      const assertion = decodeCbor(hashBox.content, 0, { requireComplete: true, deadline }).value;
      if (assertion instanceof CborMap) {
        const expected = assertion.get('hash');
        const exclusions = assertion.get('exclusions');
        if (expected instanceof Uint8Array) {
          const algorithm = assertion.get('alg') || 'sha256';
          const actual = await hashWithExclusions(byteArray, exclusions, algorithm);
          result.hashValid = actual === toHex(expected);
          if (!result.hashValid) {
            result.state = C2PA_STATES.TAMPERED;
            result.errors.push('Hash hard binding không khớp: asset đã bị sửa sau khi ký.');
          }
        }
      }
    } catch (error) {
      result.hashValid = false;
      result.state = C2PA_STATES.MANIFEST_INVALID;
      result.errors.push(`Hard binding không hợp lệ: ${error.message}`);
      return result;
    }
  } else {
    result.diagnostics.push('Không có c2pa.hash.data: chưa kiểm tra được asset có bị sửa sau khi ký.');
  }

  // Trust policy tường minh.
  const trusted = new Set((options.trustedFingerprints || []).map(value => String(value).toLowerCase().replace(/[^0-9a-f]/g, '')));
  if (Array.isArray(options.trustedCertificates)) {
    for (const certificate of options.trustedCertificates) {
      try {
        const parsed = await parseCertificate(certificate);
        trusted.add(parsed.fingerprintSha256);
      } catch { /* chứng chỉ trust store hỏng: bỏ qua, không tự tin */ }
    }
  }
  result.pinned = trusted.has(leaf.fingerprintSha256);
  result.trusted = result.pinned;
  // Ghim fingerprint là tin cậy TƯỜNG MINH của người dùng ở lá, KHÔNG phải chuỗi
  // chứng chỉ hợp lệ tới root CA. Chuỗi không được đánh giá trong bản này.
  result.chainStatus = 'not_evaluated';
  if (result.pinned) result.trustMode = 'pinned_leaf';
  result.diagnostics.push('Chuỗi chứng chỉ chưa được đánh giá: không kiểm tra CA/CRL/OCSP/timestamp.');

  if (result.state !== C2PA_STATES.TAMPERED) {
    if (result.expired) {
      result.state = C2PA_STATES.CERTIFICATE_EXPIRED;
    } else {
      result.state = result.pinned ? C2PA_STATES.SIGNATURE_VALID_PINNED : C2PA_STATES.SIGNATURE_VALID_UNTRUSTED;
    }
  }
  if (result.expired) result.errors.push('Chứng chỉ đã hết hạn hoặc chưa tới hiệu lực.');
  return result;
}

Object.assign(__exports, { C2PA_STATES, C2PA_LIMITS, CborMap, decodeCbor, parseCertificate, parseJumbf, walkJumbf, extractC2paPayload, hashWithExclusions, verifyC2pa });
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

const PROMPT_VERSION = '2.3.1';

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
 *
 * Phân biệt quan trọng (2.3):
 *   kind: 'correction'  → lỗi chắc chắn, sửa không đổi nghĩa;
 *         'suggestion'  → lời khuyên về văn phong, có thể đúng ngữ cảnh.
 *   category: spelling | typo | grammar | punctuation | word-choice |
 *             redundancy | style | consistency | capitalization.
 *   confidence: 0..1, dùng để UI xếp thứ tự và để evaluation tách ngưỡng.
 */

const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

const CATEGORY = Object.freeze({
  SPELLING: 'spelling',
  TYPO: 'typo',
  GRAMMAR: 'grammar',
  PUNCTUATION: 'punctuation',
  WORD_CHOICE: 'word-choice',
  REDUNDANCY: 'redundancy',
  STYLE: 'style',
  CONSISTENCY: 'consistency',
  CAPITALIZATION: 'capitalization',
});

const KIND = Object.freeze({ CORRECTION: 'correction', SUGGESTION: 'suggestion' });

/**
 * @param {string} text văn bản gốc
 * @param {{type?:string, category?:string, kind?:string, confidence?:number,
 *   severity?:string, language:string, start:number, end:number,
 *   replacement:string, reason:string, explanation?:string,
 *   source?:string, ruleId?:string, paragraph?:number, evidence?:Array<object>}} spec
 * @returns {object}
 */
function makeSuggestion(text, spec) {
  const start = spec.start;
  const end = spec.end;
  const original = String(text).slice(start, end);
  const category = spec.category || spec.type || 'grammar';
  const kind = spec.kind || (spec.severity === SEVERITY.ERROR ? KIND.CORRECTION : KIND.SUGGESTION);
  const confidence = Number.isFinite(spec.confidence)
    ? Math.max(0, Math.min(1, Number(spec.confidence)))
    : (kind === KIND.CORRECTION ? 0.95 : 0.55);
  return {
    id: `${spec.ruleId || category}-${start}-${end}`,
    type: category,
    category,
    kind,
    confidence,
    severity: spec.severity || (kind === KIND.CORRECTION ? SEVERITY.ERROR : SEVERITY.INFO),
    language: spec.language || 'unknown',
    start,
    end,
    original,
    replacement: spec.replacement,
    reason: spec.reason,
    explanation: spec.explanation || spec.reason,
    source: spec.source || 'deterministic-rule',
    ruleId: spec.ruleId || null,
    paragraph: Number.isInteger(spec.paragraph) ? spec.paragraph : null,
    evidence: spec.evidence || null,
    accepted: false,
  };
}

/** Sắp xếp và loại gợi ý chồng lấn (giữ gợi ý xuất hiện trước, ưu tiên lỗi). */
function sortSuggestions(list) {
  const weight = { error: 0, warning: 1, info: 2 };
  const sorted = [...list].sort((a, b) => a.start - b.start
    || (weight[a.severity] ?? 3) - (weight[b.severity] ?? 3)
    || (b.confidence || 0) - (a.confidence || 0)
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
    corrections: list.filter(item => item.kind === KIND.CORRECTION).length,
    byType: list.reduce((acc, item) => {
      acc[item.category || item.type] = (acc[item.category || item.type] || 0) + 1;
      return acc;
    }, {}),
    bySeverity: list.reduce((acc, item) => {
      acc[item.severity] = (acc[item.severity] || 0) + 1;
      return acc;
    }, {}),
    highConfidence: list.filter(item => (item.confidence || 0) >= 0.9).length,
  };
}

Object.assign(__exports, { SEVERITY, CATEGORY, KIND, makeSuggestion, sortSuggestions, suggestionStats });
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
 * packages/writing/grammar/en.js — luật tiếng Anh deterministic (2.3).
 *
 * Nguyên tắc: chỉ tự động sửa khi ngữ cảnh cho phép chắc chắn. Trường hợp mơ hồ
 * (its/it's, affect/effect, then/than) chỉ tạo gợi ý với confidence thấp hơn,
 * và luôn có lý do cụ thể để người dùng tự quyết.
 *
 * Không có luật nào đoán ý người viết, không đổi từ đồng nghĩa, không "làm hay
 * hơn". Mọi match đều thành gợi ý để người dùng duyệt, không tự áp.
 */

const { CATEGORY, KIND, SEVERITY } = __require("writing/suggestions.js");

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
  existance: 'existence', independant: 'independent', maintenence: 'maintenance',
  priviledge: 'privilege', reccomend: 'recommend', speach: 'speech',
  threshhold: 'threshold', wich: 'which',
};

/** Danh từ không đếm được đi với "much"; số nhiều đếm được đi với "many". */
const UNCOUNTABLE = new Set([
  'water', 'information', 'time', 'money', 'research', 'evidence', 'advice', 'homework',
  'equipment', 'software', 'feedback', 'traffic', 'furniture', 'luggage', 'knowledge',
  'progress', 'news', 'work', 'staff', 'training', 'content', 'data',
]);
const COUNTABLE_PLURAL = new Set([
  'people', 'things', 'items', 'books', 'files', 'documents', 'errors', 'options',
  'users', 'reasons', 'questions', 'problems', 'examples', 'companies', 'products',
  'words', 'pages', 'tests', 'issues', 'friends', 'colleagues', 'participants',
  'students', 'readers', 'customers', 'developers', 'teams', 'hours', 'days', 'years', 'months',
]);

const VOWEL_EXCEPTIONS = /^(uni|use|user|usu|uti|eu|one|once|ubiq)/i;
const CONSONANT_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

/** Chữ cái đầu đọc như nguyên âm: an MBA, an FBI, an X-ray. */
const VOWEL_SOUND_LETTERS = new Set(['a', 'e', 'f', 'h', 'i', 'l', 'm', 'n', 'o', 'r', 's', 'x']);

function needsAn(word) {
  const value = String(word || '');
  if (!value) return false;
  const first = value[0];
  if (/[0-9]/.test(first)) {
    // 8, 11, 18 đọc bắt đầu bằng nguyên âm; 1 đọc "one".
    if (/^(8|11|18)/.test(value)) return true;
    return false;
  }
  if (/^[A-Z]{2,}/.test(value)) {
    // Viết tắt: đọc từng chữ cái.
    return VOWEL_SOUND_LETTERS.has(first.toLowerCase());
  }
  if (CONSONANT_EXCEPTIONS.test(value)) return true;
  if (VOWEL_EXCEPTIONS.test(value)) return false;
  return /^[aeiou]/i.test(value);
}

const EN_RULES = [
  {
    id: 'en.repeated-word',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.8,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.98,
    run(text) {
      const out = [];
      const re = /\b(would|could|should|must|might)\s+of\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({
          start: m.index,
          end: m.index + m[0].length,
          replacement: `${m[1]} have`,
          reason: 'Sau động từ khuyết thiếu là "have", không phải "of".',
        });
      }
      return out;
    },
  },
  {
    id: 'en.irregular-participle',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.97,
    run(text) {
      const out = [];
      const re = /\b(has|have|had)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const past = m[2].toLowerCase();
        const fixed = IRREGULAR[past];
        if (!fixed || fixed === past) continue;
        out.push({
          start: m.index,
          end: m.index + m[0].length,
          replacement: `${m[1]} ${fixed}`,
          reason: `Thì hoàn thành cần quá khứ phân từ "${fixed}", không phải "${m[2]}".`,
        });
      }
      return out;
    },
  },
  {
    id: 'en.spelling-common',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.96,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\b(a|an)[ \t]+([A-Za-z0-9][A-Za-z0-9-]*)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const article = m[1].toLowerCase();
        const word = m[2];
        if (/^(one|once|unique|united|universal|useful)$/i.test(word)) continue;
        const vowelSound = needsAn(word);
        if (article === 'a' && vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'an', reason: `Trước "${word}" đọc bắt đầu bằng nguyên âm nên dùng "an".` });
        } else if (article === 'an' && !vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'a', reason: `Trước "${word}" đọc bắt đầu bằng phụ âm nên dùng "a".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.space-before-punctuation',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const before = text[m.index - 1] || '';
        if (/[0-9]/.test(before) && m[1] === '.') continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'en.space-after-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /([,;])(?=[A-Za-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (/[0-9]/.test(text[m.index - 1] || '')) continue; // 1,000
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Cần một khoảng trắng sau dấu phẩy/chấm phẩy.' });
      }
      return out;
    },
  },
  {
    id: 'en.double-space',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.92,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
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
    type: CATEGORY.CAPITALIZATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.7,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
    run(text) {
      const out = [];
      const re = /\b(they|we|you|these|those)\s+was\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} were`, reason: 'Chủ ngữ số nhiều/ngôi hai đi với "were".' });
      }
      return out;
    },
  },
  {
    id: 'en.third-person-dont',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
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
  {
    id: 'en.have-has',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const patterns = [
        { re: /\b(he|she|it)\s+have\b/gi, replace: m => `${m[1]} has`, reason: 'Ngôi thứ ba số ít dùng "has".' },
        { re: /\b(they|we|you)\s+has\b/gi, replace: m => `${m[1]} have`, reason: 'Chủ ngữ số nhiều/ngôi hai dùng "have".' },
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.re.exec(text)) !== null) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: pattern.replace(m), reason: pattern.reason });
        }
      }
      return out;
    },
  },
  {
    id: 'en.there-is-plural',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\bthere\s+(is|was)\s+(many|several|two|three|four|five|both|few|multiple)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const verb = m[1].toLowerCase() === 'is' ? 'are' : 'were';
        const lead = /^[A-Z]/.test(m[0]) ? 'There' : 'there';
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${lead} ${verb} ${m[2]}`, reason: `"${m[2]}" là số nhiều nên dùng "there ${verb}".` });
      }
      return out;
    },
  },
  {
    id: 'en.much-many',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /\b(much|many)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const determiner = m[1].toLowerCase();
        const noun = m[2].toLowerCase();
        if (determiner === 'much' && COUNTABLE_PLURAL.has(noun)) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: `many ${m[2]}`, reason: `"${m[2]}" đếm được nên dùng "many".` });
        } else if (determiner === 'many' && UNCOUNTABLE.has(noun)) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: `much ${m[2]}`, reason: `"${m[2]}" không đếm được nên dùng "much".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.its-it-is',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.92,
    run(text) {
      const out = [];
      // "its a" / "its the" không thể là sở hữu cách (thiếu danh từ) → "it's".
      const re = /\bits\s+(a|an|the|not|been|going|time|clear|important)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const replacement = /^[A-Z]/.test(m[0]) ? "It's" : "it's";
        out.push({ start: m.index, end: m.index + 3, replacement, reason: '"its" là sở hữu; ở đây cần "it is" → "it\'s".' });
      }
      return out;
    },
  },
  {
    id: 'en.their-there',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\btheir\s+(is|are|was|were)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const replacement = /^[A-Z]/.test(m[0]) ? 'There' : 'there';
        out.push({ start: m.index, end: m.index + 5, replacement, reason: 'Cần "there" (tồn tại), không phải "their" (sở hữu).' });
      }
      return out;
    },
  },
  {
    id: 'en.loose-lose',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\bloose\s+(weight|money|time|track|focus|control|interest)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        out.push({ start, end: start + 5, replacement: 'lose', reason: '"lose" là mất; "loose" là lỏng.' });
      }
      return out;
    },
  },
  {
    id: 'en.then-than',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.WARNING,
    kind: KIND.SUGGESTION,
    confidence: 0.55,
    run(text) {
      const out = [];
      const re = /\b(more|less|better|worse|other|rather|greater|smaller|older|younger|faster|slower|higher|lower)\s+then\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[0].length - 4;
        out.push({ start: at, end: at + 4, replacement: 'than', reason: 'So sánh hơn dùng "than"; "then" là thời gian.' });
      }
      return out;
    },
  },
  {
    id: 'en.oxford-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.35,
    run(text) {
      const out = [];
      // Liệt kê 3 phần tử không có dấu phẩy trước "and" — chỉ là lựa chọn style.
      const re = /\b([A-Za-z]+),\s+([A-Za-z]+)\s+and\s+([A-Za-z]+)\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: m.index + m[0].length, replacement: `, ${m[2]}, and ${m[3]}`, reason: 'Có thể dùng dấu phẩy Oxford trong liệt kê 3 phần tử (tuỳ house style).' });
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
 * packages/writing/grammar/vi.js — luật tiếng Việt deterministic (2.3).
 *
 * Sửa hồi quy quan trọng so với 2.2: các cụm như "cũng như là", "nói chung là",
 * "ngoài ra thì", "tuy nhiên thì" là tiếng Việt tự nhiên, chỉ hơi dài. Chúng
 * KHÔNG còn bị xếp vào lỗi chính tả; chúng là gợi ý văn phong (kind
 * 'suggestion'), người dùng có thể bỏ qua.
 *
 * Giới hạn phải nói thẳng: đây KHÔNG phải bộ ngữ pháp tiếng Việt. Nó bắt lỗi
 * gõ, khoảng trắng, lặp từ và một số cấu trúc rõ ràng. Không đoán ý người viết,
 * không đổi từ đồng nghĩa, không sửa trật tự từ.
 */

const { CATEGORY, KIND, SEVERITY } = __require("writing/suggestions.js");

/** Từ lặp có chủ đích trong tiếng Việt (nhấn mạnh, phân phối, số nhiều). */
const REDUPLICATION_ALLOWED = new Set([
  'người', 'nhà', 'ngày', 'đêm', 'năm', 'tháng', 'lần', 'ai', 'gì', 'nào', 'sao',
  'thế', 'vậy', 'rất', 'hơi', 'mãi', 'luôn', 'từng', 'mỗi', 'đi', 'lại', 'ra', 'vào',
  'dần', 'mãi', 'hoài', 'thôi', 'đâu', 'hơn', 'lắm', 'quá',
]);

/**
 * Lỗi chính tả/gõ KHÔNG mơ hồ. Chỉ những cặp mà từ sai không phải là một từ
 * khác có nghĩa trong tiếng Việt.
 */
const TYPOS = {
  'sử lý': 'xử lý',
  'xử dụng': 'sử dụng',
  'bỡi vì': 'bởi vì',
  'bởi zì': 'bởi vì',
  'vì zậy': 'vì vậy',
  'đựơc': 'được',
  'ngừơi': 'người',
  'nhửng': 'những',
  'khỏang': 'khoảng',
  'chọng': 'trọng',
  'ngọai': 'ngoại',
  'họach': 'hoạch',
};

/**
 * Cụm dài hơn cách nói gọn — tiếng Việt tự nhiên, nên chỉ là gợi ý văn phong.
 * Không bao giờ tự áp; confidence thấp để UI xếp sau lỗi thật.
 */
const STYLE_TRIMS = {
  'cũng như là': 'cũng như',
  'nói chung là': 'nói chung',
  'ngoài ra thì': 'ngoài ra',
  'tuy nhiên thì': 'tuy nhiên',
  'bởi vì thế': 'bởi thế',
  'cho nên là': 'cho nên',
  'như là': 'như',
  'thì là': 'thì',
  'mà là': 'mà',
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundary(value) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(value)}(?![\\p{L}\\p{N}])`, 'giu');
}

/** @type {Array<{id:string,type:string,severity:string,kind?:string,confidence?:number,run:(text:string)=>Array<object>}>} */
const VI_RULES = [
  {
    id: 'vi.typo-unambiguous',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.97,
    run(text) {
      const out = [];
      for (const [wrong, right] of Object.entries(TYPOS)) {
        if (wrong === right) continue;
        const re = wordBoundary(wrong);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: right,
            reason: `Lỗi gõ: "${wrong}" → "${right}".`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.repeated-word',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /(^|[^\p{L}])([\p{L}]{2,})([ \t]+)\2(?=[^\p{L}]|$)/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        // "người người", "ngày ngày"… là láy có chủ đích, không phải lỗi.
        if (REDUPLICATION_ALLOWED.has(m[2].toLowerCase())) continue;
        const start = m.index + m[1].length;
        out.push({ start, end: m.index + m[0].length, replacement: m[2], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'vi.style-trim',
    type: CATEGORY.STYLE,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.45,
    run(text) {
      const out = [];
      for (const [long, short] of Object.entries(STYLE_TRIMS)) {
        const re = wordBoundary(long);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: short,
            reason: `Có thể viết gọn hơn: "${long}" → "${short}". Đây là lựa chọn văn phong, không phải lỗi.`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.space-before-punctuation',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const before = text[m.index - 1] || '';
        // "1 000" hay "10 : 30" hiếm; dấu chấm giữa số là thập phân, không sửa.
        if (/[0-9]/.test(before) && m[1] === '.') continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.8,
    run(text) {
      const out = [];
      const re = /([,;:])(?=[\p{L}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        // "1,5" là số thập phân kiểu Việt Nam, không phải thiếu khoảng trắng.
        if (/[0-9]/.test(text[m.index - 1] || '') && m[1] === ',') continue;
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Cần một khoảng trắng sau dấu phẩy/hai chấm.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-period',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /([.!?])(?=[\p{Lu}\p{Ll}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        const next = text[m.index + 1] || '';
        const before = text[m.index - 1] || '';
        if (/[0-9]/.test(before) || /[0-9]/.test(next)) continue; // 3.14, phiên bản
        if (m[1] === '.' && /[A-Z]/.test(before) && /[A-Z]/.test(next)) continue; // viết tắt kiểu "TP.HCM"
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Thiếu khoảng trắng sau dấu kết câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.double-space',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.9,
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
    id: 'vi.decomposed-unicode',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.95,
    run(text) {
      const out = [];
      // Nguyên âm/ký tự có thể bị tách dấu (NFD) khi copy từ PDF hoặc web.
      const re = /[\p{L}][\p{M}]+/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        const composed = m[0].normalize('NFC');
        if (composed !== m[0]) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: composed,
            reason: 'Ký tự bị tách dấu (Unicode tổ hợp) — chuẩn hoá về NFC.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.sentence-start',
    type: CATEGORY.CAPITALIZATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.7,
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
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.6,
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
  {
    id: 'vi.redundant-pair',
    type: CATEGORY.REDUNDANCY,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.5,
    run(text) {
      const out = [];
      // Hai từ nối cùng chức năng trong một câu. Thay bằng dạng gọn, không xoá trắng.
      const pairs = {
        'và cũng': 'và',
        'nhưng tuy nhiên': 'nhưng',
        'bởi vì do': 'bởi vì',
        'nếu như': 'nếu',
        'hoặc là': 'hoặc',
      };
      for (const [long, short] of Object.entries(pairs)) {
        const re = wordBoundary(long);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: short,
            reason: `Hai từ nối cùng chức năng: có thể viết "${short}".`,
          });
        }
      }
      return out;
    },
  },
];

Object.assign(__exports, { REDUPLICATION_ALLOWED, TYPOS, STYLE_TRIMS, VI_RULES });
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
const { makeSuggestion, sortSuggestions, suggestionStats, SEVERITY, CATEGORY, KIND } = __require("writing/suggestions.js");
const { EN_RULES } = __require("writing/grammar/en.js");
const { VI_RULES } = __require("writing/grammar/vi.js");

const GRAMMAR_SCHEMA_VERSION = '2.0';

/** Luật an toàn cho mọi ngôn ngữ (không phụ thuộc ngữ pháp). */
const NEUTRAL_RULES = [
  {
    id: 'neutral.double-space',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.9,
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

function paragraphAt(source, index) {
  let paragraph = 0;
  for (let i = 0; i < index && i < source.length; i++) if (source.charCodeAt(i) === 10) paragraph++;
  return paragraph;
}

/**
 * @param {string} text
 * @param {{language?:'en'|'vi'|'unknown', maxSuggestions?:number, types?:string[],
 *   minConfidence?:number}} [options]
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
  const minConfidence = Number.isFinite(options.minConfidence) ? Number(options.minConfidence) : 0;
  const collected = [];

  for (const seg of segmentText(source)) {
    if (seg.type !== 'text' || !seg.value) continue;
    const paragraph = paragraphAt(source, seg.start);
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
          type: hit.category || rule.type,
          category: hit.category || rule.type,
          kind: hit.kind || rule.kind,
          confidence: Number.isFinite(hit.confidence) ? hit.confidence : rule.confidence,
          severity: hit.severity || rule.severity || SEVERITY.WARNING,
          language,
          start: seg.start + hit.start,
          end: seg.start + hit.end,
          replacement: hit.replacement,
          reason: hit.reason,
          explanation: hit.explanation,
          ruleId: rule.id,
          paragraph,
        });
        if (suggestion.original && suggestion.original !== suggestion.replacement
          && (suggestion.confidence || 0) >= minConfidence) {
          collected.push(suggestion);
        }
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
  __require("core/zip.js"),
  __require("core/xml.js"),
  __require("core/ooxml.js"),
  __require("core/pdf.js"),
  __require("core/c2pa.js"),
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
globalThis.TraceCore.__engineVersion = '2.3';
})();
