/* Trace Cleaner — service worker
   - Mọi request mạng chạy ở đây để content script không bị CSP của trang chặn.
   - Mở sidebar: ưu tiên Side Panel gốc của Chrome (cần permission "sidePanel"),
     luôn có đường dự phòng để bấm icon không bao giờ im lặng.
   - Model Google: tự đổi model khi 404, tự thử lại khi 503. */

const APP_URL = "https://norvixadamas.github.io/trace-cleaner/";

/* 11/2026: gemma-* trả 404 trên v1beta, model 2.5 chỉ còn cho key cũ → thử lần lượt. */
const GOOGLE_FALLBACK = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

const PROMPT = `You are a meticulous human line editor. Rewrite machine-written prose so it reads like one specific person wrote it in one sitting, without changing any fact.

Non-negotiable facts
- Keep every company name, product, job title, person name, number, percentage, date, technology and URL EXACTLY as written.
- Keep the same language as the input, and the same meaning and argument order.
- Keep length within +-10% of the original. Never pad.

Delete on sight
- Praise openings/closings ("I am thrilled to apply", "Thank you for your time and consideration").
- "not just X but Y", "not only ... but also", "rather than relying on", "without sacrificing".
- Three-item lists (tricolons) and any symmetrical "A, B, and C".
- Bold lead-in bullets and perfectly parallel bullet sets.
- Marketing words: leverage, streamline, unlock, empower, harness, robust, seamless, scalable, cutting-edge, world-class, holistic, pivotal, vital, crucial, comprehensive, meticulous, passionate.
- Intensifiers and hedges: incredibly, deeply, truly, absolutely, arguably, it is worth noting.
- Signposting: furthermore, moreover, additionally, ultimately, in conclusion.
- Metaphor filler: dive into, delve into, a testament to, tapestry, journey, realm.
- Em dashes — use commas, full stops or parentheses.
- "As an AI", "In today's fast-paced world", rhetorical questions as transitions.

How a person writes
- Vary sentence length hard: mix 4-word and 30-word sentences.
- Start with concrete things (product, number, date, name), not This/The/It/There.
- Use contractions when the register allows.
- Prefer concrete nouns and specific verbs.
- Vary paragraph length; allow one small asymmetry.

Output only the rewritten text. No preamble, no notes, no markdown fences.`;

/* ─────────── mở sidebar ─────────── */

function enablePanelOnClick() {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
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
  // Chạy tới đây nghĩa là panel chưa mở được → mở bằng tay, rồi mới tới các đường lui.
  if (tab && tab.windowId != null && chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => openFallback(tab));
    return;
  }
  openFallback(tab);
});

function openFallback(tab) {
  const done = () => chrome.tabs.create({ url: APP_URL });
  if (!tab || tab.id == null) return done();
  // trang cũ chưa có content script → chèn rồi mở bản nổi
  try {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["sidebar.js", "content.js"] }, () => {
      if (chrome.runtime.lastError) return done();
      chrome.tabs.sendMessage(tab.id, { type: "toggle" }, () => {
        if (chrome.runtime.lastError) done();
      });
    });
  } catch { done(); }
}

/* ─────────── humanize ─────────── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "humanize") {
    humanize(msg.text || "", msg.cfg || {})
      .then(text => sendResponse({ text }))
      .catch(e => sendResponse({ error: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "ping") sendResponse({ ok: true });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isModelErr = m => /HTTP 404|not found|not supported for generateContent/i.test(m);
const isBusyErr = m => /HTTP 503|UNAVAILABLE|high demand|overloaded/i.test(m);

async function humanize(text, cfg) {
  if (!text.trim()) throw new Error("văn bản rỗng");
  const promptText = (cfg.prompt || "").trim() || PROMPT;
  const provider = cfg.provider === "openai" ? "openai" : "google";
  const base = (cfg.base || (provider === "google"
    ? "https://generativelanguage.googleapis.com/v1beta"
    : "https://api.openai.com/v1")).replace(/\/+$/, "");
  const model = (cfg.model || "").replace(/^models\//, "") ||
    (provider === "google" ? "gemini-3.8-flash" : "gpt-4o-mini");
  const key = cfg.key || "";
  if (!key) throw new Error("chưa có API key");

  if (provider === "google") {
    const models = [model, ...GOOGLE_FALLBACK].filter((m, i, a) => m && a.indexOf(m) === i);
    let lastErr = "";
    for (const m of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await geminiCall(base, m, key, promptText, text);
        } catch (e) {
          lastErr = String(e && e.message || e);
          if (isBusyErr(lastErr) && attempt === 0) { await sleep(1800); continue; }
          if (isModelErr(lastErr)) break;      // 404 → đổi model
          throw e;                             // 401/429/key sai → dừng luôn
        }
      }
    }
    throw new Error(lastErr || "không gọi được model nào");
  }

  return openaiCall(base, model, key, promptText, text);
}

async function geminiCall(base, model, key, promptText, text) {
  const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "You are a precise line editor. Never invent facts, names, numbers, technologies or URLs." }] },
      contents: [{ role: "user", parts: [{ text: promptText + "\n\n---\n" + text }] }],
      generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 4096 }
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
  const j = JSON.parse(body);
  if (j.promptFeedback && j.promptFeedback.blockReason) throw new Error("safety filter: " + j.promptFeedback.blockReason);
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  const out = parts.map(p => p.text || "").join("").trim();
  if (!out) throw new Error("model trả về rỗng");
  return out;
}

async function openaiCall(base, model, key, promptText, text) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model,
      temperature: 0.85,
      messages: [
        { role: "system", content: "You are a precise line editor. Never invent facts, names, numbers, technologies or URLs." },
        { role: "user", content: promptText + "\n\n---\n" + text }
      ]
    })
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
  const j = JSON.parse(body);
  const out = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!out) throw new Error("model trả về rỗng");
  return out.trim();
}
