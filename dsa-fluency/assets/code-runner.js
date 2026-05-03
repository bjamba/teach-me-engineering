/* ============================================================
   In-page code runner for dsa-fluency.
   Supports Python (via Pyodide, lazy-loaded), JavaScript, and
   TypeScript (compiled via the typescript CDN bundle, lazy-loaded).

   Usage from a lesson/exercise page:

     <div class="coderunner"
          data-cr
          data-cr-title="Two Sum"
          data-cr-langs="python,js,ts"
          data-cr-default="python"
          data-cr-id="m01-d01-twosum">
       <script type="application/json" data-cr-starter-python>
       def two_sum(nums, target):
           # your code here
           pass
       </script>
       <script type="application/json" data-cr-starter-js>
       function twoSum(nums, target) {
         // your code here
       }
       </script>
       <script type="application/json" data-cr-starter-ts>
       function twoSum(nums: number[], target: number): number[] {
         // your code here
         return [];
       }
       </script>
       <script type="application/json" data-cr-tests>
       [
         { "fn": "two_sum",  "lang": "python", "args": [[2,7,11,15], 9], "expected": [0,1], "desc": "basic" },
         { "fn": "twoSum",   "lang": "js",     "args": [[2,7,11,15], 9], "expected": [0,1], "desc": "basic" },
         { "fn": "twoSum",   "lang": "ts",     "args": [[2,7,11,15], 9], "expected": [0,1], "desc": "basic" }
       ]
       </script>
     </div>

   All editor state persists per data-cr-id under the dsa_ namespace.
   ============================================================ */
