/* Knowledge check wiring + lesson progress tracking.
   Classic script (no modules) so file:// works.
   Auto-wires every .q on the page. Reads correct answer from data-correct.
   Persists per-lesson completion to localStorage under ts_progress.
   Reads lesson id from <body data-lesson="..."> if present.
*/
(function() {
  var NS = 'ts_';
  var quizState = {};

  function lessonId() {
    return document.body.getAttribute('data-lesson') || null;
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(NS + 'progress') || '{}'); }
    catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(NS + 'progress', JSON.stringify(p)); } catch (e) {}
  }

  function markLessonComplete() {
    var id = lessonId();
    if (!id) return;
    var p = loadProgress();
    p.lessons = p.lessons || {};
    if (!p.lessons[id]) {
      p.lessons[id] = { completed_at: new Date().toISOString() };
      saveProgress(p);
    }
  }

  document.querySelectorAll('.q').forEach(function(q, idx) {
    var correct = q.dataset.correct;
    q.querySelectorAll('.opt').forEach(function(opt) {
      opt.addEventListener('click', function() {
        if (quizState[idx]) return;
        var choice = opt.dataset.choice;
        var isRight = choice === correct;
        quizState[idx] = isRight ? 'right' : 'wrong';

        q.querySelectorAll('.opt').forEach(function(o) {
          o.setAttribute('disabled', '');
          if (o.dataset.choice === correct) o.classList.add('correct');
          else if (o === opt) o.classList.add('wrong');
        });
        q.querySelectorAll('.feedback').forEach(function(f) { f.classList.remove('show'); });
        if (isRight) {
          var ok = q.querySelector('.feedback.ok');
          if (ok) ok.classList.add('show');
        } else {
          var fb = q.querySelector('.feedback.no[data-for="' + choice + '"]');
          if (fb) fb.classList.add('show');
          else {
            var fallback = q.querySelector('.feedback.no');
            if (fallback) fallback.classList.add('show');
          }
        }

        var total = document.querySelectorAll('.q').length;
        var answered = Object.keys(quizState).length;
        if (answered === total) {
          var right = Object.values(quizState).filter(function(v) { return v === 'right'; }).length;
          var summary = document.getElementById('check-summary');
          if (!summary) return;
          var scoreEl = document.getElementById('check-score');
          if (scoreEl) scoreEl.textContent = right + ' / ' + total;
          summary.classList.add('show');
          var msgEl = summary.querySelector('.msg') || summary.querySelector('div:last-child');
          if (msgEl) {
            if (right === total) msgEl.textContent = "Nailed it. Ready for the next lesson.";
            else if (right >= total - 1) msgEl.textContent = "Solid. Glance back at the section for the missed one and you're set.";
            else msgEl.textContent = "Worth a re-skim before moving on — the wrong answers explain where each idea lives.";
          }
          // Mark lesson complete on quiz finish
          markLessonComplete();
        }
      });
    });
  });

  // Quick / Deep toggle (if present)
  document.querySelectorAll('#depth-toggle button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('#depth-toggle button').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var narr = document.getElementById('narrative');
      if (narr) narr.classList.toggle('quick', btn.dataset.depth === 'quick');
    });
  });

  // === Track preference (Quickstart vs Comprehensive) ===
  function getTrack() {
    try { return localStorage.getItem(NS + 'track') || 'comprehensive'; } catch (e) { return 'comprehensive'; }
  }
  function setTrack(t) {
    try { localStorage.setItem(NS + 'track', t); } catch (e) {}
  }
  // Expose for module pages
  window.tsTrack = { get: getTrack, set: setTrack };

  // On lesson pages: default depth toggle to "quick" if track is quickstart
  (function applyTrackToLesson() {
    var toggle = document.getElementById('depth-toggle');
    var narr = document.getElementById('narrative');
    if (!toggle || !narr) return;
    if (getTrack() === 'quickstart') {
      toggle.querySelectorAll('button').forEach(function(b) {
        b.classList.toggle('active', b.dataset.depth === 'quick');
      });
      narr.classList.add('quick');
    }
  })();

  // === Module index helpers ===
  // Module definitions (single source of truth)
  var MODULES = [
    { id: 'm0', dir: 'module-00-terminal', title: 'M0 · Terminal primer', total: 5, optional: true },
    { id: 'm1', dir: 'module-01-networking', title: 'M1 · Networking', total: 6 },
    { id: 'm2', dir: 'module-02-tailscale', title: 'M2 · What Tailscale is', total: 5 },
    { id: 'm3', dir: 'module-03-onboarding', title: 'M3 · Onboarding', total: 7 },
    { id: 'm4', dir: 'module-04-toolbox', title: 'M4 · Toolbox', total: 8 },
    { id: 'm5', dir: 'module-05-ops', title: 'M5 · Ops & security', total: 5 },
  ];
  window.tsModules = MODULES;

  // Render the course-wide progress strip (call from module index pages)
  // Pass currentModuleId, e.g. 'm1', and the prefix path back to the course root (e.g. '../')
  window.tsRenderCourseStrip = function(currentId, rootPath) {
    rootPath = rootPath || '../';
    var el = document.getElementById('course-strip');
    if (!el) return;
    var p = loadProgress();
    var lessons = p.lessons || {};
    el.innerHTML = MODULES.map(function(m) {
      var done = 0;
      for (var i = 1; i <= m.total; i++) if (lessons[m.id + 'l' + i]) done++;
      var pct = m.total ? Math.round(done * 100 / m.total) : 0;
      var cls = 'stage';
      if (m.id === currentId) cls += ' current';
      else if (done >= m.total && m.total > 0) cls += ' done';
      return '<a class="' + cls + '" href="' + rootPath + m.dir + '/index.html">' +
        '<div class="stage-head"><span>' + m.id.toUpperCase() + '</span>' + (m.optional ? ' <span style="opacity:0.6">opt</span>' : '') + '</div>' +
        '<div class="stage-title">' + m.title.split('·')[1].trim() + '</div>' +
        '<div class="stage-bar"><div class="stage-fill" style="width:' + pct + '%"></div></div>' +
      '</a>';
    }).join('');
  };

  // Render the track banner. Call from module index pages.
  window.tsRenderTrackBanner = function() {
    var el = document.getElementById('track-banner');
    if (!el) return;
    function paint() {
      var t = getTrack();
      el.className = 'track-banner ' + (t === 'quickstart' ? 'quickstart' : '');
      el.innerHTML = (t === 'quickstart'
        ? '<span class="track-name">⚡ Quickstart</span> Dimmed lessons are optional on this track.'
        : '<span class="track-name">🧭 Comprehensive</span> Every lesson, every project.') +
        '<button class="switch">Switch track</button>';
      el.querySelector('.switch').addEventListener('click', function() {
        setTrack(t === 'quickstart' ? 'comprehensive' : 'quickstart');
        paint();
        applyTrackToLessonList();
      });
    }
    paint();
  };

  function applyTrackToLessonList() {
    var list = document.getElementById('lesson-list');
    if (list) list.dataset.track = getTrack();
  }
  window.tsApplyTrackToLessonList = applyTrackToLessonList;

  // OS tabs (if present)
  document.querySelectorAll('.os-tabs').forEach(function(tabs) {
    tabs.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var os = btn.dataset.os;
        tabs.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        // Find the os-panels container that's a sibling
        var parent = tabs.parentElement;
        parent.querySelectorAll('.os-panel').forEach(function(p) {
          p.classList.toggle('active', p.dataset.os === os);
        });
      });
    });
  });
})();
