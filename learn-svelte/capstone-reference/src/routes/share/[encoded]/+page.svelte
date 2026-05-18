<!--
  /share/[encoded] — decode a base64url pattern from the URL, copy it into the
  engine, then offer the user a button to navigate back to the main DAW.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { TRACKS } from '$lib/audio/tracks';

  let { data } = $props();
  let applied = $state(false);

  function apply() {
    audio.applyPattern(data.pattern, data.bpm);
    applied = true;
  }

  function openInDaw() {
    apply();
    goto(`${base}/`);
  }
</script>

<svelte:head><title>Shared pattern · Svelte DAW</title></svelte:head>

<main class="page">
  <h1>Shared <span class="accent">Pattern</span></h1>
  <p class="sub">BPM {data.bpm} · {Object.keys(data.pattern).length} tracks</p>

  <div class="preview">
    {#each TRACKS as t (t.id)}
      {@const row = data.pattern[t.id] ?? []}
      <div class="row" style="--c-track: {t.color}">
        <span class="name">{t.name}</span>
        <div class="cells">
          {#each row as on, i (i)}
            <span class="cell" class:on class:downbeat={i % 4 === 0}></span>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button type="button" class="primary" onclick={openInDaw}>
      load into DAW
    </button>
    <button type="button" class="ghost" onclick={apply} disabled={applied}>
      {applied ? 'applied!' : 'apply (stay here)'}
    </button>
  </div>
</main>

<style>
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: var(--sp-6) var(--sp-4);
  }
  h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    letter-spacing: 0.04em;
    font-weight: 800;
  }
  .accent { color: var(--c-accent); }
  .sub {
    margin: 4px 0 var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.06em;
  }
  .preview {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    --c-track: #888;
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: var(--sp-3);
    align-items: center;
  }
  .name {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-track);
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 4px;
  }
  .cell {
    height: 24px;
    background: color-mix(in srgb, var(--c-track) 6%, var(--c-surface));
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    position: relative;
  }
  .cell.downbeat::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 3px;
    height: 3px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--c-track) 50%, transparent);
  }
  .cell.on {
    background: var(--c-track);
    border-color: var(--c-track);
    box-shadow: 0 0 10px -3px var(--c-track);
  }
  .actions {
    display: flex;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
  }
  button { font: inherit; cursor: pointer; }
  .primary {
    padding: 10px 22px;
    background: var(--c-accent);
    color: white;
    border: 0;
    border-radius: var(--r-md);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: var(--fs-xs);
    text-transform: uppercase;
  }
  .ghost {
    padding: 10px 16px;
    background: var(--c-surface);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
  }
  .ghost:disabled { opacity: 0.5; cursor: default; }
</style>
