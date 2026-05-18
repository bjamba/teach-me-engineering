<!--
  Per-channel mixer: gain (vertical fader), pan, mute, solo per track. Plus
  a master volume fader on the right.

  All sliders are two-way bound to the engine's channels state; the engine has
  one $effect per channel-concern that rampTo's the live Tone.js gain/pan node
  with the combined mute+solo logic.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';
</script>

<div class="mixer">
  <h3>MIXER</h3>
  <div class="channels">
    {#each TRACKS as t (t.id)}
      {@const ch = audio.channels[t.id]}
      <div class="channel" style="--c-track: {t.color}">
        <span class="name">{t.name}</span>

        <div class="fader-wrap">
          <input
            type="range"
            class="fader"
            min="0"
            max="1"
            step="0.01"
            bind:value={ch.gain}
            aria-label="{t.name} gain"
            style="--fader-pct: {Math.round(ch.gain * 100)}%"
          />
          <span class="fader-num lcd">{Math.round(ch.gain * 100)}</span>
        </div>

        <div class="pan">
          <label class="pan-label" for="pan-{t.id}">PAN</label>
          <input
            id="pan-{t.id}"
            type="range"
            class="pan-slider"
            min="-1"
            max="1"
            step="0.01"
            bind:value={ch.pan}
            aria-label="{t.name} pan"
          />
        </div>

        <div class="buttons">
          <button
            type="button"
            class="ms"
            class:active={ch.muted}
            onclick={() => (ch.muted = !ch.muted)}
            aria-label="Mute {t.name}"
          >M</button>
          <button
            type="button"
            class="ms solo"
            class:active={ch.solo}
            onclick={() => (ch.solo = !ch.solo)}
            aria-label="Solo {t.name}"
          >S</button>
        </div>
      </div>
    {/each}

    <div class="channel master">
      <span class="name">MAST</span>
      <div class="fader-wrap">
        <input
          type="range"
          class="fader master-fader"
          min="0"
          max="1"
          step="0.01"
          bind:value={audio.masterVolume}
          aria-label="Master volume"
        />
        <span class="fader-num lcd">{Math.round(audio.masterVolume * 100)}</span>
      </div>
      <div class="pan-spacer"></div>
      <div class="buttons-spacer"></div>
    </div>
  </div>
</div>

<style>
  .mixer {
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3) var(--sp-4);
  }
  h3 {
    margin: 0 0 var(--sp-2);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    color: var(--c-track-4);
  }
  .channels {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--sp-2);
  }
  @media (max-width: 720px) {
    .channels { grid-template-columns: repeat(5, minmax(72px, 1fr)); overflow-x: auto; }
  }
  .channel {
    --c-track: #888;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .channel.master { --c-track: var(--c-text-muted); }
  .name {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-track);
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .fader-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  /* Vertical fader. Browser support for slider-vertical varies — we use
     -webkit-appearance for Chrome/Safari + writing-mode for the fallback
     so it stays vertical on Firefox too. */
  .fader {
    appearance: slider-vertical;
    -webkit-appearance: slider-vertical;
    writing-mode: vertical-lr;
    direction: rtl;
    width: 24px;
    height: 100px;
    accent-color: var(--c-track);
  }
  .master-fader { accent-color: var(--c-accent); }
  .fader-num {
    font-size: 0.7rem;
    color: var(--c-track);
    font-feature-settings: 'tnum';
    min-width: 26px;
    text-align: center;
  }

  .pan { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .pan-label {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--c-text-faint);
    letter-spacing: 0.08em;
  }
  .pan-slider {
    width: 100%;
    accent-color: var(--c-track);
  }
  .pan-spacer { height: 18px; width: 100%; }

  .buttons { display: flex; gap: 4px; }
  .buttons-spacer { height: 24px; }
  .ms {
    background: transparent;
    color: var(--c-text-faint);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 3px 9px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    cursor: pointer;
  }
  .ms:hover { border-color: var(--c-border-strong); color: var(--c-text); }
  .ms.active {
    background: var(--c-error);
    color: white;
    border-color: var(--c-error);
  }
  .ms.solo.active {
    background: var(--c-warning);
    color: black;
    border-color: var(--c-warning);
  }
</style>
