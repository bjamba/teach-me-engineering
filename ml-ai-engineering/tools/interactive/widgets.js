/* ============================================================
   Inline learning widgets. Scans the page for [data-widget] and
   initializes three kinds:
     data-widget="check"   — prediction check (numeric / text / multi)
     data-widget="code"    — runnable Python cell (Pyodide, lazy-loaded)
     data-widget="embed"   — iframe-embed of another tool page

   Drop-in usage:
     <link rel="stylesheet" href="../tools/interactive/widgets.css">
     <script defer src="../tools/interactive/widgets.js"></script>

   ============================================================ */

(function () {
  "use strict";

  // ---------------- KaTeX re-rendering -------------------------
  // Widgets inject content (prompts, hints, explanations, feedback) that
  // KaTeX's initial document.body pass missed or that arrives later when
  // the learner submits an answer. Call this on any element holding $…$
  // or $$…$$ that needs math rendered.
  function renderMath(el) {
    if (!el || typeof window.renderMathInElement !== "function") return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false }
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      });
    } catch (e) { /* swallow — bad math shouldn't break the widget */ }
  }

  // ---------------- Pyodide (lazy) -----------------------------
  let pyodidePromise = null;
  const PYODIDE_VERSION = "0.26.2";

  function ensurePyodide(statusEl) {
    if (pyodidePromise) return pyodidePromise;
    pyodidePromise = new Promise(function (resolve, reject) {
      if (statusEl) statusEl.textContent = "Loading Python runtime (~10 MB, cached after first load)…";
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/pyodide.js";
      s.onload = async function () {
        try {
          if (statusEl) statusEl.textContent = "Starting Python…";
          const py = await window.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/"
          });
          if (statusEl) statusEl.textContent = "Loading NumPy…";
          await py.loadPackage(["numpy"]);
          if (statusEl) statusEl.textContent = "Ready.";
          resolve(py);
        } catch (e) {
          reject(e);
        }
      };
      s.onerror = function () { reject(new Error("Failed to load Pyodide")); };
      document.head.appendChild(s);
    });
    return pyodidePromise;
  }

  // ---------------- CHECK widget -------------------------------
  // <div data-widget="check"
  //      data-answer="10"          (required; can be number, string, or pipe-separated list "10|ten")
  //      data-tolerance="0.01"     (optional; numeric tolerance, default 0)
  //      data-choices="pos|zero|neg" (optional; when present, renders buttons instead of input)
  //      data-explain="optional explanation HTML shown after answering">
  //   <div data-prompt>What is [3,1]·[2,4]?</div>
  // </div>
  function initCheck(el) {
    const rawAnswer = el.dataset.answer || "";
    const answers = rawAnswer.split("|").map(s => s.trim());
    const tolerance = parseFloat(el.dataset.tolerance || "0");
    const choices = el.dataset.choices ? el.dataset.choices.split("|").map(s => s.trim()) : null;
    const labelText = el.dataset.label || "Try it";
    const explain = el.dataset.explain || "";
    const promptEl = el.querySelector("[data-prompt]");
    const promptHtml = promptEl ? promptEl.innerHTML : el.innerHTML;

    el.classList.add("w-card");
    el.innerHTML = "";

    const label = document.createElement("div");
    label.className = "w-label";
    label.textContent = labelText;
    el.appendChild(label);

    const prompt = document.createElement("div");
    prompt.className = "w-prompt";
    prompt.innerHTML = promptHtml;
    el.appendChild(prompt);

    const feedback = document.createElement("div");
    feedback.className = "w-feedback";

    function isCorrect(given) {
      const g = given.trim();
      if (!g) return false;
      for (const a of answers) {
        if (tolerance > 0) {
          const gn = parseFloat(g), an = parseFloat(a);
          if (!isNaN(gn) && !isNaN(an) && Math.abs(gn - an) <= tolerance) return true;
        }
        if (g.toLowerCase() === a.toLowerCase()) return true;
        const gn = parseFloat(g), an = parseFloat(a);
        if (!isNaN(gn) && !isNaN(an) && gn === an) return true;
      }
      return false;
    }

    function reveal(ok, given) {
      feedback.classList.add("show");
      feedback.classList.toggle("ok", ok);
      feedback.classList.toggle("no", !ok);
      let msg = ok
        ? '<strong>Correct.</strong> <code>' + escapeHtml(answers[0]) + '</code>'
        : '<strong>Not quite.</strong> Expected <code>' + escapeHtml(answers[0]) + '</code>' + (given ? ', got <code>' + escapeHtml(given) + '</code>' : '') + '.';
      if (explain) msg += '<div class="hint">' + explain + '</div>';
      feedback.innerHTML = msg;
      renderMath(feedback);
      if (ok) {
        label.classList.add("done");
        el.dispatchEvent(new CustomEvent("widget:done", { bubbles: true }));
      }
    }

    // ---- optional scratch pad (default: on for inputs, off for multi-choice
    //      and any widget marked data-scratch="off") ----
    const scratchOverride = (el.dataset.scratch || "").toLowerCase();
    const scratchEnabled = scratchOverride === "on"
      ? true
      : scratchOverride === "off"
        ? false
        : !choices;
    let scratchToggle = null;
    let scratchPad = null;
    if (scratchEnabled) {
      scratchToggle = document.createElement("button");
      scratchToggle.type = "button";
      scratchToggle.className = "w-scratch-toggle";
      scratchToggle.textContent = "📝 Scratch";
      scratchToggle.title = "Open a scratch area for notes / arithmetic";
      scratchPad = document.createElement("textarea");
      scratchPad.className = "w-scratch";
      scratchPad.spellcheck = false;
      scratchPad.placeholder = "Jot your working. Nothing is submitted — just a surface to think on.";
      scratchPad.rows = 3;
      scratchToggle.addEventListener("click", function () {
        const open = scratchPad.classList.toggle("open");
        scratchToggle.classList.toggle("active", open);
        if (open) scratchPad.focus();
      });
    }

    if (choices) {
      const choiceWrap = document.createElement("div");
      choiceWrap.className = "w-choices";
      const buttons = [];
      choices.forEach(function (c) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "w-choice";
        btn.textContent = c;
        btn.addEventListener("click", function () {
          buttons.forEach(b => { b.classList.remove("selected"); b.disabled = true; });
          const ok = isCorrect(c);
          btn.classList.add(ok ? "correct" : "wrong");
          if (!ok) {
            buttons.forEach(b => { if (isCorrect(b.textContent)) b.classList.add("correct"); });
          }
          reveal(ok, c);
        });
        buttons.push(btn);
        choiceWrap.appendChild(btn);
      });
      el.appendChild(choiceWrap);
    } else {
      const row = document.createElement("div");
      row.className = "w-row";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "w-input";
      input.placeholder = el.dataset.placeholder || "Your answer";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-btn";
      btn.textContent = "Check";
      function submit() {
        const v = input.value;
        const ok = isCorrect(v);
        input.classList.remove("correct", "wrong");
        input.classList.add(ok ? "correct" : "wrong");
        reveal(ok, v);
      }
      btn.addEventListener("click", submit);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
      row.appendChild(input);
      row.appendChild(btn);
      if (scratchToggle) row.appendChild(scratchToggle);
      el.appendChild(row);
    }

    if (choices && scratchToggle) {
      const scratchRow = document.createElement("div");
      scratchRow.className = "w-row w-row-scratch";
      scratchRow.appendChild(scratchToggle);
      el.appendChild(scratchRow);
    }

    if (scratchPad) el.appendChild(scratchPad);
    el.appendChild(feedback);
    renderMath(el);
  }

  // ---------------- CODE widget --------------------------------
  // <div data-widget="code"
  //      data-label="Run this"
  //      data-expected="10"         (optional; compared against last stdout line, trimmed)
  //      data-starter="a = np.array([3,1])\nb = np.array([2,4])\nprint(a @ b)">
  //   <div data-hint>…optional HTML to show above the editor…</div>
  // </div>
  function initCode(el) {
    const starter = el.dataset.starter ? decodeStarter(el.dataset.starter) : (el.querySelector("[data-starter]")?.textContent || "");
    const expected = el.dataset.expected;
    const labelText = el.dataset.label || "Run this";
    const hintEl = el.querySelector("[data-hint]");
    const hintHtml = hintEl ? hintEl.innerHTML : "";

    el.classList.add("w-card");
    el.innerHTML = "";

    const label = document.createElement("div");
    label.className = "w-label";
    label.textContent = labelText;
    el.appendChild(label);

    if (hintHtml) {
      const hint = document.createElement("div");
      hint.className = "w-prompt";
      hint.innerHTML = hintHtml;
      el.appendChild(hint);
    }

    const codeWrap = document.createElement("div");
    codeWrap.className = "w-code";

    const header = document.createElement("div");
    header.className = "w-code-header";
    header.innerHTML = "<span>python · numpy available as np</span><span>edit + run</span>";
    codeWrap.appendChild(header);

    const editor = document.createElement("textarea");
    editor.className = "w-editor";
    editor.spellcheck = false;
    editor.value = starter.trim();
    editor.rows = Math.max(3, (starter.trim().split("\n").length || 3));
    codeWrap.appendChild(editor);

    const footer = document.createElement("div");
    footer.className = "w-code-footer";
    const status = document.createElement("div");
    status.className = "w-code-status";
    status.textContent = "Not run yet.";
    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "w-btn";
    runBtn.textContent = "▶ Run";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "w-btn w-btn-ghost";
    resetBtn.textContent = "Reset";
    footer.appendChild(status);
    footer.appendChild(resetBtn);
    footer.appendChild(runBtn);
    codeWrap.appendChild(footer);

    const output = document.createElement("div");
    output.className = "w-output";
    codeWrap.appendChild(output);

    el.appendChild(codeWrap);
    renderMath(el);

    resetBtn.addEventListener("click", function () {
      editor.value = starter.trim();
      output.classList.remove("show", "err", "match-ok", "match-no");
      output.textContent = "";
      status.textContent = "Not run yet.";
      label.classList.remove("done");
    });

    runBtn.addEventListener("click", async function () {
      runBtn.disabled = true;
      resetBtn.disabled = true;
      output.classList.remove("err", "match-ok", "match-no");
      output.classList.add("show");
      output.textContent = "";
      status.textContent = "Preparing…";
      try {
        const py = await ensurePyodide(status);
        status.textContent = "Running…";
        const src = editor.value;
        const wrapped =
          "import sys, io, numpy as np\n" +
          "__buf = io.StringIO()\n" +
          "__old = sys.stdout\n" +
          "sys.stdout = __buf\n" +
          "try:\n" +
          src.split("\n").map(l => "    " + l).join("\n") + "\n" +
          "finally:\n" +
          "    sys.stdout = __old\n" +
          "__buf.getvalue()";
        const result = await py.runPythonAsync(wrapped);
        const text = (result || "").toString();
        output.textContent = text || "(no output)";
        if (expected !== undefined) {
          const last = text.trim().split("\n").pop() || "";
          const exp = String(expected).trim();
          const ok = last === exp ||
            (!isNaN(parseFloat(last)) && !isNaN(parseFloat(exp)) &&
             Math.abs(parseFloat(last) - parseFloat(exp)) < 1e-6);
          output.classList.add(ok ? "match-ok" : "match-no");
          status.textContent = ok ? "✓ matches expected " + exp : "Output: " + last + " · expected " + exp;
          if (ok) {
            label.classList.add("done");
            el.dispatchEvent(new CustomEvent("widget:done", { bubbles: true }));
          }
        } else {
          status.textContent = "Done.";
        }
      } catch (e) {
        output.classList.add("err");
        output.textContent = String(e.message || e);
        status.textContent = "Error.";
      } finally {
        runBtn.disabled = false;
        resetBtn.disabled = false;
      }
    });
  }

  // ---------------- EMBED widget -------------------------------
  // <div data-widget="embed"
  //      data-src="../tools/matrix-visualizer.html"
  //      data-height="640"
  //      data-title="Matrix Transformation Visualizer">
  // </div>
  function initEmbed(el) {
    const src = el.dataset.src;
    const height = el.dataset.height || "560";
    const title = el.dataset.title || "Interactive tool";
    if (!src) return;

    el.classList.add("w-embed");
    el.innerHTML = "";

    const header = document.createElement("div");
    header.className = "w-embed-header";
    header.innerHTML =
      '<span style="color: var(--w-text-muted); font-size:12px; text-transform:uppercase; letter-spacing:0.06em;">🧪 ' + escapeHtml(title) + '</span>' +
      '<a href="' + encodeURI(src) + '" target="_blank" rel="noopener">Open in new tab ↗</a>';
    el.appendChild(header);

    const iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.height = height;
    iframe.loading = "lazy";
    iframe.title = title;
    el.appendChild(iframe);
  }

  // ---------------- QUIZ widget --------------------------------
  // Wraps a group of check/code widgets with a progress tally.
  // <div data-widget="quiz" data-title="Self-check">
  //   <div data-widget="check" ...>...</div>
  //   <div data-widget="code" ...>...</div>
  //   ...
  // </div>
  function initQuiz(el) {
    const title = el.dataset.title || "Self-check";
    const children = Array.from(el.querySelectorAll('[data-widget="check"], [data-widget="code"]'));
    const total = children.length;
    if (total === 0) return;

    const header = document.createElement("div");
    header.className = "w-quiz-header";
    header.innerHTML =
      '<div class="w-quiz-title">' + escapeHtml(title) + '</div>' +
      '<div class="w-quiz-progress"><div class="w-quiz-bar"></div><span class="w-quiz-count">0 / ' + total + ' correct</span></div>';
    el.classList.add("w-quiz", "w-quiz-paged");
    el.insertBefore(header, el.firstChild);

    const bar = header.querySelector(".w-quiz-bar");
    const count = header.querySelector(".w-quiz-count");
    const completed = new Set();

    // Pagination — one question at a time
    let current = 0;
    function show(i) {
      if (i < 0 || i >= total) return;
      current = i;
      children.forEach(function (c, idx) { c.classList.toggle("active", idx === i); });
      pageLabel.textContent = "Question " + (i + 1) + " of " + total;
      prevBtn.disabled = i === 0;
      nextBtn.disabled = i === total - 1;
      jumpBtns.forEach(function (b, idx) {
        b.classList.toggle("current", idx === i);
      });
    }

    children.forEach(function (c, idx) {
      c.classList.add("w-quiz-page");
      if (idx !== 0) c.classList.remove("active");
      else c.classList.add("active");
    });

    const footer = document.createElement("div");
    footer.className = "w-quiz-footer";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "w-btn w-btn-ghost";
    prevBtn.textContent = "← Prev";
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "w-btn";
    nextBtn.textContent = "Next →";
    const pageLabel = document.createElement("div");
    pageLabel.className = "w-quiz-page-label";

    const jumpRow = document.createElement("div");
    jumpRow.className = "w-quiz-jump";
    const jumpBtns = children.map(function (c, idx) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "w-quiz-jump-btn";
      dot.textContent = String(idx + 1);
      dot.title = "Go to question " + (idx + 1);
      dot.addEventListener("click", function () { show(idx); });
      jumpRow.appendChild(dot);
      return dot;
    });

    prevBtn.addEventListener("click", function () { show(current - 1); });
    nextBtn.addEventListener("click", function () { show(current + 1); });

    footer.appendChild(prevBtn);
    footer.appendChild(pageLabel);
    footer.appendChild(nextBtn);

    el.appendChild(jumpRow);
    el.appendChild(footer);

    show(0);

    el.addEventListener("widget:done", function (ev) {
      const target = ev.target.closest('[data-widget="check"], [data-widget="code"]');
      if (!target || completed.has(target)) return;
      completed.add(target);
      const idx = children.indexOf(target);
      if (idx >= 0) jumpBtns[idx].classList.add("done");
      const n = completed.size;
      const pct = Math.round((n / total) * 100);
      bar.style.width = pct + "%";
      count.textContent = n + " / " + total + " correct";
      if (n === total) {
        el.classList.add("w-quiz-done");
        const banner = document.createElement("div");
        banner.className = "w-quiz-banner";
        banner.innerHTML = "✓ <strong>All " + total + " correct.</strong> You can move on.";
        header.appendChild(banner);
      }
    });
  }

  // ---------------- helpers ------------------------------------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function decodeStarter(s) {
    return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }

  // ---------------- boot ---------------------------------------
  function init() {
    document.querySelectorAll('[data-widget="check"]').forEach(initCheck);
    document.querySelectorAll('[data-widget="code"]').forEach(initCode);
    document.querySelectorAll('[data-widget="embed"]').forEach(initEmbed);
    // Quiz must run after its children are initialized
    document.querySelectorAll('[data-widget="quiz"]').forEach(initQuiz);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
