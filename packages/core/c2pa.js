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
  VERIFIED_TRUSTED: 'verified_trusted',
  TAMPERED: 'asset_modified_after_signing',
});

export const C2PA_LIMITS = Object.freeze({
  maxManifestBytes: 4 * 1024 * 1024,
  maxBoxes: 512,
  maxDepth: 12,
  maxCertBytes: 64 * 1024,
});

/* ───────────────────────── CBOR ───────────────────────── */

class CborTag { constructor(tag, value) { this.tag = tag; this.value = value; } }
export class CborMap { constructor(entries) { this.entries = entries || []; } get(key) { const hit = this.entries.find(item => item[0] === key); return hit ? hit[1] : undefined; } has(key) { return this.entries.some(item => item[0] === key); } }

function readUint(bytes, at, length) {
  let value = 0;
  for (let i = 0; i < length; i++) value = value * 256 + bytes[at + i];
  return value;
}

/**
 * Decoder CBOR tối thiểu nhưng đúng: int, bstr, tstr, array, map, tag, float, simple.
 * @returns {{value:any, offset:number}}
 */
export function decodeCbor(bytes, offset = 0) {
  const readItem = at => {
    if (at >= bytes.length) throw new Error('CBOR: hết dữ liệu');
    const initial = bytes[at];
    const major = initial >> 5;
    const info = initial & 0x1F;
    let cursor = at + 1;
    let length;
    if (info < 24) length = info;
    else if (info === 24) { length = bytes[cursor]; cursor += 1; }
    else if (info === 25) { length = readUint(bytes, cursor, 2); cursor += 2; }
    else if (info === 26) { length = readUint(bytes, cursor, 4); cursor += 4; }
    else if (info === 27) { length = readUint(bytes, cursor, 8); cursor += 8; }
    else if (info === 31) length = -1; // indefinite
    else throw new Error(`CBOR: info ${info} không hợp lệ`);

    if (major === 0) return { value: length, offset: cursor };
    if (major === 1) return { value: -1 - length, offset: cursor };
    if (major === 2 || major === 3) {
      if (length === -1) {
        const chunks = [];
        let total = 0;
        for (;;) {
          if (bytes[cursor] === 0xFF) { cursor += 1; break; }
          const item = readItem(cursor);
          const chunk = major === 2 ? item.value : new TextDecoder().decode(item.value);
          chunks.push(chunk);
          total += chunk.length;
          if (total > C2PA_LIMITS.maxManifestBytes) throw new Error('CBOR: chuỗi quá lớn');
          cursor = item.offset;
        }
        return major === 2
          ? { value: concatBytes(chunks), offset: cursor }
          : { value: chunks.join(''), offset: cursor };
      }
      if (cursor + length > bytes.length) throw new Error('CBOR: chuỗi vượt biên');
      const slice = bytes.subarray(cursor, cursor + length);
      return { value: major === 2 ? slice : new TextDecoder().decode(slice), offset: cursor + length };
    }
    if (major === 4) {
      const out = [];
      if (length === -1) {
        for (;;) {
          if (bytes[cursor] === 0xFF) { cursor += 1; break; }
          const item = readItem(cursor);
          out.push(item.value);
          cursor = item.offset;
          if (out.length > 50000) throw new Error('CBOR: array quá lớn');
        }
        return { value: out, offset: cursor };
      }
      for (let i = 0; i < length; i++) {
        const item = readItem(cursor);
        out.push(item.value);
        cursor = item.offset;
      }
      return { value: out, offset: cursor };
    }
    if (major === 5) {
      const entries = [];
      const readPair = () => {
        const key = readItem(cursor);
        const value = readItem(key.offset);
        entries.push([key.value, value.value]);
        cursor = value.offset;
      };
      if (length === -1) {
        for (;;) {
          if (bytes[cursor] === 0xFF) { cursor += 1; break; }
          readPair();
          if (entries.length > 50000) throw new Error('CBOR: map quá lớn');
        }
        return { value: new CborMap(entries), offset: cursor };
      }
      for (let i = 0; i < length; i++) readPair();
      return { value: new CborMap(entries), offset: cursor };
    }
    if (major === 6) {
      const item = readItem(cursor);
      return { value: new CborTag(length, item.value), offset: item.offset };
    }
    // simple / float
    if (info === 20) return { value: false, offset: cursor };
    if (info === 21) return { value: true, offset: cursor };
    if (info === 22) return { value: null, offset: cursor };
    if (info === 23) return { value: undefined, offset: cursor };
    if (info === 26) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + at + 1, 4);
      return { value: view.getFloat32(0), offset: at + 5 };
    }
    if (info === 27) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + at + 1, 8);
      return { value: view.getFloat64(0), offset: at + 9 };
    }
    return { value: length, offset: cursor };
  };
  return readItem(offset);
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
    if (out.length > 500) break;
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
 */
