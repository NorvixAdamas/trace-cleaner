/**
 * packages/providers/errors.js — hợp đồng lỗi duy nhất cho mọi bề mặt.
 *
 * Web và Extension phải trả cùng mã cho cùng một kiểu hỏng. Không nơi nào được
 * ném chuỗi lỗi thô của provider ra UI, và không bao giờ đưa API key vào message.
 */

export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_MODEL_UNAVAILABLE: 'PROVIDER_MODEL_UNAVAILABLE',
  PROVIDER_EMPTY_RESPONSE: 'PROVIDER_EMPTY_RESPONSE',
  PROVIDER_BAD_RESPONSE: 'PROVIDER_BAD_RESPONSE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CANCELLED: 'CANCELLED',
  STALE_DOCUMENT_REVISION: 'STALE_DOCUMENT_REVISION',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  PARSER_ERROR: 'PARSER_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

export const RETRYABLE = Object.freeze(new Set([
  ERROR_CODES.PROVIDER_TIMEOUT,
  ERROR_CODES.PROVIDER_UNAVAILABLE,
  ERROR_CODES.PROVIDER_RATE_LIMIT,
  ERROR_CODES.NETWORK_ERROR,
]));

/**
 * @param {string} code mã trong ERROR_CODES
 * @param {string} message câu cho người dùng, không chứa key
 * @param {{retryable?:boolean, status?:number|null, model?:string|null}} [extra]
 */
export function providerError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  error.retryable = extra.retryable ?? RETRYABLE.has(code);
  if (extra.status != null) error.status = extra.status;
  if (extra.model) error.model = extra.model;
  return error;
}

/** Che key nếu provider lỡ nhét vào body lỗi. */
export function redactSecrets(text, key) {
  let out = String(text ?? '');
  if (key && typeof key === 'string' && key.length >= 8) {
    out = out.split(key).join('[redacted-key]');
  }
  return out
    .replace(/\b(AIza|AQ\.|sk-)[A-Za-z0-9_\-]{6,}/g, '[redacted-key]')
    .replace(/("?(?:api[_-]?key|authorization|x-goog-api-key)"?\s*[:=]\s*)"?[^",\s}]{8,}"?/gi, '$1"[redacted-key]"');
}

/** HTTP status → mã lỗi ổn định. */
export function errorFromStatus(status, body, key) {
  const detail = redactSecrets(String(body ?? ''), key).slice(0, 180);
  if (status === 401 || status === 403) {
    return providerError(ERROR_CODES.PROVIDER_AUTH_ERROR, `HTTP ${status} — API key sai hoặc không có quyền. ${detail}`.trim(), { status });
  }
  if (status === 429) {
    return providerError(ERROR_CODES.PROVIDER_RATE_LIMIT, `HTTP 429 — hết lượt gọi hoặc bị giới hạn tốc độ. ${detail}`.trim(), { status, retryable: true });
  }
  if (status === 404) {
    return providerError(ERROR_CODES.PROVIDER_MODEL_UNAVAILABLE, `HTTP 404 — model không tồn tại hoặc không phục vụ generateContent. ${detail}`.trim(), { status });
  }
  if (status === 400 || status === 422) {
    return providerError(ERROR_CODES.VALIDATION_ERROR, `HTTP ${status} — request bị từ chối. ${detail}`.trim(), { status });
  }
  if (status >= 500) {
    return providerError(ERROR_CODES.PROVIDER_UNAVAILABLE, `HTTP ${status} — nhà cung cấp đang lỗi. ${detail}`.trim(), { status, retryable: true });
  }
  return providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, `HTTP ${status} — ${detail}`.trim(), { status });
}

/**
 * Chuẩn hoá bất kỳ lỗi nào thành mã ổn định.
 * @param {unknown} error
 * @param {{timeoutMs?:number, key?:string, cancelled?:boolean}} [context]
 */
export function normalizeError(error, context = {}) {
  if (!error) return providerError(ERROR_CODES.INTERNAL_ERROR, 'lỗi không xác định');
  if (error.code && ERROR_CODES[error.code]) return error;
  const timeoutMs = context.timeoutMs ?? 60000;
  if (error.name === 'AbortError' || /aborted/i.test(String(error.message || ''))) {
    return context.cancelled
      ? providerError(ERROR_CODES.CANCELLED, 'Bạn đã huỷ yêu cầu.', { retryable: false })
      : providerError(ERROR_CODES.PROVIDER_TIMEOUT, `Quá ${Math.round(timeoutMs / 1000)}s không có phản hồi.`, { retryable: true });
  }
  const message = redactSecrets(String(error.message || error), context.key);
  if (/Failed to fetch|NetworkError|net::ERR|ENOTFOUND|ECONNREFUSED|CORS/i.test(message)) {
    return providerError(ERROR_CODES.NETWORK_ERROR, 'Không kết nối được tới API — kiểm tra mạng, Base URL hoặc CORS.', { retryable: true });
  }
  if (/JSON/i.test(message)) return providerError(ERROR_CODES.PROVIDER_BAD_RESPONSE, 'Phản hồi không phải JSON hợp lệ.');
  return providerError(ERROR_CODES.INTERNAL_ERROR, message);
}

/** Kết quả lỗi để trả qua message passing / UI (không chứa stack, không chứa key). */
export function errorPayload(error, context) {
  const normalized = normalizeError(error, context);
  return { error: normalized.message, code: normalized.code, retryable: !!normalized.retryable };
}
