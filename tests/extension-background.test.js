/**
 * Service worker thật (extension/background.js) được chạy trong vm với chrome.*
 * giả và bundle canonical thật: kiểm tra nó dùng TraceProviders, trả cùng mã lỗi
 * với web, huỷ được request và chặn gửi trùng.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = readFileSync(join(ROOT, 'extension/core/bundle.js'), 'utf8');
const prompts = readFileSync(join(ROOT, 'extension/core/prompts.js'), 'utf8');
const rawWorker = readFileSync(join(ROOT, 'extension/background.js'), 'utf8');
// vm chạy script thuần: bỏ các câu import (đã cấp sẵn binding bên dưới), nhưng
// phần thân listener/registry vẫn là code thật của service worker.
const workerSource = rawWorker
  .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
  .replace(/^export\s+/gm, '');

function loadWorker({ fetchImpl } = {}) {
  const listeners = [];
  const replies = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    AbortController,
    TextEncoder,
    TextDecoder,
    Response,
    Headers,
    JSON,
    Math,
    Date,
    fetch: fetchImpl || (async () => new Response('{}', { status: 500 })),
    chrome: {
      runtime: {
        onInstalled: { addListener() {} },
        onStartup: { addListener() {} },
        onSuspend: { addListener() {} },
        onMessage: { addListener(fn) { listeners.push(fn); } },
      },
      sidePanel: { setPanelBehavior: () => Promise.resolve(), open: () => Promise.resolve() },
      action: { onClicked: { addListener() {} } },
      tabs: { create() {}, sendMessage() {} },
      scripting: { executeScript() {} },
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(bundle, context);
  vm.runInContext(prompts.replace(/^export\s+/gm, ''), context);
  vm.runInContext(workerSource, context, { filename: 'background.js' });

  const send = message => new Promise(resolve => {
    const keepAlive = listeners[0](message, {}, resolve);
    if (keepAlive !== true && typeof keepAlive !== 'undefined') { /* sync reply */ }
  });
  return { context, send, replies };
}

const CFG = { provider: 'google', key: 'ext-key-12345678', model: 'gemini-3.8-flash', markdown: true, mode: 'general' };
const okBody = { candidates: [{ content: { parts: [{ text: 'bản viết lại' }] } }] };

test('background dùng bundle canonical, không tự định nghĩa provider', () => {
  assert.match(rawWorker, /import "\.\/core\/bundle\.js"/);
  assert.match(rawWorker, /TraceProviders|providers\.generate/);
  assert.doesNotMatch(rawWorker, /function geminiCall|function openaiCall|GOOGLE_FALLBACK/);
  assert.match(rawWorker, /RequestRegistry/);
  assert.match(rawWorker, /msg\.type === "cancel"/);
});

test('humanize trả text + preservation và requestId', async () => {
  const worker = loadWorker({ fetchImpl: async () => new Response(JSON.stringify(okBody), { status: 200 }) });
  const reply = await worker.send({ type: 'humanize', text: 'Hello world.', cfg: CFG, requestId: 'req_a' });
  assert.equal(reply.text, 'bản viết lại');
  assert.equal(reply.requestId, 'req_a');
  assert.equal(reply.preservation.failed, false);
  assert.equal(reply.preservation.issues.length, 0);
  assert.equal(reply.promptVersion, '2.3.0');
});

test('key sai → cùng mã PROVIDER_AUTH_ERROR như web', async () => {
  const worker = loadWorker({ fetchImpl: async () => new Response('{"error":"bad"}', { status: 401 }) });
  const reply = await worker.send({ type: 'humanize', text: 'Hello.', cfg: CFG, requestId: 'req_b' });
  assert.equal(reply.code, 'PROVIDER_AUTH_ERROR');
  assert.ok(!String(reply.error).includes(CFG.key));
});

test('văn bản rỗng → VALIDATION_ERROR, không gọi mạng', async () => {
  let calls = 0;
  const worker = loadWorker({ fetchImpl: async () => { calls += 1; return new Response('{}'); } });
  const reply = await worker.send({ type: 'humanize', text: '   ', cfg: CFG, requestId: 'req_c' });
  assert.equal(reply.code, 'VALIDATION_ERROR');
  assert.equal(calls, 0);
});

test('huỷ request đang chạy trả CANCELLED và cancel báo ok', async () => {
  let aborted = false;
  const worker = loadWorker({
    fetchImpl: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted = true; reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
    }),
  });
  const pending = worker.send({ type: 'humanize', text: 'Hello.', cfg: CFG, requestId: 'req_d' });
  await new Promise(r => setTimeout(r, 20));
  const cancelReply = await worker.send({ type: 'cancel', requestId: 'req_d' });
  assert.equal(cancelReply.ok, true);
  const reply = await pending;
  assert.equal(reply.code, 'CANCELLED');
  assert.equal(aborted, true);
});

test('gửi trùng requestId bị từ chối thay vì chạy song song', async () => {
  const worker = loadWorker({
    fetchImpl: (url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }),
  });
  const first = worker.send({ type: 'humanize', text: 'Hello.', cfg: CFG, requestId: 'req_dup' });
  await new Promise(r => setTimeout(r, 10));
  const second = await worker.send({ type: 'humanize', text: 'Hello again.', cfg: CFG, requestId: 'req_dup' });
  assert.match(second.error, /đang chạy/);
  await worker.send({ type: 'cancel', requestId: 'req_dup' });
  await first;
});

test('ping báo engine version và số request đang chạy', async () => {
  const worker = loadWorker();
  const reply = await worker.send({ type: 'ping' });
  assert.equal(reply.ok, true);
  assert.equal(reply.engineVersion, '2.3');
  assert.equal(reply.running, 0);
  assert.ok(reply.promptVersion);
});

test('sidebar có nút huỷ và gate dán khi bảo toàn thất bại', () => {
  const sidebar = readFileSync(join(ROOT, 'extension/sidebar.js'), 'utf8');
  assert.match(sidebar, /id="btnCancel"/);
  assert.match(sidebar, /hooks\.cancel/);
  assert.match(sidebar, /severity === "failed"/);
  assert.match(sidebar, /requestId: currentRequestId/);
});

test('content.js và panel.js chuyển requestId + cancel xuống background', () => {
  for (const file of ['extension/content.js', 'extension/panel.js']) {
    const code = readFileSync(join(ROOT, file), 'utf8');
    assert.match(code, /requestId: \(opts && opts\.requestId\)/, file);
    assert.match(code, /type: "cancel"/, file);
  }
});
