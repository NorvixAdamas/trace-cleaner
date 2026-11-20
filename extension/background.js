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

/** Gọi model rồi kiểm tra bảo toàn trên kết quả; không tin prompt. */
async function humanize(text, cfg, options = {}) {
  if (!String(text || "").trim()) throw providerError(ERROR_CODES.VALIDATION_ERROR, "văn bản rỗng");
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
