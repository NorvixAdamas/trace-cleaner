/** Sinh PDF tối giản nhưng hợp lệ để test parser thật. */

const enc = text => new TextEncoder().encode(text);

function toUnicodeCMap(text) {
  const lines = ['/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def', '/CMapType 2 def',
    '1 begincodespacerange', '<0000> <FFFF>', 'endcodespacerange'];
  const chars = [...text];
  lines.push(`${chars.length} beginbfchar`);
  chars.forEach((ch, index) => {
    const code = (index + 1).toString(16).toUpperCase().padStart(4, '0');
    const value = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    lines.push(`<${code}> <${value}>`);
  });
  lines.push('endbfchar', 'endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  return lines.join('\n');
}

function hexString(text) {
  const chars = [...text];
  return '<' + chars.map((_, index) => (index + 1).toString(16).toUpperCase().padStart(4, '0')).join('') + '>';
}

/**
 * @param {{text?:string, pages?:number, mode?:'classic'|'xref-stream'|'objstm',
 *   encrypt?:boolean, imageOnly?:boolean, compressContent?:boolean}} [options]
 */
export async function buildPdf(options = {}) {
  const text = options.text ?? 'Xin chào PDF';
  const pageCount = options.pages ?? 1;
  const mode = options.mode ?? 'classic';
  const imageOnly = options.imageOnly === true;
  const compress = options.compressContent === true;

  const cmapText = toUnicodeCMap(text);
  let content = imageOnly
    ? 'q 72 0 0 72 72 700 cm /Im1 Do Q'
    : `BT /F1 12 Tf 72 720 Td ${hexString(text)} Tj ET`;
  let contentBytes = enc(content);
  if (compress) {
    contentBytes = new Uint8Array(await new Response(
      new Blob([contentBytes]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer());
  }

  const objects = new Map();
  const pageObjNums = [];
  // 1 catalog, 2 pages, 3 font, 4 cmap, 5 image (nếu cần); trang bắt đầu từ 10.
  const pageStart = 10;
  for (let i = 0; i < pageCount; i++) pageObjNums.push(pageStart + i * 2);
  objects.set(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  objects.set(2, `<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageCount} >>`);
  objects.set(3, `<< /Type /Font /Subtype /Type0 /BaseFont /TraceTest /Encoding /Identity-H /ToUnicode 4 0 R >>`);
  objects.set(4, { dict: `<< /Length ${enc(cmapText).length} >>`, stream: enc(cmapText) });
  if (imageOnly) {
    const imageData = enc('\u0001\u0002\u0003\u0004');
    objects.set(5, { dict: `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imageData.length} >>`, stream: imageData });
  }
  pageObjNums.forEach((num, index) => {
    const contentNum = num + 1;
    const resources = `<< /Font << /F1 3 0 R >>${imageOnly ? ' /XObject << /Im1 5 0 R >>' : ''} >>`;
    const filter = compress ? ' /Filter /FlateDecode' : '';
    objects.set(num, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources ${resources} /Contents ${contentNum} 0 R >>`);
    objects.set(contentNum, { dict: `<< /Length ${contentBytes.length}${filter} >>`, stream: contentBytes, repeat: index });
  });

  if (mode === 'classic') {
    const chunks = [];
    let offset = 0;
    const offsets = new Map();
    const push = bytes => { chunks.push(bytes); offset += bytes.length; };
    push(enc('%PDF-1.7\n%\u00E2\u00E3\u00CF\u00D3\n'));
    const nums = [...objects.keys()].sort((a, b) => a - b);
    for (const num of nums) {
      offsets.set(num, offset);
      const value = objects.get(num);
      if (typeof value === 'string') push(enc(`${num} 0 obj\n${value}\nendobj\n`));
      else push(encodeStream(num, value));
    }
    const xrefAt = offset;
    const maxNum = nums[nums.length - 1] + 1;
    let xref = `xref\n0 ${maxNum}\n0000000000 65535 f \n`;
    for (let num = 1; num < maxNum; num++) {
      const at = offsets.get(num);
      xref += at === undefined
        ? '0000000000 65535 f \n'
        : `${String(at).padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${maxNum} /Root 1 0 R${options.encrypt ? ' /Encrypt 99 0 R' : ''} >>\nstartxref\n${xrefAt}\n%%EOF\n`;
    push(enc(xref + trailer));
    return concat(chunks);
  }

  // xref stream: object 6 (hoặc objstm 6) + xref 7.
  const useObjStm = mode === 'objstm';
  const chunks = [];
  let offset = 0;
  const push = bytes => { chunks.push(bytes); offset += bytes.length; };
  push(enc('%PDF-1.7\n%\u00E2\u00E3\u00CF\u00D3\n'));
  const entries = [];
  // Chỉ object KHÔNG phải stream mới được đóng gói vào ObjStm.
  const packedNums = useObjStm ? [1, 2, 3] : [];
  if (useObjStm) {
    const header = [];
    const bodies = [];
    let rel = 0;
    for (const num of packedNums) {
      const value = objects.get(num);
      if (typeof value !== 'string') throw new Error('fixture: không đóng gói stream vào ObjStm');
      const bodyText = value;
      header.push(`${num} ${rel}`);
      bodies.push(bodyText);
      rel += bodyText.length + 1;
    }
    const headerText = header.join(' ') + ' ';
    const streamText = headerText + bodies.join('\n');
    const payload = enc(streamText);
    const objstmDict = `<< /Type /ObjStm /N ${packedNums.length} /First ${headerText.length} /Length ${payload.length} >>`;
    const at = offset;
    push(enc(`6 0 obj\n${objstmDict}\nstream\n`));
    push(payload);
    push(enc('\nendstream\nendobj\n'));
    packedNums.forEach((num, index) => entries.push({ num, type: 2, field2: 6, field3: index }));
    entries.push({ num: 6, type: 1, field2: at, field3: 0 });
  }

  const nums = [...objects.keys()].filter(num => !packedNums.includes(num)).sort((a, b) => a - b);
  const streamObjStm = useObjStm ? 6 : null;
  for (const num of nums) {
    const at = offset;
    const value = objects.get(num);
    if (typeof value === 'string') push(enc(`${num} 0 obj\n${value}\nendobj\n`));
    else push(encodeStream(num, value));
    entries.push({ num, type: 1, field2: at, field3: 0 });
  }

  const xrefNum = useObjStm ? 7 : 6;
  const xrefAt = offset;
  entries.push({ num: xrefNum, type: 1, field2: xrefAt, field3: 0 });
  const size = Math.max(...entries.map(e => e.num)) + 1;
  const byNum = new Map(entries.map(item => [item.num, item]));
  const rows = [];
  for (let num = 0; num < size; num++) {
    const item = byNum.get(num);
    if (!item) { rows.push([0, 0, 0]); continue; }
    rows.push([item.type, item.field2, item.field3]);
  }
  const rowLength = 1 + 4 + 2;
  const data = new Uint8Array(rows.length * rowLength);
  rows.forEach((row, index) => {
    const at = index * rowLength;
    data[at] = row[0];
    data[at + 1] = (row[1] >>> 24) & 0xFF;
    data[at + 2] = (row[1] >>> 16) & 0xFF;
    data[at + 3] = (row[1] >>> 8) & 0xFF;
    data[at + 4] = row[1] & 0xFF;
    data[at + 5] = (row[2] >>> 8) & 0xFF;
    data[at + 6] = row[2] & 0xFF;
  });
  const xrefDict = `<< /Type /XRef /Size ${size} /W [1 4 2] /Root 1 0 R /Length ${data.length} >>`;
  push(enc(`${xrefNum} 0 obj\n${xrefDict}\nstream\n`));
  push(data);
  push(enc(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`));
  return concat(chunks);
}

function encodeStream(num, value) {
  const body = value.stream;
  const header = enc(`${num} 0 obj\n${value.dict}\nstream\n`);
  const tail = enc('\nendstream\nendobj\n');
  const out = new Uint8Array(header.length + body.length + tail.length);
  out.set(header, 0);
  out.set(body, header.length);
  out.set(tail, header.length + body.length);
  return out;
}

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}
