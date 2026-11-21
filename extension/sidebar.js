/* Trace Cleaner — sidebar UI + bộ làm sạch.
   Không phụ thuộc chrome.* ; content.js truyền hooks vào nên file này test được standalone. */

window.TraceSidebar = (() => {
  /* Toàn bộ phép làm sạch nằm trong packages/core (bundle extension/core/bundle.js).
     Sidebar chỉ là UI adapter: không giữ regex riêng, không xoá mục danh sách,
     không đảo phủ định, không đụng ZWJ/ZWNJ/variation selector. */
  function core(){
    const c = typeof globalThis !== "undefined" ? globalThis.TraceCore : null;
    if (!c || typeof c.cleanText !== "function" || typeof c.countsFor !== "function") {
      throw new Error("thiếu core dùng chung (extension/core/bundle.js) — tải lại extension");
    }
    return c;
  }

  function stats(text){
    return core().countsFor(text);
  }

  /* options: { markdown } — markdown=false nghĩa là xoá marker, giữ nội dung. */
  function clean(text, opts){
    const o = opts || {};
    const c = core();
    const before = c.countsFor(text);
    const result = c.cleanText(text, { markdown: o.markdown !== false });
    return {
      text: result.text,
      removed: before,
      left: result.stats,
      guarded: false,
      audit: result.audit,
      warnings: result.warnings,
      log: result.log
    };
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const CSS = `
  :host, * { box-sizing: border-box; }
  .wrap {
    position: fixed; top: 0; right: 0; height: 100vh; width: 392px; max-width: 96vw;
    display: flex; flex-direction: column; gap: 0;
    background: #0b1220; color: #e6edf7; border-left: 1px solid #23324b;
    box-shadow: -12px 0 32px rgba(0,0,0,.35);
    font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    transform: translateX(100%); transition: transform .18s ease;
  }
  .wrap.on { transform: none; }
  header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1c2a41;
           background: linear-gradient(180deg,#101a2e,#0b1220); }
  header b { font-size: 13.5px; letter-spacing: -.01em; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 10px #38bdf8a0; }
  header .x { margin-left: auto; background: none; border: 0; color: #8ea3c0; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
  header .x:hover { background: #1b2942; color: #fff; }
  .body { padding: 10px 12px 14px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  textarea { width: 100%; resize: vertical; background: #0e1626; color: #e6edf7; border: 1px solid #22314a;
             border-radius: 9px; padding: 9px 10px; font: 12.5px/1.55 ui-monospace, Menlo, Consolas, monospace; }
  textarea:focus { outline: 2px solid #38bdf8; outline-offset: -1px; border-color: #38bdf8; }
  #input { min-height: 132px; } #output { min-height: 132px; }
  #input.dropon { outline: 2px dashed #5eead4; outline-offset: -2px; }
  /* nút phóng to: luôn hiện, bấm để mở rộng, kéo góc để đổi kích thước */
  .tbwrap { position: relative; display: flex; flex-direction: column; min-width: 0; }
  .expbtn { position: absolute; top: 5px; right: 5px; z-index: 4; width: 22px; height: 22px; padding: 0;
            display: grid; place-items: center; font: 600 11.5px/1 ui-monospace, Menlo, Consolas, monospace;
            border-radius: 6px; border: 1px solid #22314a; background: #0b1220d9; color: #8ea3c0;
            cursor: pointer; opacity: .8; }
  .expbtn:hover { opacity: 1; color: #5eead4; border-color: #5eead4; }
  textarea.tbzoom { position: fixed; left: 10px; top: 44px; width: calc(100vw - 20px); height: calc(100vh - 54px);
                    min-width: 220px; min-height: 140px; max-width: none; max-height: none;
                    z-index: 99999; resize: both; overflow: auto; flex: none;
                    border: 1px solid #5eead4; background: #0b1220; color: #e6edf7;
                    box-shadow: 0 24px 60px -20px #000; }
  .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  button { font: inherit; font-size: 12px; padding: 6px 10px; border-radius: 8px; cursor: pointer;
           border: 1px solid #2a3c59; background: #16233a; color: #dbe6f5; }
  button:hover { background: #1d2d49; }
  button.primary { background: linear-gradient(180deg,#2f9be8,#1f76c9); border-color: #3aa6f0; color: #fff; font-weight: 600; }
  button.primary:hover { filter: brightness(1.08); }
  button.ghost { background: transparent; }
  button:disabled { opacity: .5; cursor: default; }
  label.chk { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #b9c9de;
              padding: 5px 8px; border: 1px solid #22314a; border-radius: 8px; cursor: pointer; }
  label.chk:has(input:checked) { border-color: #2f9be8; color: #eaf4ff; background: #12243a; }
  .chain { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 8px; border: 1px dashed #22314a; border-radius: 10px; }
  .chain .lab { font-size: 10.5px; letter-spacing: .1em; color: #7f95b3; }
  .chain select { background: #0e1626; color: #e6edf7; border: 1px solid #22314a; border-radius: 8px;
                  padding: 5px 7px; font: 11.5px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .chain select:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
  .status { font-size: 11.5px; color: #8ea3c0; min-height: 16px; white-space: pre-wrap; }
  .status.err { color: #ff9c8a; }
  .status.ok { color: #7ee0a8; }
  details { border: 1px solid #1f2d45; border-radius: 9px; padding: 7px 9px; background: #0d1728; }
  summary { cursor: pointer; font-size: 11.5px; color: #9fb4d0; }
  details input, details select { width: 100%; margin-top: 6px; background: #0e1626; color: #e6edf7; border: 1px solid #22314a;
                                  border-radius: 7px; padding: 6px 8px; font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace; }
  .foot { font-size: 10.5px; color: #6f86a5; line-height: 1.5; border-top: 1px solid #16233a; padding-top: 7px; }
  .metrics { display: flex; gap: 6px; flex-wrap: wrap; font-size: 11px; }
  .metrics span { background: #12203a; border: 1px solid #22314a; border-radius: 999px; padding: 2px 8px; color: #9fb4d0; }
  .metrics b { color: #e6edf7; }
  `;

  const HTML = `
  <div class="wrap" id="wrap">
    <header><span class="dot"></span><b>Trace Cleaner</b><span style="font-size:10.5px;color:#6f86a5">sidebar</span>
      <button class="x" id="btnClose" title="Đóng (Alt+Shift+T)">✕</button></header>
    <div class="body">
      <div class="row"><button id="btnGrab" class="ghost">↓ Lấy văn bản đang chọn</button><button id="btnClear" class="ghost">Xoá</button></div>
      <textarea id="input" placeholder="Dán văn bản vào đây…"></textarea>
      <div class="chain">
        <span class="lab">CHUỖI</span>
        <label class="chk"><input type="checkbox" id="cClean" checked> Làm sạch</label>
        <label class="chk"><input type="checkbox" id="cHuman" checked> Humanize</label>
        <label class="chk" title="Bật: giữ heading / **bold** / bullet / link và dặn AI giữ nguyên cấu trúc. Tắt: xoá hết định dạng rồi tự căn lại."><input type="checkbox" id="cMd" checked> Markdown</label>
        <select id="cMode" title="Kiểu viết lại — cùng bộ chế độ với web"></select>
        <button id="btnSwap" class="ghost" title="Đổi thứ tự chạy">⇄ <span id="order">Humanize → Làm sạch</span></button>
        <button id="btnRun" class="primary">Chạy</button>
        <button id="btnCancel" class="ghost" disabled title="Dừng request đang chạy (không phải timeout)">■ Huỷ</button>
      </div>
      <div class="status" id="status"></div>
      <textarea id="output" readonly placeholder="Kết quả…"></textarea>
      <div class="metrics" id="metrics"></div>
      <details id="guardBox" hidden><summary>Kiểm tra bảo toàn nội dung</summary><div id="guardList" class="status"></div></details>
      <div class="row"><button id="btnCopy">Copy</button><button id="btnInsert" class="primary">Dán vào trang</button><button id="btnRevert" class="ghost" title="Khôi phục văn bản trước lần chạy gần nhất">↩ Bản trước</button></div>
      <details>
        <summary>Prompt humanize — xem &amp; sửa <span id="pLen" style="color:#7f95b3"></span></summary>
        <textarea id="promptTa" spellcheck="false" style="min-height:150px" placeholder="Prompt gửi kèm văn bản…"></textarea>
        <div class="status" id="promptStatus" style="font-size:10.5px"></div>
      </details>
      <details id="cfgBox">
        <summary>API key &amp; model</summary>
        <select id="cProvider"><option value="google">Google Gemini</option><option value="openai">OpenAI-compatible</option></select>
        <input id="cBase" placeholder="base url">
        <input id="cModel" placeholder="gemini-3.8-flash">
        <input id="cKey" type="password" autocomplete="off" spellcheck="false" placeholder="API key (chỉ lưu trong phiên)">
        <label class="chk" style="margin-top:6px"><input type="checkbox" id="cRemember"> Ghi nhớ API key trên máy này</label>
        <div class="row" style="margin-top:6px"><button id="btnSaveCfg">Lưu cấu hình</button><button id="btnForgetKey" class="ghost">Xoá key</button></div>
        <div class="status" id="cfgMsg" style="font-size:10.5px"></div>
      </details>
      <div class="foot">Làm sạch chạy 100% tại máy. Humanize gửi văn bản lên Google/OpenAI qua background — chỗ này rời máy.
      Điểm số không phải "đã xoá dấu vết AI": detector thương mại vẫn bắt được phần lớn văn bản đã viết lại.</div>
    </div>
  </div>`;

  function mount(root, hooks) {
    const style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
    const holder = document.createElement("div");
    holder.innerHTML = HTML;
    root.appendChild(holder);
    const $ = id => holder.querySelector("#" + id);
    const wrap = $("wrap");
    const input = $("input"), output = $("output"), status = $("status");

    let order = localStorage.getItem("traceChainOrder") === "clean-first" ? "clean-first" : "human-first";
    let busy = false;
    let mdKeep = localStorage.getItem("traceMdKeep") !== "0";
    let lastRunOriginal = "";
    let currentRequestId = null;
    let currentGuard = null;
    const newRequestId = () => "ui_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    // Kiểu viết lại: cùng danh sách với web (packages/writing/prompts.js).
    const MODE_LABELS = [
      ["general", "Tổng quát"], ["proofread", "Proofread"], ["clarity", "Clarity"],
      ["concise", "Concise"], ["natural", "Natural flow"], ["professional", "Professional"],
      ["academic", "Học thuật"], ["cover", "Cover letter"], ["email", "Email"]
    ];
    let mode = localStorage.getItem("traceMode") || "general";
    if (!MODE_LABELS.some(([value]) => value === mode)) mode = "general";
    const modeSel = $("cMode");
    modeSel.innerHTML = MODE_LABELS.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
    modeSel.value = mode;
    modeSel.addEventListener("change", () => {
      mode = modeSel.value;
      try { localStorage.setItem("traceMode", mode); } catch {}
    });

    // prompt dùng chung với web app (đồng bộ 2 chiều qua chrome.storage)
    const promptTa = $("promptTa"), promptStatus = $("promptStatus");
    let promptText = "";
    const showLen = () => { $("pLen").textContent = promptText ? "· " + promptText.length + " ký tự" : ""; };
    (async () => {
      if (!hooks.getPrompt) return;
      promptText = (await hooks.getPrompt()) || "";
      if (promptText) promptTa.value = promptText;
      showLen();
    })();
    if (hooks.onPromptChange) hooks.onPromptChange(v => {
      if (typeof v !== "string" || v === promptTa.value) return;
      promptTa.value = v; promptText = v; showLen();
      promptStatus.textContent = "vừa cập nhật từ web app";
    });
    let promptTimer = null;
    promptTa.addEventListener("input", () => {
      promptText = promptTa.value; showLen();
      clearTimeout(promptTimer);
      promptTimer = setTimeout(() => {
        if (hooks.setPrompt) hooks.setPrompt(promptText);
        promptStatus.textContent = "đã lưu · web app dùng cùng prompt";
      }, 250);
    });

    const say = (msg, kind) => { status.textContent = msg || ""; status.className = "status" + (kind ? " " + kind : ""); };
    const paintOrder = () => { $("order").textContent = order === "human-first" ? "Humanize → Làm sạch" : "Làm sạch → Humanize"; };

    /* nút Markdown: giữ định dạng (bật) hay xoá hết + căn lại (tắt) */
    const mdBox = $("cMd");
    mdBox.checked = mdKeep;
    mdBox.addEventListener("change", () => {
      mdKeep = mdBox.checked;
      try { localStorage.setItem("traceMdKeep", mdKeep ? "1" : "0"); } catch {}
      say(mdKeep ? "Markdown: giữ nguyên định dạng" : "Markdown: xoá hết định dạng + căn lại");
    });

    /* phóng to ô text: bấm nút để mở rộng, kéo góc để đổi kích thước, Esc để thu nhỏ */
    let zoomEl = null;
    const zoomBar = document.createElement("div");
    zoomBar.style.cssText = "position:fixed;left:10px;top:6px;z-index:100000;display:none;align-items:center;gap:6px;" +
      "background:#101a2e;border:1px solid #2a3c59;border-radius:8px;padding:4px 6px;" +
      "font:11px/1.4 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#9fb4d0";
    zoomBar.innerHTML = '<span id="zbLab"></span><button type="button" id="zbClose">⤡ Thu nhỏ</button>';
    holder.appendChild(zoomBar);

    const boxSizes = () => { try { return JSON.parse(localStorage.getItem("traceBoxSize") || "{}") || {}; } catch { return {}; } };
    function closeZoom() {
      if (!zoomEl) return;
      const el = zoomEl;
      zoomEl = null;
      if (el.id && el.style.width) {
        try {
          const all = boxSizes();
          all[el.id] = { w: el.style.width, h: el.style.height };
          localStorage.setItem("traceBoxSize", JSON.stringify(all));
        } catch {}
      }
      el.classList.remove("tbzoom");
      el.style.width = ""; el.style.height = "";
      if (el._tbwrap) el._tbwrap.classList.remove("zoomed");
      zoomBar.style.display = "none";
      try { el.focus(); } catch {}
    }
    function openZoom(el, label) {
      if (zoomEl) closeZoom();
      zoomEl = el;
      if (el._tbwrap) el._tbwrap.classList.add("zoomed");
      el.classList.add("tbzoom");
      let s = null;
      try { s = boxSizes()[el.id]; } catch {}
      if (s && s.w && s.h) { el.style.width = s.w; el.style.height = s.h; }
      zoomBar.querySelector("#zbLab").textContent = label;
      zoomBar.style.display = "flex";
      try { el.focus(); } catch {}
    }
    function boxButton(el, label) {
      if (!el || el._tbwrap) return;
      const w = document.createElement("div");
      w.className = "tbwrap";
      el.parentNode.insertBefore(w, el);
      w.appendChild(el);
      el._tbwrap = w;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "expbtn";
      b.textContent = "⤢";
      b.title = "Mở rộng ô · kéo góc để đổi kích thước";
      b.setAttribute("aria-label", "Mở rộng ô " + label);
      b.addEventListener("click", () => el.classList.contains("tbzoom") ? closeZoom() : openZoom(el, label));
      w.appendChild(b);
    }
    zoomBar.querySelector("#zbClose").addEventListener("click", closeZoom);
    holder.addEventListener("keydown", e => { if (e.key === "Escape" && zoomEl) closeZoom(); });

    /* thả file .txt/.md vào ô văn bản là nạp luôn */
    ["dragenter", "dragover"].forEach(ev => input.addEventListener(ev, e => {
      const t = e.dataTransfer && e.dataTransfer.types;
      if (!t || ![...t].includes("Files")) return;
      e.preventDefault(); input.classList.add("dropon");
    }));
    input.addEventListener("dragleave", () => input.classList.remove("dropon"));
    input.addEventListener("drop", async e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      e.preventDefault(); input.classList.remove("dropon");
      const f = files[0];
      try {
        const t = await f.text();
        if (!t.trim()) { say("File rỗng hoặc nhị phân: " + f.name, "err"); return; }
        const had = input.value.trim();
        input.value = had ? had + "\n\n" + t.trim() : t;
        say(`Đã nạp ${f.name} · ${t.length} ký tự`);
      } catch (err) { say("Không đọc được file: " + err.message, "err"); }
    });

    function paintMetrics(cleaned) {
      const r = cleaned.removed, m = $("metrics");
      const parts = [
        ["ký tự ẩn", r.vis + r.pua], ["khoảng trắng lạ", r.blank],
        ["ngoặc cong", r.quotes], ["em dash", r.emdash], ["tell", r.tells]
      ].filter(([, v]) => v > 0).map(([k, v]) => `<span>${esc(k)} <b>${v}</b></span>`);
      const left = cleaned.left.tells;
      m.innerHTML = parts.join("") + (parts.length ? "" : `<span>không thấy dấu vết ký tự</span>`) +
        (cleaned.audit && cleaned.audit.length ? `<span title="Số ký tự đã sửa, có audit từng ký tự">đã sửa <b>${cleaned.audit.length}</b></span>` : "") +
        `<span>còn <b>${left}</b> tell</span>` +
        (cleaned.guarded ? `<span title="Bước sửa câu xoá quá nhiều nên đã bỏ">⚠ giữ nguyên câu</span>` : "");
    }

    async function run() {
      if (busy) return;
      const text = input.value.trim();
      const hasClean = $("cClean").checked, hasHuman = $("cHuman").checked;
      if (!text) return say("Chưa có văn bản.", "err");
      if (!hasClean && !hasHuman) return say("Tích ít nhất một bước — hoặc bấm 'Làm sạch' / 'Humanize' bên dưới.", "err");

      let seq;
      if (hasClean && hasHuman) seq = order === "human-first" ? ["human", "clean"] : ["clean", "human"];
      else seq = hasHuman ? ["human"] : ["clean"];

      busy = true;
      $("btnRun").disabled = true;
      const t0 = performance.now();
      let cur = text, lastClean = null, guard = null;
      lastRunOriginal = input.value;
      try {
        for (const step of seq) {
          if (step === "human") {
            say("Humanize: đang gọi model…");
            if (typeof hooks.humanize !== "function") throw new Error("extension chưa nối background");
            currentRequestId = newRequestId();
            $("btnCancel").disabled = typeof hooks.cancel !== "function";
            const r = await hooks.humanize(cur, promptText, { markdown: mdKeep, mode, requestId: currentRequestId });
            if (r && typeof r === "object" && typeof r.text === "string"){ cur = r.text; guard = r.preservation || null; }
            else cur = r;
          } else {
            say("Làm sạch…");
            lastClean = clean(cur, { markdown: mdKeep });
            cur = lastClean.text;
          }
        }
        if (!lastClean) lastClean = clean(cur, { markdown: mdKeep });
        else lastClean = Object.assign({}, lastClean, { left: stats(cur) }); // "còn tell" phải đếm trên kết quả cuối
        output.value = cur;
        paintMetrics(lastClean);
        paintGuard(guard);
        say("Xong · " + seq.map(s => s === "human" ? "humanize" : "làm sạch").join(" → ") +
            " · " + ((performance.now() - t0) / 1000).toFixed(1) + "s", "ok");
      } catch (e) {
        say("Lỗi: " + (e && e.message ? e.message : e), "err");
      } finally {
        busy = false;
        currentRequestId = null;
        $("btnCancel").disabled = true;
        $("btnRun").disabled = false;
      }
    }

    function paintGuard(guard){
      const box = $("guardBox"), list = $("guardList");
      if (!box || !list) return;
      if (!guard){ box.hidden = true; list.textContent = ""; currentGuard = null; return; }
      const issues = guard.issues || [];
      currentGuard = guard;
      box.hidden = false;
      list.textContent = issues.length
        ? issues.map(i => (i.severity === "failed" ? "LỖI: " : "Cảnh báo: ") + i.detail).join("\n")
        : "Số / URL / email / ngày / phủ định / trích dẫn / Markdown khớp. Ngữ nghĩa sâu chưa được kiểm tra tự động.";
      box.open = issues.length > 0;
    }

    function onlyClean() {
      const t = input.value.trim();
      if (!t) return say("Chưa có văn bản.", "err");
      lastRunOriginal = input.value;
      const c = clean(t, { markdown: mdKeep });
      output.value = c.text;
      paintMetrics(c);
      say("Chỉ làm sạch (không gọi API).", "ok");
    }

    async function onlyHuman() {
      if (busy) return;
      const t = input.value.trim();
      if (!t) return say("Chưa có văn bản.", "err");
      busy = true; $("btnRun").disabled = true;
      lastRunOriginal = input.value;
      try {
        say("Humanize: đang gọi model…");
        currentRequestId = newRequestId();
        $("btnCancel").disabled = typeof hooks.cancel !== "function";
        const r = await hooks.humanize(t, promptText, { markdown: mdKeep, mode, requestId: currentRequestId });
        const outText = r && typeof r === "object" ? r.text : r;
        output.value = outText;
        paintMetrics(clean(outText, { markdown: mdKeep }));
        paintGuard(r && typeof r === "object" ? r.preservation : null);
        say("Chỉ humanize — chưa làm sạch ký tự.", "ok");
      } catch (e) { say("Lỗi: " + (e && e.message ? e.message : e), "err"); }
      finally { busy = false; currentRequestId = null; $("btnCancel").disabled = true; $("btnRun").disabled = false; }
    }

    $("btnRun").addEventListener("click", run);

    /* Huỷ thật: gửi requestId xuống background để abort fetch đang chạy. */
    $("btnCancel").addEventListener("click", async () => {
      const id = currentRequestId;
      if (!id || typeof hooks.cancel !== "function") return;
      $("btnCancel").disabled = true;
      const ok = await hooks.cancel(id);
      say(ok ? "Đã huỷ yêu cầu." : "Yêu cầu đã xong trước khi huỷ.", ok ? "ok" : "err");
    });
    $("btnSwap").addEventListener("click", () => {
      order = order === "human-first" ? "clean-first" : "human-first";
      localStorage.setItem("traceChainOrder", order);
      paintOrder();
    });
    $("btnGrab").addEventListener("click", async () => {
      const t = (hooks.grab ? await hooks.grab() : "") || "";
      if (!t) return say("Không đọc được: bôi đen văn bản hoặc bấm vào ô nhập trên trang trước.", "err");
      input.value = t;
      say("Đã lấy " + t.length + " ký tự từ trang.", "ok");
    });
    $("btnClear").addEventListener("click", () => { input.value = ""; output.value = ""; $("metrics").innerHTML = ""; say(""); });
    $("btnCopy").addEventListener("click", async () => {
      if (!output.value) return;
      try { await navigator.clipboard.writeText(output.value); say("Đã copy.", "ok"); }
      catch { output.select(); document.execCommand("copy"); say("Đã copy.", "ok"); }
    });
    $("btnInsert").addEventListener("click", async () => {
      if (!output.value) return say("Chưa có kết quả.", "err");
      /* Bảo toàn nội dung không đạt (mất số/mục danh sách/phủ định/URL) ⇒ phải
         xác nhận rõ ràng, không im lặng dán đè lên ô của người dùng. */
      const failedIssues = currentGuard ? (currentGuard.issues || []).filter(i => i.severity === "failed") : [];
      if (failedIssues.length) {
        const failed = failedIssues;
        const detail = failed.slice(0, 4).map(i => "• " + i.detail).join("\n");
        const proceed = window.confirm("Kiểm tra bảo toàn KHÔNG đạt:\n" + detail + "\n\nVẫn dán vào trang?");
        if (!proceed) return say("Đã giữ nguyên trang — sửa lại kết quả rồi thử lại.", "err");
      }
      const ok = hooks.insert ? await hooks.insert(output.value) : false;
      say(ok ? "Đã dán vào ô đang chọn trên trang." : "Không tìm thấy ô nhập — đã copy vào clipboard.", ok ? "ok" : "");
    });
    $("btnRevert").addEventListener("click", () => {
      if (!lastRunOriginal) return say("Chưa có bản trước để khôi phục.", "err");
      input.value = lastRunOriginal;
      output.value = "";
      $("metrics").innerHTML = "";
      paintGuard(null);
      say("Đã khôi phục văn bản trước lần chạy gần nhất.", "ok");
    });
    $("btnClose").addEventListener("click", () => { closeZoom(); if (hooks.close) hooks.close(); });

    // API config — key mặc định chỉ ở session; local chỉ khi tick "Ghi nhớ".
    const cfgMsg = $("cfgMsg");
    const readCfg = () => ({
      provider: $("cProvider").value,
      base: $("cBase").value.trim(),
      model: $("cModel").value.trim(),
      key: $("cKey").value,
      remember: $("cRemember").checked,
    });
    (async () => {
      const cfg = (hooks.loadCfg && await hooks.loadCfg()) || {};
      if (cfg.provider) $("cProvider").value = cfg.provider;
      if (cfg.base) $("cBase").value = cfg.base;
      if (cfg.model) $("cModel").value = cfg.model;
      if (cfg.key) $("cKey").value = cfg.key;
      $("cRemember").checked = cfg.remember === true;
      if (!cfg.base) $("cBase").value = "https://generativelanguage.googleapis.com/v1beta";
      if (!cfg.model) $("cModel").value = "gemini-3.8-flash";
    })();
    $("btnSaveCfg").addEventListener("click", async () => {
      const cfg = readCfg();
      if (hooks.saveCfg) await hooks.saveCfg(cfg);
      cfgMsg.textContent = cfg.remember
        ? "Đã lưu · key được ghi trên máy này vì bạn đã tick ghi nhớ."
        : "Đã lưu · key chỉ sống trong phiên trình duyệt.";
      // Provider tuỳ biến: xin quyền đúng origin, ngay trong user gesture này.
      if (cfg.provider === "openai" && typeof hooks.ensurePermission === "function") {
        const result = await hooks.ensurePermission(cfg.base);
        if (result && result.ok) {
          cfgMsg.textContent += result.already ? " Quyền host đã có." : " Đã cấp quyền cho " + result.pattern + ".";
        } else if (result && result.error) {
          cfgMsg.textContent += " " + result.error;
        }
      }
      say("Đã lưu cấu hình.", "ok");
    });
    $("btnForgetKey").addEventListener("click", async () => {
      $("cKey").value = "";
      $("cRemember").checked = false;
      if (hooks.clearKey) await hooks.clearKey();
      cfgMsg.textContent = "Đã xoá key khỏi phiên và khỏi máy.";
    });

    paintOrder();
    boxButton(input, "Văn bản");
    boxButton(output, "Kết quả");
    boxButton(promptTa, "Prompt");
    return {
      show(v) { wrap.classList.toggle("on", v !== false); },
      isOpen() { return wrap.classList.contains("on"); },
      toggle() { wrap.classList.toggle("on"); return wrap.classList.contains("on"); },
      run, onlyClean, onlyHuman, clean, stats
    };
  }

  return { mount, clean, stats, esc };
})();
