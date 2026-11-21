/**
 * packages/writing/shared/normalization.js — vùng không được sửa tự động.
 *
 * Trích dẫn trực tiếp là lời của người khác. Deterministic engine có thể phân
 * tích xung quanh nhưng không được thay chữ bên trong dấu ngoặc kép, vì như vậy
 * là sửa lời trích dẫn. Hàm ở đây chỉ trả offset, không chuẩn hoá văn bản.
 */

export const QUOTE_PATTERN = /"[^"\n]{1,800}"|“[^”\n]{1,800}”|«[^»\n]{1,800}»/g;

export function quotedRanges(text) {
  const source = String(text ?? '');
  const ranges = [];
  QUOTE_PATTERN.lastIndex = 0;
  let match;
  while ((match = QUOTE_PATTERN.exec(source)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
    if (match[0].length === 0) QUOTE_PATTERN.lastIndex += 1;
  }
  return ranges;
}

export function insideRanges(start, end, ranges) {
  return (ranges || []).some(range => start < range.end && end > range.start);
}
