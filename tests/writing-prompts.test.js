import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROMPT_BASE, MODES, MD_KEEP_CLAUSE, MD_PLAIN_CLAUSE, SELF_EDIT,
  buildPrompt, PROMPT_VERSION, webPresets,
} from '../packages/writing/prompts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

const DESTRUCTIVE = [
  /Delete on sight/i,
  /Three-item lists/i,
  /Break it\./i,
  /Delete any three-item/i,
  /remove .*list item/i,
];

test('prompt không còn chỉ dẫn xoá nội dung', () => {
  const surfaces = [PROMPT_BASE, SELF_EDIT, MD_KEEP_CLAUSE, MD_PLAIN_CLAUSE,
    ...Object.values(MODES).map(mode => mode.instruction)];
  for (const text of surfaces) {
    for (const pattern of DESTRUCTIVE) {
      assert.doesNotMatch(text, pattern);
    }
  }
});

test('prompt của extension và web đều không còn chỉ dẫn xoá', () => {
  for (const path of ['extension/background.js', 'extension/core/prompts.js', 'index.html']) {
    const text = read(path);
    for (const pattern of DESTRUCTIVE) {
      assert.doesNotMatch(text, pattern, `${path} còn chỉ dẫn phá huỷ: ${pattern}`);
    }
  }
});

test('prompt đặt bảo toàn lên trước và nhắc rõ danh sách + phủ định', () => {
  assert.match(PROMPT_BASE, /Keep every list item/i);
  assert.match(PROMPT_BASE, /negation/i);
  assert.match(PROMPT_BASE, /Do not invent facts/i);
  assert.ok(PROMPT_BASE.indexOf('Non-negotiable preservation') < PROMPT_BASE.indexOf('What good editing looks like'));
});

test('mỗi chế độ có chỉ dẫn riêng, không chỉ đổi nhãn', () => {
  const instructions = Object.entries(MODES).map(([key, mode]) => {
    assert.ok(mode.label && mode.label.length > 0, `${key} thiếu label`);
    assert.ok(mode.instruction.length > 30, `${key} thiếu instruction thật`);
    return mode.instruction;
  });
  assert.equal(new Set(instructions).size, instructions.length);
});

test('buildPrompt ghép đúng chế độ và mệnh đề Markdown', () => {
  assert.match(buildPrompt('concise', { markdown: true }), /Editing mode: Concise/);
  assert.match(buildPrompt('concise', { markdown: true }), /Markdown structure \(mandatory\)/);
  assert.doesNotMatch(buildPrompt('concise', { markdown: false }), /Markdown structure \(mandatory\)/);
  assert.match(buildPrompt('concise', { markdown: false }), /Plain text \(mandatory\)/);
  assert.match(buildPrompt('không-tồn-tại'), /Editing mode: Tổng quát/);
  assert.match(PROMPT_VERSION, /^\d+\.\d+\.\d+$/);
});

test('web dùng đúng bản sinh từ registry', () => {
  const html = read('index.html');
  const start = html.indexOf('/* @generated:prompts:start');
  const end = html.indexOf('/* @generated:prompts:end */');
  assert.ok(start > 0 && end > start, 'thiếu marker prompt trong index.html');
  const block = html.slice(start, end);
  assert.ok(block.includes(JSON.stringify(PROMPT_BASE)), 'P_BASE web lệch registry');
  assert.ok(block.includes(JSON.stringify(SELF_EDIT)), 'SELF_EDIT web lệch registry');
  assert.ok(block.includes(PROMPT_VERSION), 'PROMPT_VERSION web lệch registry');
  const presets = webPresets();
  for (const [key, value] of Object.entries(presets)) {
    assert.ok(block.includes(`${key}: ${JSON.stringify(value)}`), `preset ${key} lệch registry`);
  }
});

test('extension nạp prompt từ registry, không tự định nghĩa lại', () => {
  const background = read('extension/background.js');
  assert.match(background, /from "\.\/core\/prompts\.js"/);
  assert.doesNotMatch(background, /const PROMPT\s*=/);
  assert.doesNotMatch(background, /MD_KEEP_CLAUSE\s*=/);
});
