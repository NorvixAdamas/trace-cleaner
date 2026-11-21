/**
 * packages/writing/engine/readability.js — đo cấu trúc câu/đoạn, không phán xét.
 *
 * Không có ngưỡng "câu ngắn luôn tốt hơn". Các con số chỉ là quan sát; mọi
 * observation đều nói rõ đây là tín hiệu để người viết xem lại, không phải lỗi.
 * Flesch chỉ tính cho tiếng Anh vì công thức dựa trên âm tiết tiếng Anh; tiếng
 * Việt trả null thay vì bịa điểm.
 */

export const READABILITY_SCHEMA_VERSION = '1.0';

const ABBREVIATION = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|approx|Fig|No)\.$/i;

function words(text) {
  return String(text ?? '').match(/[\p{L}\p{N}][\p{L}\p{N}'’._+#-]*/gu) || [];
}

/** Tách câu theo dấu kết câu + khoảng trắng; bảo vệ viết tắt phổ biến. */
export function splitSentences(text) {
  const source = String(text ?? '');
  const out = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (!'.!?…'.includes(ch)) continue;
    let end = i + 1;
    while (end < source.length && '.!?…'.includes(source[end])) end += 1;
    const rest = source.slice(end);
    if (!/^\s+/.test(rest) && rest.length) continue;
    const candidate = source.slice(start, end).trim();
    if (!candidate) { start = end; continue; }
    if (ch === '.' && ABBREVIATION.test(candidate)) continue;
    // "3.14" không phải kết câu. Chỉ bỏ qua khi hai bên đều là CHỮ SỐ;
    // "end.Next" viết liền cũng không tách, nhưng "end. Next" thì tách.
    if (ch === '.' && /\d$/.test(candidate.slice(0, -1)) && /^\s*\d/.test(rest)) continue;
    out.push({ text: candidate, start, end });
    start = end;
  }
  const tail = source.slice(start).trim();
  if (tail) out.push({ text: tail, start, end: source.length });
  return out;
}

/** Đoạn = khối giữa các dòng trống; dòng đơn vẫn được coi là một đoạn. */
export function splitParagraphs(text) {
  const source = String(text ?? '');
  const out = [];
  let offset = 0;
  for (const chunk of source.split(/(\n[ \t]*\n+)/)) {
    if (/^\n[ \t]*\n+$/.test(chunk)) { offset += chunk.length; continue; }
    const leading = (chunk.match(/^\s*/) || [''])[0].length;
    const value = chunk.trim();
    if (value) out.push({ text: value, start: offset + leading, end: offset + leading + value.length });
    offset += chunk.length;
  }
  if (!out.length && source.trim()) out.push({ text: source.trim(), start: 0, end: source.length });
  return out;
}

/** Âm tiết tiếng Anh xấp xỉ: nhóm nguyên âm, trừ e câm cuối từ. */
function englishSyllables(word) {
  const clean = String(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

/**
 * @param {string} text
 * @param {{language?:'en'|'vi'|'unknown'}} [options]
 */
export function analyzeReadability(text, options = {}) {
  const source = String(text ?? '');
  const language = options.language || 'unknown';
  const sentenceList = splitSentences(source);
  const paragraphList = splitParagraphs(source);
  const sentenceWordCounts = sentenceList.map(item => words(item.text).length).filter(n => n > 0);
  const paragraphWordCounts = paragraphList.map(item => words(item.text).length).filter(n => n > 0);
  const allWords = words(source);
  const totalWords = allWords.length;
  const averageSentence = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length
    : 0;
  const averageParagraph = paragraphWordCounts.length
    ? paragraphWordCounts.reduce((a, b) => a + b, 0) / paragraphWordCounts.length
    : 0;
  const unique = new Set(allWords.map(word => word.toLowerCase()));

  let flesch = null;
  if (language === 'en' && sentenceWordCounts.length && totalWords) {
    const syllables = allWords.reduce((sum, word) => sum + englishSyllables(word), 0);
    flesch = 206.835 - 1.015 * (totalWords / sentenceWordCounts.length)
      - 84.6 * (syllables / totalWords);
  }

  const observations = [];
  const add = (id, severity, title, message, evidence) => observations.push({
    id, category: 'readability', severity, title, message, evidence,
  });

  const longSentences = sentenceList.filter(item => words(item.text).length > 35);
  if (longSentences.length) {
    add('readability.long-sentence', 'info', 'Câu dài',
      `${longSentences.length}/${sentenceList.length} câu dài hơn 35 từ. Không tự cắt: hãy kiểm tra xem câu có nhiều mệnh đề độc lập không.`,
      longSentences.slice(0, 5).map(item => ({ start: item.start, end: item.end, text: item.text })));
  }
  const denseParagraphs = paragraphList.filter(item => words(item.text).length > 150);
  if (denseParagraphs.length) {
    add('readability.dense-paragraph', 'info', 'Đoạn quá dày',
      `${denseParagraphs.length} đoạn dài hơn 150 từ. Cân nhắc tách theo ý, không theo số câu.`,
      denseParagraphs.slice(0, 3).map(item => ({ start: item.start, end: item.end, text: item.text.slice(0, 120) })));
  }
  if (sentenceWordCounts.length >= 10 && stddev(sentenceWordCounts) < 4) {
    add('readability.uniform-sentences', 'info', 'Độ dài câu rất đều',
      'Độ lệch chuẩn độ dài câu dưới 4 từ. Đây là quan sát nhịp điệu, không phải lỗi; chỉ nên đổi nếu nội dung cần nhấn mạnh.',
      [{ standardDeviation: Number(stddev(sentenceWordCounts).toFixed(2)) }]);
  }
  if (totalWords >= 100 && unique.size / totalWords < 0.35) {
    add('readability.low-diversity', 'info', 'Lặp từ vựng nhiều',
      `Chỉ ${unique.size}/${totalWords} từ khác nhau. Kiểm tra xem việc lặp là thuật ngữ cố ý hay thiếu từ thay thế.`,
      [{ unique: unique.size, total: totalWords }]);
  }

  return {
    schemaVersion: READABILITY_SCHEMA_VERSION,
    language,
    metrics: {
      characters: source.length,
      words: totalWords,
      sentences: sentenceList.length,
      paragraphs: paragraphList.length,
      averageSentenceWords: Number(averageSentence.toFixed(2)),
      medianSentenceWords: median(sentenceWordCounts),
      sentenceStdDev: Number(stddev(sentenceWordCounts).toFixed(2)),
      longestSentenceWords: sentenceWordCounts.length ? Math.max(...sentenceWordCounts) : 0,
      averageParagraphWords: Number(averageParagraph.toFixed(2)),
      lexicalDiversity: totalWords ? Number((unique.size / totalWords).toFixed(3)) : 0,
      fleschReadingEase: flesch === null ? null : Number(flesch.toFixed(1)),
    },
    observations,
    notes: ['flesch chỉ là ước lượng cho tiếng Anh; tiếng Việt không có điểm Flesch.',
      'Câu ngắn không mặc định tốt hơn câu dài.'],
    offsetSystem: 'utf16-source',
  };
}
