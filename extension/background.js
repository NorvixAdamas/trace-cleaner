/* Trace Cleaner — service worker (ES module)
   - Mọi request mạng chạy ở đây để content script không bị CSP của trang chặn.
   - Prompt lấy từ packages/writing/prompts.js (bản sinh extension/core/prompts.js).
   - Provider dùng CHUNG packages/providers với web (extension/core/bundle.js),
     nên mã lỗi, timeout, fallback model và cách huỷ giống hệt web app.
   - Request có requestId + registry huỷ được; kết quả cũ không ghi đè kết quả mới. */

import "./core/bundle.js";
import { buildPrompt, PROMPT_VERSION } from "./core/prompts.js";

const APP_URL = "https://norvixadamas.github.io/trace-cleaner/";
const REQUEST_TIMEOUT_MS = 60000;

const providers = globalThis.TraceProviders;
const core = globalThis.TraceCore;
if (!providers || !core) throw new Error("thiếu bundle canonical (extension/core/bundle.js)");

const { ERROR_CODES, providerError, normalizeError, RequestRegistry, requestId: newRequestId } = providers;
const registry = new RequestRegistry();

/* ─────────── mở sidebar ─────────── */

function enablePanelOnClick() {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnClick: true })
        .catch(e => console.warn("[trace] setPanelBehavior:", e && e.message));
    } else {
      console.warn("[trace] chrome.sidePanel không có — thiếu permission sidePanel hoặc Chrome < 114");
    }
  } catch (e) { console.warn("[trace]", e && e.message); }
}

chrome.runtime.onInstalled.addListener(enablePanelOnClick);
chrome.runtime.onStartup.addListener(enablePanelOnClick);
enablePanelOnClick();

chrome.action.onClicked.addListener(tab => {
  // Nếu setPanelBehavior đã bật, Chrome tự mở panel và listener này không chạy.
  if (tab && tab.windowId != null && chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => openFallback(tab));
    return;
  }
  openFallback(tab);
});

function openFallback(tab) {
  const done = () => chrome.tabs.create({ url: APP_URL });
  if (!tab || tab.id == null) return done();
  // trang cũ chưa có content script → chèn đủ core + sidebar rồi mở bản nổi
  try {
    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, files: ["core/bundle.js", "sidebar.js", "content.js"] },
      () => {
        if (chrome.runtime.lastError) return done();
        chrome.tabs.sendMessage(tab.id, { type: "toggle" }, () => {
          if (chrome.runtime.lastError) done();
        });
      },
    );
  } catch { done(); }
}

/* ─────────── sidebar nổi: chỉ chèn sau thao tác người dùng ─────────── */

// Không có content_scripts tĩnh: tab chỉ nhận bundle khi người dùng bấm phím tắt
// hoặc gọi action. content.js tự chống chèn trùng bằng cờ __traceCleanerLoaded.
async function injectFloating(tab) {
  if (!tab || tab.id == null) return { ok: false, error: "không có tab đích" };
  const url = String(tab.url || "");
  if (!/^https?:/i.test(url)) {
    return { ok: false, error: "Chrome không cho chèn script vào trang này." };
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["core/bundle.js", "config.js", "sidebar.js", "content.js"],
    });
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
    return { ok: true };
  } catch (error) {
    const message = (error && error.message) || "không chèn được sidebar";
    console.warn("[trace] inject:", message);
    return { ok: false, error: message };
  }
}

chrome.commands.onCommand.addListener(async command => {
  if (command !== "toggle-floating") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await injectFloating(tab);
  if (!result.ok && tab && tab.id != null) {
    try { await chrome.action.setBadgeText({ tabId: tab.id, text: "!" }); } catch {}
    setTimeout(() => { try { chrome.action.setBadgeText({ tabId: tab.id, text: "" }); } catch {} }, 3000);
  }
});

/* ─────────── prompt ─────────── */

