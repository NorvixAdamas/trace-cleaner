/**
 * Hợp đồng hành vi dùng chung (tests/fixtures/parity-cases.json) phải cho cùng
 * kết quả ở JS core và Python CLI. Python không phải bản port của JS, nhưng hai
 * bên phải nói cùng một sự thật về Unicode/whitespace.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanText } from '../packages/core/cleaning.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/parity-cases.json'), 'utf8'));

function pythonClean(text) {
  const raw = execFileSync('python', [join(ROOT, 'tools/trace_scan.py'), '-', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    input: text,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  return JSON.parse(raw);
}

let pythonAvailable = true;
try {
  pythonClean('ok');
} catch {
  pythonAvailable = false;
}

for (const item of fixture.cases) {
  test(`JS core: ${item.name}`, () => {
    assert.equal(cleanText(item.text, { markdown: true }).text, item.cleaned);
  });

  test(`Python CLI: ${item.name}`, t => {
    if (!pythonAvailable) return t.skip('python không chạy được');
    assert.equal(pythonClean(item.text).cleaned, item.cleaned);
  });
}

test('CRLF được giữ nguyên khi Python đọc/ghi, không bị đổi sang LF', t => {
  if (!pythonAvailable) return t.skip('python không chạy được');
  const report = pythonClean('một\r\nhai\r\n');
  assert.ok(report.cleaned.includes('\r\n'), 'Python đã đổi CRLF thành LF');
});
