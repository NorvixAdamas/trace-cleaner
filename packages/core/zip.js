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

import { PARSER_LIMITS, validateZipEntryName } from './limits.js';

export const ZIP_ERRORS = Object.freeze({
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
export function zipError(reason, detail) {
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
export function crc32(bytes) {
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
export async function openZip(input, options = {}) {
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