(function () {
  var NS = "dsa_";
  var PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
  var TS_URL = "https://cdnjs.cloudflare.com/ajax/libs/typescript/5.4.5/typescript.min.js";

  var pyodideLoading = null;
  var pyodide = null;
  var tsLoading = null;

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object") return a === b;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  function showSnap(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensurePyodide(setStatus) {
    if (pyodide) return Promise.resolve(pyodide);
    if (pyodideLoading) return pyodideLoading;
    setStatus("loading Python runtime…");
    pyodideLoading = loadScript(PYODIDE_URL)
      .then(function () { return window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/" }); })
      .then(function (py) { pyodide = py; setStatus("Python ready"); return py; })
      .catch(function (err) { pyodideLoading = null; setStatus("failed to load Python"); throw err; });
    return pyodideLoading;
  }

  function ensureTypeScript(setStatus) {
    if (window.ts) return Promise.resolve(window.ts);
    if (tsLoading) return tsLoading;
    setStatus("loading TypeScript compiler…");
    tsLoading = loadScript(TS_URL).then(function () { setStatus("TypeScript ready"); return window.ts; });
    return tsLoading;
  }

  function compileTS(source) {
    var out = window.ts.transpileModule(source, {
      compilerOptions: { module: window.ts.ModuleKind.None, target: window.ts.ScriptTarget.ES2020 }
    });
    return out.outputText;
  }

  function runJS(source, captureLog) {
    var orig = console.log;
    var lines = [];
    console.log = function () {
      var args = Array.prototype.slice.call(arguments);
      lines.push(args.map(function (a) {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(" "));
      orig.apply(console, arguments);
    };
    var sandbox = {};
    try {
      var fn = new Function("with(this){\n" + source + "\n; return this;}");
      var ctx = fn.call(sandbox);
      if (captureLog) captureLog(lines.join("\n"));
      return ctx;
    } finally {
      console.log = orig;
    }
  }

  function runPython(source, captureLog) {
    var capture = "import sys\nfrom io import StringIO\n_buf = StringIO()\nsys.stdout = _buf\n";
    var restore = "\nsys.stdout = sys.__stdout__\n_buf.getvalue()";
    return pyodide.runPythonAsync(capture + source + restore).then(function (out) {
      if (captureLog) captureLog(out || "");
      return null;
    });
  }

  function callJSFn(ctx, name, args) {
    if (typeof ctx[name] !== "function") throw new Error("function '" + name + "' is not defined");
    return ctx[name].apply(null, args);
  }

  function callPyFn(name, args) {
    var argsExpr = "_args";
    pyodide.globals.set("_args", pyodide.toPy(args));
    return pyodide.runPythonAsync(name + "(*" + argsExpr + ")").then(function (res) {
      if (res && typeof res.toJs === "function") {
        var js = res.toJs({ dict_converter: Object.fromEntries });
        try { res.destroy(); } catch (e) {}
        return js;
      }
      return res;
    });
  }

  function key(id, lang) { return NS + "code/" + id + "/" + lang; }

  function makeOption(value, label, selected) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    if (selected) o.selected = true;
    return o;
  }

  function readInline(el, attr) {
    var node = el.querySelector("[" + attr + "]");
    return node ? node.textContent.replace(/^\s*\n/, "").replace(/\s+$/, "") : "";
  }

  function readJSON(el, attr) {
    var node = el.querySelector("[" + attr + "]");
    if (!node) return null;
    try { return JSON.parse(node.textContent); }
    catch (e) { console.error("Bad JSON in " + attr, e); return null; }
  }

  function mountOne(el) {
    var id = el.dataset.crId || ("auto-" + Math.random().toString(36).slice(2, 8));
    var title = el.dataset.crTitle || "Code";
    var langs = (el.dataset.crLangs || "python,js,ts").split(",").map(function (s) { return s.trim(); });
    var def = el.dataset.crDefault || langs[0];

    var starters = {
      python: readInline(el, "data-cr-starter-python"),
      js:     readInline(el, "data-cr-starter-js"),
      ts:     readInline(el, "data-cr-starter-ts")
    };
    var tests = readJSON(el, "data-cr-tests") || [];

    var saved = {};
    langs.forEach(function (lang) {
      try { saved[lang] = localStorage.getItem(key(id, lang)) || starters[lang] || ""; }
      catch (e) { saved[lang] = starters[lang] || ""; }
    });

    el.innerHTML = "";
    el.classList.add("coderunner");

    var head = document.createElement("div");
    head.className = "coderunner-head";
    var titleEl = document.createElement("span");
    titleEl.className = "coderunner-title";
    titleEl.textContent = title;
    head.appendChild(titleEl);
    var tabs = document.createElement("div");
    tabs.className = "coderunner-langtabs";
    head.appendChild(tabs);
    el.appendChild(head);

    var editorWrap = document.createElement("div");
    editorWrap.className = "coderunner-editor";
    var ta = document.createElement("textarea");
    ta.spellcheck = false;
    ta.autocapitalize = "off";
    ta.autocomplete = "off";
    ta.setAttribute("autocorrect", "off");
    editorWrap.appendChild(ta);
    el.appendChild(editorWrap);

    var actions = document.createElement("div");
    actions.className = "coderunner-actions";
    var runBtn = document.createElement("button");
    runBtn.className = "btn primary sm";
    runBtn.textContent = "▶ Run";
    var testBtn = document.createElement("button");
    testBtn.className = "btn sm";
    testBtn.textContent = "✓ Run tests";
    var resetBtn = document.createElement("button");
    resetBtn.className = "btn ghost sm";
    resetBtn.textContent = "Reset";
    var status = document.createElement("span");
    status.className = "coderunner-status";
    status.textContent = "";
    actions.appendChild(runBtn);
    if (tests.length) actions.appendChild(testBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(status);
    el.appendChild(actions);

    var output = document.createElement("div");
    output.className = "coderunner-output";
    el.appendChild(output);

    var testsEl = document.createElement("div");
    testsEl.className = "coderunner-tests";
    el.appendChild(testsEl);

    var current = def;
    function setLang(lang) {
      saved[current] = ta.value;
      try { localStorage.setItem(key(id, current), saved[current]); } catch (e) {}
      current = lang;
      ta.value = saved[lang] || starters[lang] || "";
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.classList.toggle("active", b.dataset.lang === lang);
      });
    }

    langs.forEach(function (lang) {
      var b = document.createElement("button");
      b.className = "coderunner-langtab" + (lang === def ? " active" : "");
      b.dataset.lang = lang;
      b.textContent = ({ python: "Python", js: "JavaScript", ts: "TypeScript" })[lang] || lang;
      b.addEventListener("click", function () { setLang(lang); });
      tabs.appendChild(b);
    });

    ta.value = saved[current] || starters[current] || "";

    ta.addEventListener("input", function () {
      try { localStorage.setItem(key(id, current), ta.value); } catch (e) {}
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") {
        e.preventDefault();
        var s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.substring(0, s) + "    " + ta.value.substring(en);
        ta.selectionStart = ta.selectionEnd = s + 4;
      }
    });

    function setStatus(s) { status.textContent = s; }
    function writeOut(s, kind) {
      output.textContent = s || "";
      output.style.color = kind === "err" ? "var(--err)" : "var(--text)";
    }

    runBtn.addEventListener("click", function () {
      writeOut("", "ok");
      testsEl.innerHTML = "";
      runCode().catch(function (err) { writeOut(String(err && err.message || err), "err"); });
    });

    function runCode() {
      var src = ta.value;
      if (current === "python") {
        return ensurePyodide(setStatus).then(function () {
          setStatus("running…");
          return runPython(src, function (out) { writeOut(out || "(no output)"); setStatus("done"); });
        });
      } else if (current === "js") {
        setStatus("running…");
        runJS(src, function (out) { writeOut(out || "(no output)"); setStatus("done"); });
        return Promise.resolve();
      } else if (current === "ts") {
        return ensureTypeScript(setStatus).then(function () {
          setStatus("compiling…");
          var js = compileTS(src);
          setStatus("running…");
          runJS(js, function (out) { writeOut(out || "(no output)"); setStatus("done"); });
        });
      }
      return Promise.resolve();
    }

    testBtn && testBtn.addEventListener("click", function () {
      writeOut("");
      testsEl.innerHTML = "";
      runTests().catch(function (err) { writeOut(String(err && err.message || err), "err"); });
    });

    function runOne(t, ctx) {
      var lang = t.lang || current;
      var args = t.args || [];
      var expected = t.expected;
      if (lang === "python") {
        return callPyFn(t.fn, args).then(function (got) {
          var pass = deepEqual(got, expected);
          return { pass: pass, got: got, expected: expected, desc: t.desc || (t.fn + "(" + args.map(showSnap).join(", ") + ")") };
        });
      } else {
        var got = callJSFn(ctx, t.fn, args);
        var pass = deepEqual(got, expected);
        return Promise.resolve({ pass: pass, got: got, expected: expected, desc: t.desc || (t.fn + "(" + args.map(showSnap).join(", ") + ")") });
      }
    }

    function runTests() {
      var src = ta.value;
      var lang = current;
      var ofLang = tests.filter(function (t) { return (t.lang || current) === current; });
      if (!ofLang.length) {
        var node = document.createElement("div");
        node.className = "coderunner-test";
        node.innerHTML = '<span class="icon">·</span><div class="body"><div class="desc faint">No tests defined for ' + current + ' yet — try Run instead.</div></div>';
        testsEl.appendChild(node);
        return Promise.resolve();
      }
      var prep;
      if (lang === "python") {
        prep = ensurePyodide(setStatus).then(function () {
          setStatus("loading code…");
          return pyodide.runPythonAsync(src);
        });
      } else if (lang === "js") {
        prep = Promise.resolve(runJS(src));
      } else {
        prep = ensureTypeScript(setStatus).then(function () {
          var js = compileTS(src);
          return runJS(js);
        });
      }
      return prep.then(function (ctx) {
        setStatus("running tests…");
        var run = ofLang.reduce(function (chain, t) {
          return chain.then(function (acc) {
            return runOne(t, ctx).then(function (r) { acc.push(r); return acc; }, function (err) {
              acc.push({ pass: false, desc: t.desc || t.fn, error: String(err.message || err) });
              return acc;
            });
          });
        }, Promise.resolve([]));
        return run.then(function (results) {
          renderTestResults(results);
          var passed = results.filter(function (r) { return r.pass; }).length;
          setStatus(passed + " / " + results.length + " passed");
        });
      });
    }

    function renderTestResults(results) {
      testsEl.innerHTML = "";
      results.forEach(function (r) {
        var n = document.createElement("div");
        n.className = "coderunner-test " + (r.pass ? "pass" : "fail");
        var detail = "";
        if (r.error) {
          detail = '<div class="detail">error: ' + escapeHtml(r.error) + '</div>';
        } else if (!r.pass) {
          detail = '<div class="detail">got: ' + escapeHtml(showSnap(r.got)) + ' &nbsp; expected: ' + escapeHtml(showSnap(r.expected)) + '</div>';
        }
        n.innerHTML = '<span class="icon">' + (r.pass ? "✓" : "✗") + '</span><div class="body"><div class="desc">' + escapeHtml(r.desc) + '</div>' + detail + '</div>';
        testsEl.appendChild(n);
      });
    }

    resetBtn.addEventListener("click", function () {
      if (!confirm("Reset this editor to the starter code?")) return;
      ta.value = starters[current] || "";
      try { localStorage.setItem(key(id, current), ta.value); } catch (e) {}
      writeOut("");
      testsEl.innerHTML = "";
      setStatus("reset");
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }

  function init() {
    var els = document.querySelectorAll("[data-cr]");
    Array.prototype.forEach.call(els, mountOne);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
