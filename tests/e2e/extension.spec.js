/**
 * Chrome Extension E2E thật (Playwright + Chromium, load unpacked).
 *
 * Phạm vi: panel.html như một extension page thật, service worker thật,
 * content script thật trên trang http(s), storage thật (session vs local),
 * request provider thật qua background (route của Playwright đóng vai API).
 *
 * KHÔNG test: bong bóng Side Panel của Chrome (không thao tác được bằng
 * Playwright) — panel.html dùng đúng sidebar.js nên phần UI/logic được kiểm,
 * còn việc Chrome mở panel từ toolbar là hành vi của trình duyệt.
 */
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const extensionPath = path.join(root, 'extension');

let context;
let extensionId;
let panel;

async function storage(area, key) {
  return panel.evaluate(([areaName, k]) => new Promise(resolve => {
    chrome.storage[areaName].get(k, value => resolve(value[k] ?? null));
  }), [area, key]);
}

async function configure({ base = 'https://api.openai.com/v1', model = 'gpt-4o-mini', key = 'sk-e2e', remember = false } = {}) {
  await panel.evaluate(() => { const box = document.querySelector('#cfgBox'); if (box) box.open = true; });
  await panel.selectOption('#cProvider', 'openai');
  await panel.fill('#cBase', base);
  await panel.fill('#cModel', model);
  await panel.fill('#cKey', key);
  const box = panel.locator('#cRemember');
  if (await box.isChecked() !== remember) await box.click();
  await panel.click('#btnSaveCfg');
}

test.beforeAll(async () => {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trace-e2e-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
    ],
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
  extensionId = new URL(worker.url()).host;
  panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/panel.html`);
  await expect(panel.locator('#wrap')).toBeVisible();
});

test.afterAll(async () => {
  if (context) await context.close();
});

test('panel.html render sidebar thật và trả lời ping từ bundle', async () => {
  const info = await panel.evaluate(() => new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'ping' }, resolve);
  }));
  expect(info.ok).toBe(true);
  expect(info.engineVersion).toBe('2.3');
  expect(info.promptVersion).toBe('2.3.0');
  const version = await panel.evaluate(() => chrome.runtime.getManifest().version);
  expect(version).toBe('2.3.0');
});

test('API key: mặc định chỉ ở session, chỉ vào local khi tick ghi nhớ, xoá được', async () => {
  await configure({ remember: false });
  const local = await storage('local', 'traceCfg');
  const session = await storage('session', 'traceCfg');
  expect(local && local.key).toBeFalsy();
  expect(session && session.key).toBe('sk-e2e');

  await configure({ remember: true });
  const localRemembered = await storage('local', 'traceCfg');
  expect(localRemembered.key).toBe('sk-e2e');
  expect(localRemembered.remember).toBe(true);

  // Reload panel: key được nạp lại từ local vì đã opt-in.
  await panel.reload();
  await panel.evaluate(() => { const box = document.querySelector('#cfgBox'); if (box) box.open = true; });
  await expect(panel.locator('#cKey')).toHaveValue('sk-e2e');
  await expect(panel.locator('#cRemember')).toBeChecked();

  await panel.click('#btnForgetKey');
  const localCleared = await storage('local', 'traceCfg');
  const sessionCleared = await storage('session', 'traceCfg');
  expect(localCleared.key).toBeFalsy();
  expect(localCleared.remember).toBe(false);
  expect(sessionCleared && sessionCleared.key ? sessionCleared.key : '').toBe('');
  await expect(panel.locator('#cKey')).toHaveValue('');
});

test('provider thật qua background: huỷ giữa request thì abort và không ghi đè kết quả', async () => {
  await configure({ remember: false });
  let calls = 0;
  let aborted = false;
  let failedText = '';
  // Tín hiệu abort ở tầng trình duyệt: request tới provider bị huỷ thật.
  context.on('requestfailed', request => {
    if (request.url().includes('/chat/completions')) failedText = (request.failure() && request.failure().errorText) || '';
  });
  await context.route('https://api.openai.com/v1/chat/completions', async route => {
    calls += 1;
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'Bản viết lại từ provider giả.' } }] }),
      });
    } catch {
      // Browser đã abort fetch ⇒ Playwright không fulfill được request nữa.
      aborted = true;
    }
  });

  await panel.uncheck('#cClean');
  await panel.check('#cHuman');
  await panel.fill('#input', 'Câu gốc cần viết lại.');
  await panel.click('#btnRun');
  await expect(panel.locator('#btnCancel')).toBeEnabled();
  await panel.click('#btnCancel');
  await expect(panel.locator('#status')).toContainText('Đã huỷ');

  // Quá thời điểm route lẽ ra trả kết quả: output vẫn rỗng, không có "kết quả ma".
  await panel.waitForTimeout(2200);
  await expect(panel.locator('#output')).toHaveValue('');
  expect(calls).toBe(1);
  expect(String(failedText).toLowerCase()).toContain('abort');
  void aborted;

  // Lần chạy không huỷ: kết quả hiển thị đúng contract.
  await panel.click('#btnRun');
  await expect(panel.locator('#output')).toHaveValue('Bản viết lại từ provider giả.', { timeout: 15000 });
  await expect(panel.locator('#status')).toContainText('Xong');
});

test('provider tuỳ biến chưa cấp quyền bị background từ chối (CONFIG_ERROR)', async () => {
  const reply = await panel.evaluate(() => new Promise(resolve => {
    chrome.runtime.sendMessage({
      type: 'humanize',
      requestId: 'e2e-unpermitted',
      text: 'kiểm tra quyền',
      cfg: { provider: 'openai', base: 'https://unpermitted.example/v1', model: 'm', key: 'k' },
    }, resolve);
  }));
  expect(reply.code).toBe('CONFIG_ERROR');
  expect(reply.error).toContain('unpermitted.example');
});

test('floating sidebar: inject theo user gesture, lấy chữ trong ô, đóng/mở lại', async () => {
  await context.route('https://example.test/', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><title>E2E page</title><textarea id="editor">Nội dung trong ô của trang.</textarea><button id="native">Nút của trang</button>',
  }));
  const page = await context.newPage();
  await page.goto('https://example.test/');
  await expect(page.locator('#editor')).toHaveValue('Nội dung trong ô của trang.');

  await page.locator('#editor').focus();
  await page.keyboard.press('Alt+Shift+S');
  const host = page.locator('#trace-cleaner-host');
  await expect(host).toHaveCount(1);
  const wrap = host.locator('.wrap');
  await expect(wrap).toHaveClass(/on/);

  await host.locator('#btnGrab').click();
  await expect(host.locator('#input')).toHaveValue('Nội dung trong ô của trang.');

  await host.locator('#btnClose').click();
  await expect(wrap).not.toHaveClass(/on/);
  await page.keyboard.press('Alt+Shift+S');
  await expect(wrap).toHaveClass(/on/);

  // Không can thiệp nút của trang.
  let clicked = 0;
  await page.exposeFunction('__nativeClick', () => { clicked += 1; });
  await page.evaluate(() => document.getElementById('native').addEventListener('click', () => window.__nativeClick()));
  await page.click('#native');
  expect(clicked).toBe(1);

  await page.close();
});
