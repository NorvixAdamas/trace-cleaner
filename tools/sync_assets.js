#!/usr/bin/env node
/**
 * tools/sync_assets.js — sinh mọi artifact phái sinh từ nguồn duy nhất.
 *
 *   node tools/sync_assets.js          # ghi lại
 *   node tools/sync_assets.js --check  # exit 1 nếu artifact đã lệch nguồn
 *
 * Artifact:
 *   1. extension/core/bundle.js   — bundle core (classic script, gán globalThis.TraceCore)
 *   2. extension/core/prompts.js  — bản copy ESM của packages/writing/prompts.js
 *   3. index.html                 — khối prompt giữa hai marker @generated:prompts
 *
 * Không dùng bundler ngoài: core chỉ có import/export tĩnh dạng đơn giản, tool
 * kiểm tra cú pháp lạ và báo lỗi thay vì sinh bundle sai.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prompts from '../packages/writing/prompts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = join(ROOT, 'packages', 'core');
const EXT_CORE = join(ROOT, 'extension', 'core');
const INDEX = join(ROOT, 'index.html');

/** Module được đưa vào bundle của extension (thứ tự không quan trọng). */
const BUNDLE_MODULES = [
  'unicode.js',
  'entities.js',
  'markdown.js',
  'preservation.js',
  'diff.js',
  'document.js',
  'cleaning.js',
];

const PROMPTS_SRC = join(ROOT, 'packages', 'writing', 'prompts.js');

const STALE = [];

const rel = path => relative(ROOT, path).replace(/\\/g, '/');

/**
 * Chuyển một ES module đơn giản sang thân hàm của module registry.
 * Chỉ hỗ trợ:
 *   import { a, b as c } from './x.js'
 *   export const|let|var NAME = ...
 *   export function NAME(...)
 *   export class NAME
 * Bất kỳ cú pháp export nào khác đều bị từ chối để không sinh bundle sai.
 */
