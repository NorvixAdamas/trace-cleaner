/* Trace Cleaner — service worker (ES module)
   - Mọi request mạng chạy ở đây để content script không bị CSP của trang chặn.
   - Prompt lấy từ packages/writing/prompts.js (bản copy extension/core/prompts.js
     do tools/sync_assets.js sinh ra) — một nguồn duy nhất với web app.
   - Mở sidebar: ưu tiên Side Panel gốc của Chrome, luôn có đường dự phòng.
   - Request có timeout + huỷ; lỗi được chuẩn hoá thành mã ổn định. */

import { checkPreservation } from "./core/preservation.js";
import { buildPrompt, PROMPT_VERSION } from "./core/prompts.js";

const APP_URL = "https://norvixadamas.github.io/trace-cleaner/";
const REQUEST_TIMEOUT_MS = 60000;

/* 11/2026: gemma-* trả 404 trên v1beta, model 2.5 chỉ còn cho key cũ → thử lần lượt. */
const GOOGLE_FALLBACK = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

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

/* ─────────── lỗi chuẩn hoá ─────────── */

/** @typedef {{code:string, message:string, retryable:boolean}} ProviderError */

const ERROR_CODES = Object.freeze({
  VALIDATION: "VALIDATION_ERROR",
  CONFIG: "CONFIG_ERROR",
  AUTH: "PROVIDER_AUTH_ERROR",
  RATE: "PROVIDER_RATE_LIMIT",
  TIMEOUT: "PROVIDER_TIMEOUT",
  UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  MODEL: "PROVIDER_MODEL_UNAVAILABLE",
  NETWORK: "NETWORK_ERROR",
  EMPTY: "PROVIDER_EMPTY_RESPONSE",
  PARSE: "PROVIDER_BAD_RESPONSE",
  CANCELLED: "CANCELLED",
});

function fail(code, message, retryable = false) {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
}

/** HTTP status → mã lỗi ổn định, không lộ key, không lộ body đầy đủ. */
function errorFromStatus(status, body) {
  const detail = String(body || "").slice(0, 180);
  if (status === 401 || status === 403) return fail(ERROR_CODES.AUTH, `HTTP ${status} — key sai hoặc không có quyền. ${detail}`);
  if (status === 429) return fail(ERROR_CODES.RATE, `HTTP 429 — hết lượt gọi. ${detail}`, true);
  if (status === 404) return fail(ERROR_CODES.MODEL, `HTTP 404 — model không tồn tại. ${detail}`);
  if (status >= 500) return fail(ERROR_CODES.UNAVAILABLE, `HTTP ${status} — nhà cung cấp đang lỗi. ${detail}`, true);
  return fail(ERROR_CODES.PARSE, `HTTP ${status} — ${detail}`);
}

function normalizeThrown(error) {
  if (!error) return fail(ERROR_CODES.PARSE, "lỗi không xác định");
  if (error.code || error.name === "AbortError") {
    if (error.name === "AbortError") return fail(ERROR_CODES.TIMEOUT, `quá ${REQUEST_TIMEOUT_MS / 1000}s không có phản hồi`, true);
    return error;
  }
  const message = String(error.message || error);
  if (/Failed to fetch|NetworkError|net::ERR/i.test(message)) {
    return fail(ERROR_CODES.NETWORK, "không kết nối được tới API — kiểm tra mạng/Base URL/CORS.", true);
  }
  if (/JSON/i.test(message)) return fail(ERROR_CODES.PARSE, "phản hồi không phải JSON hợp lệ.");
  return fail(ERROR_CODES.PARSE, message);
}

/* ─────────── humanize ─────────── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "humanize") {
    humanize(msg.text || "", msg.cfg || {})
      .then(result => sendResponse(result))
      .catch(e => {
        const error = normalizeThrown(e);
        sendResponse({ error: error.message, code: error.code, retryable: !!error.retryable });
      });
    return true;
  }
  if (msg.type === "ping") sendResponse({ ok: true, promptVersion: PROMPT_VERSION });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isModelErr = m => /HTTP 404|not found|not supported for generateContent/i.test(m);

/** Prompt gửi đi: prompt người dùng nếu có, cộng mệnh đề Markdown; ngược lại lấy registry. */
export function resolvePrompt(cfg) {
  const markdown = cfg.markdown !== false;
  const custom = String(cfg.prompt || "").trim();
  if (!custom) return buildPrompt(cfg.mode || "general", { markdown });
  // Prompt tự soạn vẫn phải kèm chế độ + ràng buộc Markdown từ registry.
  const full = buildPrompt(cfg.mode || "general", { markdown });
  const tail = full.slice(full.indexOf("## Editing mode:"));
  return `${custom}\n\n${tail}`;
}

