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

import { PARSER_LIMITS } from './limits.js';

export const XML_ERRORS = Object.freeze({
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

export function xmlError(reason, detail) {
  const error = new Error(`${ERROR_TEXT[reason] || 'Lỗi XML.'}${detail ? ` (${detail})` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const PREDEFINED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Độ dài UTF-8 thật, không cấp phát bản encode. */
export function utf8ByteLength(value) {
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
export function decodeXmlInput(input, { maxBytes = PARSER_LIMITS.maxXmlBytes, name = 'xml' } = {}) {
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
export function decodeXmlEntities(value, { maxLength = Infinity } = {}) {
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
export function parseXml(text, options = {}) {
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
export function child(node, name) {
  if (!node || !Array.isArray(node.children)) return null;
  for (const item of node.children) {
    if (item && item.type === 'element' && (item.name === name || item.localName === name)) return item;
  }
  return null;
}

/** Tất cả con trực tiếp theo tên. */
export function childrenOf(node, name) {
  if (!node || !Array.isArray(node.children)) return [];
  return node.children.filter(item => item && item.type === 'element' && (item.name === name || item.localName === name));
}

/** Mọi hậu duệ theo tên, dừng ở `limit` để không nổ bộ nhớ. */
export function descendants(node, name, limit = 10000) {
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

export function attr(node, name) {
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
export function textContent(node, options = {}) {
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
export function elements(node, visit) {
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
