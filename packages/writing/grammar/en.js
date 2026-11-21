/**
 * packages/writing/grammar/en.js — luật tiếng Anh deterministic (2.3).
 *
 * Nguyên tắc: chỉ tự động sửa khi ngữ cảnh cho phép chắc chắn. Trường hợp mơ hồ
 * (its/it's, affect/effect, then/than) chỉ tạo gợi ý với confidence thấp hơn,
 * và luôn có lý do cụ thể để người dùng tự quyết.
 *
 * Không có luật nào đoán ý người viết, không đổi từ đồng nghĩa, không "làm hay
 * hơn". Mọi match đều thành gợi ý để người dùng duyệt, không tự áp.
 */

import { CATEGORY, KIND, SEVERITY } from '../suggestions.js';

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
  existance: 'existence', independant: 'independent', maintenence: 'maintenance',
  priviledge: 'privilege', reccomend: 'recommend', speach: 'speech',
  threshhold: 'threshold', wich: 'which',
};

/** Danh từ không đếm được đi với "much"; số nhiều đếm được đi với "many". */
const UNCOUNTABLE = new Set([
  'water', 'information', 'time', 'money', 'research', 'evidence', 'advice', 'homework',
  'equipment', 'software', 'feedback', 'traffic', 'furniture', 'luggage', 'knowledge',
  'progress', 'news', 'work', 'staff', 'training', 'content', 'data',
]);
const COUNTABLE_PLURAL = new Set([
  'people', 'things', 'items', 'books', 'files', 'documents', 'errors', 'options',
  'users', 'reasons', 'questions', 'problems', 'examples', 'companies', 'products',
  'words', 'pages', 'tests', 'issues', 'friends', 'colleagues', 'participants',
  'students', 'readers', 'customers', 'developers', 'teams', 'hours', 'days', 'years', 'months',
]);

const VOWEL_EXCEPTIONS = /^(uni|use|user|usu|uti|eu|one|once|ubiq)/i;
const CONSONANT_EXCEPTIONS = /^(hour|honest|honou?r|heir)/i;

/** Chữ cái đầu đọc như nguyên âm: an MBA, an FBI, an X-ray. */
const VOWEL_SOUND_LETTERS = new Set(['a', 'e', 'f', 'h', 'i', 'l', 'm', 'n', 'o', 'r', 's', 'x']);

function needsAn(word) {
  const value = String(word || '');
  if (!value) return false;
  const first = value[0];
  if (/[0-9]/.test(first)) {
    // 8, 11, 18 đọc bắt đầu bằng nguyên âm; 1 đọc "one".
    if (/^(8|11|18)/.test(value)) return true;
    return false;
  }
  if (/^[A-Z]{2,}/.test(value)) {
    // Viết tắt: đọc từng chữ cái.
    return VOWEL_SOUND_LETTERS.has(first.toLowerCase());
  }
  if (CONSONANT_EXCEPTIONS.test(value)) return true;
  if (VOWEL_EXCEPTIONS.test(value)) return false;
  return /^[aeiou]/i.test(value);
}

