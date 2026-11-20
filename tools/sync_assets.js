#!/usr/bin/env node
/**
 * tools/sync_assets.js — sinh mọi artifact phái sinh từ nguồn duy nhất.
 *
 *   node tools/sync_assets.js          # ghi lại
 *   node tools/sync_assets.js --check  # exit 1 nếu artifact đã lệch nguồn
 *
 * Artifact:
 *   1. extension/core/bundle.js   — bundle classic-script của packages/core +
 *                                   packages/writing + packages/providers.
 *                                   Phơi 3 global: TraceCore, TraceWriting,
 *                                   TraceProviders. Dùng cho content script,
 *                                   side panel và service worker (import side-effect).
 *   2. extension/core/prompts.js  — bản copy ESM của packages/writing/prompts.js
 *   3. index.html                 — khối core sinh tự động + khối prompt
 *
 * Không dùng bundler ngoài. Tool chỉ hỗ trợ đúng các dạng import/export mà core
 * đang dùng; gặp cú pháp lạ thì báo lỗi thay vì sinh bundle sai.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prompts from '../packages/writing/prompts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_CORE = join(ROOT, 'extension', 'core');
const INDEX = join(ROOT, 'index.html');

/** Module đưa vào bundle, đặt tên theo path tương đối trong repo. */
const BUNDLE_MODULES = [
  'core/unicode.js',
  'core/entities.js',
  'core/markdown.js',
  'core/preservation.js',
  'core/diff.js',
  'core/document.js',
  'core/cleaning.js',
  'core/limits.js',
  'writing/prompts.js',
  'writing/suggestions.js',
  'writing/language.js',
  'writing/grammar/en.js',
  'writing/grammar/vi.js',
  'writing/grammar/index.js',
  'providers/errors.js',
  'providers/request.js',
  'providers/google.js',
  'providers/openai-compatible.js',
  'providers/registry.js',
];

const CORE_GLOBALS = [
  ['TraceCore', [
    'core/unicode.js', 'core/entities.js', 'core/markdown.js', 'core/preservation.js',
    'core/diff.js', 'core/document.js', 'core/cleaning.js', 'core/limits.js',
  ]],
  ['TraceWriting', [
    'writing/prompts.js', 'writing/suggestions.js', 'writing/language.js', 'writing/grammar/index.js',
  ]],
  ['TraceProviders', [
    'providers/registry.js', 'providers/errors.js', 'providers/request.js',
  ]],
];

const PROMPTS_SRC = join(ROOT, 'packages', 'writing', 'prompts.js');
const STALE = [];
const rel = path => relative(ROOT, path).replace(/\\/g, '/');

/** Resolve import path tương đối thành tên module trong bundle. */
function resolveDep(fromName, spec) {
  const resolved = posix.normalize(posix.join(posix.dirname(fromName), spec));
  if (!BUNDLE_MODULES.includes(resolved)) {
    throw new Error(`${fromName}: import "${spec}" → ${resolved} không nằm trong danh sách bundle`);
  }
  return resolved;
}

/**
 * Chuyển một ES module đơn giản sang thân hàm của module registry.
 * Chỉ hỗ trợ named import và export const/let/var/function/class.
 */