/** Gọi model rồi kiểm tra bảo toàn trên kết quả; không tin prompt. */
async function humanize(text, cfg) {
  if (!String(text || "").trim()) throw fail(ERROR_CODES.VALIDATION, "văn bản rỗng");
  const out = await callModel(text, cfg);
  return {
    text: out,
    preservation: checkPreservation(text, out, { markdown: cfg.markdown !== false }),
    promptVersion: PROMPT_VERSION,
    mode: cfg.mode || "general",
  };
}

async function callModel(text, cfg) {
  if (!text.trim()) throw fail(ERROR_CODES.VALIDATION, "văn bản rỗng");
  const promptText = resolvePrompt(cfg);
  const provider = cfg.provider === "openai" ? "openai" : "google";
  const base = (cfg.base || (provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta"
    : "https://api.openai.com/v1")).replace(/\/+$/, "");
  const model = (cfg.model || "").replace(/^models\//, "") ||
    (provider === "google" ? "gemini-3.8-flash" : "gpt-4o-mini");
  const key = cfg.key || "";
  if (!key) throw fail(ERROR_CODES.CONFIG, "chưa có API key");

  if (provider === "google") {
    const models = [model, ...GOOGLE_FALLBACK].filter((m, i, a) => m && a.indexOf(m) === i);
    let lastError = null;
    for (const candidate of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await withTimeout(signal => geminiCall(base, candidate, key, promptText, text, signal));
        } catch (error) {
          const normalized = normalizeThrown(error);
          lastError = normalized;
          const message = normalized.message;
          if (normalized.code === ERROR_CODES.UNAVAILABLE && attempt === 0) { await sleep(1800); continue; }
          if (normalized.code === ERROR_CODES.MODEL || isModelErr(message)) break; // đổi model
          throw normalized;
        }
      }
    }
    throw lastError || fail(ERROR_CODES.UNAVAILABLE, "không gọi được model nào");
  }

  return withTimeout(signal => openaiCall(base, model, key, promptText, text, signal));
}

/** Bọc fetch trong timeout + AbortController, không để request treo vô hạn. */
function withTimeout(run) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return Promise.resolve()
    .then(() => run(controller.signal))
    .finally(() => clearTimeout(timer));
}

async function readJson(res) {
  const body = await res.text();
  if (!res.ok) throw errorFromStatus(res.status, body);
  try {
    return JSON.parse(body);
  } catch {
    throw fail(ERROR_CODES.PARSE, "phản hồi không phải JSON hợp lệ.");
  }
}

async function geminiCall(base, model, key, promptText, text, signal) {
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are a precise line editor. Never invent facts, names, numbers, technologies or URLs, and never delete a list item or a negation." }] },
      contents: [{ role: "user", parts: [{ text: promptText + "\n\n---\n" + text }] }],
      generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 4096 }
    })
  });
  const j = await readJson(res);
  if (j.promptFeedback && j.promptFeedback.blockReason) {
    throw fail(ERROR_CODES.PARSE, "safety filter: " + j.promptFeedback.blockReason);
  }
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const out = parts.map(p => p.text || "").join("").trim();
  if (!out) throw fail(ERROR_CODES.EMPTY, "model trả về rỗng");
  return out;
}

async function openaiCall(base, model, key, promptText, text, signal) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      messages: [
        { role: "system", content: "You are a precise line editor. Never invent facts, names, numbers, technologies or URLs, and never delete a list item or a negation." },
        { role: "user", content: promptText + "\n\n---\n" + text }
      ]
    })
  });
  const j = await readJson(res);
  const out = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!out) throw fail(ERROR_CODES.EMPTY, "model trả về rỗng");
  return out.trim();
}
