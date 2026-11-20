/* Trace Cleaner — panel gốc của Chrome.
   Độc lập với content script: grab/insert chạy bằng chrome.scripting,
   humanize đi qua background để không vướng CSP của trang.
   Các API chrome.* đều có guard để mở file này ngoài extension vẫn render được (debug). */

(() => {
  const PROMPT_KEY = "tracePrompt";
  const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const hasRuntime = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  const hasScripting = typeof chrome !== "undefined" && chrome.scripting && chrome.tabs;

  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const getPrompt = () => new Promise(res => {
    if (!hasStorage) return res(lsGet(PROMPT_KEY, ""));
    try { chrome.storage.local.get(PROMPT_KEY, o => res(o[PROMPT_KEY] || "")); } catch { res(""); }
  });
  const setPrompt = v => {
    lsSet(PROMPT_KEY, v);
    if (hasStorage) { try { chrome.storage.local.set({ [PROMPT_KEY]: v }); } catch {} }
  };

  const getCfg = () => new Promise(res => {
    if (!hasStorage) {
      try { return res(JSON.parse(lsGet("traceCfg", "{}"))); } catch { return res({}); }
    }
    try { chrome.storage.local.get("traceCfg", o => res(o.traceCfg || {})); } catch { res({}); }
  });
  const saveCfg = cfg => {
    lsSet("traceCfg", JSON.stringify(cfg));
    if (!hasStorage) return Promise.resolve(true);
    return new Promise(res => {
      try { chrome.storage.local.set({ traceCfg: cfg }, () => res(true)); } catch { res(false); }
    });
  };

  async function inPage(fn, args) {
    if (!hasScripting) return null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) return null;
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args: args || [] });
      return r ? r.result : null;
    } catch (e) {
      console.warn("[Trace Cleaner] tab này không cho chạy script:", e && e.message);
      return null;
    }
  }

  const grabFromPage = () => inPage(() => {
    const sel = String(window.getSelection ? window.getSelection() : "");
    if (sel.trim()) return sel;
    const el = document.activeElement;
    if (!el) return "";
    if (el.isContentEditable) return el.innerText || el.textContent || "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value;
    return "";
  });

  const insertIntoPage = text => inPage(t => {
    const el = document.activeElement;
    if (!el) return false;
    if (el.isContentEditable) { el.focus(); document.execCommand("insertText", false, t); return true; }
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.focus();
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, "value");
      if (d && d.set) d.set.call(el, t); else el.value = t;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }, [text]);

  const humanize = (text, prompt, opts) => new Promise((resolve, reject) => {
    if (!hasRuntime) return reject(new Error("Chưa cài như extension — mở panel qua icon trên toolbar."));
    getCfg().then(cfg => {
      chrome.runtime.sendMessage({ type: "humanize", text, cfg: Object.assign({}, cfg, { prompt: prompt || "", markdown: !!(opts && opts.markdown) }) }, res => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res) return reject(new Error("background không trả lời — thử tải lại extension"));
        if (res.error) return reject(new Error(res.error));
        resolve(res.text);
      });
    });
  });

  const ui = window.TraceSidebar.mount(document.body, {
    humanize,
    grab: grabFromPage,
    insert: insertIntoPage,
    close: () => { try { window.close(); } catch {} },
    loadCfg: getCfg,
    saveCfg,
    getPrompt,
    setPrompt,
    onPromptChange: cb => {
      if (!hasStorage) return;
      try {
        chrome.storage.onChanged.addListener((ch, area) => {
          if (area === "local" && ch[PROMPT_KEY]) cb(ch[PROMPT_KEY].newValue || "");
        });
      } catch {}
    }
  });
  ui.show(true);
  window.__tracePanel = ui;
})();
