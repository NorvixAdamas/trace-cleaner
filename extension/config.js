/* Trace Cleaner — chính sách lưu API key + quyền host cho provider tuỳ biến.
 *
 * Quy tắc (giống web, ghi trong docs/PRIVACY.md):
 *   - mặc định key chỉ sống trong PHIÊN (chrome.storage.session);
 *   - chỉ ghi chrome.storage.local khi người dùng tick "Ghi nhớ API key";
 *   - key cũ do bản ≤2.2 để lại trong local (không có cờ remember) bị chuyển
 *     sang session và xoá khỏi local — không âm thầm giữ key trên đĩa.
 *
 * File này là classic script, nạp trước sidebar.js. Không import gì để dùng được
 * cả trong content script (isolated world) và panel.
 */
(function () {
  if (window.TraceConfig) return;
  const KEY = "traceCfg";
  const hasChrome = typeof chrome !== "undefined" && chrome.storage;

  const area = name => (chrome.storage && chrome.storage[name]) || null;
  const get = (store, key) => new Promise(resolve => {
    if (!store) return resolve({});
    try { store.get(key, value => resolve((value && value[key]) || {})); } catch { resolve({}); }
  });
  const set = (store, value) => new Promise(resolve => {
    if (!store) return resolve(false);
    try { store.set({ [KEY]: value }, () => resolve(!chrome.runtime.lastError)); } catch { resolve(false); }
  });
  const remove = (store, key) => new Promise(resolve => {
    if (!store) return resolve(false);
    try { store.remove(key, () => resolve(true)); } catch { resolve(false); }
  });

  function publicFields(cfg) {
    return {
      provider: cfg.provider === "openai" ? "openai" : "google",
      base: String(cfg.base || "").trim(),
      model: String(cfg.model || "").trim(),
      remember: cfg.remember === true,
    };
  }

  /** @returns {Promise<{provider:string, base:string, model:string, key:string, remember:boolean}>} */
  async function load() {
    if (!hasChrome) {
      let stored = {};
      try { stored = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch {}
      const sessionKey = sessionStorage.getItem(KEY + ":key") || "";
      const key = stored.remember === true ? String(stored.key || "") : sessionKey;
      return { ...publicFields(stored), key, remember: stored.remember === true };
    }
    const local = await get(area("local"), KEY);
    const session = await get(area("session"), KEY);
    // Migration: key nằm trong local nhưng không có cờ remember → chuyển sang session.
    if (local.key && local.remember !== true) {
      await save({ ...publicFields(local), key: String(local.key), remember: false });
      local.key = "";
    }
    const remember = local.remember === true && !!local.key;
    return {
      ...publicFields(local),
      remember,
      key: remember ? String(local.key) : String(session.key || ""),
    };
  }

  /** Ghi cấu hình theo đúng chính sách: key vào local CHỈ khi remember. */
  async function save(cfg) {
    const remember = cfg.remember === true && Boolean(cfg.key);
    const base = publicFields({ ...cfg, remember });
    if (!hasChrome) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...base, key: remember ? cfg.key : "" }));
        if (remember) sessionStorage.removeItem(KEY + ":key");
        else sessionStorage.setItem(KEY + ":key", String(cfg.key || ""));
      } catch {}
      return true;
    }
    const localValue = remember ? { ...base, key: String(cfg.key) } : base;
    const localOk = await set(area("local"), localValue);
    if (remember) {
      await remove(area("session"), KEY);
    } else {
      await set(area("session"), { key: String(cfg.key || ""), remember: false });
      // Bảo đảm bản trên đĩa không còn key cũ.
      const local = await get(area("local"), KEY);
      if (local.key) await set(area("local"), base);
    }
    return localOk;
  }

  /** Xoá key ở cả hai nơi (nút "Xoá key"). */
  async function clearKey() {
    if (!hasChrome) {
      try {
        const stored = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
        localStorage.setItem(KEY, JSON.stringify({ ...publicFields(stored), remember: false }));
        sessionStorage.removeItem(KEY + ":key");
      } catch {}
      return true;
    }
    await remove(area("session"), KEY);
    const local = await get(area("local"), KEY);
    await set(area("local"), publicFields({ ...local, remember: false }));
    return true;
  }

  /**
   * Origin pattern cho một Base URL hợp lệ.
   * Chỉ https, hoặc http với loopback (dev). Trả null nếu không hợp lệ.
   */
  function originPattern(baseUrl) {
    let url;
    try { url = new URL(String(baseUrl || "").trim()); } catch { return null; }
    if (url.protocol === "https:") return `${url.origin}/*`;
    const loopback = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
    if (url.protocol === "http:" && loopback) return `${url.origin}/*`;
    return null;
  }

  /**
   * Bảo đảm có quyền cho đúng origin của provider. PHẢI gọi trong user gesture
   * (click) — Chrome từ chối request() ngoài gesture.
   */
  async function ensurePermission(baseUrl) {
    const pattern = originPattern(baseUrl);
    if (!pattern) return { ok: false, error: "Base URL phải là https:// (hoặc http://localhost khi phát triển)." };
    if (!hasChrome || !chrome.permissions) return { ok: true, pattern, skipped: true };
    try {
      const already = await chrome.permissions.contains({ origins: [pattern] });
      if (already) return { ok: true, pattern, already: true };
      const granted = await chrome.permissions.request({ origins: [pattern] });
      return granted
        ? { ok: true, pattern, already: false }
        : { ok: false, pattern, error: "Bạn chưa cấp quyền cho " + pattern + " — request tới host này sẽ bị chặn." };
    } catch (error) {
      return { ok: false, pattern, error: (error && error.message) || "Không xin được quyền." };
    }
  }

  window.TraceConfig = { load, save, clearKey, originPattern, ensurePermission };
})();
