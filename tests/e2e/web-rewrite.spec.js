/**
 * Web E2E — hồi quy A9: bản hiển thị, proposal trong Review và bản được Accept
 * phải là MỘT chuỗi duy nhất (chuỗi đã qua cleaner), không phải raw của model.
 *
 * Chạy index.html thật trên http://127.0.0.1, chặn network bằng route của
 * Playwright, không cần API key thật.
 */
import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = 'Bản\u200b model viết — có "trích dẫn" và  khoảng trắng.';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

let server;
let baseUrl;
let browser;

test.beforeAll(async () => {
  const html = await fs.readFile(path.join(root, 'index.html'));
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
});

test.afterAll(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

test('rewrite: hiển thị = proposal = bản Accept, raw không lọt vào Review', async () => {
  const context = await browser.newContext();
  let calls = 0;
  await context.route('https://generativelanguage.googleapis.com/**', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    calls += 1;
    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: RAW }] } }] }),
    });
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.fill('#src', 'Câu gốc của người dùng.');
  await page.evaluate(() => switchTab('rewrite'));
  await page.selectOption('#apiProvider', 'google');
  await page.fill('#apiModel', 'gemini-3.8-flash');
  await page.fill('#apiKey', 'sk-e2e-fake');
  await page.click('#btnRunRewrite');
  await expect(page.locator('#rewriteOut')).toBeVisible({ timeout: 20_000 });
  expect(calls).toBe(1);

  const shown = (await page.locator('#rewriteOut').textContent()).trim();
  expect(shown).not.toContain('\u200b');
  expect(shown).not.toBe(RAW.trim());

  await page.evaluate(() => switchTab('review'));
  const proposed = (await page.locator('#reviewProposed').textContent()).trim();
  expect(proposed).toBe(shown);

  await page.click('#btnReviewAccept');
  const applied = await page.inputValue('#src');
  expect(applied).toBe(shown);

  // Bản gốc vẫn còn trong lịch sử để khôi phục.
  await page.click('#btnReviewRestore');
  expect(await page.inputValue('#src')).toBe('Câu gốc của người dùng.');
  await context.close();
});
