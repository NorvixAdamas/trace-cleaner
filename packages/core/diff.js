/**
 * packages/core/diff.js — word-level diff để so sánh bản gốc và bản đề xuất.
 * Không phụ thuộc thư viện, không render HTML (UI tự escape).
 */

const MAX_CELLS = 4_000_000;

export function tokenize(text) {
  return String(text ?? '').match(/\s+|[^\s]+/g) || [];
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {Array<{type:'equal'|'insert'|'delete', value:string}>}
 */
export function diffWords(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const ops = [];
  const push = (type, value) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.value += value;
    else ops.push({ type, value });
  };

  if (start) push('equal', a.slice(0, start).join(''));
  if (midA.length * midB.length > MAX_CELLS) {
    if (midA.length) push('delete', midA.join(''));
    if (midB.length) push('insert', midB.join(''));
  } else if (midA.length || midB.length) {
    const n = midA.length;
    const m = midB.length;
    const width = m + 1;
    const dp = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        dp[i * width + j] = midA[i] === midB[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push('equal', midA[i]);
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        push('delete', midA[i]);
        i += 1;
      } else {
        push('insert', midB[j]);
        j += 1;
      }
    }
    while (i < n) { push('delete', midA[i]); i += 1; }
    while (j < m) { push('insert', midB[j]); j += 1; }
  }
  if (endA < a.length) push('equal', a.slice(endA).join(''));
  return ops;
}

export function diffStats(ops) {
  let added = 0;
  let removed = 0;
  let kept = 0;
  for (const op of ops) {
    const n = tokenize(op.value).length;
    if (op.type === 'insert') added += n;
    else if (op.type === 'delete') removed += n;
    else kept += n;
  }
  return { added, removed, kept };
}

/** 0..1, dựa trên số token giữ nguyên. */
export function similarity(before, after) {
  const a = tokenize(before).length;
  const b = tokenize(after).length;
  if (!a && !b) return 1;
  const { kept } = diffStats(diffWords(before, after));
  return (2 * kept) / (a + b) || 0;
}

/**
 * Áp một tập thay thế lên văn bản, kiểm tra vị trí để không ghi sai chỗ.
 * @param {string} text
 * @param {Array<{find:string, replace:string, index?:number}>} edits
 */
export function applyEdits(text, edits) {
  let out = String(text);
  const applied = [];
  const rejected = [];
  for (const edit of edits || []) {
    const at = typeof edit.index === 'number' ? out.indexOf(edit.find, edit.index) : out.indexOf(edit.find);
    if (!edit.find || at < 0) {
      rejected.push({ edit, reason: 'not_found' });
      continue;
    }
    out = out.slice(0, at) + edit.replace + out.slice(at + edit.find.length);
    applied.push({ ...edit, index: at });
  }
  return { text: out, applied, rejected };
}

/** Chuyển diff thành mảng dòng có nhãn để UI hiển thị. */
export function diffLines(ops, width = 72) {
  const lines = [];
  for (const op of ops) {
    const prefix = op.type === 'insert' ? '+ ' : op.type === 'delete' ? '- ' : '  ';
    const chunks = String(op.value).split('\n');
    chunks.forEach((chunk, i) => {
      const tail = i < chunks.length - 1 ? '' : '';
      if (!chunk.trim() && !tail) return;
      for (let k = 0; k < chunk.length; k += width) {
        lines.push(prefix + chunk.slice(k, k + width));
      }
    });
  }
  return lines;
}
