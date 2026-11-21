/**
 * tests/helpers/zip-builder.js — dựng archive ZIP nhỏ để kiểm tra giới hạn.
 *
 * Cho phép cố tình khai báo metadata sai (size/CRC/phương thức/flags) để chứng
 * minh parser không tin central directory.
 */

export async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const enc = text => new TextEncoder().encode(text);

function u16(view, at, value) { view.setUint16(at, value, true); }
function u32(view, at, value) { view.setUint32(at, value >>> 0, true); }

/**
 * @param {Array<{name:string, data:string|Uint8Array, method?:0|8, declaredSize?:number,
 *   declaredCrc?:number, flags?:number, methodOverride?:number, storeData?:Uint8Array}>} entries
 */
export async function buildZip(entries) {
  const prepared = [];
  for (const entry of entries) {
    const data = typeof entry.data === 'string' ? enc(entry.data) : entry.data;
    const method = entry.method ?? 8;
    const payload = entry.storeData || (method === 8 ? await deflateRaw(data) : data);
    prepared.push({ ...entry, data, method, payload });
  }

  const chunks = [];
  let offset = 0;
  const central = [];

  for (const item of prepared) {
    const nameBytes = enc(item.name);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20);
    u16(lv, 6, item.flags ?? 0);
    u16(lv, 8, item.methodOverride ?? item.method);
    u16(lv, 10, 0);
    u16(lv, 12, 0);
    u32(lv, 14, item.declaredCrc ?? crc32(item.data));
    u32(lv, 18, item.payload.length);
    u32(lv, 22, item.declaredSize ?? item.data.length);
    u16(lv, 26, nameBytes.length);
    u16(lv, 28, 0);
    local.set(nameBytes, 30);
    chunks.push(local, item.payload);
    central.push({ item, nameBytes, offset });
    offset += local.length + item.payload.length;
  }

  const centralStart = offset;
  for (const { item, nameBytes, offset: lho } of central) {
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20);
    u16(cv, 6, 20);
    u16(cv, 8, item.flags ?? 0);
    u16(cv, 10, item.methodOverride ?? item.method);
    u16(cv, 12, 0);
    u16(cv, 14, 0);
    u32(cv, 16, item.declaredCrc ?? crc32(item.data));
    u32(cv, 20, item.payload.length);
    u32(cv, 24, item.declaredSize ?? item.data.length);
    u16(cv, 28, nameBytes.length);
    u16(cv, 30, 0);
    u16(cv, 32, 0);
    u16(cv, 34, 0);
    u16(cv, 36, 0);
    u32(cv, 38, 0);
    u32(cv, 42, lho);
    cd.set(nameBytes, 46);
    chunks.push(cd);
    offset += cd.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 4, 0);
  u16(ev, 6, 0);
  u16(ev, 8, prepared.length);
  u16(ev, 10, prepared.length);
  u32(ev, 12, offset - centralStart);
  u32(ev, 16, centralStart);
  u16(ev, 20, 0);
  chunks.push(eocd);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
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

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
