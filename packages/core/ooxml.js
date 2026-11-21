/**
 * packages/core/ooxml.js — đọc DOCX / PPTX / XLSX ở mức cấu trúc.
 *
 * Nguyên tắc:
 *   - mọi part được đọc đều đi qua `parseXml` (có giới hạn + chặn DTD/ENTITY),
 *   - quan hệ (relationships) được resolve thật, không đoán tên file,
 *   - thứ tự slide/sheet lấy theo presentation.xml / workbook.xml,
 *   - tracked changes và comments được GIỮ khác biệt, không flatten,
 *   - giới hạn slide/sheet/trang/ký tự lấy từ `limits.js`.
 *
 * Không hỗ trợ (được ghi rõ trong release report): chart/SmartArt text, macro
 * (vbaProject), OLE objects, chữ trong shape group lồng quá sâu, XLSX pivot.
 */

import { openZip } from './zip.js';
import { parseXml, child, childrenOf, descendants, attr, textContent } from './xml.js';
import { PARSER_LIMITS, clampText } from './limits.js';

export const OOXML_ERRORS = Object.freeze({
  MISSING_MAIN_PART: 'missing_main_part',
  MISSING_CONTENT_TYPES: 'missing_content_types',
  INVALID_RELATIONSHIPS: 'invalid_relationships',
  SLIDE_LIMIT: 'slide_limit_exceeded',
  SHEET_LIMIT: 'sheet_limit_exceeded',
  TEXT_LIMIT: 'text_limit_exceeded',
  BAD_DOCUMENT: 'invalid_document',
});

export function ooxmlError(reason, detail) {
  const messages = {
    [OOXML_ERRORS.MISSING_MAIN_PART]: 'Thiếu part chính của tài liệu',
    [OOXML_ERRORS.MISSING_CONTENT_TYPES]: 'Thiếu [Content_Types].xml',
    [OOXML_ERRORS.INVALID_RELATIONSHIPS]: 'Quan hệ (relationships) không hợp lệ',
    [OOXML_ERRORS.SLIDE_LIMIT]: 'Vượt giới hạn số slide',
    [OOXML_ERRORS.SHEET_LIMIT]: 'Vượt giới hạn số worksheet',
    [OOXML_ERRORS.TEXT_LIMIT]: 'Văn bản trích ra vượt giới hạn',
    [OOXML_ERRORS.BAD_DOCUMENT]: 'Tài liệu không hợp lệ',
  };
  const error = new Error(`${messages[reason] || 'Lỗi tài liệu'}${detail ? `: ${detail}` : ''}`);
  error.code = 'PARSER_ERROR';
  error.reason = reason;
  if (detail) error.detail = String(detail);
  return error;
}

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function baseDir(path) {
  const at = path.lastIndexOf('/');
  return at < 0 ? '' : path.slice(0, at + 1);
}

