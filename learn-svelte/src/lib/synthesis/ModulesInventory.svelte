<!--
  Module-by-module inventory of what shipped across the curriculum.
  Renders as a vertical timeline with each module tagged by its track color.
-->
<script lang="ts">
  type Mod = {
    id: string;
    label: string;
    project: string;
    note: string;
    color: string;
  };

  const mods: Mod[] = [
    { id: 'M1', label: 'Hello, Counter, Toggle',  project: 'Smallest working components',  note: 'Three sections of a .svelte file. First taste of $state and $derived.',                                              color: 'var(--c-track-1)' },
    { id: 'M2', label: 'Tap Tempo Detective',     project: 'Music-utility tool, ~100 lines', note: 'Reactive state across inputs, derived BPM, localStorage persistence.',                                                color: 'var(--c-track-2)' },
    { id: 'M3', label: 'Metronome Studio',        project: 'Transport bar + swing + viz',    note: 'Components, props, snippets, spring motion via svelte/motion, audio synthesis via Tone.js.',                            color: 'var(--c-track-3)' },
    { id: 'M4', label: 'Chord Player',            project: 'URL-shareable progression',      note: '$bindable, shared state via .svelte.ts modules, URL-encoded pattern sharing.',                                         color: 'var(--c-track-4)' },
    { id: 'M5', label: 'Practice Journal',        project: 'Full SvelteKit app',             note: 'Routing, load functions, form actions, render modes, deployed to GitHub Pages.',                                        color: 'var(--c-track-5)' },
    { id: 'M6–7', label: 'The DAW',               project: 'Sample-accurate sequencer',      note: 'Per-channel mixer, effect chain with rampTo, FFT viz at 60fps, MediaRecorder, IndexedDB, pattern URLs, installable PWA.', color: 'var(--c-track-6)' },
    { id: 'M8', label: 'Ship + Polish + This',    project: 'Make it public',                 note: 'Deploy pipeline, Open Graph, PWA, embed, README — and this synthesis.',                                                color: 'var(--c-track-8)' },
  ];
</script>

<aside class="inventory" aria-label="What you built across the curriculum">
  <div class="inv-header">
    <span class="inv-label">What shipped</span>
    <span class="inv-meta">six projects · ~1500–2000 lines · one public URL</span>
  </div>

  <ol class="timeline">
    {#each mods as m}
      <li class="row">
        <div class="badge" style="--c-mod: {m.color}">{m.id}</div>
        <div class="rule" style="--c-mod: {m.color}" aria-hidden="true"></div>
        <div class="body">
          <div class="row-head">
            <span class="proj">{m.label}</span>
            <span class="dot" aria-hidden="true">·</span>
            <span class="subt">{m.project}</span>
          </div>
          <div class="note">{m.note}</div>
        </div>
      </li>
    {/each}
  </ol>
</aside>

<style>
  .inventory {
    margin: var(--sp-5) 0;
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    background: var(--c-card);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
  }
  .inv-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: var(--sp-4);
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .inv-label {
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--c-text-muted);
  }
  .inv-meta {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-3);
  }
  .row {
    display: grid;
    grid-template-columns: 56px 8px 1fr;
    gap: var(--sp-3);
    align-items: start;
  }
  .badge {
    background: color-mix(in srgb, var(--c-mod) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-mod) 50%, var(--c-border));
    color: var(--c-mod);
    border-radius: var(--r-sm);
    padding: 4px 6px;
    text-align: center;
    font-family: var(--font-lcd);
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }
  .rule {
    width: 3px;
    background: color-mix(in srgb, var(--c-mod) 45%, transparent);
    border-radius: 2px;
    align-self: stretch;
    margin: 6px auto 0;
  }
  .body { min-width: 0; padding-top: 2px; }
  .row-head {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    flex-wrap: wrap;
    margin-bottom: 2px;
  }
  .proj {
    color: var(--c-text);
    font-weight: 600;
    font-size: var(--fs-md);
  }
  .dot { color: var(--c-text-faint); }
  .subt {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
  }
  .note {
    color: var(--c-text-muted);
    font-size: var(--fs-sm);
    line-height: 1.55;
  }

  @media (max-width: 540px) {
    .row { grid-template-columns: 48px 6px 1fr; gap: var(--sp-2); }
    .badge { font-size: 10px; padding: 3px 4px; }
  }
</style>
