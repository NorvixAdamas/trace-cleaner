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
 * Áp một tập thay thế lên văn bản, KHÔNG áp tuần tự trên chuỗi đang đổi.
 *
 * Vấn đề của cách cũ: mỗi lần thay đổi độ dài, offset của các edit sau lệch
 * theo, và `indexOf` có thể khớp một chỗ khác cùng nội dung. Cách mới:
 *   1. Chốt vị trí trên MỘT snapshot của chuỗi gốc.
 *   2. Kiểm tra `source.slice(start, end) === find` trước khi nhận.
 *   3. Từ chối edit mơ hồ (find xuất hiện nhiều lần mà không có index/occurrence)
 *      thay vì ghi vào chỗ đầu tiên.
 *   4. Phát hiện chồng lấn và áp theo thứ tự giảm dần.
 *
 * @param {string} text
 * @param {Array<{find?:string, replace?:string, replacement?:string, index?:number,
 *   start?:number, end?:number, occurrence?:number}>} edits
 * @param {{sourceRevision?:string|null}} [options]
 * @returns {{text:string, applied:Array<object>, rejected:Array<object>, conflicts:Array<object>,
 *   sourceRevision:string|null, schemaVersion:string}}
 */
export function applyEdits(text, edits, options = {}) {
  const source = String(text ?? '');
  const applied = [];
  const rejected = [];
  const conflicts = [];
  const planned = [];

  const nthIndexOf = (needle, occurrence) => {
    let at = -1;
    for (let n = 0; n < occurrence; n += 1) {
      at = source.indexOf(needle, at + 1);
      if (at < 0) return -1;
    }
    return at;
  };

  for (const raw of edits || []) {
    if (!raw || typeof raw !== 'object') {
      rejected.push({ edit: raw, reason: 'invalid_edit' });
      continue;
    }
    const edit = { ...raw };
    const find = typeof edit.find === 'string' ? edit.find : '';
    const replacement = String(edit.replace ?? edit.replacement ?? '');
    let start;
    let end;

    if (typeof edit.start === 'number' && typeof edit.end === 'number') {
      start = edit.start;
      end = edit.end;
    } else if (typeof edit.index === 'number') {
      // `index` là vị trí CHÍNH XÁC của `find` trên chuỗi gốc. Cố tình không
      // dùng indexOf(index) nữa: như vậy một index lệch sẽ trượt sang chỗ khác
      // cùng nội dung và sửa nhầm. Sai vị trí ⇒ conflict text_mismatch.
      if (edit.index < 0 || edit.index > source.length) {
        conflicts.push({ edit, reason: 'out_of_bounds', detail: `index ${edit.index} ngoài chuỗi ${source.length} ký tự.` });
        continue;
      }
      start = edit.index;
      end = start + (find ? find.length : 0);
    } else if (find) {
      const occurrence = typeof edit.occurrence === 'number' ? edit.occurrence : 0;
      if (occurrence > 0) {
        start = nthIndexOf(find, occurrence);
        if (start < 0) {
          rejected.push({ edit, reason: 'not_found' });
          continue;
        }
      } else {
        start = source.indexOf(find);
        if (start < 0) {
          rejected.push({ edit, reason: 'not_found' });
          continue;
        }
        if (source.indexOf(find, start + 1) >= 0) {
          rejected.push({ edit, reason: 'ambiguous', detail: 'find xuất hiện nhiều lần; cần index hoặc occurrence.' });
          continue;
        }
      }
      end = start + find.length;
    } else {
      rejected.push({ edit, reason: 'invalid_edit' });
      continue;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > source.length) {
      conflicts.push({ edit, reason: 'out_of_bounds', detail: `[${start}, ${end}) ngoài chuỗi ${source.length} ký tự.` });
      continue;
    }
    if (find && source.slice(start, end) !== find) {
      conflicts.push({ edit, reason: 'text_mismatch', detail: 'Đoạn tại vị trí này không khớp `find`.' });
      continue;
    }
    planned.push({ start, end, replacement, edit });
  }

  // Chồng lấn: hai edit cùng sửa một vùng thì không đoán ý — loại cả hai.
  planned.sort((a, b) => a.start - b.start || a.end - b.end);
  const accepted = [];
  let cursorEnd = -1;
  for (const item of planned) {
    if (item.start < cursorEnd) {
      conflicts.push({ edit: item.edit, reason: 'overlap', detail: `[${item.start}, ${item.end}) chồng lấn edit trước.` });
      const previous = accepted.pop();
      if (previous) conflicts.push({ edit: previous.edit, reason: 'overlap', detail: 'Bị edit sau chồng lấn.' });
      cursorEnd = accepted.length ? accepted[accepted.length - 1].end : -1;
      continue;
    }
    accepted.push(item);
    cursorEnd = item.end;
  }

  let out = source;
  for (let i = accepted.length - 1; i >= 0; i -= 1) {
    const item = accepted[i];
    out = out.slice(0, item.start) + item.replacement + out.slice(item.end);
    applied.push({ ...item.edit, index: item.start, end: item.end, replacement: item.replacement });
  }
  applied.reverse();

  return {
    text: out,
    applied,
    rejected,
    conflicts,
    sourceRevision: options.sourceRevision ?? null,
    schemaVersion: '1.0',
  };
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
