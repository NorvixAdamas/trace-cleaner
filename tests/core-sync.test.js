import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('extension/core khớp packages/core (không sửa tay bản sao)', t => {
  try {
    const out = execFileSync('python', [join(ROOT, 'tools', 'sync_core.py'), '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.match(out, /khớp/);
  } catch (error) {
    if (error.code === 'ENOENT') {
      t.skip('python không có trong PATH');
      return;
    }
    assert.fail(String(error.stderr || error.message));
  }
});
