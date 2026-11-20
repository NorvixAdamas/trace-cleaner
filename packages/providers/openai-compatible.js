/**
 * packages/providers/openai-compatible.js — /chat/completions.
 *
 * Dùng được cho OpenAI, OpenRouter, Groq, Ollama… miễn là tương thích.
 * Base URL vẫn phải https, trừ loopback khi phát triển (Ollama ở localhost).
 */

import { providerError, ERROR_CODES } from './errors.js';
import { withTimeout, readJson, validateBaseUrl, DEFAULT_TIMEOUT_MS } from './request.js';

export const OPENAI_DEFAULT_BASE = 'https://api.openai.com/v1';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM = 'You are a precise line editor. Never invent facts, names, numbers, technologies or URLs. '
  + 'Never delete a list item, a negation, a condition or a citation.';

export function validateConfiguration(cfg = {}) {
  if (!String(cfg.key ?? '').trim()) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Chưa có API key cho nhà cung cấp này.') };
  }
  const base = String(cfg.base || OPENAI_DEFAULT_BASE).trim();
  const validated = validateBaseUrl(base);
  if (!validated.ok) return validated;
  const model = String(cfg.model || OPENAI_DEFAULT_MODEL).trim();
  if (!model || model.length > 120) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Tên model không hợp lệ.') };
  }
  return { ok: true, base: base.replace(/\/+$/, ''), model, key: String(cfg.key).trim() };
}

export async function generate(options) {
  const check = validateConfiguration(options);
  if (!check.ok) throw check.error;
  const { key, base, model } = check;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw providerError(ERROR_CODES.CONFIG_ERROR, 'Môi trường không có fetch.');
  }

  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.85,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${options.prompt}\n\n---\n${options.text}` },
        ],
      }),
    });
    return readJson(res, { key });
  }, { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal: options.signal, key });

  const content = json?.choices?.[0]?.message?.content;
  const out = typeof content === 'string' ? content.trim() : '';
  if (!out) throw providerError(ERROR_CODES.PROVIDER_EMPTY_RESPONSE, 'Model không trả nội dung.');
  return { text: out.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim(), model };
}

export async function listModels(options = {}) {
  const check = validateConfiguration({ ...options, model: options.model || OPENAI_DEFAULT_MODEL });
  if (!check.ok) throw check.error;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const base = String(options.base || OPENAI_DEFAULT_BASE).replace(/\/+$/, '');
  const json = await withTimeout(async signal => {
    const res = await fetchImpl(`${base}/models`, {
      signal,
      headers: { Authorization: `Bearer ${check.key}` },
    });
    return readJson(res, { key: check.key });
  }, { timeoutMs: options.timeoutMs ?? 20000, signal: options.signal, key: check.key });
  return (json?.data || []).map(model => model.id).filter(Boolean);
}
