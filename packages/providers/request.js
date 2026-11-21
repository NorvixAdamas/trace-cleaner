/**
 * packages/providers/request.js — timeout, huỷ, đọc JSON, chống request trùng.
 *
 * Timeout KHÁC huỷ: timeout do đồng hồ, huỷ do người dùng. Hai nguyên nhân phải
 * ra hai mã lỗi khác nhau, nếu không UI không thể nói đúng chuyện gì xảy ra.
 */

import { providerError, errorFromStatus, ERROR_CODES, normalizeError } from './errors.js';

export const DEFAULT_TIMEOUT_MS = 60000;
/** Chỉ cho phép http:// với loopback khi phát triển. */
export const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chạy một tác vụ có signal với timeout + huỷ ngoài.
 * @template T
 * @param {(signal:AbortSignal)=>Promise<T>} run
 * @param {{timeoutMs?:number, signal?:AbortSignal, key?:string}} [options]
 * @returns {Promise<T>}
 */
export async function withTimeout(run, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let cancelled = false;
  let timedOut = false;

  const onExternalAbort = () => { cancelled = true; controller.abort(); };
  if (options.signal) {
    if (options.signal.aborted) {
      throw providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.');
    }
    options.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (cancelled) throw providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.');
    if (timedOut) {
      throw providerError(ERROR_CODES.PROVIDER_TIMEOUT,
        `Quá ${Math.round(timeoutMs / 1000)}s không có phản hồi.`, { retryable: true });
    }
    throw normalizeError(error, { timeoutMs, key: options.key });
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', onExternalAbort);
  }
}

/** Đọc body có giới hạn kích thước, rồi parse JSON. */
export async function readJson(res, { key, maxBytes = 1_000_000 } = {}) {
  const text = await res.text();
  if (text.length > maxBytes) {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi quá lớn để xử lý an toàn.');
  }
  if (!res.ok) throw errorFromStatus(res.status, text, key);
  try {
    return JSON.parse(text);
  } catch {
    throw providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi không phải JSON hợp lệ.');
  }
}

/** Base URL: bắt buộc https, trừ loopback khi phát triển. */
export function validateBaseUrl(base) {
  const value = String(base ?? '').trim();
  if (!value) return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Thiếu Base URL.') };
  let url;
  try { url = new URL(value); } catch {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Base URL không hợp lệ.') };
  }
  if (url.username || url.password) {
    return { ok: false, error: providerError(ERROR_CODES.CONFIG_ERROR, 'Base URL không được chứa thông tin đăng nhập.') };
  }
  if (url.protocol === 'https:') return { ok: true, url };
  if (url.protocol === 'http:' && LOOPBACK.test(value)) return { ok: true, url, insecureLocalhost: true };
  return {
    ok: false,
    error: providerError(ERROR_CODES.CONFIG_ERROR,
      'Base URL phải dùng https:// (chỉ http://localhost được phép khi phát triển).'),
  };
}

/**
 * Sổ request đang chạy: chống gửi trùng, cho phép huỷ đúng request,
 * và đảm bảo phản hồi cũ không ghi đè kết quả mới.
 */
export class RequestRegistry {
  constructor() { this.items = new Map(); }

  /** @returns {{id:string, signal:AbortSignal}|null} null nếu id đã tồn tại */
  start(id) {
    if (this.items.has(id)) return null;
    const controller = new AbortController();
    this.items.set(id, controller);
    return { id, signal: controller.signal };
  }

  isRunning(id) { return this.items.has(id); }

  cancel(id) {
    const controller = this.items.get(id);
    if (!controller) return false;
    controller.abort();
    this.items.delete(id);
    return true;
  }

  finish(id) { this.items.delete(id); }

  /** Huỷ tất cả (dùng khi trang đóng / extension reload). */
  cancelAll() {
    const ids = [...this.items.keys()];
    for (const id of ids) this.cancel(id);
    return ids;
  }

  get size() { return this.items.size; }
}

/** Tạo id request ổn định cho UI. */
export function requestId(prefix = 'req') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

