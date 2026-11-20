/* Trace Cleaner — sidebar UI + bộ làm sạch.
   Không phụ thuộc chrome.* ; content.js truyền hooks vào nên file này test được standalone. */

window.TraceSidebar = (() => {
  const INVIS = /[\u200B-\u200D\u2060\uFEFF\u00AD\u180E\u200E\u200F\u061C]/g;
  const BLANK = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
  const PUA   = /[\uE000-\uF8FF]/g;

  const SIGNPOST = /\b(furthermore|moreover|additionally|ultimately|in conclusion|that said|notably),?\s+/gi;
  const INTENS = /\b(incredibly|extremely|absolutely|utterly|genuinely|truly|really|very|highly|profoundly|certainly|definitely)\s+/gi;
  const PRAISE_APPLY = /\bI am (thrilled|excited|delighted|honou?red) to apply\b/gi;
  const PRAISE_ANY = /\bI am (thrilled|excited|delighted|honou?red) to\b/gi;
  const BOILER_LINE = /^[ \t]*(i hope this (email|message|note)?\s*finds you well|thank you for your (time|consideration)[^.!?\n]*)[.!]?[ \t]*$/gim;
  const FRAME1 = /\bnot just\s+([^,.;]{2,45}?)\s+but (?:also\s+)?([^,.;]{2,45}?)(?=[,.;]|$)/gi;
  const FRAME2 = /\b(?:it is|it's|this is) not (?:just\s|only\s)?([^,.;]{2,40}),\s*(?:it is|it's|but)\s+([^,.;]{2,40})/gi;
  const TRICOLON = /([^,;\n]{2,45}),\s([^,;\n]{2,45}),\s+and\s([^,;\n]{2,35})([.;])/g;
  const TRICOLON2 = /\b(\w+),\s(\w+), and (\w+)\b/g;

  const WORDMAP = [
    [/\brobust\b/gi, "solid"], [/\bseamless(ly)?\b/gi, m => m.toLowerCase().startsWith("seamlessly") ? "smoothly" : "smooth"],
    [/\bcutting-edge\b/gi, "current"], [/\bworld-class\b/gi, "strong"], [/\bholistic\b/gi, "complete"],
    [/\bpivotal\b/gi, "key"], [/\bcrucial\b/gi, "key"], [/\bvital\b/gi, "key"],
    [/\bcomprehensive\b/gi, "full"], [/\bmeticulous(ly)?\b/gi, m => m.endsWith("ly") ? "carefully" : "careful"],
    [/\bpassionate\b/gi, "keen"], [/\binnovative\b/gi, "new"], [/\bdynamic\b/gi, "active"],
    [/\bleveraged?\b/gi, "used"], [/\bleverages?\b/gi, "uses"], [/\bleveraging\b/gi, "using"],
    [/\bstreamlin(e|ed|es|ing)\b/gi, m => "simplif" + ({ e: "y", ed: "ied", es: "ies", ing: "ying" }[m.slice(-2)] || "y")],
    [/\bunlock(ed|s|ing)?\b/gi, m => m.replace(/^unlock/i, "open")],
    [/\bempower(ed|s|ing)?\b/gi, m => m.replace(/^empower/i, "help")],
    [/\butili[sz]e(d|s)?\b/gi, m => m.replace(/utili[sz]e/i, "use")],
    [/\butili[sz]ing\b/gi, "using"],
    [/\bdelve into\b/gi, "look at"], [/\bdive into\b/gi, "look at"],
    [/\bshed light on\b/gi, "explain"], [/\ba testament to\b/gi, "proof of"]
  ];

  const TELLS = [
    [/\bnot just\b[^.]{0,40}\bbut\b/gi, "not just … but"],
    [/\bnot only\b[^.]{0,40}\bbut also\b/gi, "not only … but also"],
    [/\brather than\b/gi, "rather than"],
    [/\b(robust|seamless|scalable|cutting-edge|world-class|holistic|pivotal|vital|crucial|comprehensive|meticulous|passionate)\b/gi, "từ marketing"],
    [/\b(furthermore|moreover|additionally|ultimately|in conclusion)\b/gi, "signpost"],
    [/\b(delve|tapestry|realm|journey)\b/gi, "ẩn dụ rỗng"],
    [/—/g, "em dash"],
    [/[\u201C\u201D\u2018\u2019]/g, "ngoặc cong"],
    [/[\u200B-\u200D\u2060\uFEFF\u00AD\uE000-\uF8FF]/g, "ký tự ẩn"]
  ];

  function stats(text) {
    const s = { vis: 0, blank: 0, pua: 0, quotes: 0, emdash: 0, dbl: 0, tells: 0 };
    s.vis = (text.match(INVIS) || []).length;
    s.blank = (text.match(BLANK) || []).length;
    s.pua = (text.match(PUA) || []).length;
    s.quotes = (text.match(/[\u201C\u201D\u2018\u2019\u00AB\u00BB]/g) || []).length;
    s.emdash = (text.match(/—/g) || []).length;
    s.dbl = (text.match(/ {2,}/g) || []).length;
    for (const [re] of TELLS) s.tells += (text.match(re) || []).length;
    return s;
  }

  /* Xoá toàn bộ marker Markdown rồi căn lại — dùng khi nút Markdown tắt. */
  function stripMarkdown(text) {
    let n = 0;
    const hit = () => { n++; };
    let t = text.replace(/\r\n?/g, "\n");
    t = t.replace(/```[^\n]*\n?([\s\S]*?)```/g, (m, body) => { hit(); return body.replace(/\n{2,}/g, "\n"); });
    t = t.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (m, alt, url) => { hit(); return alt ? (alt === url ? alt : alt + " (" + url + ")") : url; });
    t = t.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, label, url) => {
      hit();
      if (/^https?:\/\//i.test(label)) return label;
      return label === url ? label : label + " (" + url + ")";
    });
    t = t.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (m, u) => { hit(); return u; });
    t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, () => { hit(); return ""; });
    t = t.replace(/^[ \t]{0,3}>[ \t]?/gm, () => { hit(); return ""; });
    t = t.replace(/^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, () => { hit(); return ""; });
    t = t.replace(/\*\*\*([^*\n]+)\*\*\*/g, (m, x) => { hit(); return x; });
    t = t.replace(/\*\*([^*\n]+)\*\*/g, (m, x) => { hit(); return x; });
    t = t.replace(/__([^_\n]+)__/g, (m, x) => { hit(); return x; });
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, (m, pre, x) => { hit(); return pre + x; });
    t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, (m, pre, x) => { hit(); return pre + x; });
    t = t.replace(/`([^`\n]+)`/g, (m, x) => { hit(); return x; });
    t = t.replace(/^[ \t]*[-*+•][ \t]+/gm, () => { hit(); return ""; });
    t = t.replace(/^[ \t]*\d{1,3}[.)][ \t]+/gm, () => { hit(); return ""; });
    t = t.split("\n").map(l => l.replace(/[ \t]+$/g, "")).join("\n")
         .replace(/\n{3,}/g, "\n\n")
         .replace(/^\s+|\s+$/g, "");
    return { text: t, n };
  }

  function clean(text, opts) {
    const o = Object.assign({ structural: true, words: false, markdown: true }, opts || {});
    const before = stats(text);
    let guarded = false;
    let t = text.replace(/\r\n?/g, "\n");
    t = t.replace(INVIS, "").replace(PUA, "").replace(BLANK, " ");
    t = t.replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
         .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
         .replace(/[\u00AB\u00BB]/g, '"');
    t = t.replace(/\s*—\s*/g, ", ");
    if (o.structural && t.trim()) {
      const before2 = t;
      let s = t.replace(PRAISE_APPLY, "I am applying").replace(PRAISE_ANY, "I want to");
      s = s.replace(BOILER_LINE, "");
      s = s.replace(FRAME1, (m, a, b) => a + " and " + b);
      s = s.replace(FRAME2, (m, a, b) => a);
      s = s.replace(TRICOLON, (m, a, b, c, end) => "" + a + " and " + b + end);
      s = s.replace(TRICOLON2, (m, a, b, c) => a + " and " + b);
      s = s.replace(SIGNPOST, "");
      s = s.replace(INTENS, "");
      // chốt an toàn: nếu bước sửa câu xoá quá 65% văn bản thì bỏ, giữ bản chỉ làm sạch ký tự
      if (s.trim().length >= before2.trim().length * 0.35) t = s;
      else guarded = true;
    }
    if (o.words) for (const [re, rep] of WORDMAP) t = t.replace(re, rep);
    if (!o.markdown) t = stripMarkdown(t).text;
    t = t.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1")
         .replace(/\n{3,}/g, "\n\n").trim();
    const after = stats(t);
    return { text: t, removed: before, left: after, guarded };
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
        <button id="btnSwap" class="ghost" title="Đổi thứ tự chạy">⇄ <span id="order">Humanize → Làm sạch</span></button>
        <button id="btnRun" class="primary">Chạy</button>
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
        <input id="cKey" type="password" placeholder="API key (lưu trong chrome.storage.local)">
        <button id="btnSaveCfg" style="margin-top:6px">Lưu cấu hình</button>
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
            const r = await hooks.humanize(cur, promptText, { markdown: mdKeep });
            if (r && typeof r === "object" && typeof r.text === "string"){ cur = r.text; guard = r.preservation || null; }
            else cur = r;
          } else {
            say("Làm sạch…");
            lastClean = clean(cur, { structural: true, words: true, markdown: mdKeep });
            cur = lastClean.text;
          }
        }
        if (!lastClean) lastClean = clean(cur, { structural: true, words: true, markdown: mdKeep });
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
        $("btnRun").disabled = false;
      }
    }

    function paintGuard(guard){
      const box = $("guardBox"), list = $("guardList");
      if (!box || !list) return;
      if (!guard){ box.hidden = true; list.textContent = ""; return; }
      const issues = guard.issues || [];
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
      const c = clean(t, { structural: true, words: true, markdown: mdKeep });
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
        const r = await hooks.humanize(t, promptText, { markdown: mdKeep });
        const outText = r && typeof r === "object" ? r.text : r;
        output.value = outText;
        paintMetrics(clean(outText, { markdown: mdKeep }));
        paintGuard(r && typeof r === "object" ? r.preservation : null);
        say("Chỉ humanize — chưa làm sạch ký tự.", "ok");
      } catch (e) { say("Lỗi: " + (e && e.message ? e.message : e), "err"); }
      finally { busy = false; $("btnRun").disabled = false; }
    }

    $("btnRun").addEventListener("click", run);
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

    // API config
    const cfgFields = ["cProvider", "cBase", "cModel", "cKey"];
    const readCfg = () => ({ provider: $("cProvider").value, base: $("cBase").value.trim(), model: $("cModel").value.trim(), key: $("cKey").value });
    (async () => {
      const cfg = (hooks.loadCfg && await hooks.loadCfg()) || {};
      if (cfg.provider) $("cProvider").value = cfg.provider;
      if (cfg.base) $("cBase").value = cfg.base;
      if (cfg.model) $("cModel").value = cfg.model;
      if (cfg.key) $("cKey").value = cfg.key;
      if (!cfg.base) $("cBase").value = "https://generativelanguage.googleapis.com/v1beta";
      if (!cfg.model) $("cModel").value = "gemini-3.8-flash";
    })();
    $("btnSaveCfg").addEventListener("click", async () => {
      if (hooks.saveCfg) await hooks.saveCfg(readCfg());
      say("Đã lưu cấu hình.", "ok");
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
