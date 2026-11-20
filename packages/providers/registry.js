/**
 * packages/providers/registry.js — một API duy nhất cho Web và Extension.
 *
 * `generate()` chuẩn hoá: chọn provider, tự đổi model khi 404, thử lại một lần
 * khi 5xx, và luôn trả cùng shape. Caller không cần biết provider nào.
 */

import {
  generate as googleGenerate, listModels as googleListModels,
  validateConfiguration as googleValidate, GOOGLE_FALLBACK_MODELS,
} from './google.js';
import {
  generate as openaiGenerate, listModels as openaiListModels,
  validateConfiguration as openaiValidate,
} from './openai-compatible.js';
import { providerError, ERROR_CODES, normalizeError } from './errors.js';
import { sleep } from './request.js';

export const SCHEMA_VERSION = '1.0';

const MODULES = Object.freeze({
  google: { generate: googleGenerate, listModels: googleListModels, validateConfiguration: googleValidate },
  openai: { generate: openaiGenerate, listModels: openaiListModels, validateConfiguration: openaiValidate },
});

export function resolveProvider(name) {
  const key = name === 'openai' || name === 'openai-compatible' ? 'openai' : 'google';
  return { name: key, module: MODULES[key] };
}

/** @returns {{ok:true, provider:string, base:string, model:string, key:string}|{ok:false, error:Error}} */
export function validateConfiguration(cfg = {}) {
  const { name, module } = resolveProvider(cfg.provider);
  const check = module.validateConfiguration(cfg);
  if (!check.ok) return check;
  return { ...check, provider: name };
}

export async function listModels(cfg = {}, options = {}) {
  const { module } = resolveProvider(cfg.provider);
  const models = await module.listModels({ ...cfg, ...options });
  return [...new Set(models)].sort();
}

/**
 * Sinh văn bản.
 * @param {object} cfg {provider, key, base, model}
 * @param {{text:string, prompt:string, signal?:AbortSignal, timeoutMs?:number,
 *   fetchImpl?:Function, retryDelayMs?:number, requestId?:string, onModelSwitch?:Function}} options
 * @returns {Promise<{text:string, model:string, provider:string, requestId:string|null, schemaVersion:string}>}
 */
export async function generate(cfg = {}, options = {}) {
  const check = validateConfiguration(cfg);
  if (!check.ok) throw check.error;
  const { name, module } = resolveProvider(check.provider);
  const retryDelayMs = options.retryDelayMs ?? 1800;
  const requestId = options.requestId ?? null;

  if (name !== 'google') {
    const result = await module.generate({
      ...cfg,
      key: check.key,
      base: check.base,
      model: check.model,
      prompt: options.prompt,
      text: options.text,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
    });
    return { ...result, provider: name, requestId, schemaVersion: SCHEMA_VERSION };
  }

  const models = [check.model, ...GOOGLE_FALLBACK_MODELS]
    .filter((model, index, all) => model && all.indexOf(model) === index);
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        if (model !== check.model && typeof options.onModelSwitch === 'function') {
          options.onModelSwitch(model, check.model);
        }
        const result = await module.generate({
          ...cfg,
          key: check.key,
          base: check.base,
          model,
          prompt: options.prompt,
          text: options.text,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          fetchImpl: options.fetchImpl,
        });
        return { ...result, provider: name, requestId, schemaVersion: SCHEMA_VERSION };
      } catch (error) {
        const normalized = normalizeError(error, { timeoutMs: options.timeoutMs, key: check.key });
        lastError = normalized;
        // Huỷ và hết quota không nên thử model khác: người dùng cần biết ngay.
        if (normalized.code === ERROR_CODES.CANCELLED
          || normalized.code === ERROR_CODES.PROVIDER_AUTH_ERROR
          || normalized.code === ERROR_CODES.PROVIDER_RATE_LIMIT
          || normalized.code === ERROR_CODES.PROVIDER_TIMEOUT) {
          throw normalized;
        }
        if (normalized.code === ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE) break; // đổi model
        if (normalized.code === ERROR_CODES.PROVIDER_UNAVAILABLE && attempt === 0) {
          if (retryDelayMs > 0) await sleep(retryDelayMs);
          continue;
        }
        if (normalized.code === ERROR_CODES.VALIDATION_ERROR) throw normalized;
        if (normalized.code === ERROR_CODES.NETWORK_ERROR) throw normalized;
        break;
      }
    }
  }

  const tried = models.length > 1 ? ` (đã thử: ${models.join(', ')})` : '';
  throw providerError(
    lastError?.code || ERROR_CODES.PROVIDER_UNAVAILABLE,
    `${lastError?.message || 'không gọi được model nào'}${tried}`,
    { retryable: !!lastError?.retryable },
  );
}

