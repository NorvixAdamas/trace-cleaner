/**
 * packages/core/limits.js — giới hạn tài nguyên cho mọi parser file.
 *
 * Mọi giá trị ở đây là giới hạn CỨNG. UI có thể cho chọn thấp hơn, không được
 * vượt. Mục tiêu: một file hỏng hoặc độc hại không thể treo tab, ăn hết RAM,
 * hay giải nén tới hàng trăm GB từ một file vài chục KB.
 */

const MB = 1024 * 1024;

export const PARSER_LIMITS = Object.freeze({
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
export function validateZipEntryName(name) {
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
export function checkZipBudget(entries, limits = PARSER_LIMITS) {
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
export function xmlDepth(xml) {
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
export function assertSafeXml(xml, { name = 'xml', limits = PARSER_LIMITS } = {}) {
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
export function utf8Size(value) {
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
export function clampText(text, limits = PARSER_LIMITS) {
  const source = String(text ?? '');
  if (source.length <= limits.maxTextChars) return { text: source, truncated: false };
  return { text: source.slice(0, limits.maxTextChars), truncated: true };
}
