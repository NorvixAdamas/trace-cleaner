/**
 * packages/core/markdown.js — tách văn bản Markdown thành đoạn để chỉ sửa phần chữ.
 *
 * Không phải parser Markdown đầy đủ (dự án chưa dùng thư viện nào); đủ để bảo
 * vệ code fence, code span, link và autolink khỏi các phép biến đổi regex.
 */

const FENCE = /^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm;
const INLINE_CODE = /`[^`\n]+`/g;
const LINK = /!?\[[^\]\n]*\]\([^)\n]*\)/g;
const AUTOLINK = /<(?:https?:\/\/|mailto:)[^>\s]+>/g;

/**
 * @param {string} text
 * @returns {Array<{type:'text'|'code'|'inlineCode'|'link'|'autolink', value:string}>}
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
    fences: (source.match(/^[ \t]*```/gm) || []).length,
    links: (source.match(/\[[^\]\n]+\]\([^)\n]+\)/g) || []).length,
  };
}

/** Xoá marker, giữ nội dung; code fence giữ nguyên code bên trong. */
export function stripMarkdown(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n');
  let removed = 0;
  let out = source.replace(FENCE, block => {
    removed += 1;
    return block.replace(/^[ \t]*```[^\n]*\n?/gm, '').replace(/^[ \t]*```[ \t]*$/gm, '').replace(/\n{2,}/g, '\n');
  });
  out = out.replace(LINK, (match, offset, whole) => {
    removed += 1;
    const label = match.replace(/^!?\[/, '').replace(/\]\([^)]*\)$/, '');
    const url = (match.match(/\]\(([^)]*)\)$/) || [])[1] || '';
    if (label === url) return label;
    void whole;
    void offset;
    return url ? `${label} (${url})` : label;
  });
  out = out
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]{0,3}>[ \t]?/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]*[-*+][ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/^[ \t]*\d{1,3}[.)][ \t]+/gm, () => { removed += 1; return ''; })
    .replace(/\*\*([^*\n]+)\*\*/g, (m, inner) => { removed += 1; return inner; })
    .replace(/__([^_\n]+)__/g, (m, inner) => { removed += 1; return inner; })
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, (m, pre, inner) => { removed += 1; return pre + inner; })
    .replace(/`([^`\n]+)`/g, (m, inner) => { removed += 1; return inner; })
    .replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, () => { removed += 1; return ''; });
  out = out
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
  return { text: out, removed };
}
