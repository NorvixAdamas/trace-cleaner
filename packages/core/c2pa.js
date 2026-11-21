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

export const C2PA_STATES = Object.freeze({
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

export const C2PA_LIMITS = Object.freeze({
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
export class CborMap { constructor(entries) { this.entries = entries || []; } get(key) { const hit = this.entries.find(item => item[0] === key); return hit ? hit[1] : undefined; } has(key) { return this.entries.some(item => item[0] === key); } }

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
export function decodeCbor(bytes, offset = 0, options = {}) {
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
export async function parseCertificate(der) {
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
export function parseJumbf(input, options = {}) {
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

export function walkJumbf(boxes, visit, depth = 0) {
  for (const box of boxes) {
    visit(box, depth);
    if (box.children) walkJumbf(box.children, visit, depth + 1);
  }
}

/* ───────────────────────── container ───────────────────────── */

/** Tìm payload C2PA trong JPEG (APP11) hoặc PNG (caBX). */
export function extractC2paPayload(bytes, { maxBytes = C2PA_LIMITS.maxManifestBytes } = {}) {
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
export async function hashWithExclusions(asset, exclusions, alg = 'sha256') {
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
export async function verifyC2pa(asset, options = {}) {
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
