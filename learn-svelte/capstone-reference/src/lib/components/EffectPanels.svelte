<!--
  Filter / Delay / Reverb effect chain UI. Each slider is two-way bound to a
  rune on the audio engine; the engine has a $effect per parameter that
  rampTo's the live Tone.js node when the rune changes.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
</script>

<div class="effects">
  <fieldset class="panel">
    <legend>FILTER</legend>
    <div class="knob">
      <div class="knob-head">
        <label for="filter-freq">cutoff</label>
        <span class="lcd">{audio.filterFreq} Hz</span>
      </div>
      <input
        id="filter-freq"
        type="range"
        min="100"
        max="20000"
        step="10"
        bind:value={audio.filterFreq}
      />
    </div>
  </fieldset>

  <fieldset class="panel">
    <legend>DELAY</legend>
    <div class="knob">
      <div class="knob-head">
        <label for="delay-time">time</label>
        <span class="lcd">{audio.delayTime.toFixed(2)} s</span>
      </div>
      <input
        id="delay-time"
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={audio.delayTime}
      />
    </div>
    <div class="knob">
      <div class="knob-head">
        <label for="delay-fb">feedback</label>
        <span class="lcd">{audio.delayFeedback.toFixed(2)}</span>
      </div>
      <input
        id="delay-fb"
        type="range"
        min="0"
        max="0.95"
        step="0.01"
        bind:value={audio.delayFeedback}
      />
    </div>
  </fieldset>

  <fieldset class="panel">
    <legend>REVERB</legend>
    <div class="knob">
      <div class="knob-head">
        <label for="reverb-wet">wet</label>
        <span class="lcd">{audio.reverbWet.toFixed(2)}</span>
      </div>
      <input
        id="reverb-wet"
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={audio.reverbWet}
      />
    </div>
  </fieldset>
</div>

<style>
  .effects {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .panel {
    flex: 1;
    min-width: 200px;
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3) var(--sp-4);
  }
  legend {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-track-4);
    letter-spacing: 0.14em;
    padding: 0 6px;
  }
  .knob {
    margin-top: var(--sp-2);
    margin-bottom: var(--sp-2);
  }
  .knob:last-child { margin-bottom: 0; }
  .knob-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.06em;
  }
  .lcd {
    color: var(--c-track-4);
    font-size: 0.78rem;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--c-track-4);
  }
</style>
