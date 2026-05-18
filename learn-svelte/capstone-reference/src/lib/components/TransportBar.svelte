<!--
  Transport: PLAY/STOP, BPM, REC, current-step readout, share + clear/randomize.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { encodePattern } from '$lib/audio/encoding';
  import { base } from '$app/paths';

  let copied = $state(false);

  async function share() {
    const encoded = encodePattern($state.snapshot(audio.pattern) as Record<string, number[]>, audio.bpm);
    const url = `${location.origin}${base}/share/${encoded}/`;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard failed — fall back to a prompt the user can copy manually.
      window.prompt('Copy this share URL:', url);
    }
  }
</script>

<div class="bar">
  <button
    class="play"
    class:playing={audio.isPlaying}
    type="button"
    onclick={() => audio.toggleTransport()}
    disabled={audio.isLoading}
  >
    {#if audio.isLoading}
      <span class="spin">◌</span> LOAD
    {:else if audio.isPlaying}
      <span class="icon">■</span> STOP
    {:else}
      <span class="icon">▶</span> PLAY
    {/if}
  </button>

  <button
    class="rec"
    class:recording={audio.isRecording}
    type="button"
    onclick={() => audio.toggleRecording()}
    disabled={audio.isLoading}
  >
    <span class="icon">{audio.isRecording ? '■' : '●'}</span> REC
  </button>

  <div class="bpm">
    <label for="bpm-input">BPM</label>
    <input
      id="bpm-input"
      type="range"
      min="60"
      max="200"
      step="1"
      bind:value={audio.bpm}
    />
    <span class="bpm-num lcd">{audio.bpm}</span>
  </div>

  <div class="step-readout lcd" aria-label="Current step">
    STEP {audio.currentStep < 0 ? '--' : String(audio.currentStep + 1).padStart(2, '0')}
  </div>

  <div class="actions">
    <button class="ghost" type="button" onclick={() => audio.clearPattern()}>clear</button>
    <button class="ghost" type="button" onclick={() => audio.randomizePattern()}>rand</button>
    <button class="ghost" type="button" onclick={share}>
      {copied ? 'copied!' : 'share'}
    </button>
  </div>

  <div class="status">
    <span class="led" class:active={audio.isPlaying}></span>
    {audio.isLoading ? 'LOADING' : audio.isPlaying ? 'PLAYING' : 'READY'}
  </div>
</div>

{#if audio.loadError}
  <div class="err">{audio.loadError}</div>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
    padding: var(--sp-3);
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    margin-bottom: var(--sp-3);
  }

  button { font: inherit; cursor: pointer; }

  .play {
    padding: 10px 22px;
    background: var(--c-accent);
    color: white;
    border: 0;
    border-radius: var(--r-md);
    font-weight: 700;
    letter-spacing: 0.1em;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    box-shadow: 0 6px 18px -8px var(--c-accent);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: transform var(--d-fast);
  }
  .play:hover:not(:disabled) { transform: translateY(-1px); }
  .play:disabled { opacity: 0.55; cursor: not-allowed; }
  .play.playing { background: #c93000; box-shadow: 0 6px 18px -8px #c93000; }

  .rec {
    padding: 10px 18px;
    background: var(--c-surface);
    color: var(--c-error);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    font-weight: 700;
    letter-spacing: 0.1em;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .rec.recording {
    background: var(--c-error);
    color: white;
    border-color: var(--c-error);
    animation: rec-blink 0.8s ease-in-out infinite;
  }
  @keyframes rec-blink {
    0%, 100% { box-shadow: 0 0 24px var(--c-error); }
    50% { box-shadow: 0 0 6px var(--c-error); }
  }

  .icon { font-size: 0.7rem; }
  .spin {
    display: inline-block;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .bpm {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .bpm label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .bpm input {
    width: 140px;
    accent-color: var(--c-accent);
  }
  .bpm-num {
    font-size: var(--fs-sm);
    color: var(--c-accent);
    font-weight: 700;
    min-width: 36px;
    text-align: right;
  }

  .step-readout {
    padding: 6px 10px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    color: var(--c-accent);
    min-width: 88px;
    text-align: center;
  }

  .actions { display: flex; gap: 6px; }
  .ghost {
    padding: 7px 12px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    color: var(--c-text-muted);
    border-radius: var(--r-sm);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
    letter-spacing: 0.04em;
  }
  .ghost:hover { border-color: var(--c-border-strong); color: var(--c-text); }

  .status {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-text-muted);
    letter-spacing: 0.12em;
  }
  .led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-text-faint);
    transition: background 200ms;
  }
  .led.active {
    background: var(--c-success);
    box-shadow: 0 0 10px var(--c-success);
    animation: pulse 0.8s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }

  .err {
    background: color-mix(in srgb, var(--c-error) 14%, transparent);
    color: var(--c-error);
    border: 1px solid color-mix(in srgb, var(--c-error) 30%, transparent);
    border-radius: var(--r-sm);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin-bottom: var(--sp-3);
  }
</style>
