/* ============================================================
   Floating notepad widget.
   - localStorage key: "ude_notes" (array of {id, ts, module, text})
   - Mounts a FAB + slide-up panel on any page that includes this script.
   - Ignored on the full notepad page (which has data-notepad-full).
   - Touch-friendly, mobile-first.
   ============================================================ */
(function () {
  if (document.body && document.body.dataset.notepadFull === "true") return;

  var KEY = "ude_notes";
  var MODULES = [
    "general",
    "module-01-orientation",
    "module-02-snowflake",
    "module-03-python",
    "module-04-aws",
    "module-05-matillion",
    "module-06-git-jenkins",
    "module-07-governance",
    "module-08-streaming",
    "module-09-optimization-capstone"
  ];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }
  function guessModule() {
    var m = window.location.pathname.match(/module-\d+-[^\/]+/);
    return m ? m[0] : "general";
  }
  function fmtTs(ts) {
    var d = new Date(ts);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function render(panelBody) {
    var notes = load();
    if (!notes.length) {
      panelBody.innerHTML = '<p class="faint" style="text-align:center;padding:20px 0;">No notes yet. Jot anything down — facts, gotchas, questions, half-formed ideas. Export to Google Sheets when ready.</p>';
      return;
    }
    notes.sort(function(a,b){ return b.ts - a.ts; });
    panelBody.innerHTML = notes.map(function (n) {
      return '<div class="notepad-entry" data-id="'+n.id+'">' +
             '<div class="notepad-entry-meta"><span>'+fmtTs(n.ts)+'</span><span>'+n.module.replace(/^module-\d+-/, "")+'</span></div>' +
             '<div>'+escapeHtml(n.text)+'</div>' +
             '<button class="notepad-entry-del" aria-label="Delete">×</button>' +
             '</div>';
    }).join("");
    Array.prototype.forEach.call(panelBody.querySelectorAll(".notepad-entry-del"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.closest(".notepad-entry").dataset.id;
        save(load().filter(function (n) { return String(n.id) !== String(id); }));
        render(panelBody);
      });
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];
    });
  }

  function mount() {
    var fab = document.createElement("button");
    fab.className = "notepad-fab";
    fab.setAttribute("aria-label", "Open notepad");
    fab.textContent = "📓";
    document.body.appendChild(fab);

    var panel = document.createElement("div");
    panel.className = "notepad-panel";
    panel.innerHTML = [
      '<div class="notepad-head">',
      '<strong>📓 Notepad</strong>',
      '<div style="display:flex;gap:6px;">',
      '<a class="btn btn-ghost btn-sm" href="' + rootPath() + 'notepad.html">Full view →</a>',
      '<button class="btn btn-ghost btn-sm" id="np-close" aria-label="Close">×</button>',
      '</div>',
      '</div>',
      '<div class="notepad-body"></div>',
      '<div class="notepad-compose">',
      '<textarea id="np-text" placeholder="Quick note…"></textarea>',
      '<div class="notepad-compose-row">',
      '<select id="np-module">',
      MODULES.map(function(m){
        var sel = (m === guessModule()) ? " selected" : "";
        return '<option value="'+m+'"'+sel+'>'+m+'</option>';
      }).join(""),
      '</select>',
      '<button class="btn btn-sm" id="np-save">Save</button>',
      '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(panel);

    var body = panel.querySelector(".notepad-body");
    render(body);

    fab.addEventListener("click", function () {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) {
        render(body);
        panel.querySelector("#np-text").focus();
      }
    });
    panel.querySelector("#np-close").addEventListener("click", function(){
      panel.classList.remove("open");
    });
    panel.querySelector("#np-save").addEventListener("click", function(){
      var txt = panel.querySelector("#np-text").value.trim();
      if (!txt) return;
      var mod = panel.querySelector("#np-module").value;
      var notes = load();
      notes.push({ id: Date.now() + Math.random().toString(36).slice(2,7), ts: Date.now(), module: mod, text: txt });
      save(notes);
      panel.querySelector("#np-text").value = "";
      render(body);
    });
    // Ctrl/Cmd+Enter to save
    panel.querySelector("#np-text").addEventListener("keydown", function(e){
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        panel.querySelector("#np-save").click();
      }
    });
  }

  function rootPath() {
    // Work out how many ../ to go back to reach course root (where notepad.html lives).
    var parts = window.location.pathname.split("/").filter(Boolean);
    var idx = -1;
    for (var i = parts.length - 1; i >= 0; i--) {
      if (parts[i] === "utility-data-engineer") { idx = i; break; }
    }
    if (idx === -1) {
      // Fallback: count levels from last folder to file
      var depthRaw = parts.length - 1; // exclude file
      // Not inside a named root; assume we're at root
      return "";
    }
    var depth = parts.length - 1 - idx;
    return "../".repeat(Math.max(0, depth - 0));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
