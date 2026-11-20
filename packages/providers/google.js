/**
 * packages/providers/google.js — Google Gemini / Generative Language API.
 *
 * Không giữ state, không đọc localStorage: caller truyền key và base URL.
 * `fetchImpl` cho phép test bằng fetch giả mà không cần API key thật.
 */

import { providerError, ERROR_CODES, redactSecrets } from './errors.js';
import { withTimeout, readJson, validateBaseUrl, DEFAULT_TIMEOUT_MS } from './request.js';

export const GOOGLE_DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const GOOGLE_DEFAULT_MODEL = 'gemini-3.8-flash';
/** 11/2026: gemma-* trả 404 trên v1beta; model 2.5 chỉ còn cho key cũ. */
export const GOOGLE_FALLBACK_MODELS = Object.freeze([
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
]);

const SYSTEM = 'You are a precise line editor. Never invent facts, names, numbers, technologies or URLs. '
  + 'Never delete a list item, a negation, a condition or a citation.';

export function validateConfiguration(cfg = {}) {
  if (!String(cfg.key ?? '').trim()) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Chưa có API key cho Google Gemini.') };
  }
  const base = String(cfg.base || GOOGLE_DEFAULT_BASE).trim();
  const validated = validateBaseUrl(base);
  if (!validated.ok) return validated;
  const model = String(cfg.model || GOOGLE_DEFAULT_MODEL).replace(/^models\//, '');
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(model)) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Tên model không hợp lệ.') };
  }
  return { ok: true, base: base.replace(/\/+$/, ''), model, key: String(cfg.key).trim() };
}

/**
 * @param {{key:string, base?:string, model:string, prompt:string, text:string,
 *   signal?:AbortSignal, timeoutMs?:number, fetchImpl?:Function,
 *   temperature?:number, maxOutputTokens?:number}} options
 * @returns {Promise<{text:string, model:string}>}
 */
export async function generate(options) {
  const check = validateConfiguration(options);
  if (!check.ok) throw check.error;
  const { key, base, model } = check;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw providerError(ERROR_CODES.CONFIG_ERROR, 'Môi trường không có fetch.');
  }
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;

  const json = await withTimeout(async signal => {
    const res = await fetchImpl(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `${options.prompt}\n\n---\n${options.text}` }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.85,
          topP: 0.95,
          maxOutputTokens: options.maxOutputTokens ?? 4096,
        },
      }),
    });
    return readJson(res, { key });
  }, { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options.signal, key });

  if (json?.promptFeedback?.blockReason) {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE,
      `Bị safety filter chặn: ${redactSecrets(json.promptFeedback.blockReason, key)}`);
  }
  const candidate = (json?.candidates || [])[0];
  if (!candidate) throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE, 'Model không trả candidate nào.');
  const parts = candidate?.content?.parts || [];
  const out = parts.map(part => part.text || '').join('').trim();
  if (!out) {
    throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE,
      `Model trả về rỗng (finishReason: ${candidate.finishReason || '?'}).`);
  }
  return { text: out, model };
}

/** Danh sách model khai báo generateContent. */
export async function listModels(options = {}) {
  const check = validateConfiguration({ ...options, model: options.model || GOOGLE_DEFAULT_MODEL });
  if (!check.ok) throw check.error;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const base = String(options.base || GOOGLE_DEFAULT_BASE).replace(/\/+$/, '');
  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/models?pageSize=200`, {
      signal,
      headers: { 'x-goog-api-key': check.key },
    });
    return readJson(res, { key: check.key });
  }, { timeoutMs: options.timeoutMs ?? 20000, signal: options.signal, key: check.key });
  return (json?.models || [])
    .filter(model => (model.supportedGenerationMethods || []).includes('generateContent'))
    .map(model => String(model.name || '').replace(/^models\//, ''))
    .filter(Boolean);
}

