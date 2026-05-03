/* Tiny helper: hooks up the "Mark lesson complete" button to dsa_progress.
   Reads data-lesson-id from <body> in the form "module-XX/lesson/lesson-YY"
   or "module-XX/exercise/drill-YY". */
(function () {
  var k = "dsa_progress";
  var btn = document.querySelector("[data-complete]");
  var id = document.body && document.body.dataset && document.body.dataset.lessonId;
  if (!btn || !id) return;
  function load() { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } }
  function save(p) { localStorage.setItem(k, JSON.stringify(p)); }
  var p = load();
  var doneLabel = btn.dataset.doneLabel || "✓ Marked complete";
  if (p[id]) { btn.classList.add("done"); btn.textContent = doneLabel; }
  btn.addEventListener("click", function () {
    p = load();
    p[id] = true;
    save(p);
    btn.classList.add("done");
    btn.textContent = doneLabel;
    if (window.confetti) {
      try { window.confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } }); } catch (e) {}
    }
  });
})();
