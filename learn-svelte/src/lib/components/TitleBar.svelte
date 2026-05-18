<!--
  Studio-tool title bar.
  Brand on the left. Step-grid transport in the middle (10 cells, one per
  module, each lit in its module color in proportion to that module's
  progress; the current module's cell pulses on a slow constant beat).
  On the right: audio toggle, theme toggle, sources link.
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { progress, lessonKey } from '$lib/stores/progress.svelte';
  import { curriculum } from '$lib/curriculum';
  import { audio } from '$lib/audio/audio.svelte';

  function moduleProgress(modSlug: string, lessons: { slug: string }[]) {
    const done = lessons.filter((l) => progress.isComplete(lessonKey(modSlug, l.slug))).length;
    return { done, total: lessons.length, pct: done / lessons.length };
  }

  const currentModuleSlug = $derived.by(() => {
    const m = page.url.pathname.match(/\/lessons\/([^/]+)\//);
    return m ? m[1] : null;
  });

  const crumb = $derived.by(() => {
    const path = page.url.pathname.replace(base, '').replace(/\/$/, '');
    if (!path || path === '/') return null;
    if (path === '/sources') return 'sources';
    const m = path.match(/^\/lessons\/(\d+)-[^/]+\/(\d+)-/);
    if (m) return `M${parseInt(m[1])} · L${parseInt(m[2])}`;
    return path;
  });

  function toggleTheme() {
    const html = document.documentElement;
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    html.dataset.theme = next;
    localStorage.setItem('svelte_theme', next);
    audio.play('sweep');
  }

  function onAudioToggle() {
    void audio.toggle();
  }
</script>

<header class="titlebar">
  <a class="brand" href={base + '/'} aria-label="Home" onclick={() => audio.play('click')}>
    <span class="brand-mark" aria-hidden="true">▲</span>
    <span class="brand-word">make</span>
    <span class="brand-slash">/</span>
    <span class="brand-word brand-svelte">svelte</span>
  </a>

  <div class="bread">
    {#if crumb}
      <span class="bread-sep">›</span>
      <span class="bread-text">{crumb}</span>
    {/if}
  </div>

  <div class="transport-group">
    <div class="transport-grid" aria-label="Course progress">
      {#each curriculum as m, i (m.slug)}
        {@const mp = moduleProgress(m.slug, m.lessons)}
        {@const isCurrent = currentModuleSlug === m.slug}
        <a
          class="step"
          class:current={isCurrent}
          class:full={mp.pct === 1}
          class:partial={mp.pct > 0 && mp.pct < 1}
          class:downbeat={(i + 1) % 4 === 0}
          href={base + `/lessons/${m.slug}/${m.lessons[0].slug}`}
          style="--c-step: {m.color}; --pct: {Math.max(0.06, mp.pct) * 100}%;"
          title={`${m.title} — ${mp.done}/${mp.total}`}
          onclick={() => audio.play('select')}
        >
          <span class="step-fill" aria-hidden="true"></span>
          <span class="step-num" aria-hidden="true">{m.number}</span>
        </a>
      {/each}
    </div>
  </div>

  <div class="right">
    <a class="link" href={base + '/demos/'} onclick={() => audio.play('click')}>demos</a>
    <a class="link" href={base + '/reference/'} onclick={() => audio.play('click')}>ref</a>
    <a class="link" href={base + '/troubleshooting/'} onclick={() => audio.play('click')}>?</a>
    <a class="link" href={base + '/sources/'} onclick={() => audio.play('click')}>sources</a>

    <button
      class="icon"
      class:icon-on={audio.enabled}
      type="button"
      onclick={onAudioToggle}
      aria-label="Toggle audio cues"
      aria-pressed={audio.enabled}
      title={audio.enabled ? 'Audio: on' : 'Audio: off'}
    >
      {#if audio.enabled}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 6h2l3-3v10l-3-3H3V6z" fill="currentColor"/>
          <path d="M11 5.5a3 3 0 0 1 0 5M12.5 4a5 5 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 6h2l3-3v10l-3-3H3V6z" fill="currentColor"/>
          <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      {/if}
    </button>

    <button class="icon" type="button" onclick={toggleTheme} aria-label="Toggle theme">
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 1a7 7 0 1 0 7 7A6 6 0 0 1 8 1z" fill="currentColor"/>
      </svg>
    </button>
  </div>
</header>

<style>
  .titlebar {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: var(--sp-3);
    padding: 0 var(--sp-4);
    background: var(--c-chrome);
    border-bottom: 1px solid var(--c-border);
    height: var(--titlebar-h);
    user-select: none;
  }
  @media (max-width: 760px) {
    .titlebar { grid-template-columns: auto 1fr auto; }
    .bread { display: none; }
  }

  /* ── BRAND ─────────────────────────────────────────────────────────── */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--c-text);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: -0.02em;
    text-decoration: none;
    padding: 0 var(--sp-2);
  }
  .brand:hover { text-decoration: none; }
  .brand-mark {
    color: var(--c-track-1);
    font-size: 1.15rem;
    transform: translateY(-1px);
    text-shadow: 0 0 12px var(--c-track-1);
  }
  .brand-word { font-weight: 700; }
  .brand-slash { color: var(--c-text-faint); font-weight: 400; padding: 0 1px; }
  .brand-svelte { color: var(--c-track-1); }

  /* ── BREAD ─────────────────────────────────────────────────────────── */
  .bread {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.04em;
  }
  .bread-sep { color: var(--c-text-faint); }
  .bread-text { color: var(--c-text-muted); }

  /* ── TRANSPORT (step grid) ────────────────────────────────────────── */
  .transport-group {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .transport-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 3px;
    padding: 4px 6px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    height: 28px;
    align-items: center;
  }
  /* slight extra gap every 4 cells = "downbeats" */
  .transport-grid .step.downbeat { margin-right: 4px; }

  .step {
    --c-step: #888;
    --pct: 0%;
    position: relative;
    width: 16px;
    height: 18px;
    background: color-mix(in srgb, var(--c-step) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-step) 25%, var(--c-border));
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 80ms var(--ease-spring);
  }
  .step:hover {
    transform: translateY(-1px);
    border-color: var(--c-step);
  }
  .step-fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: var(--pct);
    background: var(--c-step);
    box-shadow: 0 0 8px -1px var(--c-step);
    transition: height var(--d-slow) var(--ease-spring);
  }
  .step.full {
    background: var(--c-step);
    border-color: var(--c-step);
    box-shadow: 0 0 8px -1px var(--c-step);
  }
  .step-num {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    height: 100%;
    font-family: var(--font-lcd);
    font-size: 0.6rem;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.0);
    transition: color var(--d-fast);
    font-feature-settings: 'tnum';
  }
  .step.full .step-num,
  .step.partial .step-num {
    color: rgba(255, 255, 255, 0.85);
    mix-blend-mode: difference;
  }
  .step.current {
    border-color: var(--c-step);
    animation: step-pulse 1.6s ease-in-out infinite;
    z-index: 2;
  }
  @keyframes step-pulse {
    0%, 100% { box-shadow: 0 0 0 1px var(--c-step), 0 0 0 0 transparent; }
    50%      { box-shadow: 0 0 0 1px var(--c-step), 0 0 12px 1px var(--c-step); }
  }

  /* ── RIGHT GROUP ──────────────────────────────────────────────────── */
  .right {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .link {
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 4px 8px;
    border-radius: var(--r-sm);
    text-decoration: none;
  }
  .link:hover {
    color: var(--c-text);
    background: var(--c-surface);
    text-decoration: none;
  }

  .icon {
    background: transparent;
    border: 1px solid var(--c-border);
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: all var(--d-fast);
  }
  .icon:hover { border-color: var(--c-border-strong); color: var(--c-text); }
  .icon.icon-on {
    color: var(--c-track-1);
    border-color: color-mix(in srgb, var(--c-track-1) 50%, var(--c-border));
    background: color-mix(in srgb, var(--c-track-1) 10%, transparent);
  }
</style>
