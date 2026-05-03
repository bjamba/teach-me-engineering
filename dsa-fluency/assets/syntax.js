/* Lazy Prism.js loader + per-element highlighter.

   Other components (codetabs.js, solution.js, the reference tool) call
   DSASyntax.highlight(pre, lang) for each code block they mount. This file
   loads Prism core + python/javascript/typescript grammars from a CDN once
   per page and then highlights the requested elements as the grammars become
   available.

   - Prism core is loaded with data-manual so we control highlighting.
   - Language plugins are loaded sequentially after core.
   - Calls made before Prism is ready are queued and flushed once it loads.
   - The CSS theme that styles .token.* classes lives in styles.css and uses
     the same color palette as the rest of the course. */
(function () {
  var PRISM_VERSION = "1.29.0";
  var BASE = "https://cdnjs.cloudflare.com/ajax/libs/prism/" + PRISM_VERSION + "/";
  var LANG_FILES = ["components/prism-python.min.js", "components/prism-javascript.min.js", "components/prism-typescript.min.js"];

  var loadPromise = null;
  var queue = [];

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadPrism() {
    if (window.Prism && window.Prism.languages && window.Prism.languages.python && window.Prism.languages.javascript && window.Prism.languages.typescript) {
      return Promise.resolve(window.Prism);
    }
    if (loadPromise) return loadPromise;
    var corePromise = window.Prism ? Promise.resolve() : loadScript(BASE + "prism.min.js", { "data-manual": "" });
    loadPromise = corePromise.then(function () {
      // Prism's autoloader could be used, but explicit loads keep things deterministic.
      return LANG_FILES.reduce(function (p, f) {
        return p.then(function () { return loadScript(BASE + f); });
      }, Promise.resolve());
    }).then(function () { return window.Prism; });
    return loadPromise;
  }

  function prismLang(lang) {
    return ({ python: "python", js: "javascript", ts: "typescript", go: "go" })[lang] || lang;
  }

  function ensureCodeLangClass(pre, lang) {
    var code = pre.querySelector("code");
    if (!code) {
      // Wrap raw text in a <code> for Prism. Preserve textContent.
      var wrap = document.createElement("code");
      wrap.textContent = pre.textContent;
      pre.textContent = "";
      pre.appendChild(wrap);
      code = wrap;
    }
    var pl = prismLang(lang);
    Array.prototype.slice.call(code.classList).forEach(function (c) {
      if (c.indexOf("language-") === 0) code.classList.remove(c);
    });
    code.classList.add("language-" + pl);
    return code;
  }

  function highlight(pre, lang) {
    if (!pre || !lang) return;
    var code = ensureCodeLangClass(pre, lang);
    loadPrism().then(function (Prism) {
      try { Prism.highlightElement(code); } catch (e) {}
    });
  }

  // Drain any calls queued before this file loaded, then replace the queue
  // with a live forwarder so further pushes highlight immediately.
  var pending = (window.__dsaSyntaxQueue && window.__dsaSyntaxQueue.length) ? window.__dsaSyntaxQueue.slice() : [];
  window.__dsaSyntaxQueue = {
    push: function (item) { highlight(item[0], item[1]); }
  };
  pending.forEach(function (item) { highlight(item[0], item[1]); });

  // Best-effort highlight of every static <pre><code class="language-X"> on the
  // page (so authors can hand-write `class="language-python"` if they want).
  function autoHighlight() {
    var els = document.querySelectorAll('pre code[class*="language-"]');
    if (!els.length) return;
    loadPrism().then(function (Prism) {
      Array.prototype.forEach.call(els, function (c) {
        try { Prism.highlightElement(c); } catch (e) {}
      });
    });
  }

  window.DSASyntax = { highlight: highlight, loadPrism: loadPrism, autoHighlight: autoHighlight };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoHighlight);
  } else {
    autoHighlight();
  }
})();
