/* ============================================================
   DSA notebook widget.
   - Floating FAB on every lesson + exercise page.
   - Captures notes tagged by module + lesson + concept (free text).
   - Persists in localStorage under "dsa_notes".
   - On the full notebook page (data-notebook-full="true"), renders
     a complete searchable view + Markdown / HTML / JSON exporters.
   ============================================================ */
(function () {
  var KEY = "dsa_notes";

  var MODULES = [
    { id: "general", label: "General" },
    { id: "module-00-mental-model", label: "M0 · Mental Model & Big-O" },
    { id: "module-01-arrays-hashing", label: "M1 · Arrays & Hashing" },
    { id: "module-02-stacks-queues", label: "M2 · Stacks, Queues, Deques" },
    { id: "module-03-linked-lists-trees", label: "M3 · Linked Lists & Trees" },
    { id: "module-04-heaps", label: "M4 · Heaps & Priority Queues" },
    { id: "module-05-graphs", label: "M5 · Graphs" },
    { id: "module-06-search-sort", label: "M6 · Searching & Sorting" },
    { id: "module-07-dp-greedy", label: "M7 · DP, Greedy, Backtracking" }
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  function guessModule() {
    var b = document.body || {};
    if (b.dataset && b.dataset.module) return b.dataset.module;
    var m = window.location.href.match(/module-\d+-[^\/]+/);
    return m ? m[0] : "general";
  }
  function guessConcept() {
    var b = document.body || {};
    if (b.dataset && b.dataset.concept) return b.dataset.concept;
    var t = document.title || "";
    return t.replace(/\s*·.*$/, "").trim() || "";
  }
  function moduleLabel(id) {
    for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i].label;
    return id;
  }

  function fmtTs(ts) {
    var d = new Date(ts);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  }

  /* ---- Floating widget (lesson/exercise pages) ---- */
  function mountFab() {
    if (document.body && document.body.dataset.notebookFull === "true") return;

    var fab = document.createElement("button");
    fab.className = "notebook-fab";
    fab.setAttribute("aria-label", "Open notebook");
    fab.textContent = "📓";
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "notebook-panel";
    panel.innerHTML = [
      '<div class="notebook-head">',
      '  <strong>📓 DSA notebook</strong>',
      '  <div style="display:flex; gap:6px; margin-left:auto;">',
      '    <a class="btn ghost sm" href="' + rootPath() + 'notebook.html">Full →</a>',
      '    <button class="btn ghost sm" data-nb-close aria-label="Close">×</button>',
      '  </div>',
      '</div>',
      '<div class="notebook-body" data-nb-body></div>',
      '<div class="notebook-compose">',
      '  <textarea data-nb-text placeholder="Idea, gotcha, metaphor, mistake-and-fix… anything you want in your future deep-dive."></textarea>',
      '  <div class="notebook-compose-row">',
      '    <select data-nb-module></select>',
      '    <input type="text" data-nb-concept placeholder="concept (optional)" />',
      '    <button class="btn primary sm" data-nb-save>Save</button>',
      '  </div>',
      '</div>'
    ].join("");
    document.body.appendChild(panel);

    var sel = panel.querySelector("[data-nb-module]");
    MODULES.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id; o.textContent = m.label;
      if (m.id === guessModule()) o.selected = true;
      sel.appendChild(o);
    });
    panel.querySelector("[data-nb-concept]").value = guessConcept();

    var body = panel.querySelector("[data-nb-body]");
    function render() {
      var notes = load().filter(function (n) {
        return n.module === sel.value || sel.value === "general" && n.module === "general";
      });
      notes.sort(function (a, b) { return b.ts - a.ts; });
      if (!notes.length) {
        body.innerHTML = '<p class="faint" style="text-align:center;padding:14px 0; font-size:0.85rem;">No notes for this module yet. Quick-capture anything — half-formed ideas count.</p>';
        return;
      }
      body.innerHTML = notes.slice(0, 40).map(function (n) {
        return '<div class="notebook-entry" data-id="' + n.id + '">' +
          '<div class="notebook-entry-meta"><span>' + (n.concept || moduleLabel(n.module)) + '</span><span>' + fmtTs(n.ts) + '</span></div>' +
          '<div class="notebook-entry-text">' + escapeHtml(n.text) + '</div>' +
          '<button class="notebook-entry-del" aria-label="Delete">×</button>' +
        '</div>';
      }).join("");
      Array.prototype.forEach.call(body.querySelectorAll(".notebook-entry-del"), function (b) {
        b.addEventListener("click", function () {
          var id = b.closest(".notebook-entry").dataset.id;
          save(load().filter(function (n) { return String(n.id) !== String(id); }));
          render();
        });
      });
    }
    render();
    sel.addEventListener("change", render);

    fab.addEventListener("click", function () {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) {
        render();
        panel.querySelector("[data-nb-text]").focus();
      }
    });
    panel.querySelector("[data-nb-close]").addEventListener("click", function () {
      panel.classList.remove("open");
    });
    panel.querySelector("[data-nb-save]").addEventListener("click", function () {
      var txt = panel.querySelector("[data-nb-text]").value.trim();
      if (!txt) return;
      var notes = load();
      notes.push({
        id: Date.now() + Math.random().toString(36).slice(2, 7),
        ts: Date.now(),
        module: sel.value,
        concept: panel.querySelector("[data-nb-concept]").value.trim(),
        text: txt
      });
      save(notes);
      panel.querySelector("[data-nb-text]").value = "";
      render();
    });
    panel.querySelector("[data-nb-text]").addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") panel.querySelector("[data-nb-save]").click();
    });
  }

  /* ---- Full-page view (notebook.html) ---- */
  function mountFull() {
    var root = document.querySelector("[data-notebook-full-mount]");
    if (!root) return;

    function buildExports() {
      var notes = load().slice().sort(function (a, b) { return a.ts - b.ts; });
      var byModule = {};
      notes.forEach(function (n) {
        var key = n.module || "general";
        (byModule[key] = byModule[key] || []).push(n);
      });

      var md = ["# DSA Fluency — My Deep-Dive Notebook",
                "",
                "_Exported " + new Date().toLocaleString() + " · " + notes.length + " note" + (notes.length === 1 ? "" : "s") + "_",
                "",
                "---",
                ""];
      MODULES.forEach(function (m) {
        var ns = byModule[m.id] || [];
        if (!ns.length) return;
        md.push("## " + m.label);
        md.push("");
        ns.forEach(function (n) {
          if (n.concept) md.push("### " + n.concept);
          md.push("_" + fmtTs(n.ts) + "_");
          md.push("");
          md.push(n.text);
          md.push("");
        });
        md.push("---");
        md.push("");
      });

      var html = ['<!DOCTYPE html>',
                  '<html lang="en"><head><meta charset="UTF-8"><title>DSA Fluency — Notebook Export</title>',
                  '<style>body{font-family:Inter,system-ui,sans-serif;background:#fbfaf6;color:#1c1814;line-height:1.65;max-width:780px;margin:2rem auto;padding:0 1.5rem;}',
                  'h1{font-family:Georgia,serif;font-size:2rem;margin-bottom:0.25rem;}',
                  'h2{margin-top:2.5rem;border-bottom:1px solid #d9cfbb;padding-bottom:0.4rem;font-family:Georgia,serif;font-weight:500;}',
                  'h3{color:#4f46e5;margin-top:1.5rem;}',
                  '.meta{color:#897f72;font-size:0.85rem;}',
                  '.note{background:#fff;border-left:3px solid #fbbf24;padding:0.75rem 1rem;margin:0.75rem 0;border-radius:4px;white-space:pre-wrap;}',
                  '.ts{color:#897f72;font-size:0.78rem;margin-bottom:0.4rem;}',
                  '</style></head><body>',
                  '<h1>DSA Fluency — My Deep-Dive Notebook</h1>',
                  '<p class="meta">Exported ' + new Date().toLocaleString() + ' · ' + notes.length + ' notes</p>'];
      MODULES.forEach(function (m) {
        var ns = byModule[m.id] || [];
        if (!ns.length) return;
        html.push("<h2>" + escapeHtml(m.label) + "</h2>");
        ns.forEach(function (n) {
          if (n.concept) html.push("<h3>" + escapeHtml(n.concept) + "</h3>");
          html.push('<div class="ts">' + escapeHtml(fmtTs(n.ts)) + "</div>");
          html.push('<div class="note">' + escapeHtml(n.text) + "</div>");
        });
      });
      html.push("</body></html>");

      return { md: md.join("\n"), html: html.join("\n"), json: JSON.stringify(notes, null, 2), notes: notes };
    }

    function render() {
      var x = buildExports();
      var notes = x.notes;
      var modGroups = {};
      notes.forEach(function (n) {
        (modGroups[n.module] = modGroups[n.module] || []).push(n);
      });

      var modulesHtml = MODULES.map(function (m) {
        var ns = (modGroups[m.id] || []).slice().sort(function (a, b) { return b.ts - a.ts; });
        if (!ns.length) return "";
        return '<section class="nb-section">' +
          '<h2>' + escapeHtml(m.label) + ' <span class="faint" style="font-weight:400; font-size:0.85rem;">· ' + ns.length + '</span></h2>' +
          ns.map(function (n) {
            return '<article class="nb-card" data-id="' + n.id + '">' +
              '<header class="nb-card-head">' +
                '<span class="nb-card-concept">' + escapeHtml(n.concept || "(no concept)") + '</span>' +
                '<span class="nb-card-ts faint">' + escapeHtml(fmtTs(n.ts)) + '</span>' +
              '</header>' +
              '<div class="nb-card-body">' + escapeHtml(n.text) + '</div>' +
              '<div class="nb-card-actions">' +
                '<button class="btn ghost sm" data-edit>Edit</button>' +
                '<button class="btn ghost sm" data-del>Delete</button>' +
              '</div>' +
            '</article>';
          }).join("") +
        '</section>';
      }).join("");

      root.innerHTML = '<div class="nb-meta">' +
          '<span>' + notes.length + ' note' + (notes.length === 1 ? "" : "s") + '</span>' +
          '<div class="nb-actions">' +
            '<button class="btn primary sm" data-export-md>Download Markdown</button>' +
            '<button class="btn sm" data-export-html>Download HTML</button>' +
            '<button class="btn sm" data-export-json>Download JSON</button>' +
            '<button class="btn ghost sm" data-clear>Clear all…</button>' +
          '</div>' +
        '</div>' +
        (notes.length ? modulesHtml : '<p class="muted" style="margin-top:2rem;">No notes yet. Open any lesson and tap the 📓 in the corner — your notes show up here, ready to export as your personal DSA bible.</p>');

      root.querySelector("[data-export-md]") && root.querySelector("[data-export-md]").addEventListener("click", function () {
        downloadBlob("dsa-notebook.md", x.md, "text/markdown");
      });
      root.querySelector("[data-export-html]") && root.querySelector("[data-export-html]").addEventListener("click", function () {
        downloadBlob("dsa-notebook.html", x.html, "text/html");
      });
      root.querySelector("[data-export-json]") && root.querySelector("[data-export-json]").addEventListener("click", function () {
        downloadBlob("dsa-notebook.json", x.json, "application/json");
      });
      var clearBtn = root.querySelector("[data-clear]");
      if (clearBtn) clearBtn.addEventListener("click", function () {
        if (!confirm("Delete every note? Export first if you want a copy.")) return;
        save([]);
        render();
      });

      Array.prototype.forEach.call(root.querySelectorAll(".nb-card"), function (c) {
        var id = c.dataset.id;
        c.querySelector("[data-del]").addEventListener("click", function () {
          if (!confirm("Delete this note?")) return;
          save(load().filter(function (n) { return String(n.id) !== String(id); }));
          render();
        });
        c.querySelector("[data-edit]").addEventListener("click", function () {
          var current = load().find(function (n) { return String(n.id) === String(id); });
          if (!current) return;
          var next = prompt("Edit note:", current.text);
          if (next == null) return;
          var notes = load().map(function (n) {
            return String(n.id) === String(id) ? Object.assign({}, n, { text: next }) : n;
          });
          save(notes);
          render();
        });
      });
    }

    render();
  }

  // path-prefix-from-self-src trick (HOSTING.md rule 1)
  var SELF_SRC = (document.currentScript && document.currentScript.getAttribute("src")) || "";
  function rootPath() {
    var i = SELF_SRC.indexOf("assets/");
    return i >= 0 ? SELF_SRC.substring(0, i) : "";
  }

  function init() {
    if (document.body && document.body.dataset.notebookFull === "true") {
      mountFull();
    } else {
      mountFab();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
