<!--
  The 4×16 step grid. Each cell is its own subscribed reactive unit — clicking
  one re-evaluates only that cell, not the row, not the grid.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';
</script>

<div class="grid" role="grid" aria-label="Step sequencer">
  <!-- Step-number ruler shows the bar structure (4 cells per beat). -->
  <div class="ruler" aria-hidden="true">
    <div class="ruler-spacer"></div>
    <div class="ruler-cells">
      {#each Array(16) as _, i (i)}
        <div
          class="ruler-cell lcd"
          class:downbeat={i % 4 === 0}
          class:current={i === audio.currentStep}
        >
          {String(i + 1).padStart(2, '0')}
        </div>
      {/each}
    </div>
  </div>

  {#each TRACKS as track (track.id)}
    {@const ch = audio.channels[track.id]}
    <div
      class="row"
      style="--c-track: {track.color}"
      class:muted={ch.muted}
    >
      <button
        class="row-label"
        type="button"
        onclick={() => audio.toggleMute(track.id)}
        aria-label="Mute {track.name}"
      >
        <span class="color-bar"></span>
        <span class="track-name">{track.name}</span>
        <span class="mute-flag" aria-hidden="true">{ch.muted ? 'M' : ''}</span>
      </button>
      <div class="cells">
        {#each audio.pattern[track.id] as on, i (i)}
          <button
            class="cell"
            class:on
            class:current={i === audio.currentStep}
            class:downbeat={i % 4 === 0}
            onclick={() => audio.toggleCell(track.id, i)}
            type="button"
            aria-label={`${track.name} step ${i + 1}: ${on ? 'on' : 'off'}`}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .grid {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    display: flex;
    flex-direction: column;
    gap: 6px;
    user-select: none;
  }

  .ruler {
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: var(--sp-3);
    align-items: center;
    padding-bottom: 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--c-border) 60%, transparent);
    margin-bottom: 2px;
  }
  .ruler-cells {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 4px;
  }
  .ruler-cell {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--c-text-faint);
  }
  .ruler-cell.downbeat { color: var(--c-text-muted); }
  .ruler-cell.current {
    color: var(--c-accent);
    text-shadow: 0 0 8px var(--c-accent);
  }

  .row {
    --c-track: #888;
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: var(--sp-3);
    align-items: center;
  }

  .row-label {
    display: grid;
    grid-template-columns: 6px 1fr 14px;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    height: 36px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition: border-color var(--d-fast);
  }
  .row-label:hover { border-color: var(--c-border-strong); }
  .color-bar {
    width: 4px;
    height: 18px;
    background: var(--c-track);
    border-radius: 2px;
    box-shadow: 0 0 8px -2px var(--c-track);
  }
  .row.muted .color-bar {
    background: var(--c-text-faint);
    box-shadow: none;
  }
  .track-name {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text);
    letter-spacing: 0.06em;
  }
  .row.muted .track-name { color: var(--c-text-faint); }
  .mute-flag {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--c-error);
    font-weight: 700;
    text-align: right;
  }

  .cells {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 4px;
  }

  .cell {
    position: relative;
    height: 36px;
    background: color-mix(in srgb, var(--c-track) 6%, var(--c-surface));
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    cursor: pointer;
    padding: 0;
    transition:
      background var(--d-fast),
      border-color var(--d-fast),
      transform 80ms var(--ease-spring);
    overflow: hidden;
  }
  .cell:hover {
    background: color-mix(in srgb, var(--c-track) 18%, var(--c-surface));
    border-color: color-mix(in srgb, var(--c-track) 60%, var(--c-border));
  }
  .cell.downbeat::before {
    content: '';
    position: absolute;
    top: 4px;
    left: 4px;
    width: 4px;
    height: 4px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--c-track) 50%, transparent);
  }
  .cell.on {
    background: var(--c-track);
    border-color: var(--c-track);
    box-shadow: 0 0 12px -3px var(--c-track);
  }
  .cell.on:hover { transform: translateY(-1px); }
  .cell.current {
    border-color: white;
    border-width: 2px;
  }
  .cell.on.current {
    box-shadow: 0 0 24px -2px var(--c-track), 0 0 0 1px white inset;
  }

  .row.muted .cell.on {
    background: color-mix(in srgb, var(--c-track) 35%, var(--c-surface));
    box-shadow: none;
    border-color: var(--c-border);
  }

  @media (max-width: 720px) {
    .ruler, .row { grid-template-columns: 64px 1fr; gap: var(--sp-2); }
    .row-label { padding: 6px; grid-template-columns: 4px 1fr 10px; }
    .cell { height: 28px; }
  }
</style>
