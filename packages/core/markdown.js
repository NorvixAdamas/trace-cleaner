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
export function splitMarkdown(text) {
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
export function transformProse(text, transform) {
  return splitMarkdown(text)
    .map(seg => (seg.type === 'text' ? transform(seg.value) : seg.value))
    .join('');
}

export function countStructure(text) {
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
export function unfence(block) {
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
export function stripMarkdownInline(text) {
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
export function stripMarkdown(text) {
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
