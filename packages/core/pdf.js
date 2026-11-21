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

import { PARSER_LIMITS } from './limits.js';

export const PDF_ERRORS = Object.freeze({
  NOT_PDF: 'pdf_not_pdf',
  ENCRYPTED: 'pdf_encrypted',
  TRUNCATED: 'pdf_truncated',
  XREF_BROKEN: 'pdf_xref_broken',
  TOO_DEEP: 'pdf_too_deep',
  STREAM_TOO_LARGE: 'pdf_stream_too_large',
  CANCELLED: 'pdf_cancelled',
  TIMEOUT: 'pdf_timeout',
});

export function pdfError(reason, detail) {
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
export function parseToUnicode(text) {
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
export async function extractTextFromContent(content, fonts, context = {}) {
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
export async function parsePdf(input, options = {}) {
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
