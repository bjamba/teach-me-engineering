<!--
  Module card for the dashboard. Each card carries its module's signature
  color through the chrome — top color stripe, hover glow, progress meter.
  Hover lifts the card and reveals a per-module gradient that subtly tracks
  the cursor (FLIP-style affordance built in vanilla Svelte transforms).
-->
<script lang="ts">
  import { base } from '$app/paths';
  import { progress, lessonKey } from '$lib/stores/progress.svelte';
  import { audio } from '$lib/audio/audio.svelte';
  import Waveform from '$lib/components/Waveform.svelte';
  import type { Module } from '$lib/curriculum';

  let { module }: { module: Module } = $props();

  const completed = $derived(
    module.lessons.filter((l) => progress.isComplete(lessonKey(module.slug, l.slug))).length
  );
  const pct = $derived(Math.round((completed / module.lessons.length) * 100));
  const total = $derived(module.lessons.length);

  let cardEl: HTMLAnchorElement | undefined = $state();
  let mx = $state(50);
  let my = $state(50);

  function handleMove(e: PointerEvent) {
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 100;
    my = ((e.clientY - r.top) / r.height) * 100;
  }
</script>

<a
  bind:this={cardEl}
  class="card"
  class:complete={completed === total}
  class:started={completed > 0 && completed < total}
  href={base + `/lessons/${module.slug}/${module.lessons[0].slug}`}
  onpointermove={handleMove}
  onclick={() => audio.play('select')}
  style="--c-track: {module.color}; --mx: {mx}%; --my: {my}%;"
  data-wf-host
>
  <span class="stripe"></span>

  <header class="card-head">
    <span class="num">M{String(module.number).padStart(2, '0')}</span>
    <span class="verb">{module.verb}</span>
    <span class="wf-slot" style="color: {module.color};">
      <Waveform moduleSlug={module.slug} width={36} />
    </span>
    <span class="status lcd">
      {#if completed === total}
        ✓ done
      {:else if completed > 0}
        <span class="done-frac">{completed}<span class="frac-sep">/</span>{total}</span>
      {:else}
        {total} lessons
      {/if}
    </span>
  </header>

  <h3>{module.title}</h3>
  <p class="tagline">{module.tagline}</p>

  <footer class="card-foot">
    <div class="bar">
      <div class="bar-fill" style="width: {pct}%"></div>
    </div>
    <span class="bar-label">{pct}<span class="bar-pct">%</span></span>
  </footer>
</a>

<style>
  .card {
    --mx: 50%;
    --my: 50%;
    --c-track: var(--c-accent);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-5);
    padding-top: calc(var(--sp-5) + 4px);
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    color: var(--c-text);
    text-decoration: none;
    transition:
      transform var(--d-mid) var(--ease-out),
      border-color var(--d-mid),
      box-shadow var(--d-mid);
    overflow: hidden;
    isolation: isolate;
    min-height: 168px;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: radial-gradient(
      280px 200px at var(--mx) var(--my),
      color-mix(in srgb, var(--c-track) 20%, transparent),
      transparent 70%
    );
    opacity: 0;
    transition: opacity var(--d-mid) var(--ease-out);
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--c-track) 50%, var(--c-border));
    box-shadow:
      0 12px 36px -16px color-mix(in srgb, var(--c-track) 60%, transparent),
      var(--shadow-card);
    text-decoration: none;
  }
  .card:hover::before { opacity: 1; }

  /* color stripe across the top — the "track header" */
  .stripe {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--c-track);
    box-shadow: 0 0 10px -2px var(--c-track);
  }

  .card-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    letter-spacing: 0.06em;
  }
  .num { color: var(--c-track); font-weight: 600; }
  .verb {
    text-transform: uppercase;
    color: var(--c-text-muted);
  }
  .wf-slot {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    opacity: 0.7;
    transition: opacity var(--d-fast);
  }
  .card:hover .wf-slot { opacity: 1; }
  .status {
    color: var(--c-text-muted);
    font-feature-settings: 'tnum';
  }
  .done-frac { color: var(--c-track); }
  .frac-sep { color: var(--c-text-faint); }

  h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    line-height: 1.15;
    letter-spacing: -0.02em;
    font-weight: 700;
    color: var(--c-text);
  }

  .tagline {
    margin: 0;
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.45;
    flex: 1;
  }

  .card-foot {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-top: auto;
  }
  .bar {
    flex: 1;
    height: 4px;
    background: var(--c-surface-2);
    border-radius: 99px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--c-track);
    transition: width var(--d-slow) var(--ease-spring);
    box-shadow: 0 0 6px -1px var(--c-track);
  }
  .bar-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    font-feature-settings: 'tnum';
    min-width: 32px;
    text-align: right;
    letter-spacing: 0.04em;
  }
  .bar-pct { opacity: 0.6; }

  .card.complete {
    border-color: color-mix(in srgb, var(--c-track) 60%, var(--c-border));
  }
  .card.complete .stripe {
    height: 6px;
  }
</style>
