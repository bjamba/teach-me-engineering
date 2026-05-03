/* Code-tabs component — language toggle for static code examples.

   Markup pattern any lesson can use:

     <div class="codetabs" data-langs="python,js,ts">
       <pre data-lang="python"><code>def two_sum(nums, target):
           ...</code></pre>
       <pre data-lang="js"><code>function twoSum(nums, target) {
         ...
       }</code></pre>
       <pre data-lang="ts"><code>function twoSum(nums: number[], target: number): number[] {
         ...
       }</code></pre>
     </div>

   - Renders a tab strip across the top with one button per language.
   - Shows only the active language; the rest are hidden.
   - The course-wide preferred language is remembered in localStorage
     under "dsa_codelang" so that switching once propagates everywhere.
   - Listens for "dsa-codelang-changed" custom events so all instances
     on the page sync when one is changed. */
(function () {
  var KEY = "dsa_codelang";

  // Lazy-load syntax.js once if it's not already on the page. This way every
  // lesson that already loads codetabs.js gets syntax highlighting for free.
  var SELF_SRC = (document.currentScript && document.currentScript.getAttribute("src")) || "";
  function syntaxPath() {
    var i = SELF_SRC.lastIndexOf("/");
    return i >= 0 ? SELF_SRC.substring(0, i + 1) + "syntax.js" : "syntax.js";
  }
  function ensureSyntax() {
    if (window.DSASyntax) return;
    if (document.querySelector('script[data-dsa-syntax]')) return;
    var s = document.createElement("script");
    s.src = syntaxPath();
    s.setAttribute("data-dsa-syntax", "");
    document.head.appendChild(s);
  }
  ensureSyntax();

  function loadPref() {
    try { return localStorage.getItem(KEY) || null; } catch (e) { return null; }
  }
  function savePref(l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
  }

  function langName(l) {
    return ({ python: "Python", js: "JavaScript", ts: "TypeScript", go: "Go" })[l] || l;
  }

  function copy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "copy-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 220); }, 1200);
  }

  function mountOne(el) {
    var declaredLangs = (el.dataset.langs || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    // Discover what's actually present
    var pres = Array.prototype.slice.call(el.querySelectorAll(":scope > pre[data-lang]"));
    if (!pres.length) return;
    var present = pres.map(function (p) { return p.dataset.lang; });
    var langs = (declaredLangs.length ? declaredLangs : present).filter(function (l) { return present.indexOf(l) !== -1; });
    if (!langs.length) return;

    // Build the tab strip
    var head = document.createElement("div");
    head.className = "codetabs-head";
    var tabs = document.createElement("div");
    tabs.className = "codetabs-tabs";
    head.appendChild(tabs);

    var copyBtn = document.createElement("button");
    copyBtn.className = "codetabs-copy";
    copyBtn.title = "Copy code";
    copyBtn.textContent = "📋";
    head.appendChild(copyBtn);

    el.insertBefore(head, el.firstChild);

    var pref = loadPref();
    var initial = pref && langs.indexOf(pref) !== -1 ? pref : langs[0];

    function setLang(l, propagate) {
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.classList.toggle("active", b.dataset.lang === l);
      });
      pres.forEach(function (p) {
        p.classList.toggle("active", p.dataset.lang === l);
      });
      el.dataset.activeLang = l;
      if (propagate !== false) {
        savePref(l);
        document.dispatchEvent(new CustomEvent("dsa-codelang-changed", { detail: { lang: l, source: el } }));
      }
    }

    langs.forEach(function (l) {
      var b = document.createElement("button");
      b.className = "codetabs-tab";
      b.dataset.lang = l;
      b.textContent = langName(l);
      b.addEventListener("click", function () { setLang(l); });
      tabs.appendChild(b);
    });

    setLang(initial, false);

    // Tag each <pre>'s inner <code> with a language- class. syntax.js
    // (lazy-loaded above) will pick these up and highlight via Prism.
    function prismLang(l) { return ({ python: "python", js: "javascript", ts: "typescript", go: "go" })[l] || l; }
    pres.forEach(function (p) {
      var code = p.querySelector("code");
      if (!code) {
        // wrap raw text content in a <code>
        var c = document.createElement("code");
        c.textContent = p.textContent;
        p.textContent = "";
        p.appendChild(c);
        code = c;
      }
      Array.prototype.slice.call(code.classList).forEach(function (c) {
        if (c.indexOf("language-") === 0) code.classList.remove(c);
      });
      code.classList.add("language-" + prismLang(p.dataset.lang));
      // Queue highlight; syntax.js drains the queue when it loads.
      (window.__dsaSyntaxQueue = window.__dsaSyntaxQueue || []).push([p, p.dataset.lang]);
    });

    copyBtn.addEventListener("click", function () {
      var pre = el.querySelector("pre[data-lang].active code") || el.querySelector("pre[data-lang].active");
      if (!pre) return;
      if (copy(pre.textContent)) toast("Copied " + langName(el.dataset.activeLang));
    });

    document.addEventListener("dsa-codelang-changed", function (ev) {
      if (ev.detail.source === el) return;
      if (langs.indexOf(ev.detail.lang) !== -1) setLang(ev.detail.lang, false);
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".codetabs"), mountOne);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
