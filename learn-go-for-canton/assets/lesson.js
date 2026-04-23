/* Shared progress-tracking helper for every lesson and exercise page.
   Each page sets window.LESSON = { module: "module-00", id: "lesson-01", kind: "lesson" }
   before this script loads, then calls GC.initLesson(). */

(function () {
  const NS = 'gc_';

  function readProgress() {
    try {
      const raw = localStorage.getItem(NS + 'progress');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeProgress(p) {
    localStorage.setItem(NS + 'progress', JSON.stringify(p));
  }

  function itemKey(mod, id, kind) { return mod + '/' + kind + '/' + id; }

  function markComplete(mod, id, kind) {
    const p = readProgress();
    p[itemKey(mod, id, kind)] = { completed_at: new Date().toISOString() };
    writeProgress(p);
    maybeCelebrate(kind);
  }

  function unmarkComplete(mod, id, kind) {
    const p = readProgress();
    delete p[itemKey(mod, id, kind)];
    writeProgress(p);
  }

  function isComplete(mod, id, kind) {
    const p = readProgress();
    return !!p[itemKey(mod, id, kind)];
  }

  function maybeCelebrate(kind) {
    /* Light celebration — confetti only if loaded. */
    if (window.confetti) {
      window.confetti({
        particleCount: kind === 'exercise' ? 90 : 45,
        spread: 70,
        origin: { y: 0.7 }
      });
    }
  }

  function bindCompleteButton(btn, mod, id, kind) {
    function update() {
      const done = isComplete(mod, id, kind);
      btn.classList.toggle('done', done);
      btn.textContent = done ? '✓ Completed — click to unmark' : 'Mark as complete';
    }
    btn.addEventListener('click', () => {
      if (isComplete(mod, id, kind)) unmarkComplete(mod, id, kind);
      else markComplete(mod, id, kind);
      update();
    });
    update();
  }

  function initLesson() {
    const L = window.LESSON;
    if (!L) return;
    const btn = document.getElementById('completeBtn');
    if (btn) bindCompleteButton(btn, L.module, L.id, L.kind);
  }

  /* Expose helpers for exercise pages that need richer state. */
  window.GC = {
    NS,
    readProgress,
    writeProgress,
    isComplete,
    markComplete,
    unmarkComplete,
    initLesson
  };
})();
