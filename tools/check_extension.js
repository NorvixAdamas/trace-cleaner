#!/usr/bin/env node
/**
 * tools/check_extension.js — kiểm tra tĩnh manifest + file extension.
 * Chạy: node tools/check_extension.js
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(ROOT, 'extension');
const errors = [];
const warnings = [];

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(EXT, 'manifest.json'), 'utf8'));
} catch (error) {
  console.error('manifest.json không đọc được:', error.message);
  process.exit(1);
}

if (manifest.manifest_version !== 3) errors.push('manifest_version phải là 3');

const allowedPermissions = new Set(['storage', 'activeTab', 'scripting', 'sidePanel']);
for (const permission of manifest.permissions || []) {
  if (!allowedPermissions.has(permission)) errors.push(`permission lạ: ${permission}`);
}
if ((manifest.permissions || []).includes('tabs')) errors.push('permission "tabs" không cần thiết');

for (const host of manifest.host_permissions || []) {
  if (host === 'http://*/*' || host === 'https://*/*' || host === '<all_urls>') {
    errors.push(`host_permission quá rộng: ${host}`);
  }
}

if (manifest.background && manifest.background.type === 'module') {
  const entry = manifest.background.service_worker;
  if (!entry || !existsSync(join(EXT, entry))) errors.push(`thiếu service worker: ${entry}`);
  else {
    const code = readFileSync(join(EXT, entry), 'utf8');
    const imports = [
      ...code.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g),
      ...code.matchAll(/^\s*import\s+['"](\.\/[^'"]+)['"]/gm),
    ].map(m => m[1]);
    for (const relative of imports) {
      if (!existsSync(join(EXT, relative))) errors.push(`import không tồn tại: ${relative}`);
    }
  }
}

for (const script of manifest.content_scripts || []) {
  const files = script.js || [];
  for (const file of files) {
    if (!existsSync(join(EXT, file))) errors.push(`content script không tồn tại: ${file}`);
  }
  // Sidebar chỉ là UI adapter: core dùng chung phải được nạp trước nó.
  const coreAt = files.indexOf('core/bundle.js');
  const sidebarAt = files.indexOf('sidebar.js');
  if (sidebarAt >= 0 && (coreAt < 0 || coreAt > sidebarAt)) {
    errors.push('content script phải nạp core/bundle.js trước sidebar.js');
  }
  const matches = script.matches || [];
  if (matches.some(m => m === '<all_urls>' || m === 'http://*/*' || m === 'https://*/*')) {
    warnings.push('content script chạy trên mọi trang http(s) — cần ghi rõ lý do trong docs/SECURITY.md');
  }
  if (matches.some(m => m === 'file:///*' || m === 'ftp://*/*')) {
    errors.push('content script không được chạy trên scheme ngoài http(s)');
  }
}

try {
  const panel = readFileSync(join(EXT, 'panel.html'), 'utf8');
  const coreScript = panel.indexOf('src="core/bundle.js"');
  const sidebarScript = panel.indexOf('src="sidebar.js"');
  if (coreScript < 0 || sidebarScript < 0 || coreScript > sidebarScript) {
    errors.push('panel.html phải nạp core/bundle.js trước sidebar.js');
  }
} catch {
  errors.push('thiếu panel.html');
}

for (const required of ['core/bundle.js', 'core/prompts.js', 'core/preservation.js']) {
  if (!existsSync(join(EXT, required))) errors.push(`thiếu artifact sinh tự động: ${required}`);
}

for (const [size, path] of Object.entries(manifest.icons || {})) {
  if (!existsSync(join(EXT, path))) errors.push(`thiếu icon ${size}: ${path}`);
}

for (const warning of warnings) console.warn('WARN', warning);
if (errors.length) {
  for (const error of errors) console.error('FAIL', error);
  process.exit(1);
}
console.log(`manifest OK · v${manifest.version} · ${(manifest.permissions || []).length} permission`);
