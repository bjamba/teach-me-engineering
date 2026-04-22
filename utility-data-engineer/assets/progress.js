/* Progress tracker. localStorage key "ude_progress":
   { mode: "crash"|"deep", completed: {"module-02-snowflake/lesson-01": 1712345678901, ...}, lastSession: ts } */
(function () {
  var KEY = "ude_progress";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch(e) { return {}; }
  }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

  window.UDE_Progress = {
    get: load,
    setMode: function (m) { var d = load(); d.mode = m; d.lastSession = Date.now(); save(d); document.body.dataset.mode = m; },
    getMode: function () { return (load().mode) || "crash"; },
    markComplete: function (key) {
      var d = load(); d.completed = d.completed || {}; d.completed[key] = Date.now(); d.lastSession = Date.now(); save(d);
    },
    unmark: function (key) {
      var d = load(); if (d.completed) { delete d.completed[key]; save(d); }
    },
    isComplete: function (key) {
      var d = load(); return !!(d.completed && d.completed[key]);
    },
    countComplete: function (prefix) {
      var d = load(), n = 0;
      if (!d.completed) return 0;
      Object.keys(d.completed).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) n++; });
      return n;
    }
  };

  // Apply mode to body automatically
  if (document.body) document.body.dataset.mode = window.UDE_Progress.getMode();
  else document.addEventListener("DOMContentLoaded", function () { document.body.dataset.mode = window.UDE_Progress.getMode(); });
})();

/* Page-level "Mark this lesson complete" helper.
   Call UDE_AttachLessonComplete("module-02-snowflake/lesson-01") after DOM ready,
   and include a <button id="mark-complete"> on the page. */
function UDE_AttachLessonComplete(key) {
  var btn = document.getElementById("mark-complete");
  if (!btn) return;
  function refresh() {
    if (window.UDE_Progress.isComplete(key)) {
      btn.textContent = "✓ Completed — click to reset";
      btn.classList.add("btn-ghost");
      btn.classList.remove("btn");
    } else {
      btn.textContent = "Mark as complete";
      btn.classList.add("btn");
      btn.classList.remove("btn-ghost");
    }
  }
  btn.addEventListener("click", function () {
    if (window.UDE_Progress.isComplete(key)) window.UDE_Progress.unmark(key);
    else window.UDE_Progress.markComplete(key);
    refresh();
  });
  refresh();
}
