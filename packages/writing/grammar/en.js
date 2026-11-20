/**
 * packages/writing/grammar/en.js — luật tiếng Anh deterministic.
 *
 * Chỉ những sửa đổi KHÔNG phụ thuộc ngữ cảnh. Không có luật nào đoán ý người
 * viết, không đổi từ đồng nghĩa, không "làm hay hơn". Mọi match đều thành gợi ý
 * để người dùng duyệt, không tự áp.
 */

const REPEAT_ALLOWED = new Set(['had', 'that', 'is', 'no', 'very', 'ha', 'so', 'by', 'on', 'out']);

export const IRREGULAR = {
  went: 'gone', came: 'come', saw: 'seen', did: 'done', took: 'taken', wrote: 'written',
  spoke: 'spoken', broke: 'broken', chose: 'chosen', gave: 'given', knew: 'known',
  threw: 'thrown', began: 'begun', drank: 'drunk', ate: 'eaten', fell: 'fallen',
  forgot: 'forgotten', got: 'got', hid: 'hidden', rode: 'ridden', rang: 'rung',
  sang: 'sung', swam: 'swum', wore: 'worn', drove: 'driven', flew: 'flown',
  grew: 'grown', drew: 'drawn', stole: 'stolen', froze: 'frozen', shook: 'shaken',
};

export const MISSPELLINGS = {
  alot: 'a lot', definately: 'definitely', seperate: 'separate', recieve: 'receive',
  occured: 'occurred', untill: 'until', teh: 'the', wich: 'which', thier: 'their',
  becuase: 'because', accomodate: 'accommodate', arguement: 'argument',
  enviroment: 'environment', goverment: 'government', neccessary: 'necessary',
  publically: 'publicly', refered: 'referred', succesful: 'successful',
  tommorow: 'tomorrow', wierd: 'weird', adress: 'address', calender: 'calendar',
};

const VOWEL_EXCEPTIONS = /^(uni|use|user|usu|uti|eu|one|once|ubiq)/i;
const CONSONANT_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

/** @type {Array<{id:string,type:string,severity:string,run:(text:string)=>Array<object>}>} */
export const EN_RULES = [
  {
    id: 'en.repeated-word',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /\b([A-Za-z]{2,})([ \t]+)\1\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (REPEAT_ALLOWED.has(m[1].toLowerCase())) continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Từ bị lặp lại.' });
      }
      return out;
    },
  },
  {
    id: 'en.would-of',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(would|could|should|must|might)\s+of\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({
          start: m.index, end: m.index + m[0].length,
          replacement: `${m[1]} have`,
          reason: 'Sau động từ khuyết thiếu là "have", không phải "of".',
        });
      }
      return out;
    },
  },
  {
    id: 'en.irregular-participle',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(has|have|had)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const past = m[2].toLowerCase();
        const fixed = IRREGULAR[past];
        if (!fixed || fixed === past) continue;
        out.push({
          start: m.index, end: m.index + m[0].length,
          replacement: `${m[1]} ${fixed}`,
          reason: `Thì hoàn thành cần quá khứ phân từ "${fixed}", không phải "${m[2]}".`,
        });
      }
      return out;
    },
  },
  {
    id: 'en.spelling-common',
    type: 'spelling',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b[a-z]{3,}\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const fixed = MISSPELLINGS[m[0].toLowerCase()];
        if (!fixed) continue;
        const replacement = m[0][0] === m[0][0].toUpperCase()
          ? fixed[0].toUpperCase() + fixed.slice(1)
          : fixed;
        out.push({ start: m.index, end: m.index + m[0].length, replacement, reason: `Lỗi chính tả: "${m[0]}" → "${fixed}".` });
      }
      return out;
    },
  },
  {
    id: 'en.article-a-an',
    type: 'grammar',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /\b(a|an)[ \t]+([A-Za-z][a-z]*)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const article = m[1].toLowerCase();
        const word = m[2];
        const vowelLetter = /^[aeiou]/i.test(word);
        // "a university" / "an hour": âm đầu quyết định, không phải chữ cái.
        const vowelSound = (vowelLetter && !VOWEL_EXCEPTIONS.test(word)) || CONSONANT_EXCEPTIONS.test(word);
        if (article === 'a' && vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'an', reason: `Trước "${word}" dùng "an".` });
        } else if (article === 'an' && !vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'a', reason: `Trước "${word}" dùng "a".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.space-before-punctuation',
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
    id: 'en.space-after-comma',
    type: 'punctuation',
    severity: 'info',
    run(text) {
      const out = [];
      const re = /([,;])(?=[A-Za-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + 1, replacement: m[1] + ' ', reason: 'Cần một khoảng trắng sau dấu phẩy/chấm phẩy.' });
      }
      return out;
    },
  },
  {
    id: 'en.double-space',
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
    id: 'en.lowercase-i',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /(^|[^A-Za-z])i(?=[^A-Za-z]|$)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: 'I', reason: 'Đại từ "I" luôn viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'en.sentence-start',
    type: 'capitalization',
    severity: 'warning',
    run(text) {
      const out = [];
      const re = /(^|[.!?][ \t]+)([a-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: at + 1, replacement: m[2].toUpperCase(), reason: 'Đầu câu phải viết hoa.' });
      }
      return out;
    },
  },
  {
    id: 'en.was-were',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(they|we|you|these|those)\s+was\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} were`, reason: `Chủ ngữ số nhiều/ngôi hai đi với "were".` });
      }
      return out;
    },
  },
  {
    id: 'en.third-person-dont',
    type: 'grammar',
    severity: 'error',
    run(text) {
      const out = [];
      const re = /\b(he|she|it)\s+(don't|do not)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const negated = m[2].toLowerCase() === "don't" ? "doesn't" : 'does not';
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} ${negated}`, reason: 'Ngôi thứ ba số ít dùng "doesn\'t".' });
      }
      return out;
    },
  },
];

