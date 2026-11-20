import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_CODES, providerError, normalizeError, errorFromStatus, redactSecrets,
} from '../packages/providers/errors.js';
import { RequestRegistry, validateBaseUrl, withTimeout } from '../packages/providers/request.js';
import { generate as rawGenerate } from '../packages/providers/registry.js';
import * as google from '../packages/providers/google.js';
import * as openai from '../packages/providers/openai-compatible.js';

const CFG = { provider: 'google', key: 'test-key-123456789', model: 'gemini-3.8-flash' };

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const googleOk = text => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
const openaiOk = text => ({ choices: [{ message: { content: text } }] });

const call = (opts = {}) => rawGenerate(CFG, { text: 'hello', prompt: 'p', retryDelayMs: 0, ...opts });

test('generate thành công trả text và model', async () => {
  const result = await call({ fetchImpl: async () => jsonResponse(googleOk('xin chào')) });
  assert.equal(result.text, 'xin chào');
  assert.equal(result.provider, 'google');
  assert.equal(result.schemaVersion, '1.0');
  assert.equal(result.model, 'gemini-3.8-flash');
});

test('thiếu key là CONFIG_ERROR, không gọi mạng', async () => {
  let called = 0;
  await assert.rejects(
    rawGenerate({ provider: 'google', key: '' }, { text: 'x', prompt: 'p', fetchImpl: async () => { called += 1; return jsonResponse(googleOk('x')); } }),
    error => error.code === ERROR_CODES.CONFIG_ERROR,
  );
  assert.equal(called, 0);
});

test('HTTP 401/403 → PROVIDER_AUTH_ERROR, không thử model khác', async () => {
  let calls = 0;
  for (const status of [401, 403]) {
    calls = 0;
    await assert.rejects(
      call({ fetchImpl: async () => { calls += 1; return jsonResponse({ error: 'bad key' }, status); } }),
      error => error.code === ERROR_CODES.PROVIDER_AUTH_ERROR && error.status === status,
    );
    assert.equal(calls, 1);
  }
});

test('HTTP 404 → đổi model fallback và thành công', async () => {
  const models = [];
  const result = await call({
    fetchImpl: async url => {
      models.push(String(url).match(/models\/([^:]+):/)[1]);
      return String(url).includes('gemini-3.8-flash')
        ? jsonResponse({ error: 'not found' }, 404)
        : jsonResponse(googleOk('ok'));
    },
  });
  assert.equal(result.text, 'ok');
  assert.deepEqual(models.slice(0, 2), ['gemini-3.8-flash', 'gemini-flash-latest']);
  assert.equal(result.model, 'gemini-flash-latest');
});

test('HTTP 429 → PROVIDER_RATE_LIMIT, không thử tiếp', async () => {
  await assert.rejects(
    call({ fetchImpl: async () => jsonResponse({ error: 'quota' }, 429) }),
    error => error.code === ERROR_CODES.PROVIDER_RATE_LIMIT,
  );
});

test('HTTP 500/503 → thử lại một lần rồi PROVIDER_UNAVAILABLE', async () => {
  let calls = 0;
  await assert.rejects(
    call({ fetchImpl: async () => { calls += 1; return jsonResponse({ error: 'down' }, 503); } }),
    error => error.code === ERROR_CODES.PROVIDER_UNAVAILABLE,
  );
  assert.ok(calls >= 2, 'phải thử lại ít nhất một lần');
});

test('503 rồi 200 thì thành công sau khi thử lại', async () => {
  let calls = 0;
  const result = await call({
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? jsonResponse({ error: 'busy' }, 503) : jsonResponse(googleOk('đã xong'));
    },
  });
  assert.equal(result.text, 'đã xong');
  assert.equal(calls, 2);
});

test('JSON hỏng → PROVIDER_BAD_RESPONSE', async () => {
  await assert.rejects(
    call({ fetchImpl: async () => new Response('not json', { status: 200 }) }),
    error => error.code === ERROR_CODES.PROVIDER_BAD_RESPONSE,
  );
});

test('response rỗng → PROVIDER_EMPTY_RESPONSE', async () => {
  await assert.rejects(
    call({ fetchImpl: async () => jsonResponse({ candidates: [{ content: { parts: [] } }] }) }),
    error => error.code === ERROR_CODES.PROVIDER_EMPTY_RESPONSE,
  );
});

