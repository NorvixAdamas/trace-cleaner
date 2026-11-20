/**
 * packages/writing/grammar/vi.js — luật tiếng Việt deterministic.
 *
 * Giới hạn phải nói thẳng: đây KHÔNG phải bộ ngữ pháp tiếng Việt. Nó bắt được
 * lỗi gõ/cách khoảng trắng/lặp từ và một danh sách lỗi chính tả không mơ hồ.
 * Không đụng dấu thanh, không đổi từ đồng nghĩa, không sửa trật tự từ.
 */

/** Tiếng Việt rất ít khi lặp từ có chủ đích; không có ngoại lệ mặc định. */
const REPEAT_ALLOWED = new Set();

/** Lỗi chính tả phổ biến, nghĩa không đổi khi sửa. */
export const TYPOS = {
  'sử lý': 'xử lý',
  'xử dụng': 'sử dụng',
  'sử dụng được': 'sử dụng được',
  'bỡi vì': 'bởi vì',
  'bởi zì': 'bởi vì',
  'vì zậy': 'vì vậy',
  'cũng như là': 'cũng như',
  'nói chung là': 'nói chung',
  'ngoài ra thì': 'ngoài ra',
  'tuy nhiên thì': 'tuy nhiên',
};

/** @type {Array<{id:string,type:string,severity:string,run:(text:string)=>Array<object>}>} */
export const VI_RULES = [
  {
    id: 'vi.repeated-word',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /(^|[^\p{L}])([\p{L}]{2,})([ \t]+)\2(?=[^\p{L}]|$)/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (REPEAT_ALLOWED.has(m[2].toLowerCase())) continue;
        const start = m.index + m[1].length;
        out.push({ start, end: start + m[2].length, replacement: m[2], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'vi.typo-phrase',
    type: 'spelling',
    severity: 'error',
    run(text) {
      const out = [];
      for (const [wrong, right] of Object.entries(TYPOS)) {
        if (wrong === right) continue;
        const re = new RegExp(`(?<![\\p{L}])${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu');
        let m;
        while ((m = re.exec(text)) !== null) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: right, reason: `Cách viết thường dùng: "${right}".` });
        }
      }
      return out;
    },
  },
  {
    id: 'vi.space-before-punctuation',
    type: 'punctuation',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /[ \t]+([,.;:!?])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'vi.space-after-comma',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /([,;:])(?=[\p{L}])/gu;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + 1, replacement: m[1] + ' ', reason: 'Cần một khoảng trắng sau dấu phẩy/hai chấm.' });
      }
      return out;
    },
  },
  {
    id: 'vi.double-space',
    type: 'punctuation',
    severity: 'info',
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
    id: 'vi.sentence-start',
    type: 'capitalization',
    severity: 'warning',
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
    type: 'punctuation',
    severity: 'info',
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
];