export const EN_RULES = [
  {
    id: 'en.repeated-word',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.8,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.98,
    run(text) {
      const out = [];
      const re = /\b(would|could|should|must|might)\s+of\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({
          start: m.index,
          end: m.index + m[0].length,
          replacement: `${m[1]} have`,
          reason: 'Sau động từ khuyết thiếu là "have", không phải "of".',
        });
      }
      return out;
    },
  },
  {
    id: 'en.irregular-participle',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.97,
    run(text) {
      const out = [];
      const re = /\b(has|have|had)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const past = m[2].toLowerCase();
        const fixed = IRREGULAR[past];
        if (!fixed || fixed === past) continue;
        out.push({
          start: m.index,
          end: m.index + m[0].length,
          replacement: `${m[1]} ${fixed}`,
          reason: `Thì hoàn thành cần quá khứ phân từ "${fixed}", không phải "${m[2]}".`,
        });
      }
      return out;
    },
  },
  {
    id: 'en.spelling-common',
    type: CATEGORY.SPELLING,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.96,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\b(a|an)[ \t]+([A-Za-z0-9][A-Za-z0-9-]*)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const article = m[1].toLowerCase();
        const word = m[2];
        if (/^(one|once|unique|united|universal|useful)$/i.test(word)) continue;
        const vowelSound = needsAn(word);
        if (article === 'a' && vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'an', reason: `Trước "${word}" đọc bắt đầu bằng nguyên âm nên dùng "an".` });
        } else if (article === 'an' && !vowelSound) {
          out.push({ start: m.index, end: m.index + m[1].length, replacement: 'a', reason: `Trước "${word}" đọc bắt đầu bằng phụ âm nên dùng "a".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.space-before-punctuation',
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
        if (/[0-9]/.test(before) && m[1] === '.') continue;
        out.push({ start: m.index, end: m.index + m[0].length, replacement: m[1], reason: 'Không đặt khoảng trắng trước dấu câu.' });
      }
      return out;
    },
  },
  {
    id: 'en.space-after-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /([,;])(?=[A-Za-z])/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        if (/[0-9]/.test(text[m.index - 1] || '')) continue; // 1,000
        out.push({ start: m.index, end: m.index + 1, replacement: `${m[1]} `, reason: 'Cần một khoảng trắng sau dấu phẩy/chấm phẩy.' });
      }
      return out;
    },
  },
  {
    id: 'en.double-space',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.CORRECTION,
    confidence: 0.92,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
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
    type: CATEGORY.CAPITALIZATION,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.7,
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
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
    run(text) {
      const out = [];
      const re = /\b(they|we|you|these|those)\s+was\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${m[1]} were`, reason: 'Chủ ngữ số nhiều/ngôi hai đi với "were".' });
      }
      return out;
    },
  },
  {
    id: 'en.third-person-dont',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.95,
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
  {
    id: 'en.have-has',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const patterns = [
        { re: /\b(he|she|it)\s+have\b/gi, replace: m => `${m[1]} has`, reason: 'Ngôi thứ ba số ít dùng "has".' },
        { re: /\b(they|we|you)\s+has\b/gi, replace: m => `${m[1]} have`, reason: 'Chủ ngữ số nhiều/ngôi hai dùng "have".' },
      ];
      for (const pattern of patterns) {
        let m;
        while ((m = pattern.re.exec(text)) !== null) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: pattern.replace(m), reason: pattern.reason });
        }
      }
      return out;
    },
  },
  {
    id: 'en.there-is-plural',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\bthere\s+(is|was)\s+(many|several|two|three|four|five|both|few|multiple)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const verb = m[1].toLowerCase() === 'is' ? 'are' : 'were';
        const lead = /^[A-Z]/.test(m[0]) ? 'There' : 'there';
        out.push({ start: m.index, end: m.index + m[0].length, replacement: `${lead} ${verb} ${m[2]}`, reason: `"${m[2]}" là số nhiều nên dùng "there ${verb}".` });
      }
      return out;
    },
  },
  {
    id: 'en.much-many',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.WARNING,
    kind: KIND.CORRECTION,
    confidence: 0.85,
    run(text) {
      const out = [];
      const re = /\b(much|many)\s+([a-z]+)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const determiner = m[1].toLowerCase();
        const noun = m[2].toLowerCase();
        if (determiner === 'much' && COUNTABLE_PLURAL.has(noun)) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: `many ${m[2]}`, reason: `"${m[2]}" đếm được nên dùng "many".` });
        } else if (determiner === 'many' && UNCOUNTABLE.has(noun)) {
          out.push({ start: m.index, end: m.index + m[0].length, replacement: `much ${m[2]}`, reason: `"${m[2]}" không đếm được nên dùng "much".` });
        }
      }
      return out;
    },
  },
  {
    id: 'en.its-it-is',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.92,
    run(text) {
      const out = [];
      // "its a" / "its the" không thể là sở hữu cách (thiếu danh từ) → "it's".
      const re = /\bits\s+(a|an|the|not|been|going|time|clear|important)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const replacement = /^[A-Z]/.test(m[0]) ? "It's" : "it's";
        out.push({ start: m.index, end: m.index + 3, replacement, reason: '"its" là sở hữu; ở đây cần "it is" → "it\'s".' });
      }
      return out;
    },
  },
  {
    id: 'en.their-there',
    type: CATEGORY.GRAMMAR,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\btheir\s+(is|are|was|were)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const replacement = /^[A-Z]/.test(m[0]) ? 'There' : 'there';
        out.push({ start: m.index, end: m.index + 5, replacement, reason: 'Cần "there" (tồn tại), không phải "their" (sở hữu).' });
      }
      return out;
    },
  },
  {
    id: 'en.loose-lose',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.ERROR,
    kind: KIND.CORRECTION,
    confidence: 0.9,
    run(text) {
      const out = [];
      const re = /\bloose\s+(weight|money|time|track|focus|control|interest)\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        out.push({ start, end: start + 5, replacement: 'lose', reason: '"lose" là mất; "loose" là lỏng.' });
      }
      return out;
    },
  },
  {
    id: 'en.then-than',
    type: CATEGORY.WORD_CHOICE,
    severity: SEVERITY.WARNING,
    kind: KIND.SUGGESTION,
    confidence: 0.55,
    run(text) {
      const out = [];
      const re = /\b(more|less|better|worse|other|rather|greater|smaller|older|younger|faster|slower|higher|lower)\s+then\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[0].length - 4;
        out.push({ start: at, end: at + 4, replacement: 'than', reason: 'So sánh hơn dùng "than"; "then" là thời gian.' });
      }
      return out;
    },
  },
  {
    id: 'en.oxford-comma',
    type: CATEGORY.PUNCTUATION,
    severity: SEVERITY.INFO,
    kind: KIND.SUGGESTION,
    confidence: 0.35,
    run(text) {
      const out = [];
      // Liệt kê 3 phần tử không có dấu phẩy trước "and" — chỉ là lựa chọn style.
      const re = /\b([A-Za-z]+),\s+([A-Za-z]+)\s+and\s+([A-Za-z]+)\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const at = m.index + m[1].length;
        out.push({ start: at, end: m.index + m[0].length, replacement: `, ${m[2]}, and ${m[3]}`, reason: 'Có thể dùng dấu phẩy Oxford trong liệt kê 3 phần tử (tuỳ house style).' });
      }
      return out;
    },
  },
];
