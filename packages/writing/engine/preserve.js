/**
 * packages/writing/engine/preserve.js — so sánh bản gốc và bản viết lại.
 *
 * Đây là lớp deterministic: số, ngày, URL, email, trích dẫn, tên riêng, phủ
 * định, điều kiện, danh sách và cấu trúc Markdown. Nó KHÔNG chứng minh tương
 * đương ngữ nghĩa; trường `semanticEquivalence` luôn là `not_checked`.
 */

import {
  extractEntities, numberCounts, tokenCounts, extractEnumerations,
  markdownStructure, NEGATIONS, CONDITIONS,
} from '../../core/entities.js';
import { checkPreservation } from '../../core/preservation.js';
import { PRESERVATION_STATUS } from '../shared/schema.js';

export const PRESERVATION_SCHEMA_VERSION = '3.0';

function multisetMissing(expected, actual) {
  const pool = new Map();
  for (const value of actual) pool.set(value, (pool.get(value) || 0) + 1);
  const missing = [];
  for (const value of expected) {
    const count = pool.get(value) || 0;
    if (!count) missing.push(value);
    else pool.set(value, count - 1);
  }
  return missing;
}

const NEGATION_EQUIVALENTS = new Map([
  ["don't", 'not'], ["doesn't", 'not'], ["didn't", 'not'],
  ["isn't", 'not'], ["aren't", 'not'], ["wasn't", 'not'],
  ["weren't", 'not'], ["won't", 'not'], ["can't", 'cannot'],
  ["couldn't", 'not'], ["shouldn't", 'not'], ["wouldn't", 'not'],
  ["haven't", 'not'], ["hasn't", 'not'], ["hadn't", 'not'],
]);

