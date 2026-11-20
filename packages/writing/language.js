/**
 * packages/writing/language.js — nhận diện ngôn ngữ ở mức đủ dùng.
 *
 * Không phải language detector thống kê. Mục tiêu: KHÔNG áp luật tiếng Anh lên
 * văn bản tiếng Việt. Khi không chắc, trả 'unknown' và caller chỉ chạy các luật
 * an toàn cho mọi ngôn ngữ.
 */

/** Chữ chỉ có trong tiếng Việt (hoặc rất đặc trưng). */
const VI_SPECIFIC = /[ăâđêôơưĂÂĐÊÔƠƯ]/;
const VI_TONES = /[àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/** Từ chức năng tiếng Việt / tiếng Anh để chấm điểm. */
const VI_WORDS = /\b(và|của|là|không|được|cho|với|trong|những|các|một|này|để|khi|nếu|nhưng|vì|nên)\b/gi;
const EN_WORDS = /\b(the|and|of|to|is|are|was|were|with|for|that|this|not|from|have|has|will|would|can)\b/gi;

export function detectLanguage(text) {
  const source = String(text || '');
  const letters = source.match(/\p{L}/gu) || [];
  if (!letters.length) return 'unknown';
  const ascii = letters.filter(ch => ch.codePointAt(0) < 0x80).length;
  const viHits = (source.match(VI_WORDS) || []).length;
  const enHits = (source.match(EN_WORDS) || []).length;
  const viMarkers = (source.match(new RegExp(VI_SPECIFIC.source, 'g')) || []).length
    + (source.match(VI_TONES) || []).length;

  if (viMarkers >= 2 || (viMarkers >= 1 && viHits >= 2)) return 'vi';
  if (viHits >= 3 && viHits > enHits) return 'vi';
  if (enHits >= 2 && enHits >= viHits) return 'en';
  if (ascii / letters.length > 0.95) return 'en';
  return 'unknown';
}

/** Ngôn ngữ được hỗ trợ luật deterministic. */
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'vi']);