export function parseJumbf(input, { limit = C2PA_LIMITS.maxBoxes, depth = 0 } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const boxes = [];
  let at = 0;
  while (at + 8 <= bytes.length && boxes.length < limit) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + at, 8);
    let length = view.getUint32(0);
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    let cursor = at + 8;
    if (length === 1) {
      if (at + 16 > bytes.length) break;
      const high = view.getUint32(8);
      const low = view.getUint32(12);
      length = high * 4294967296 + low;
      cursor = at + 16;
    } else if (length === 0) {
      length = bytes.length - at;
    }
    if (length < cursor - at || at + length > bytes.length) break;
    const payload = bytes.subarray(cursor, at + length);
    const box = { type, offset: at, length, data: payload };
    if (type === 'jumd') {
      if (payload.length >= 17) {
        box.uuid = [...payload.subarray(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
        box.toggles = payload[16];
        let end = payload.indexOf(0, 17);
        if (end < 0) end = payload.length;
        box.label = new TextDecoder().decode(payload.subarray(17, end));
      }
    } else if (type === 'jumb' && depth < C2PA_LIMITS.maxDepth) {
      box.children = parseJumbf(payload, { limit: limit - boxes.length, depth: depth + 1 });
      // Label của superbox nằm trong jumd con đầu tiên; nội dung thật là các box
      // còn lại (không tính descriptor).
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
  if (u8.length < 8) return { found: false };
  if (u8[0] === 0xFF && u8[1] === 0xD8) {
    let at = 2;
    const parts = [];
    while (at + 4 < u8.length) {
      if (u8[at] !== 0xFF) { at += 1; continue; }
      const marker = u8[at + 1];
      if (marker === 0xDA || marker === 0xD9) break;
      if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { at += 2; continue; }
      const length = (u8[at + 2] << 8) | u8[at + 3];
      if (length < 2 || at + 2 + length > u8.length) break;
      if (marker === 0xEB) {
        const start = at + 4;
        const end = at + 2 + length;
        if (u8[start] === 0x4A && u8[start + 1] === 0x50) {
          const chunk = u8.subarray(start + 2, end);
          if (chunk.length <= maxBytes) parts.push(chunk);
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
      const data = u8.subarray(at + 8, at + 8 + length);
      if (type === 'caBX') return { found: true, container: 'png', payload: data, chunkOffset: at, chunkLength: 12 + length };
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
  '-35': { name: 'ECDSA', hash: 'SHA-384', importAlg: 'ECDSA', curve: 'P-384' },
  '-36': { name: 'ECDSA', hash: 'SHA-512', importAlg: 'ECDSA', curve: 'P-521' },
  '-257': { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  '-37': { name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
  '-38': { name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 },
  '-39': { name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
  '-8': { name: 'Ed25519', hash: null },
};

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
  const ranges = (exclusions || [])
    .map(item => ({ start: Number(field(item, 'start')), length: Number(field(item, 'length')) }))
    .filter(item => Number.isFinite(item.start) && Number.isFinite(item.length) && item.length >= 0)
    .sort((a, b) => a.start - b.start);
  const chunks = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.start, asset.length));
    if (start > cursor) chunks.push(asset.subarray(cursor, start));
    cursor = Math.max(cursor, Math.min(range.start + range.length, asset.length));
  }
  if (cursor < asset.length) chunks.push(asset.subarray(cursor));
  const name = alg === 'sha384' ? 'SHA-384' : alg === 'sha512' ? 'SHA-512' : 'SHA-256';
  const digest = await crypto.subtle.digest(name, concatBytes(chunks));
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
    trustPolicy: options.trustedFingerprints || options.trustedCertificates ? 'explicit' : 'none',
  };
  const byteArray = asset instanceof Uint8Array ? asset : new Uint8Array(asset);
  const extracted = extractC2paPayload(byteArray);
  result.container = extracted.container || null;
  if (!extracted.found) return result;
  result.found = true;
  result.state = C2PA_STATES.DETECTED_UNVERIFIED;

  let boxes;
  try {
    boxes = parseJumbf(extracted.payload);
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
    const decoded = decodeCbor(signatureBox.content);
    const value = decoded.value instanceof CborTag ? decoded.value.value : decoded.value;
    if (!Array.isArray(value) || value.length < 4) throw new Error('COSE_Sign1 phải là array 4 phần tử');
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
    if (cose.protectedBytes.length) protectedHeader = decodeCbor(cose.protectedBytes).value;
  } catch (error) {
    result.diagnostics.push(`protected header không đọc được: ${error.message}`);
  }
  const algKey = String(protectedHeader instanceof CborMap ? protectedHeader.get(1) : (cose.unprotected.get(1) ?? ''));
  const algInfo = ALG_INFO[algKey];
  const x5chain = (() => {
    const fromProtected = protectedHeader instanceof CborMap ? protectedHeader.get('x5chain') : null;
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
    claim = decodeCbor(cose.payload).value;
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
      const assertion = decodeCbor(hashBox.content).value;
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
      result.diagnostics.push(`hard binding: ${error.message}`);
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
  result.trusted = trusted.has(leaf.fingerprintSha256);

  if (result.state !== C2PA_STATES.TAMPERED) {
    result.state = result.trusted && !result.expired
      ? C2PA_STATES.VERIFIED_TRUSTED
      : C2PA_STATES.SIGNATURE_VALID_UNTRUSTED;
  }
  if (result.expired) result.errors.push('Chứng chỉ đã hết hạn hoặc chưa tới hiệu lực.');
  return result;
}
