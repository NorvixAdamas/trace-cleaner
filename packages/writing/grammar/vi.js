/**
 * packages/writing/grammar/vi.js — luật tiếng Việt deterministic (2.3).
 *
 * Sửa hồi quy quan trọng so với 2.2: các cụm như "cũng như là", "nói chung là",
 * "ngoài ra thì", "tuy nhiên thì" là tiếng Việt tự nhiên, chỉ hơi dài. Chúng
 * KHÔNG còn bị xếp vào lỗi chính tả; chúng là gợi ý văn phong (kind
 * 'suggestion'), người dùng có thể bỏ qua.
 *
 * Giới hạn phải nói thẳng: đây KHÔNG phải bộ ngữ pháp tiếng Việt. Nó bắt lỗi
 * gõ, khoảng trắng, lặp từ và một số cấu trúc rõ ràng. Không đoán ý người viết,
 * không đổi từ đồng nghĩa, không sửa trật tự từ.
 */

import { CATEGORY, KIND, SEVERITY } from '../suggestions.js';

/** Từ lặp có chủ đích trong tiếng Việt (nhấn mạnh, phân phối, số nhiều). */
export const REDUPLICATION_ALLOWED = new Set([
  'người', 'nhà', 'ngày', 'đêm', 'năm', 'tháng', 'lần', 'ai', 'gì', 'nào', 'sao',
  'thế', 'vậy', 'rất', 'hơi', 'mãi', 'luôn', 'từng', 'mỗi', 'đi', 'lại', 'ra', 'vào',
  'dần', 'mãi', 'hoài', 'thôi', 'đâu', 'hơn', 'lắm', 'quá',
]);

/**
 * Lỗi chính tả/gõ KHÔNG mơ hồ. Chỉ những cặp mà từ sai không phải là một từ
 * khác có nghĩa trong tiếng Việt.
 */
export const TYPOS = {
  'sử lý': 'xử lý',
  'xử dụng': 'sử dụng',
  'bỡi vì': 'bởi vì',
  'bởi zì': 'bởi vì',
  'vì zậy': 'vì vậy',
  'đựơc': 'được',
  'ngừơi': 'người',
  'nhửng': 'những',
  'khỏang': 'khoảng',
  'chọng': 'trọng',
  'ngọai': 'ngoại',
  'họach': 'hoạch',
};

/**
 * Cụm dài hơn cách nói gọn — tiếng Việt tự nhiên, nên chỉ là gợi ý văn phong.
 * Không bao giờ tự áp; confidence thấp để UI xếp sau lỗi thật.
 */
export const STYLE_TRIMS = {
  'cũng như là': 'cũng như',
  'nói chung là': 'nói chung',
  'ngoài ra thì': 'ngoài ra',
  'tuy nhiên thì': 'tuy nhiên',
  'bởi vì thế': 'bởi thế',
  'cho nên là': 'cho nên',
  'như là': 'như',
  'thì là': 'thì',
  'mà là': 'mà',
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundary(value) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(value)}(?![\\p{L}\\p{N}])`, 'giu');
}

/** @type {Array<{id:string,type:string,severity:string,kind?:string,confidence?:number,run:(text:string)=>Array<object>}>} */
export const VI_RULES = [
  {
    id: 'vi.typo-unambiguous',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.97,
    run(text) {
      const out = [];
      for (const [wrong, right] of Object.entries(TYPOS)) {
        if (wrong === right) continue;
        const re = wordBoundary(wrong);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: right,
            reason: `Lỗi gõ: "${wrong}" → "${right}".`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.repeated-word',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /(^|[^\p{L}])([\p{L}]{2,})([ \t]+)\2(?=[^\p{L}]|$)/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        // "người người", "ngày ngày"… là láy có chủ đích, không phải lỗi.
        if (REDUPLICATION_ALLOWED.has(m[2].toLowerCase())) continue;
        const start = m.index + m[1].length;
        out.push({ start, end: m.index + m[0].length, replacement: m[2], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'vi.style-trim',
    type: CATEGORY.STYLE,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.45,
    run(text) {
      const out = [];
      for (const [long, short] of Object.entries(STYLE_TRIMS)) {
        const re = wordBoundary(long);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: short,
            reason: `Có thể viết gọn hơn: "${long}" → "${short}". Đây là lựa chọn văn phong, không phải lỗi.`,
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.space-before-punctuation',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const before = text[m.index - 1] || '';
        // "1 000" hay "10 : 30" hiếm; dấu chấm giữa số là thập phân, không sửa.
        if (/[0-9]/.test(before) && m[1] === '.') continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.8,
    run(text) {
      const out = [];
      const re = /([,;:])(?=[\p{L}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        // "1,5" là số thập phân kiểu Việt Nam, không phải thiếu khoảng trắng.
        if (/[0-9]/.test(text[m.index - 1] || '') && m[1] === ',') continue;
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Cần một khoảng trắng sau dấu phẩy/hai chấm.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-period',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /([.!?])(?=[\p{Lu}\p{Ll}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        const next = text[m.index + 1] || '';
        const before = text[m.index - 1] || '';
        if (/[0-9]/.test(before) || /[0-9]/.test(next)) continue; // 3.14, phiên bản
        if (m[1] === '.' && /[A-Z]/.test(before) && /[A-Z]/.test(next)) continue; // viết tắt kiểu "TP.HCM"
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Thiếu khoảng trắng sau dấu kết câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.double-space',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /[ \t]{2,}/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: ' ', reason: 'Nhiều khoảng trắng liên tiếp.' });
      }
      return out;
    },
  },
  {
    id: 'vi.decomposed-unicode',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.95,
    run(text) {
      const out = [];
      // Nguyên âm/ký tự có thể bị tách dấu (NFD) khi copy từ PDF hoặc web.
      const re = /[\p{L}][\p{M}]+/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        const composed = m[0].normalize('NFC');
        if (composed !== m[0]) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: composed,
            reason: 'Ký tự bị tách dấu (Unicode tổ hợp) — chuẩn hoá về NFC.',
          });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.sentence-start',
    type: CATEGORY.CAPITALIZATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.7,
    run(text) {
      const out = [];
      const re = /(^|[.!?][ \t]+)([a-zàáảãạăâđêôơư])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: m[2].toUpperCase(), reason: 'Đầu câu phải viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'vi.repeated-punctuation',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.6,
    run(text) {
      const out = [];
      const re = /([,;:])\1+/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Dấu câu bị lặp.' });
      }
      return out;
    },
  },
  {
    id: 'vi.redundant-pair',
    type: CATEGORY.REDUNDANCY,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.5,
    run(text) {
      const out = [];
      // Hai từ nối cùng chức năng trong một câu. Thay bằng dạng gọn, không xoá trắng.
      const pairs = {
        'và cũng': 'và',
        'nhưng tuy nhiên': 'nhưng',
        'bởi vì do': 'bởi vì',
        'nếu như': 'nếu',
        'hoặc là': 'hoặc',
      };
      for (const [long, short] of Object.entries(pairs)) {
        const re = wordBoundary(long);
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({
            start: m.index,
            end: m.index + m[0].length,
            replacement: short,
            reason: `Hai từ nối cùng chức năng: có thể viết "${short}".`,
          });
        }
      }
      return out;
    },
  },
];
