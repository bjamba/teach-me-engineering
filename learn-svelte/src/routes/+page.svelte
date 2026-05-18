<!--
  Dashboard. The sequencer is the hero — the first thing you do on this site
  is press play and feel what you'll build.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import ModuleCard from '$lib/components/ModuleCard.svelte';
  import Sequencer from '$lib/sandbox/Sequencer.svelte';
  import Led from '$lib/components/Led.svelte';
  import { curriculum, totalLessons, totalMinutes } from '$lib/curriculum';
  import { progress, lessonKey } from '$lib/stores/progress.svelte';
  import { audio } from '$lib/audio/audio.svelte';

  const total = totalLessons();
  const minutes = totalMinutes();
  const hours = Math.round(minutes / 60);

  const pct = $derived(Math.round((progress.completedCount / total) * 100));

  const startHref = base + `/lessons/${curriculum[0].slug}/${curriculum[0].lessons[0].slug}`;
</script>

<svelte:head><title>Make / Svelte</title></svelte:head>

<div class="page">
  <section class="hero">
    <div class="hero-text">
      <span class="kicker">
        <Led variant="live" compact />
        Course · {curriculum.length} modules · build 4 small apps + 1 DAW
      </span>
      <h1 class="display">
        <span>Make things</span>
        <span class="display-with">with</span>
        <span class="display-svelte">Svelte<span class="dot">.</span></span>
      </h1>
      <p class="lede">
        A serious working knowledge of Svelte 5 — runes, components, motion, kit —
        anchored in a browser-native step sequencer you build across the course.
        The kind of thing other frameworks make a project, and Svelte makes a
        Saturday.
      </p>
      <div class="hero-cta">
        <a class="btn primary" href={startHref} onclick={() => audio.play('select')}>
          <span class="btn-icon">▶</span>
          {progress.completedCount === 0 ? 'Open module 01' : 'Resume'}
        </a>
        <a class="btn ghost" href={base + '/prereqs/'} onclick={() => audio.play('click')}>
          Read prereqs first
        </a>
        <a class="btn ghost" href="#tracks" onclick={() => audio.play('click')}>
          See the tracks ↓
        </a>
        {#if !audio.enabled}
          <button class="btn ghost audio-cta" type="button" onclick={() => void audio.enable()}>
            <span class="audio-dot"></span>
            Turn on sound
          </button>
        {/if}
      </div>
    </div>

    <div class="hero-bg" aria-hidden="true">
      {#each curriculum as m, i (m.slug)}
        <span class="hero-bg-band" style="--c-track: {m.color}; --i: {i};"></span>
      {/each}
    </div>
  </section>

  <section class="sequencer-section">
    <div class="seq-intro">
      <span class="seq-kicker">↓ this is what you're going to build ↓</span>
    </div>
    <Sequencer />
    <div class="seq-foot">
      <p>
        The whole site is opt-in audio. Toggle it from the speaker icon in the
        title bar (or "turn on sound" above). Click any cell, change the BPM,
        press play — that whole interaction will live in your dashboard
        application by the end of Module&nbsp;7.
      </p>
    </div>
  </section>

  <section class="readout-section">
    <div class="readout-grid">
      <div class="stat">
        <span class="stat-label">Modules</span>
        <span class="stat-num lcd">{curriculum.length}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Lessons</span>
        <span class="stat-num lcd">{total}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Read time</span>
        <span class="stat-num lcd">~{hours}<span class="stat-unit">h</span></span>
      </div>
      <div class="stat big">
        <span class="stat-label">Your progress</span>
        <div class="stat-bottom">
          <span class="stat-num lcd accent">{pct}<span class="stat-unit">%</span></span>
          <span class="stat-meta lcd">{progress.completedCount} / {total} done</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width: {pct}%"></div></div>
      </div>

      <div class="pattern-card">
        <div class="pattern-head">
          <span class="pattern-label">Pattern view</span>
          <span class="pattern-help">{progress.completedCount}/{total} cells lit</span>
        </div>
        <div class="pattern">
          {#each curriculum as m (m.slug)}
            <div class="pattern-row" style="--c-track: {m.color};">
              <span class="pattern-num">M{String(m.number).padStart(2, '0')}</span>
              <div class="pattern-cells">
                {#each m.lessons as l (l.slug)}
                  {@const done = progress.isComplete(lessonKey(m.slug, l.slug))}
                  <a
                    class="pattern-cell"
                    class:done
                    href={base + `/lessons/${m.slug}/${l.slug}`}
                    title={`${m.number}.${l.slug.split('-')[0]} — ${l.title}`}
                    onclick={() => audio.play('click')}
                  ></a>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="tracks-section" id="tracks">
    <header class="section-head">
      <h2>Tracks</h2>
      <p>Each module is a track. Each track has a color. Lay them in the order you like — recommended path is left to right, top to bottom.</p>
    </header>

    <div class="grid">
      {#each curriculum as m (m.slug)}
        <ModuleCard module={m} />
      {/each}
    </div>
  </section>

  <section class="meta-section">
    <header class="section-head">
      <h2>About this site</h2>
    </header>
    <div class="meta-grid">
      <div class="meta-card">
        <h3>The site is the pitch.</h3>
        <p>
          This whole thing is a SvelteKit app. The transport in the title bar.
          The sequencer above. The track meters in the sidebar. View source on
          any page and every UI element is a Svelte component you can dissect.
        </p>
      </div>
      <div class="meta-card">
        <h3>You write code, not exercises.</h3>
        <p>
          Lessons embed live sandboxes that compile your Svelte source on every
          keystroke and render the result alongside the JS the compiler emitted.
          The capstone is a real project — you ship it at the end.
        </p>
      </div>
      <div class="meta-card">
        <h3>Sources are first-class.</h3>
        <p>
          Every claim a lesson makes traces back to a source on the
          <a href={base + '/sources/'} onclick={() => audio.play('click')}>sources page</a>:
          docs, primary blog posts, talks. If something isn't traceable, that's a bug.
        </p>
      </div>
    </div>
  </section>

  <footer class="foot">
    <span>Svelte 5 · runes-first · {new Date().getFullYear()}</span>
    <span>
      <button class="reset" onclick={() => { if (confirm('Reset all progress?')) progress.reset(); }}>
        reset progress
      </button>
    </span>
  </footer>
</div>

<style>
  .page { min-height: 100%; }

  /* ── HERO ──────────────────────────────────────────────────────────── */
  .hero {
    position: relative;
    padding: var(--sp-7) var(--sp-6) var(--sp-6);
    overflow: hidden;
    isolation: isolate;
  }

  .hero-text { position: relative; z-index: 2; max-width: 920px; }

  .kicker {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--c-text-faint);
    padding: 4px 0;
    margin-bottom: var(--sp-4);
  }

  .display {
    margin: 0 0 var(--sp-4);
    font-family: var(--font-display);
    font-size: clamp(2.6rem, 7vw, var(--fs-display));
    line-height: 0.94;
    letter-spacing: -0.04em;
    font-weight: 800;
    display: flex;
    flex-direction: column;
  }
  .display-with {
    color: var(--c-text-muted);
    font-weight: 500;
    font-style: italic;
    font-size: 0.62em;
    margin: 6px 0;
    letter-spacing: -0.02em;
  }
  .display-svelte {
    color: var(--c-track-1);
    text-shadow: 0 0 64px rgba(255, 62, 0, 0.5);
  }
  .display-svelte .dot {
    color: var(--c-text);
    text-shadow: none;
  }

  .lede {
    margin: 0 0 var(--sp-5);
    color: var(--c-text-muted);
    font-size: var(--fs-md);
    max-width: 56ch;
    line-height: 1.55;
  }

  .hero-cta {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    align-items: center;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 12px 20px;
    border-radius: var(--r-md);
    font-weight: 500;
    text-decoration: none;
    font-size: var(--fs-sm);
    transition:
      transform var(--d-fast) var(--ease-spring),
      background var(--d-fast),
      box-shadow var(--d-fast);
    border: 1px solid transparent;
    font-family: inherit;
    cursor: pointer;
  }
  .btn.primary {
    background: var(--c-track-1);
    color: white;
    box-shadow: 0 12px 30px -12px var(--c-track-1);
  }
  .btn.primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 18px 36px -10px var(--c-track-1);
    text-decoration: none;
  }
  .btn.ghost {
    background: var(--c-surface);
    color: var(--c-text-muted);
    border-color: var(--c-border);
  }
  .btn.ghost:hover {
    color: var(--c-text);
    border-color: var(--c-border-strong);
    text-decoration: none;
  }
  .btn-icon {
    font-size: 0.7em;
    transform: translateY(0.5px);
  }
  .audio-cta { font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .audio-dot {
    width: 8px;
    height: 8px;
    background: var(--c-track-1);
    border-radius: 99px;
    box-shadow: 0 0 10px var(--c-track-1);
    animation: dot-blink 1.6s ease-in-out infinite;
  }
  @keyframes dot-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* hero bg color bands */
  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    opacity: 0.05;
  }
  .hero-bg-band {
    flex: 1;
    background: var(--c-track);
    transform: translateX(calc(var(--i, 0) * 4px - 40px));
    transition: transform 1.6s var(--ease-out);
  }
  .hero:hover .hero-bg-band {
    transform: translateX(calc(var(--i, 0) * -2px));
  }

  /* ── SEQUENCER SECTION ───────────────────────────────────────────── */
  .sequencer-section {
    padding: var(--sp-3) var(--sp-6) var(--sp-6);
    max-width: 1280px;
  }
  .seq-intro {
    text-align: center;
    margin-bottom: var(--sp-3);
  }
  .seq-kicker {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-track-1);
    letter-spacing: 0.12em;
    animation: kicker-pulse 2.2s ease-in-out infinite;
  }
  @keyframes kicker-pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
  .seq-foot {
    margin-top: var(--sp-4);
    text-align: center;
  }
  .seq-foot p {
    margin: 0 auto;
    color: var(--c-text-muted);
    max-width: 64ch;
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  /* ── READOUT SECTION ─────────────────────────────────────────────── */
  .readout-section {
    padding: var(--sp-5) var(--sp-6);
    max-width: 1280px;
  }
  .readout-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(120px, 1fr)) 1.4fr 2fr;
    gap: var(--sp-3);
    align-items: stretch;
  }
  @media (max-width: 1100px) {
    .readout-grid { grid-template-columns: repeat(3, 1fr); }
    .readout-grid .stat.big { grid-column: span 3; }
    .readout-grid .pattern-card { grid-column: span 3; }
  }
  @media (max-width: 700px) {
    .readout-grid { grid-template-columns: 1fr 1fr; }
    .readout-grid .stat.big { grid-column: span 2; }
    .readout-grid .pattern-card { grid-column: span 2; }
  }

  .stat {
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-text-faint);
  }
  .stat-num {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-xl);
    color: var(--c-text);
    font-feature-settings: 'tnum';
    line-height: 1;
  }
  .stat.big .stat-num { font-size: var(--fs-2xl); }
  .stat-num.accent { color: var(--c-track-1); }
  .stat-unit { color: var(--c-text-muted); font-weight: 500; font-size: 0.7em; }
  .stat-bottom { display: flex; align-items: baseline; gap: var(--sp-3); justify-content: space-between; }
  .stat-meta { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-text-faint); }
  .bar {
    margin-top: 6px;
    height: 4px;
    background: var(--c-surface-2);
    border-radius: 99px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--c-track-1), #ff6b4a);
    transition: width var(--d-slow) var(--ease-spring);
    box-shadow: 0 0 8px -1px var(--c-track-1);
  }

  .pattern-card {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-3) var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .pattern-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .pattern-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--c-text-faint);
  }
  .pattern-help { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-text-faint); }

  .pattern {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pattern-row {
    --c-track: #888;
    display: grid;
    grid-template-columns: 32px 1fr;
    align-items: center;
    gap: var(--sp-2);
  }
  .pattern-num {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--c-text-faint);
  }
  .pattern-cells {
    display: flex;
    gap: 2px;
  }
  .pattern-cell {
    flex: 1;
    height: 12px;
    background: color-mix(in srgb, var(--c-track) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-track) 25%, var(--c-border));
    border-radius: 2px;
    transition:
      background var(--d-fast),
      border-color var(--d-fast),
      transform 80ms var(--ease-spring);
    text-decoration: none;
  }
  .pattern-cell:hover {
    transform: translateY(-1px);
    border-color: var(--c-track);
  }
  .pattern-cell.done {
    background: var(--c-track);
    border-color: var(--c-track);
    box-shadow: 0 0 6px -1px var(--c-track);
  }

  /* ── TRACKS SECTION ──────────────────────────────────────────────── */
  .tracks-section, .meta-section {
    padding: var(--sp-7) var(--sp-6);
    max-width: 1280px;
  }
  .section-head { margin-bottom: var(--sp-5); }
  .section-head h2 {
    margin: 0 0 var(--sp-2);
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    letter-spacing: -0.02em;
    font-weight: 700;
  }
  .section-head h2::before {
    content: '— ';
    color: var(--c-track-1);
  }
  .section-head p {
    margin: 0;
    color: var(--c-text-muted);
    max-width: 60ch;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(264px, 1fr));
    gap: var(--sp-4);
  }

  /* ── META SECTION ────────────────────────────────────────────────── */
  .meta-section { padding-top: var(--sp-5); }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--sp-4);
  }
  .meta-card {
    padding: var(--sp-5);
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
  }
  .meta-card h3 {
    margin: 0 0 var(--sp-3);
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    letter-spacing: -0.01em;
    font-weight: 700;
  }
  .meta-card p {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }

  /* ── FOOTER ──────────────────────────────────────────────────────── */
  .foot {
    padding: var(--sp-5) var(--sp-6);
    border-top: 1px solid var(--c-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--c-text-faint);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }
  .reset {
    background: transparent;
    border: 0;
    color: var(--c-text-faint);
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .reset:hover { color: var(--c-track-1); }
</style>
