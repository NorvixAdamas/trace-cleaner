import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan, ACTIONABLE } from '../packages/core/unicode.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FIXTURE = [
  'Dòng bình thường có dấu tiếng Việt: ắ ệ ỡ đ.',
  'Zero width\u200Bspace và soft\u00ADhyphen.',
  'BOM\uFEFF và word\u2060joiner.',
  'Homoglyph: \u0430\u0435\u043E\u0440\u0441\u0445 (Cyrillic).',
  'Bidi: \u202Ereversed\u202C và isolate \u2067x\u2069.',
  'PUA: \uE000\uE001 và tag \u{E0041}\u{E0042}.',
  'Emoji cờ: \u{1F3F4}\u{E0067}\u{E0062}\u{E007F} và gia đình \u{1F468}\u200D\u{1F469}\u200D\u{1F467}.',
  'LRM/RLM/ALM: \u200E\u200F\u061C.',
  'Dấu gạch nhìn giống ASCII: \u2010\u2011\u2212.',
].join('\n');

function pythonJson(text) {
  const dir = mkdtempSync(join(tmpdir(), 'trace-parity-'));
  const file = join(dir, 'fixture.txt');
  writeFileSync(file, text, 'utf8');
  try {
    const raw = execFileSync('python', [join(ROOT, 'tools', 'trace_scan.py'), file, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    return JSON.parse(raw);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('JS core và Python CLI phân loại cùng codepoint nguy hiểm', t => {
  let report;
  try {
    report = pythonJson(FIXTURE);
  } catch (error) {
    t.skip('python không chạy được: ' + error.message);
    return;
  }
  const fromPython = report.findings
    .filter(row => ACTIONABLE.includes(row.category))
    .map(row => row.cp)
    .sort((a, b) => a - b);
  const fromCore = scan(FIXTURE)
    .filter(row => ACTIONABLE.includes(row.category))
    .map(row => row.cp)
    .sort((a, b) => a - b);
  assert.deepEqual(fromPython, fromCore);
});

test('Python CLI giữ ZWJ của emoji gia đình và không phá emoji cờ', { skip: false }, t => {
  let cleaned;
  try {
    cleaned = execFileSync('python', [join(ROOT, 'tools', 'trace_scan.py'), '-', '--strip'], {
      cwd: ROOT,
      encoding: 'utf8',
      input: FIXTURE,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
  } catch (error) {
    t.skip('python không chạy được: ' + error.message);
    return;
  }
  const body = cleaned.split('\n').filter(line => !line.startsWith('  ')).join('\n');
  assert.ok(body.includes('\u200D'), 'ZWJ bị xoá — sẽ phá emoji gia đình');
  assert.ok(body.includes('\u{E0067}'), 'tag char của emoji cờ bị xoá');
});