/** Resolve Target tương đối (hoặc tuyệt đối trong package) thành tên entry. */
export function resolveRelationshipTarget(sourcePart, target) {
  const raw = String(target || '').replace(/\\/g, '/');
  if (!raw) return null;
  if (raw.startsWith('/')) return raw.slice(1);
  const segments = (baseDir(sourcePart) + raw).split('/');
  const out = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/** Quan hệ của một part: [{id, type, target, mode}] */
export function parseRelationships(root, sourcePart) {
  const list = [];
  for (const item of childrenOf(root, 'Relationship')) {
    const id = attr(item, 'Id');
    const type = attr(item, 'Type');
    const target = attr(item, 'Target');
    const mode = attr(item, 'TargetMode');
    if (!id || !type) continue;
    list.push({
      id,
      type,
      typeShort: String(type).split('/').pop(),
      target: mode === 'External' ? target : resolveRelationshipTarget(sourcePart, target),
      external: mode === 'External',
    });
  }
  return list;
}

function relsPath(part) {
  const dir = baseDir(part);
  const file = part.slice(dir.length);
  return `${dir}_rels/${file}.rels`;
}

function checkDeadline(deadline) {
  if (deadline && Date.now() > deadline) {
    const error = new Error('Quá thời gian cho phép khi đọc tài liệu.');
    error.code = 'PARSER_ERROR';
    error.reason = 'timeout';
    throw error;
  }
}

/**
 * @param {Uint8Array} input
 * @param {{format:'docx'|'pptx'|'xlsx', limits?:object, signal?:AbortSignal, timeoutMs?:number}} options
 */
export async function analyzeOoxml(input, options = {}) {
  const format = options.format || 'docx';
  const limits = options.limits || PARSER_LIMITS;
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : (options.deadline || 0);
  const signal = options.signal;
  const zip = await openZip(input, { limits, signal, deadline });
  const ctx = { limits, signal, deadline, partsRead: [], partsSkipped: [], truncated: false, diagnostics: [] };

  async function readPart(name, keepRaw = false) {
    if (!name || !zip.has(name)) { if (name) ctx.partsSkipped.push(name); return null; }
    checkDeadline(deadline);
    if (signal && signal.aborted) throw new Error('Đã huỷ khi đọc tài liệu.');
    // Đọc bytes và áp trần XML NGAY trong lúc inflate, trước khi decode.
    const bytes = await zip.read(name, { maxBytes: limits.maxXmlBytes });
    if (!bytes) { ctx.partsSkipped.push(name); return null; }
    ctx.partsRead.push(name);
    const { root } = parseXml(bytes, { limits, name });
    // Giữ raw main part để tính rsid (heuristic Word) mà không đọc lại zip.
    if (keepRaw) ctx.mainXmlText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return root;
  }

  if (!zip.has('[Content_Types].xml')) throw ooxmlError(OOXML_ERRORS.MISSING_CONTENT_TYPES);
  const rootRels = await readPart('_rels/.rels');
  if (!rootRels) throw ooxmlError(OOXML_ERRORS.INVALID_RELATIONSHIPS, '_rels/.rels');
  const rels = parseRelationships(rootRels, '');

  const mainRel = rels.find(rel => rel.typeShort === 'officeDocument');
  const defaultMain = { docx: 'word/document.xml', pptx: 'ppt/presentation.xml', xlsx: 'xl/workbook.xml' }[format];
  const mainPart = mainRel && mainRel.target && zip.has(mainRel.target) ? mainRel.target : defaultMain;
  if (!zip.has(mainPart)) throw ooxmlError(OOXML_ERRORS.MISSING_MAIN_PART, mainPart);
  const mainRoot = await readPart(mainPart, true);
  if (!mainRoot) throw ooxmlError(OOXML_ERRORS.MISSING_MAIN_PART, mainPart);

  const metadata = await readMetadata(zip, ctx);
  const result = {
    format,
    kind: { docx: 'DOCX / OOXML', pptx: 'PPTX / OOXML', xlsx: 'XLSX / OOXML' }[format],
    mainPart,
    metadata,
    partsRead: ctx.partsRead,
    partsSkipped: ctx.partsSkipped,
    diagnostics: [],
    text: '',
    truncated: false,
  };

  if (format === 'docx') Object.assign(result, await readDocx(zip, ctx, mainPart, mainRoot));
  else if (format === 'pptx') Object.assign(result, await readPptx(zip, ctx, mainPart, mainRoot));
  else Object.assign(result, await readXlsx(zip, ctx, mainPart, mainRoot));

  if (format === 'docx' && ctx.mainXmlText) {
    result.rsidCount = new Set(ctx.mainXmlText.match(/w:rsid[A-Za-z]*="([0-9A-Fa-f]{8})"/g) || []).size;
    delete ctx.mainXmlText;
  }
  const clamped = clampText(result.text, limits);
  result.truncated = clamped.truncated;
  result.text = clamped.text;
  if (result.truncated) result.diagnostics.push('Văn bản trích ra bị cắt ở giới hạn maxTextChars.');
  result.partsRead = ctx.partsRead;
  result.partsSkipped = ctx.partsSkipped;
  result.diagnostics = ctx.diagnostics;
  zip.close();
  return result;
}

/* ───────────────────────── metadata ───────────────────────── */

function firstValue(root, localName, limit = 4000) {
  if (!root) return null;
  const node = descendants(root, localName, 1)[0];
  if (!node) return null;
  const text = textContent(node).trim();
  return text ? text.slice(0, limit) : null;
}

async function readMetadata(zip, ctx) {
  const metadata = {
    creator: null, lastModifiedBy: null, created: null, modified: null, revision: null,
    title: null, subject: null, application: null, appVersion: null, company: null,
    totalTimeMinutes: null, wordsDeclared: null, pagesDeclared: null, slidesDeclared: null,
  };
  if (zip.has('docProps/core.xml')) {
    const text = await zip.readText('docProps/core.xml');
    const { root } = parseXml(text, { limits: ctx.limits, name: 'docProps/core.xml' });
    ctx.partsRead.push('docProps/core.xml');
    metadata.creator = firstValue(root, 'creator');
    metadata.lastModifiedBy = firstValue(root, 'lastModifiedBy');
    metadata.created = firstValue(root, 'created');
    metadata.modified = firstValue(root, 'modified');
    metadata.title = firstValue(root, 'title');
    metadata.subject = firstValue(root, 'subject');
    const revision = firstValue(root, 'revision');
    metadata.revision = revision && /^\d+$/.test(revision) ? Number(revision) : null;
  }
  if (zip.has('docProps/app.xml')) {
    const text = await zip.readText('docProps/app.xml');
    const { root } = parseXml(text, { limits: ctx.limits, name: 'docProps/app.xml' });
    ctx.partsRead.push('docProps/app.xml');
    metadata.application = firstValue(root, 'Application');
    metadata.appVersion = firstValue(root, 'AppVersion');
    metadata.company = firstValue(root, 'Company');
    const minutes = firstValue(root, 'TotalTime');
    metadata.totalTimeMinutes = minutes !== null && /^[0-9.,]+$/.test(minutes)
      ? parseFloat(minutes.replace(',', '.')) : null;
    const words = firstValue(root, 'Words');
    metadata.wordsDeclared = words && /^\d+$/.test(words) ? Number(words) : null;
    const pages = firstValue(root, 'Pages');
    metadata.pagesDeclared = pages && /^\d+$/.test(pages) ? Number(pages) : null;
    const slides = firstValue(root, 'Slides');
    metadata.slidesDeclared = slides && /^\d+$/.test(slides) ? Number(slides) : null;
  }
  return metadata;
}

/* ───────────────────────── DOCX ───────────────────────── */

function paragraphText(paragraph, { includeDeleted = false, revisionFilter = null } = {}) {
  let out = '';
  const walk = (node, revision) => {
    if (typeof node === 'string') { out += node; return; }
    if (!node || node.type !== 'element') return;
    const local = node.localName;
    if (local === 'p') {
      for (const kid of node.children || []) walk(kid, revision);
      return;
    }
    let active = revision;
    if (local === 'ins' || local === 'del' || local === 'moveFrom' || local === 'moveTo') {
      const type = local === 'ins' || local === 'moveTo' ? 'ins' : 'del';
      active = {
        type,
        author: attr(node, 'w:author') || attr(node, 'author'),
        date: attr(node, 'w:date') || attr(node, 'date'),
        id: attr(node, 'w:id') || attr(node, 'id'),
      };
      if (type === 'del' && !includeDeleted) return;
      if (revisionFilter && active.type !== revisionFilter) return;
    }
    if (local === 'delText' && !includeDeleted) return;
    if (local === 'tab') { out += '\t'; return; }
    if (local === 'br' || local === 'cr') { out += '\n'; return; }
    if (local === 'noBreakHyphen') { out += '-'; return; }
    for (const kid of node.children || []) walk(kid, active);
  };
  walk(paragraph, null);
  return out;
}

function revisionList(paragraph) {
  const list = [];
  const walk = node => {
    if (!node || typeof node === 'string') return;
    const local = node.localName;
    if (local === 'ins' || local === 'del' || local === 'moveFrom' || local === 'moveTo') {
      const deleted = local === 'del' || local === 'moveFrom';
      const text = paragraphText(node, { includeDeleted: true }).trim();
      if (text) {
        list.push({
          type: deleted ? 'deleted' : 'inserted',
          kind: local,
          author: attr(node, 'w:author') || attr(node, 'author') || null,
          date: attr(node, 'w:date') || attr(node, 'date') || null,
          text,
        });
      }
    }
    for (const kid of node.children || []) walk(kid);
  };
  walk(paragraph);
  return list;
}

async function readDocx(zip, ctx, mainPart, mainRoot) {
  const body = child(mainRoot, 'w:body') || mainRoot;
  const paragraphs = [];
  for (const p of descendants(body, 'w:p', ctx.limits.maxXmlBlocks)) {
    const text = paragraphText(p);
    const withDeleted = paragraphText(p, { includeDeleted: true });
    const revisions = revisionList(p);
    const pPr = child(p, 'w:pPr');
    const style = attr(pPr ? child(pPr, 'w:pStyle') : null, 'w:val');
    const commentIds = [];
    for (const start of descendants(p, 'w:commentRangeStart', 200)) {
      const id = attr(start, 'w:id');
      if (id) commentIds.push(id);
    }
    if (text.trim() || revisions.length) {
      paragraphs.push({ index: paragraphs.length, text, withDeleted, style: style || null, revisions, commentIds });
    }
    if (paragraphs.length >= ctx.limits.maxXmlBlocks) { ctx.truncated = true; break; }
  }

  const comments = [];
  const documentRels = await readRelationshipsOf(zip, mainPart, ctx);
  const commentsRel = documentRels.find(rel => rel.typeShort === 'comments' && !rel.external);
  if (commentsRel && zip.has(commentsRel.target)) {
    const { root } = await readPartRoot(zip, ctx, commentsRel.target);
    for (const node of childrenOf(root, 'w:comment')) {
      comments.push({
        id: attr(node, 'w:id'),
        author: attr(node, 'w:author'),
        date: attr(node, 'w:date'),
        initials: attr(node, 'w:initials'),
        text: descendants(node, 'w:t', 500).map(t => textContent(t)).join('').trim(),
      });
    }
  }
  const commentById = new Map(comments.map(item => [String(item.id), item]));
  for (const comment of comments) {
    const anchor = paragraphs.find(p => p.commentIds.includes(String(comment.id)));
    comment.anchoredText = anchor ? anchor.text.slice(0, 400) : null;
    comment.anchoredParagraph = anchor ? anchor.index : null;
  }

  const revisions = paragraphs.flatMap(p => p.revisions.map(item => ({ ...item, paragraph: p.index })));
  const inserted = revisions.filter(item => item.type === 'inserted');
  const deleted = revisions.filter(item => item.type === 'deleted');

  return {
    docx: {
      paragraphs,
      comments,
      commentById: Object.fromEntries(commentById),
      revisions: {
        inserted,
        deleted,
        authors: [...new Set(revisions.map(item => item.author).filter(Boolean))],
      },
    },
    text: paragraphs.map(p => p.text).join('\n'),
  };
}

async function readPartRoot(zip, ctx, name) {
  const bytes = await zip.read(name, { maxBytes: ctx.limits.maxXmlBytes });
  ctx.partsRead.push(name);
  return parseXml(bytes, { limits: ctx.limits, name });
}

/* ───────────────────────── PPTX ───────────────────────── */

function shapeText(shape) {
  const parts = [];
  for (const p of descendants(shape, 'a:p', 2000)) {
    const line = descendants(p, 'a:t', 500).map(t => textContent(t)).join('');
    if (line.trim()) parts.push(line);
  }
  return parts.join('\n');
}

function shapeIsTitle(shape) {
  const ph = descendants(shape, 'p:ph', 4)[0];
  const type = ph ? attr(ph, 'type') : null;
  return type === 'title' || type === 'ctrTitle';
}

async function readRelationshipsOf(zip, part, ctx) {
  const path = relsPath(part);
  if (!zip.has(path)) return [];
  const { root } = await readPartRoot(zip, ctx, path);
  return parseRelationships(root, part);
}

async function readPptx(zip, ctx, mainPart, mainRoot) {
  const rels = await readRelationshipsOf(zip, mainPart, ctx);
  const byId = new Map(rels.map(rel => [rel.id, rel]));
  const slideIds = descendants(mainRoot, 'p:sldId', 1000);
  if (slideIds.length > ctx.limits.maxSlides) {
    ctx.diagnostics.push(`Có ${slideIds.length} slide, chỉ đọc ${ctx.limits.maxSlides}.`);
  }
  const slides = [];
  let notesFound = 0;
  for (const sldId of slideIds.slice(0, ctx.limits.maxSlides)) {
    checkDeadline(ctx.deadline);
    const rid = attr(sldId, 'r:id') || attr(sldId, 'id');
    const rel = rid ? byId.get(rid) : null;
    const part = rel && !rel.external ? rel.target : null;
    if (!part || !zip.has(part)) {
      slides.push({ index: slides.length, part: null, title: null, text: '', notes: null, notesPart: null, missing: true });
      continue;
    }
    const { root } = await readPartRoot(zip, ctx, part);
    const shapes = descendants(root, 'p:sp', 2000);
    let title = null;
    const lines = [];
    for (const shape of shapes) {
      const text = shapeText(shape).trim();
      if (!text) continue;
      if (!title && shapeIsTitle(shape)) title = text;
      lines.push(text);
    }
    const slideRels = await readRelationshipsOf(zip, part, ctx);
    const notesRel = slideRels.find(item => item.typeShort === 'notesSlide' && !item.external);
    let notes = null;
    let notesPart = null;
    if (notesRel && zip.has(notesRel.target)) {
      notesPart = notesRel.target;
      const { root: notesRoot } = await readPartRoot(zip, ctx, notesPart);
      const body = child(notesRoot, 'p:notes') || notesRoot;
      const noteLines = [];
      for (const shape of descendants(body, 'p:sp', 200)) {
        const isNumber = descendants(shape, 'p:ph', 4).some(ph => attr(ph, 'type') === 'sldNum');
        if (isNumber) continue;
        const text = shapeText(shape).trim();
        if (text) noteLines.push(text);
      }
      notes = noteLines.join('\n');
      if (notes) notesFound += 1;
    }
    slides.push({
      index: slides.length,
      part,
      title,
      text: lines.join('\n'),
      notes,
      notesPart,
      missing: false,
    });
  }

  const text = slides.map((slide, index) => {
    const head = `## Slide ${index + 1}${slide.title ? `: ${slide.title}` : ''}`;
    return [head, slide.text, slide.notes ? `[notes] ${slide.notes}` : ''].filter(Boolean).join('\n');
  }).join('\n\n');

  return {
    pptx: {
      slides,
      slideCount: slides.length,
      declaredSlideCount: slideIds.length,
      notesFound,
      relationships: rels.map(rel => ({ id: rel.id, type: rel.typeShort, target: rel.target })),
    },
    text,
  };
}

/* ───────────────────────── XLSX ───────────────────────── */

const DATE_FORMAT_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Đoán định dạng ngày từ numFmt code (bỏ phần trong quote và []). */
export function isDateFormatCode(code) {
  const cleaned = String(code || '').replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '');
  if (!/[ymdhs]/i.test(cleaned)) return false;
  if (/^[#0.,\s%]+$/.test(cleaned)) return false;
  return /(^|[^\\])[ymdhs]/i.test(cleaned);
}

function columnIndex(ref) {
  const letters = String(ref || '').match(/^[A-Z]+/i);
  if (!letters) return -1;
  let value = 0;
  for (const ch of letters[0].toUpperCase()) value = value * 26 + (ch.charCodeAt(0) - 64);
  return value - 1;
}

function rowIndex(ref) {
  const digits = String(ref || '').match(/(\d+)$/);
  return digits ? Number(digits[1]) : -1;
}

/** Serial Excel → ISO (hệ 1900 với leap-year bug, hoặc 1904). */
export function excelSerialToIso(serial, { date1904 = false } = {}) {
  const value = Number(serial);
  if (!Number.isFinite(value)) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  // Excel 1900 giả định 29/02/1900 tồn tại: serial < 60 phải cộng thêm 1 ngày.
  const adjusted = !date1904 && value < 60 ? value + 1 : value;
  const ms = epoch + Math.round(adjusted * 86400000);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return value % 1 === 0 ? iso.slice(0, 10) : iso.slice(0, 19) + 'Z';
}

function readSharedStrings(root) {
  if (!root) return [];
  const out = [];
  for (const si of childrenOf(root, 'si')) {
    const pieces = [];
    const walk = node => {
      if (!node || typeof node === 'string') return;
      if (node.localName === 't') { pieces.push(textContent(node)); return; }
      if (node.localName === 'rPh') return; // phonetic: không phải nội dung hiển thị
      for (const kid of node.children || []) walk(kid);
    };
    walk(si);
    out.push(pieces.join(''));
  }
  return out;
}

function readStyles(root) {
  const custom = new Map();
  const xfFormats = [];
  if (!root) return { custom, xfFormats };
  for (const fmt of descendants(root, 'numFmt', 5000)) {
    const id = Number(attr(fmt, 'numFmtId'));
    if (Number.isFinite(id)) custom.set(id, attr(fmt, 'formatCode') || '');
  }
  for (const xf of descendants(root, 'xf', 20000)) {
    const id = Number(attr(xf, 'numFmtId'));
    xfFormats.push(Number.isFinite(id) ? id : 0);
  }
  return { custom, xfFormats };
}

function isDateStyle(styleId, styles) {
  const id = styles.xfFormats[styleId];
  if (id === undefined) return false;
  if (DATE_FORMAT_IDS.has(id)) return true;
  const code = styles.custom.get(id);
  return code ? isDateFormatCode(code) : false;
}

async function readXlsx(zip, ctx, mainPart, mainRoot) {
  const workbookPr = child(mainRoot, 'workbookPr');
  const date1904 = String(attr(workbookPr, 'date1904') || '').toLowerCase() === 'true'
    || String(attr(workbookPr, 'date1904') || '') === '1';
  const rels = await readRelationshipsOf(zip, mainPart, ctx);
  const byId = new Map(rels.map(rel => [rel.id, rel]));

  const sharedPart = rels.find(rel => rel.typeShort === 'sharedStrings');
  const sharedRoot = sharedPart && zip.has(sharedPart.target) ? (await readPartRoot(zip, ctx, sharedPart.target)).root : null;
  const sharedStrings = readSharedStrings(sharedRoot);

  const stylesPart = rels.find(rel => rel.typeShort === 'styles');
  const stylesRoot = stylesPart && zip.has(stylesPart.target) ? (await readPartRoot(zip, ctx, stylesPart.target)).root : null;
  const styles = readStyles(stylesRoot);

  const sheetNodes = descendants(mainRoot, 'sheet', 5000);
  if (sheetNodes.length > ctx.limits.maxSheets) {
    ctx.diagnostics.push(`Có ${sheetNodes.length} worksheet, chỉ đọc ${ctx.limits.maxSheets}.`);
  }
  const sheets = [];
  for (const sheetNode of sheetNodes.slice(0, ctx.limits.maxSheets)) {
    checkDeadline(ctx.deadline);
    const name = attr(sheetNode, 'name') || `Sheet${sheets.length + 1}`;
    const state = attr(sheetNode, 'state') || 'visible';
    const rid = attr(sheetNode, 'r:id');
    const rel = rid ? byId.get(rid) : null;
    const part = rel && !rel.external ? rel.target : null;
    const sheet = {
      index: sheets.length, name, state, part,
      hidden: state === 'hidden' || state === 'veryHidden',
      rows: 0, cells: [], text: '', diagnostics: [],
    };
    if (!part || !zip.has(part)) {
      sheet.diagnostics.push('Không resolve được worksheet part.');
      sheets.push(sheet);
      continue;
    }
    const { root } = await readPartRoot(zip, ctx, part);
    const rows = [];
    let cellCount = 0;
    for (const row of descendants(root, 'row', ctx.limits.maxXmlBlocks)) {
      const rowNumber = Number(attr(row, 'r')) || rows.length + 1;
      const values = [];
      for (const c of childrenOf(row, 'c')) {
        cellCount += 1;
        if (cellCount > ctx.limits.maxXmlBlocks * 4) break;
        const ref = attr(c, 'r') || '';
        const type = attr(c, 't') || 'n';
        const styleId = Number(attr(c, 's') || 0);
        const formulaNode = child(c, 'f');
        const formula = formulaNode ? textContent(formulaNode).trim() : null;
        const vNode = child(c, 'v');
        const raw = vNode ? textContent(vNode) : null;
        let value = null;
        let display = '';
        if (type === 's') {
          const idx = raw === null ? NaN : Number(raw);
          value = Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : '';
          display = value;
        } else if (type === 'inlineStr') {
          const is = child(c, 'is');
          value = is ? descendants(is, 't', 200).map(t => textContent(t)).join('') : '';
          display = value;
        } else if (type === 'b') {
          value = raw === '1';
          display = value ? 'TRUE' : 'FALSE';
        } else if (type === 'e') {
          value = raw;
          display = raw || '#ERROR';
        } else if (type === 'str') {
          value = raw || '';
          display = value;
        } else if (raw !== null && raw !== '') {
          const num = Number(raw);
          if (Number.isFinite(num)) {
            value = num;
            if (isDateStyle(styleId, styles)) {
              value = { serial: num, iso: excelSerialToIso(num, { date1904 }) };
              display = value.iso || String(num);
            } else {
              display = String(num);
            }
          } else {
            value = raw;
            display = raw;
          }
        }
        if (display === '' && formula) display = `=${formula}`;
        if (display !== '') values.push({ ref, column: columnIndex(ref), display });
        sheet.cells.push({
          ref, row: rowNumber, column: columnIndex(ref), type, styleId,
          value, formula, display,
        });
      }
      if (values.length) {
        rows.push({ row: rowNumber, values });
        sheet.rows += 1;
      }
    }
    sheet.text = rows.map(item => item.values.map(v => v.display).join('\t')).join('\n');
    sheets.push(sheet);
  }

  const text = sheets.map(sheet => `## Sheet: ${sheet.name}${sheet.hidden ? ' (hidden)' : ''}\n${sheet.text}`.trim()).join('\n\n');
  return {
    xlsx: {
      sheets,
      sharedStrings: sharedStrings.length,
      date1904,
      declaredSheets: sheetNodes.length,
    },
    text,
  };
}

/** Đếm nhanh số dòng/cột có dữ liệu (dùng cho báo cáo). */
export function sheetDimensions(sheet) {
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of sheet.cells || []) {
    if (cell.row > maxRow) maxRow = cell.row;
    if (cell.column > maxCol) maxCol = cell.column;
  }
  return { rows: maxRow, columns: maxCol + 1, cells: (sheet.cells || []).length };
}
