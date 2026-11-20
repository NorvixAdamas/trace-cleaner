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
    const imports = [...code.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map(m => m[1]);
    for (const relative of imports) {
      if (!existsSync(join(EXT, relative))) errors.push(`import không tồn tại: ${relative}`);
    }
  }
}

for (const script of manifest.content_scripts || []) {
  for (const file of script.js || []) {
    if (!existsSync(join(EXT, file))) errors.push(`content script không tồn tại: ${file}`);
  }
  if ((script.matches || []).some(m => m === '<all_urls>')) {
    warnings.push('content script chạy trên mọi trang — cần ghi rõ lý do trong docs/SECURITY.md');
  }
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
