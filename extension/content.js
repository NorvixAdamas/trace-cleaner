/* Trace Cleaner — content script: dựng sidebar trong shadow DOM, nối background + trang. */

(() => {
  if (window.__traceCleanerLoaded) return;
  window.__traceCleanerLoaded = true;

  let host = null, shadow = null, ui = null, lastEditable = null;

  const editable = t => Boolean(t) && (t.isContentEditable || t.tagName === "TEXTAREA"
    || (t.tagName === "INPUT" && /^(text|search|url|email|tel|)$/i.test(t.type || "text")));

  // Chèn sau khi người dùng đã focus ô nhập: giữ ô đó làm đích mặc định.
  if (editable(document.activeElement)) lastEditable = document.activeElement;

  document.addEventListener("focusin", e => {
    const t = e.target;
    if (!t || t === host) return;
    if (editable(t)) lastEditable = t;
  }, true);

  // Key mặc định chỉ ở chrome.storage.session; local chỉ khi người dùng tick ghi nhớ.
  const config = () => window.TraceConfig;
  const getCfg = () => (config() ? config().load() : Promise.resolve({}));
  const saveCfg = cfg => (config() ? config().save(cfg) : Promise.resolve(false));
  const clearKey = () => (config() ? config().clearKey() : Promise.resolve(false));
  const ensurePermission = base => (config() ? config().ensurePermission(base) : Promise.resolve({ ok: false, error: "thiếu config.js" }));

  // ── prompt dùng chung với web app ──
  const PROMPT_KEY = "tracePrompt";
  const getPrompt = () => new Promise(res => {
    try { chrome.storage.local.get(PROMPT_KEY, o => res(o[PROMPT_KEY] || "")); }
    catch { res(""); }
  });
  const setPrompt = v => { try { chrome.storage.local.set({ [PROMPT_KEY]: v }); } catch {} };

  // web app → extension: app ghi localStorage rồi phát event (không dùng event.detail,
  // vì page world và isolated world không chia sẻ object trong detail)
  document.addEventListener("trace-prompt", () => {
    try { const v = localStorage.getItem(PROMPT_KEY); if (typeof v === "string") setPrompt(v); } catch {}
  });

  // extension (hoặc tab khác) sửa prompt → cập nhật thẳng vào textarea của web app nếu tab đó đang mở
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local" || !ch[PROMPT_KEY]) return;
      const v = ch[PROMPT_KEY].newValue;
      const el = document.getElementById("rewritePrompt");
      if (!el || typeof v !== "string" || el.value === v) return;
      el.value = v;
      try { localStorage.setItem(PROMPT_KEY, v); } catch {}
      document.dispatchEvent(new Event("trace-prompt-in"));
    });
  } catch {}

  // mở app: bên nào có prompt thì đẩy sang bên kia
  window.addEventListener("load", () => {
    const el = document.getElementById("rewritePrompt");
    if (!el) return;
    getPrompt().then(ext => {
      try {
        const local = localStorage.getItem(PROMPT_KEY) || "";
        if (!ext && local) setPrompt(local);
        else if (ext && ext !== local) {
          el.value = ext;
          localStorage.setItem(PROMPT_KEY, ext);
          document.dispatchEvent(new Event("trace-prompt-in"));
        }
      } catch {}
    });
  });

  function insertIntoPage(text) {
    const el = lastEditable;
    if (!el || !el.isConnected) {
      try { navigator.clipboard.writeText(text); } catch {}
      return false;
    }
    try { el.focus(); } catch {}
    if (el.isContentEditable) {
      document.execCommand("insertText", false, text);
      return true;
    }
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, text); else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function grabFromPage() {
    const sel = window.getSelection ? String(window.getSelection().toString()) : "";
    if (sel.trim()) return sel;
    if (lastEditable && lastEditable.isConnected) {
      return lastEditable.isContentEditable ? lastEditable.innerText : lastEditable.value;
    }
    return "";
  }

  function build() {
    host = document.createElement("div");
    host.id = "trace-cleaner-host";
    host.style.cssText = "all:initial; position:fixed; top:0; right:0; width:0; height:0; z-index:2147483647;";
    shadow = host.attachShadow({ mode: "open" });
    document.documentElement.appendChild(host);

    ui = window.TraceSidebar.mount(shadow, {
      humanize: (text, prompt, opts) => new Promise((resolve, reject) => {
        if (!chrome || !chrome.runtime || !chrome.runtime.id) return reject(new Error("ngữ cảnh extension không hợp lệ — tải lại trang"));
        getCfg().then(cfg => {
          chrome.runtime.sendMessage({ type: "humanize", requestId: (opts && opts.requestId) || "", text, cfg: Object.assign({}, cfg, {
            prompt: prompt || "",
            markdown: !!(opts && opts.markdown),
            mode: (opts && opts.mode) || "general"
          }) }, res => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!res) return reject(new Error("background không trả lời — tải lại extension"));
            if (res.error) {
              const error = new Error(res.error);
              error.code = res.code || "PROVIDER_ERROR";
              return reject(error);
            }
            resolve(res);
          });
        });
      }),
      cancel: id => new Promise(resolve => {
        if (!id || !chrome || !chrome.runtime || !chrome.runtime.id) return resolve(false);
        try {
          chrome.runtime.sendMessage({ type: "cancel", requestId: id }, res => resolve(!!(res && res.ok)));
        } catch { resolve(false); }
      }),
      grab: grabFromPage,
      getPrompt,
      setPrompt,
      onPromptChange: cb => {
        try {
          chrome.storage.onChanged.addListener((ch, area) => {
            if (area === "local" && ch[PROMPT_KEY]) cb(ch[PROMPT_KEY].newValue || "");
          });
        } catch {}
      },
      insert: insertIntoPage,
      close: () => ui.show(false),
      loadCfg: getCfg,
      saveCfg,
      clearKey,
      ensurePermission
    });
    ui.show(false);
  }

  chrome.runtime.onMessage.addListener(msg => {
    if (!msg || msg.type !== "toggle") return;
    if (!host || !host.isConnected) build();
    ui.toggle();
  });

  // Alt+Shift+S mở bản nổi (Alt+Shift+T dành cho Side Panel gốc)
  document.addEventListener("keydown", e => {
    if (e.altKey && e.shiftKey && (e.key === "S" || e.key === "s")) {
      if (!ui) build();
      ui.toggle();
    }
  }, true);

  // Không dựng sẵn sidebar: ~60 node + CSS trong shadow DOM chỉ được tạo khi người dùng
  // thật sự mở nó (nút trên toolbar, Alt+Shift+S, hoặc message "toggle"), nên mỗi tab
  // không phải trả giá bộ nhớ lúc tải trang.
})();