function transformModule(name, source) {
  const deps = [];
  let body = source;

  body = body.replace(
    /^[ \t]*import\s*\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"];?[ \t]*$/gm,
    (match, names, spec) => {
      const resolved = resolveDep(name, spec);
      deps.push(resolved);
      const bindings = names.split(',').map(part => part.trim()).filter(Boolean).map(part => {
        const [imported, alias] = part.split(/\s+as\s+/).map(value => value.trim());
        return alias ? `${imported}: ${alias}` : imported;
      });
      return `const { ${bindings.join(', ')} } = __require(${JSON.stringify(resolved)});`;
    },
  );

  if (/^[ \t]*import\s/m.test(body)) {
    throw new Error(`${name}: còn import không hỗ trợ → không thể bundle an toàn`);
  }
  if (/^[ \t]*export\s+default\s/m.test(body)
    || /^[ \t]*export\s*\*/m.test(body)
    || /^[ \t]*export\s*\{/m.test(body)) {
    throw new Error(`${name}: dùng export không hỗ trợ (default/star/list) → không thể bundle an toàn`);
  }

  const exported = [];
  body = body.replace(
    /^([ \t]*)export\s+(const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (match, indent, kind, identifier) => {
      exported.push(identifier);
      return `${indent}${kind} ${identifier}`;
    },
  );

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

function bundle() {
  const modules = BUNDLE_MODULES.map(name => {
    const path = join(ROOT, 'packages', name);
    if (!existsSync(path)) throw new Error(`thiếu module: packages/${name}`);
    return transformModule(name, readFileSync(path, 'utf8'));
  });

  const header = `/* AUTO-GENERATED from packages/{core,writing,providers} — chạy: node tools/sync_assets.js
   Không sửa tay. Bundle classic-script này là core duy nhất cho Web (inline trong
   index.html), content script và side panel. tests/assets-sync.test.js kiểm tra
   artifact khớp nguồn; tests/web-core-adapter.test.js kiểm tra web gọi đúng core. */
(function () {
'use strict';
if (globalThis.TraceCore && globalThis.TraceCore.__bundleLoaded) return;
const __modules = Object.create(null);
const __cache = Object.create(null);
function __require(name) {
  if (__cache[name]) return __cache[name];
  const factory = __modules[name];
  if (!factory) throw new Error('module chưa có trong bundle: ' + name);
  const exports = __cache[name] = Object.create(null);
  factory(exports);
  return exports;
}
`;

  const globals = CORE_GLOBALS.map(([globalName, names]) =>
    `globalThis.${globalName} = Object.assign(Object.create(null),\n${names.map(n => `  __require(${JSON.stringify(n)}),`).join('\n')}\n);`).join('\n');

  const tail = `
globalThis.TraceProviders.google = __require('providers/google.js');
globalThis.TraceProviders.openai = __require('providers/openai-compatible.js');
globalThis.TraceProviders.openaiCompatible = globalThis.TraceProviders.openai;
globalThis.TraceCore.__bundleLoaded = true;
globalThis.TraceCore.__engineVersion = '2.2';
})();
`;

  return header + modules.map(module => module.code).join('\n') + globals + tail;
}

function promptsModule() {
  const source = readFileSync(PROMPTS_SRC, 'utf8');
  return `/* AUTO-GENERATED from packages/writing/prompts.js — chạy: node tools/sync_assets.js */\n${source}`;
}

/** Khối core nhúng vào index.html: chạy được từ file:// và GitHub Pages. */
function webCoreBlock(bundleText, newline) {
  const safe = bundleText.replace(/<\/script/gi, '<\\/script');
  return [
    '/* @generated:core:start — nguồn: packages/core + packages/writing + packages/providers',
    '   Sinh lại: node tools/sync_assets.js   ·   kiểm tra: node tools/sync_assets.js --check',
    '   Không sửa tay: web dùng đúng engine với extension. */',
    safe.replace(/\r\n/g, '\n').replace(/\n/g, newline),
    '/* @generated:core:end */',
  ].join(newline);
}

/** Sinh khối JS cho index.html từ registry prompt (9 chế độ). */
function webPromptBlock(newline) {
  const json = value => JSON.stringify(value);
  const lines = [
    '/* @generated:prompts:start — nguồn: packages/writing/prompts.js',
    '   Sinh lại: node tools/sync_assets.js   ·   kiểm tra: node tools/sync_assets.js --check */',
    `const PROMPT_VERSION = ${json(prompts.PROMPT_VERSION)};`,
    `const P_BASE = ${json(prompts.PROMPT_BASE)};`,
    'const P_MODES = {',
    ...Object.entries(prompts.MODES).map(([key, mode]) => `  ${key}: ${json({ label: mode.label, instruction: mode.instruction })},`),
    '};',
    'const P_PRESETS = {',
    ...Object.entries(prompts.webPresets()).map(([key, value]) => `  ${key}: ${json(value)},`),
    '};',
    `const SELF_EDIT = ${json(prompts.SELF_EDIT)};`,
    `const MD_KEEP_CLAUSE = ${json(prompts.MD_KEEP_CLAUSE)};`,
    `const MD_PLAIN_CLAUSE = ${json(prompts.MD_PLAIN_CLAUSE)};`,
    '/* @generated:prompts:end */',
  ];
  return lines.join(newline);
}

function replaceBlock(html, { start, end, block, label }) {
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  if (startAt < 0 || endAt < startAt) {
    throw new Error(`index.html: thiếu marker ${label} — không ghi đè mù`);
  }
  return html.slice(0, startAt) + block + html.slice(endAt + end.length);
}

function buildIndex(html) {
  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  const withCore = replaceBlock(html, {
    start: '/* @generated:core:start',
    end: '/* @generated:core:end */',
    block: webCoreBlock(bundle(), newline),
    label: '@generated:core',
  });
  return replaceBlock(withCore, {
    start: '/* @generated:prompts:start',
    end: '/* @generated:prompts:end */',
    block: webPromptBlock(newline),
    label: '@generated:prompts',
  });
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
  const bundleText = bundle();
  const outputs = [
    [join(EXT_CORE, 'bundle.js'), bundleText],
    [join(EXT_CORE, 'prompts.js'), promptsModule()],
    [INDEX, buildIndex(readFileSync(INDEX, 'utf8'))],
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
