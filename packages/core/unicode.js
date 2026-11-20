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

export const BLANK_CODE_POINTS = Object.freeze([
  0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000,
]);

/** Ký tự vô hình nên xoá (không gồm joiner/variation selector/bidi). */
export const INVISIBLE_CODE_POINTS = Object.freeze([
  0x200b, 0x2060, 0xfeff, 0x00ad, 0x180e,
  0x2061, 0x2062, 0x2063, 0x2064,
  0x200e, 0x200f, 0x061c,
]);

/** Bidi control làm đảo chiều hiển thị. */
export const BIDI_CODE_POINTS = Object.freeze([
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069,
]);

/** Homoglyph Cyrillic/Greek và dấu gạch nhìn giống ASCII. */
export const HOMOGLYPHS = Object.freeze({
  '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p', '\u0441': 'c',
  '\u0445': 'x', '\u0443': 'y', '\u0455': 's', '\u0456': 'i', '\u0458': 'j',
  '\u04bb': 'h', '\u0501': 'd', '\u043a': 'k', '\u043c': 'm', '\u043d': 'h',
  '\u0442': 't', '\u0432': 'b', '\u0433': 'r',
  '\u03bf': 'o', '\u03bd': 'v', '\u03b1': 'a', '\u03b9': 'i', '\u03ba': 'k',
  '\u03c1': 'p', '\u03c5': 'u', '\u0131': 'i',
  '\u2010': '-', '\u2011': '-', '\u2212': '-',
});

export const NAMES = Object.freeze({
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

export const SEVERITY = Object.freeze({
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

export const ACTION = Object.freeze({
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

export const ACTIONABLE = Object.freeze(['tag', 'pua', 'invisible', 'bidi', 'homoglyph']);

const hex = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');

/**
 * Phân loại một codepoint.
 * @param {string} ch ký tự (có thể là surrogate pair)
 * @param {number} [cp] codepoint
 * @returns {string} category
 */
export function classify(ch, cp = ch.codePointAt(0)) {
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
export function isFlagTag(cp) {
  return (cp >= 0xe0030 && cp <= 0xe0039)
    || (cp >= 0xe0061 && cp <= 0xe007a)
    || cp === 0xe007f;
}

/** Tag char ngay sau 🏴 là một phần của emoji cờ, không phải payload. */
export function isFlagSequence(source, index) {
  const before = Array.from(source.slice(0, index));
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const cp = before[i].codePointAt(0);
    if (cp >= 0xe0020 && cp <= 0xe007f) continue;
    return cp === 0x1f3f4;
  }
  return false;
}

export function nameOf(ch, cp = ch.codePointAt(0)) {
  if (HOMOGLYPHS[ch]) return `LOOKALIKE of '${HOMOGLYPHS[ch]}' (Cyrillic/Greek)`;
  return NAMES[cp] || hex(cp);
}

/**
 * Quét toàn văn, gộp theo codepoint.
 * @returns {Array<{cp:number,hex:string,name:string,category:string,severity:string,action:string,count:number,positions:number[],flag:boolean}>}
 */
export function scan(text) {
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
export function clean(text, options = {}) {
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
export function summary(text) {
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