const NEGATION_EXPANSIONS = [
  [/\bdon't\b/gi, 'do not'], [/\bdoesn't\b/gi, 'does not'], [/\bdidn't\b/gi, 'did not'],
  [/\bisn't\b/gi, 'is not'], [/\baren't\b/gi, 'are not'], [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'], [/\bwon't\b/gi, 'will not'], [/\bcan't\b/gi, 'cannot'],
  [/\bcouldn't\b/gi, 'could not'], [/\bshouldn't\b/gi, 'should not'], [/\bwouldn't\b/gi, 'would not'],
  [/\bhaven't\b/gi, 'have not'], [/\bhasn't\b/gi, 'has not'], [/\bhadn't\b/gi, 'had not'],
];

function normalizeNegation(token) {
  return NEGATION_EQUIVALENTS.get(String(token).toLowerCase()) || token;
}

function expandNegations(text) {
  let value = String(text ?? '');
  for (const [pattern, replacement] of NEGATION_EXPANSIONS) value = value.replace(pattern, replacement);
  return value;
}

const QUALIFIERS = /\b(?:at least|at most|no more than|no fewer than|more than|less than|up to|approximately|roughly|not necessarily|not only|but also|either|neither|both|only|at minimum|at maximum)\b/gi;
const MODALS = /\b(?:may|might|must|should|could|can|would|will)\b/gi;

const COMMON_CAPITALIZED = new Set([
  'The', 'This', 'That', 'These', 'Those', 'It', 'We', 'They', 'He', 'She', 'You',
  'In', 'On', 'At', 'For', 'But', 'And', 'Or', 'However', 'When', 'If', 'While',
  'After', 'Before', 'Since', 'Although', 'Because', 'As', 'By', 'With', 'Without',
  'From', 'To', 'Of', 'Our', 'Your', 'My', 'Their', 'Its', 'One', 'Two', 'Three',
  'First', 'Second', 'Finally', 'Also', 'Then', 'There', 'Here', 'More', 'Most',
  'Some', 'Many', 'All', 'No', 'Not', 'Each', 'Every', 'Both', 'Such', 'Other',
  'Another', 'New', 'What', 'Which', 'Who', 'Whom', 'Whose', 'Why', 'How', 'Please',
]);

function capitalizedNames(text) {
  const names = String(text ?? '').match(/\b[A-Z][a-z]{2,}\b/g) || [];
  return names.filter(name => !COMMON_CAPITALIZED.has(name));
}

function listTokens(item) {
  return String(item).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.+#_-]*/gu) || [];
}

function summarize(name, expected, actual) {
  const missing = multisetMissing(expected, actual);
  return {
    name,
    status: missing.length ? PRESERVATION_STATUS.BLOCKED : PRESERVATION_STATUS.PRESERVED,
    expected: expected.length,
    actual: actual.length,
    missing: missing.slice(0, 12),
  };
}

/**
 * @param {string} original
 * @param {string} revised
 * @param {{markdown?:boolean}} [options]
 */
export function comparePreservation(original, revised, options = {}) {
  const before = String(original ?? '');
  const after = String(revised ?? '');
  const entitiesBefore = extractEntities(before);
  const entitiesAfter = extractEntities(after);

  const numbersBefore = [...numberCounts(before).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const numbersAfter = [...numberCounts(after).entries()].flatMap(([value, count]) => Array(count).fill(value));

  const negationsBefore = [...tokenCounts(before, NEGATIONS).entries()].flatMap(([value, count]) => Array(count).fill(normalizeNegation(value)));
  const negationsAfter = [...tokenCounts(after, NEGATIONS).entries()].flatMap(([value, count]) => Array(count).fill(normalizeNegation(value)));
  const conditionsBefore = [...tokenCounts(before, CONDITIONS).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const conditionsAfter = [...tokenCounts(after, CONDITIONS).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const qualifiersBefore = [...tokenCounts(before, QUALIFIERS).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const qualifiersAfter = [...tokenCounts(after, QUALIFIERS).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const modalsBefore = [...tokenCounts(before, MODALS).entries()].flatMap(([value, count]) => Array(count).fill(value));
  const modalsAfter = [...tokenCounts(after, MODALS).entries()].flatMap(([value, count]) => Array(count).fill(value));

  const listBefore = extractEnumerations(before).flat();
  const listAfter = extractEnumerations(after).flat();
  const listTokensAfter = new Set(listAfter.flatMap(listTokens));
  const missingListItems = listBefore.filter(item => !listTokens(item).every(token => listTokensAfter.has(token)));

  const structureBefore = markdownStructure(before);
  const structureAfter = markdownStructure(after);
  const structureMissing = Object.entries(structureBefore)
    .filter(([key, count]) => count > 0 && structureAfter[key] < count)
    .map(([key, count]) => `${key}: ${count} → ${structureAfter[key]}`);

  const elements = [
    summarize('numbers', numbersBefore, numbersAfter),
    summarize('urls', entitiesBefore.urls, entitiesAfter.urls),
    summarize('emails', entitiesBefore.emails, entitiesAfter.emails),
    summarize('dates', entitiesBefore.dates, entitiesAfter.dates),
    summarize('citations', entitiesBefore.citations, entitiesAfter.citations),
    summarize('properNouns', entitiesBefore.properNouns, entitiesAfter.properNouns),
    summarize('names', capitalizedNames(before), capitalizedNames(after)),
    summarize('negations', negationsBefore, negationsAfter),
    summarize('conditions', conditionsBefore, conditionsAfter),
    summarize('qualifiers', qualifiersBefore, qualifiersAfter),
    summarize('modals', modalsBefore, modalsAfter),
    {
      name: 'lists',
      status: missingListItems.length ? PRESERVATION_STATUS.BLOCKED : PRESERVATION_STATUS.PRESERVED,
      expected: listBefore.length,
      actual: listAfter.length,
      missing: missingListItems.slice(0, 12),
    },
    {
      name: 'structure',
      status: structureMissing.length ? PRESERVATION_STATUS.BLOCKED : PRESERVATION_STATUS.PRESERVED,
      expected: structureBefore,
      actual: structureAfter,
      missing: structureMissing,
    },
  ];

  const core = checkPreservation(expandNegations(before), expandNegations(after), {
    markdown: options.markdown !== false,
  });

  const blocked = elements.filter(item => item.status === PRESERVATION_STATUS.BLOCKED);
  const warnings = core.issues.filter(item => item.severity === 'warning');
  let status = PRESERVATION_STATUS.PRESERVED;
  if (blocked.length || core.failed) status = PRESERVATION_STATUS.BLOCKED;
  else if (warnings.length) status = PRESERVATION_STATUS.REVIEW;

  return {
    schemaVersion: PRESERVATION_SCHEMA_VERSION,
    status,
    safeToAutoAccept: status === PRESERVATION_STATUS.PRESERVED,
    semanticEquivalence: 'not_checked',
    elements,
    blocked: blocked.map(item => item.name),
    warnings: warnings.map(item => ({ code: item.code, detail: item.detail })),
    core,
    note: 'Đây là kiểm tra deterministic (số/tên/phủ định/điều kiện/cấu trúc). Không có kết luận tương đương ngữ nghĩa.',
  };
}
