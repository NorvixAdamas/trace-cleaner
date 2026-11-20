import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(join(ROOT, path), 'utf8');

test('artifact sinh ra khớp nguồn (bundle, prompt, index.html)', () => {
  const out = execFileSync(process.execPath, [join(ROOT, 'tools', 'sync_assets.js'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(out, /artifact khớp nguồn/);
});

test('bundle extension nạp được và phơi đúng API core', () => {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read('extension/core/bundle.js'), context);
  const core = context.TraceCore;
  for (const name of ['cleanText', 'countsFor', 'checkPreservation', 'scan', 'diffWords', 'stripMarkdown']) {
    assert.equal(typeof core[name], 'function', `thiếu hàm ${name}`);
  }
  assert.equal(typeof core.DocumentSession, 'function', 'thiếu class DocumentSession');
  assert.equal(core.cleanText('Kotlin, Java, and Python').text, 'Kotlin, Java, and Python');
});

test('extension/core/prompts.js là bản copy của registry', () => {
  const source = read('packages/writing/prompts.js');
  const copy = read('extension/core/prompts.js');
  assert.ok(copy.includes(source.trim()), 'bản copy prompt lệch nguồn');
  assert.match(copy.split('\n')[0], /AUTO-GENERATED/);
});

test('manifest nạp core trước sidebar và version 2.1', () => {
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.equal(manifest.version, '2.1.0');
  assert.deepEqual(manifest.content_scripts[0].js.slice(0, 2), ['core/bundle.js', 'sidebar.js']);
  const panel = read('extension/panel.html');
  assert.ok(panel.indexOf('src="core/bundle.js"') < panel.indexOf('src="sidebar.js"'), 'panel nạp sidebar trước core');
});

test('index.html chỉ có một cặp marker prompt', () => {
  const html = read('index.html');
  assert.equal(html.match(/@generated:prompts:start/g).length, 1);
  assert.equal(html.match(/@generated:prompts:end/g).length, 1);
});
