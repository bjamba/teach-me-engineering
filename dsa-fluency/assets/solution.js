/* Solution reveal + per-language tabs + copy-to-clipboard.

   Markup pattern any drill can use:

     <div class="solution" data-langs="python,js,ts">
       <pre class="solution-pre" data-lang="python">
       def two_sum(nums, target):
           ...
       </pre>
       <pre class="solution-pre" data-lang="js">
       function twoSum(nums, target) {
         ...
       }
       </pre>
       <pre class="solution-pre" data-lang="ts">
       function twoSum(nums: number[], target: number): number[] { ... }
       </pre>
       <div class="solution-explanation">
         O(n) time, O(n) space. Trade space for an O(1) complement lookup.
       </div>
     </div>

   This script:
   - inserts the head ("Show solution") and a langtab strip
   - wires tab clicks to swap which <pre> is shown
   - adds a Copy button that copies the visible solution
*/
(function () {
  // Lazy-load syntax.js so solution code blocks get highlighted.
  var SELF_SRC = (document.currentScript && document.currentScript.getAttribute("src")) || "";
  function ensureSyntax() {
    if (window.DSASyntax) return;
    if (document.querySelector('script[data-dsa-syntax]')) return;
    var i = SELF_SRC.lastIndexOf("/");
    var src = i >= 0 ? SELF_SRC.substring(0, i + 1) + "syntax.js" : "syntax.js";
    var s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-dsa-syntax", "");
    document.head.appendChild(s);
  }
  ensureSyntax();

  function prismLang(l) { return ({ python: "python", js: "javascript", ts: "typescript", go: "go" })[l] || l; }

  function copy(text) {
    var ok = false;
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      ok = true;
    }
    return ok;
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "copy-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () {
      t.classList.remove("show");
      setTimeout(function () { t.remove(); }, 220);
    }, 1400);
  }
  function langName(l) { return ({ python: "Python", js: "JavaScript", ts: "TypeScript", go: "Go" })[l] || l; }

  function mountOne(el) {
    var langs = (el.dataset.langs || "python,js,ts").split(",").map(function (s) { return s.trim(); });
    var pres = Array.prototype.slice.call(el.querySelectorAll(".solution-pre"));
    var explanation = el.querySelector(".solution-explanation");

    pres.forEach(function (p) {
      // strip leading newline + indentation that came from the HTML formatting
      var raw = p.textContent;
      raw = raw.replace(/^\n/, "").replace(/\s+$/, "");
      // dedent based on minimum indent of non-empty lines
      var lines = raw.split("\n");
      var min = Infinity;
      lines.forEach(function (ln) {
        if (!ln.trim()) return;
        var m = ln.match(/^(\s*)/);
        if (m && m[1].length < min) min = m[1].length;
      });
      if (min !== Infinity && min > 0) {
        p.textContent = lines.map(function (ln) { return ln.slice(min); }).join("\n");
      } else {
        p.textContent = raw;
      }
      // Tag inner <code> with a language class; queue highlight for syntax.js.
      if (p.dataset.lang) {
        var code = document.createElement("code");
        code.textContent = p.textContent;
        code.classList.add("language-" + prismLang(p.dataset.lang));
        p.textContent = "";
        p.appendChild(code);
        (window.__dsaSyntaxQueue = window.__dsaSyntaxQueue || []).push([p, p.dataset.lang]);
      }
    });

    var head = document.createElement("div");
    head.className = "solution-head";
    head.innerHTML = '<span class="icon">▸</span><span class="label">Show solution</span><span class="hint">try it yourself first — then peek</span>';
    el.insertBefore(head, el.firstChild);

    var body = document.createElement("div");
    body.className = "solution-body";

    var tabs = document.createElement("div");
    tabs.className = "solution-langs";
    body.appendChild(tabs);

    pres.forEach(function (p) {
      body.appendChild(p);
    });
    if (explanation) body.appendChild(explanation);

    var actions = document.createElement("div");
    actions.className = "solution-actions";
    var copyBtn = document.createElement("button");
    copyBtn.className = "btn sm";
    copyBtn.textContent = "📋 Copy";
    actions.appendChild(copyBtn);
    body.appendChild(actions);

    el.appendChild(body);

    var current = langs[0];
    function setLang(l) {
      current = l;
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.classList.toggle("active", b.dataset.lang === l);
      });
      pres.forEach(function (p) {
        p.classList.toggle("active", p.dataset.lang === l);
      });
    }
    langs.forEach(function (l, i) {
      var b = document.createElement("button");
      b.className = "solution-langtab" + (i === 0 ? " active" : "");
      b.dataset.lang = l;
      b.textContent = langName(l);
      b.addEventListener("click", function () { setLang(l); });
      tabs.appendChild(b);
    });
    setLang(langs[0]);

    head.addEventListener("click", function () {
      el.classList.toggle("open");
      head.querySelector(".label").textContent = el.classList.contains("open") ? "Hide solution" : "Show solution";
    });

    copyBtn.addEventListener("click", function () {
      var pre = el.querySelector(".solution-pre.active");
      if (!pre) return;
      if (copy(pre.textContent)) toast("Copied " + langName(current) + " solution");
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".solution"), mountOne);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