function transformModule(name, source) {
  const deps = [];
  let body = source;

  body = body.replace(/^[ \t]*import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.-]+)['"];?[ \t]*$/gm,
    (match, names, dep) => {
      deps.push(dep);
      const bindings = names.split(',').map(part => part.trim()).filter(Boolean).map(part => {
        const [imported, alias] = part.split(/\s+as\s+/).map(value => value.trim());
        return alias ? `${imported}: ${alias}` : imported;
      });
      return `const { ${bindings.join(', ')} } = __require(${JSON.stringify(dep)});`;
    });

  if (/^[ \t]*import\s/m.test(body)) {
    throw new Error(`${name}: còn import không hỗ trợ → không thể bundle an toàn`);
  }
  if (/^[ \t]*export\s+default\s/m.test(body) || /^[ \t]*export\s*\*/m.test(body) || /^[ \t]*export\s*\{/m.test(body)) {
    throw new Error(`${name}: dùng export không hỗ trợ (default/star/list) → không thể bundle an toàn`);
  }

  const exported = [];
  body = body.replace(/^([ \t]*)export\s+(const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (match, indent, kind, identifier) => {
      exported.push(identifier);
      return `${indent}${kind} ${identifier}`;
    });

  if (/^[ \t]*export\s/m.test(body)) {
    throw new Error(`${name}: còn export chưa xử lý → không thể bundle an toàn`);
  }

  const footer = exported.length
    ? `\nObject.assign(__exports, { ${exported.join(', ')} });\n`
    : '\n';

  return {
    name,
    deps,
    code: `__modules[${JSON.stringify(name)}] = function (__exports) {\n'use strict';\n${body}${footer}};\n`,
  };
}

function bundleCore() {
  const modules = BUNDLE_MODULES.map(file => {
    const path = join(CORE, file);
    if (!existsSync(path)) throw new Error(`thiếu module core: ${rel(path)}`);
    return transformModule(file, readFileSync(path, 'utf8'));
  });

  const header = `/* AUTO-GENERATED from packages/core — chạy: node tools/sync_assets.js
   Không sửa tay. Bundle này là bản classic-script của core cho content script
   và side panel; tests/extension-bundle.test.js so sánh hành vi với core. */
(function () {
'use strict';
const __modules = Object.create(null);
const __cache = Object.create(null);
function __require(name) {
  if (__cache[name]) return __cache[name];
  const factory = __modules[name];
  if (!factory) throw new Error('core module chưa có trong bundle: ' + name);
  const exports = __cache[name] = Object.create(null);
  factory(exports);
  return exports;
}
`;

  const footer = `
globalThis.TraceCore = Object.assign(
  Object.create(null),
${BUNDLE_MODULES.map(file => `  __require(${JSON.stringify(file)}),`).join('\n')}
);
})();
`;

  return header + modules.map(module => module.code).join('\n') + footer;
}

function promptsModule() {
  const source = readFileSync(PROMPTS_SRC, 'utf8');
  return `/* AUTO-GENERATED from packages/writing/prompts.js — chạy: node tools/sync_assets.js */\n${source}`;
}

/** Sinh khối JS cho index.html từ registry prompt. */
function webPromptBlock(newline) {
  const presets = prompts.webPresets();
  const json = value => JSON.stringify(value);
  const lines = [
    '/* @generated:prompts:start — nguồn: packages/writing/prompts.js',
    '   Sinh lại: node tools/sync_assets.js   ·   kiểm tra: node tools/sync_assets.js --check */',
    `const PROMPT_VERSION = ${json(prompts.PROMPT_VERSION)};`,
    `const P_BASE = ${json(prompts.PROMPT_BASE)};`,
    'const P_PRESETS = {',
    ...Object.entries(presets).map(([key, value]) => `  ${key}: ${json(value)},`),
    '};',
    `const SELF_EDIT = ${json(prompts.SELF_EDIT)};`,
    `const MD_KEEP_CLAUSE = ${json(prompts.MD_KEEP_CLAUSE)};`,
    `const MD_PLAIN_CLAUSE = ${json(prompts.MD_PLAIN_CLAUSE)};`,
    '/* @generated:prompts:end */',
  ];
  return lines.join(newline);
}

function injectPrompts(html) {
  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  const start = '/* @generated:prompts:start';
  const end = '/* @generated:prompts:end */';
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt < 0 || endAt < startAt) {
    throw new Error('index.html: thiếu marker @generated:prompts — không ghi đè mù');
  }
  const block = webPromptBlock(newline);
  return html.slice(0, startAt) + block + html.slice(endAt + end.length);
}

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const exists = existsSync(file);
  if (exists && readFileSync(file, 'utf8') === text) {
    console.log(`không đổi ${rel(file)}`);
    return;
  }
  writeFileSync(file, text, 'utf8');
  console.log(`wrote ${rel(file)}`);
}

function check(file, text) {
  if (!existsSync(file) || readFileSync(file, 'utf8') !== text) {
    STALE.push(rel(file));
    console.error(`lệch nguồn: ${rel(file)}`);
    return;
  }
  console.log(`khớp ${rel(file)}`);
}

function main() {
  const checking = process.argv.includes('--check');
  const outputs = [
    [join(EXT_CORE, 'bundle.js'), bundleCore()],
    [join(EXT_CORE, 'prompts.js'), promptsModule()],
    [INDEX, injectPrompts(readFileSync(INDEX, 'utf8'))],
  ];

  if (checking) {
    for (const [file, text] of outputs) check(file, text);
    if (STALE.length) {
      console.error(`artifact lệch nguồn (${STALE.length}): chạy node tools/sync_assets.js`);
      return 1;
    }
    console.log('artifact khớp nguồn');
    return 0;
  }

  for (const [file, text] of outputs) write(file, text);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error('sync_assets:', error.message);
  process.exitCode = 1;
}