test('lỗi mạng → NETWORK_ERROR', async () => {
  await assert.rejects(
    call({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }),
    error => error.code === ERROR_CODES.NETWORK_ERROR,
  );
});

test('timeout → PROVIDER_TIMEOUT (khác huỷ)', async () => {
  const hanging = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(
    call({ fetchImpl: hanging, timeoutMs: 20 }),
    error => error.code === ERROR_CODES.PROVIDER_TIMEOUT,
  );
});

test('người dùng huỷ → CANCELLED, không phải timeout', async () => {
  const controller = new AbortController();
  const hanging = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(
    call({ fetchImpl: hanging, timeoutMs: 5000, signal: controller.signal }),
    error => error.code === ERROR_CODES.CANCELLED,
  );
});

test('OpenAI-compatible dùng /chat/completions và trả nội dung', async () => {
  let seenUrl = '';
  const result = await rawGenerate(
    { provider: 'openai', key: 'sk-test-123456', model: 'gpt-4o-mini' },
    {
      text: 'x', prompt: 'p',
      fetchImpl: async url => { seenUrl = String(url); return jsonResponse(openaiOk('kết quả')); },
    },
  );
  assert.match(seenUrl, /\/chat\/completions$/);
  assert.equal(result.text, 'kết quả');
});

test('model không hợp lệ trong config bị từ chối', () => {
  const check = google.validateConfiguration({ key: 'k-12345678', model: 'bad model with spaces' });
  assert.equal(check.ok, false);
  assert.equal(check.error.code, ERROR_CODES.CONFIG_ERROR);
});

test('Base URL phải https, chỉ cho phép loopback http', () => {
  assert.equal(validateBaseUrl('https://api.example.com/v1').ok, true);
  assert.equal(validateBaseUrl('http://localhost:11434/v1').ok, true);
  assert.equal(validateBaseUrl('http://evil.example.com/v1').ok, false);
  assert.equal(validateBaseUrl('not a url').ok, false);
});

test('key không bao giờ xuất hiện trong message lỗi', async () => {
  const key = 'AIzaSECRETKEY1234567890';
  try {
    await rawGenerate({ provider: 'google', key, model: 'gemini-3.8-flash' }, {
      text: 'x', prompt: 'p',
      fetchImpl: async () => jsonResponse({ error: `invalid key ${key}` }, 401),
    });
    assert.fail('phải ném lỗi');
  } catch (error) {
    assert.ok(!error.message.includes(key), 'message làm lộ key');
  }
  assert.ok(!redactSecrets(`Authorization: Bearer ${key}`).includes(key));
});

test('RequestRegistry chống gửi trùng và huỷ đúng request', () => {
  const registry = new RequestRegistry();
  const first = registry.start('req_1');
  assert.ok(first && first.signal);
  assert.equal(registry.start('req_1'), null, 'không cho trùng id');
  assert.equal(registry.isRunning('req_1'), true);
  let aborted = false;
  first.signal.addEventListener('abort', () => { aborted = true; });
  assert.equal(registry.cancel('req_1'), true);
  assert.equal(aborted, true);
  assert.equal(registry.isRunning('req_1'), false);
  assert.equal(registry.cancel('req_1'), false);
});

test('errorFromStatus map đủ mã', () => {
  assert.equal(errorFromStatus(401, '').code, ERROR_CODES.PROVIDER_AUTH_ERROR);
  assert.equal(errorFromStatus(404, '').code, ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE);
  assert.equal(errorFromStatus(429, '').code, ERROR_CODES.PROVIDER_RATE_LIMIT);
  assert.equal(errorFromStatus(400, '').code, ERROR_CODES.VALIDATION_ERROR);
  assert.equal(errorFromStatus(500, '').code, ERROR_CODES.PROVIDER_UNAVAILABLE);
  assert.equal(errorFromStatus(418, '').code, ERROR_CODES.PROVIDER_BAD_RESPONSE);
});

test('normalizeError giữ mã đã chuẩn hoá và không bọc lại', () => {
  const original = providerError(ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE, 'x');
  assert.equal(normalizeError(original), original);
});

test('withTimeout trả kết quả bình thường khi kịp', async () => {
  const value = await withTimeout(async () => 'ok', { timeoutMs: 100 });
  assert.equal(value, 'ok');
});