/** Prompt gửi đi: prompt người dùng nếu có, cộng mệnh đề Markdown; ngược lại lấy registry. */
function resolvePrompt(cfg = {}) {
  const markdown = cfg.markdown !== false;
  const custom = String(cfg.prompt || "").trim();
  if (!custom) return buildPrompt(cfg.mode || "general", { markdown });
  // Prompt tự soạn vẫn phải kèm chế độ + ràng buộc Markdown từ registry.
  const full = buildPrompt(cfg.mode || "general", { markdown });
  const tail = full.slice(full.indexOf("## Editing mode:"));
  return `${custom}\n\n${tail}`;
}

/* ─────────── humanize ─────────── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "humanize") {
    const id = typeof msg.requestId === "string" && msg.requestId ? msg.requestId : newRequestId("ext");
    const entry = registry.start(id);
    if (!entry) {
      sendResponse({ error: "yêu cầu trước đang chạy — huỷ rồi thử lại.", code: ERROR_CODES.VALIDATION_ERROR, requestId: id });
      return false;
    }
    humanize(msg.text || "", msg.cfg || {}, { requestId: id, signal: entry.signal })
      .then(result => sendResponse(result))
      .catch(e => {
        const error = normalizeError(e, { timeoutMs: REQUEST_TIMEOUT_MS, key: msg.cfg && msg.cfg.key });
        sendResponse({ error: error.message, code: error.code, retryable: !!error.retryable, requestId: id });
      })
      .finally(() => registry.finish(id));
    return true;
  }

  if (msg.type === "cancel") {
    const ok = registry.cancel(msg.requestId);
    sendResponse({ ok, cancelled: ok, requestId: msg.requestId || null });
    return false;
  }

  if (msg.type === "ping") {
    sendResponse({ ok: true, promptVersion: PROMPT_VERSION, engineVersion: core.__engineVersion, running: registry.size });
    return false;
  }
});

/**
 * Provider OpenAI-compatible tự nhập host: kiểm tra protocol + quyền origin.
 * Manifest chỉ khai optional_host_permissions; quyền thật do người dùng cấp
 * qua chrome.permissions.request ở sidebar (trong user gesture). Thiếu quyền
 * thì báo rõ cách cấp, KHÔNG xin quyền ngầm từ service worker.
 */
async function assertCustomHostAllowed(cfg) {
  if (cfg.provider !== "openai") return;
  const raw = String(cfg.base || "").trim();
  let url;
  try { url = new URL(raw); } catch { throw providerError(ERROR_CODES.CONFIG_ERROR, "Base URL không hợp lệ."); }
  if (url.username || url.password) throw providerError(ERROR_CODES.CONFIG_ERROR, "Base URL không được chứa thông tin đăng nhập.");
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw providerError(ERROR_CODES.CONFIG_ERROR, "Chỉ cho phép https:// (hoặc http://localhost khi phát triển).");
  if (!chrome.permissions) return;
  const pattern = `${url.origin}/*`;
  let granted = false;
  try { granted = await chrome.permissions.contains({ origins: [pattern] }); } catch { granted = false; }
  if (!granted)
    throw providerError(ERROR_CODES.CONFIG_ERROR,
      `Chưa cấp quyền cho ${pattern}. Mở “API key & model”, bấm Lưu cấu hình và chấp nhận hộp thoại quyền của Chrome.`);
}

/** Gọi model rồi kiểm tra bảo toàn trên kết quả; không tin prompt. */
async function humanize(text, cfg, options = {}) {
  if (!String(text || "").trim()) throw providerError(ERROR_CODES.VALIDATION_ERROR, "văn bản rỗng");
  await assertCustomHostAllowed(cfg);
  const out = await providers.generate(
    { provider: cfg.provider === "openai" ? "openai" : "google", key: cfg.key || "", base: cfg.base || "", model: cfg.model || "" },
    {
      text,
      prompt: resolvePrompt(cfg),
      signal: options.signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
      requestId: options.requestId,
    },
  );
  return {
    text: out.text,
    model: out.model,
    requestId: options.requestId,
    preservation: core.checkPreservation(text, out.text, { markdown: cfg.markdown !== false }),
    promptVersion: PROMPT_VERSION,
    mode: cfg.mode || "general",
  };
}

// Trang đóng / extension reload: không để request treo.
chrome.runtime.onSuspend.addListener(() => { try { registry.cancelAll(); } catch {} });
