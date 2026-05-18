<!--
  A playable 4-track / 16-step sequencer. Lives in the dashboard hero so
  the first thing the learner does on this site is press play and feel
  the thing they will eventually build.

  Audio: Tone.js loaded from esm.sh on first user gesture (browsers require
  AudioContext to be created in response to a user action). Drum sounds are
  Tone.js synthesizers, not samples — no asset loading, no license noise.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Led from '$lib/components/Led.svelte';

  type TrackDef = {
    id: string;
    name: string;
    color: string;
    /** Synth class name on the Tone module. */
    synth: 'MembraneSynth' | 'NoiseSynth' | 'MetalSynth';
    /** Synth options. */
    options: Record<string, any>;
    /** Trigger function that knows what note + duration + velocity to play. */
    trigger: (synth: any, time: number) => void;
  };

  const TRACKS: TrackDef[] = [
    {
      id: 'kick',
      name: 'KICK',
      color: '#ff3e00',
      synth: 'MembraneSynth',
      options: {
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      },
      trigger: (s, time) => s.triggerAttackRelease('C2', '8n', time)
    },
    {
      id: 'snare',
      name: 'SNARE',
      color: '#e5468b',
      synth: 'NoiseSynth',
      options: {
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
      },
      trigger: (s, time) => s.triggerAttackRelease('16n', time, 0.6)
    },
    {
      id: 'hat',
      name: 'HAT',
      color: '#2dbfb8',
      synth: 'MetalSynth',
      options: {
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      },
      trigger: (s, time) => s.triggerAttackRelease('C6', '32n', time, 0.18)
    },
    {
      id: 'perc',
      name: 'PERC',
      color: '#9b6cff',
      synth: 'MetalSynth',
      options: {
        envelope: { attack: 0.001, decay: 0.12, release: 0.01 },
        harmonicity: 8,
        modulationIndex: 16,
        resonance: 8000,
        octaves: 0.5
      },
      trigger: (s, time) => s.triggerAttackRelease('C5', '16n', time, 0.25)
    }
  ];

  // Pre-loaded pattern: a basic boom-bap-ish loop. Anything but generic.
  const DEFAULTS: Record<string, number[]> = {
    kick:  [1,0,0,0, 1,0,0,1, 0,0,1,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hat:   [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0],
    perc:  [0,0,0,1, 0,0,1,0, 0,1,0,0, 0,0,0,1]
  };

  let pattern: Record<string, number[]> = $state(
    Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, [...v]]))
  );
  let muted: Record<string, boolean> = $state({
    kick: false, snare: false, hat: false, perc: false
  });
  let bpm = $state(120);
  let playing = $state(false);
  let currentStep = $state(-1);
  let loading = $state(false);
  let loadError = $state<string | null>(null);

  let Tone: any = null;
  let synths: Record<string, any> = {};
  let master: any = null;
  let analyser: any = null;
  let sequence: any = null;
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let raf: number | null = null;
  let resizeObs: ResizeObserver | null = null;
  // Reference to the FFT draw function, set by startVisualizer. We hold it
  // here so the ResizeObserver can trigger an out-of-loop redraw — the .fft-strip
  // slides open with a height transition, and without this the canvas's backing
  // store stays at its old size for the first few animation frames.
  let drawFft: (() => void) | null = null;

  async function ensureTone() {
    if (Tone) return;
    loading = true;
    try {
      const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/tone@15.0.4');
      Tone = mod;
      await Tone.start();
      // Master chain so we can fan output to both speakers and the analyser
      // without doubling audio. Master → Destination, master → analyser tap.
      master = new Tone.Gain(0.9).toDestination();
      analyser = new Tone.Analyser('fft', 64);
      master.connect(analyser);
      for (const t of TRACKS) {
        const Cls = (Tone as any)[t.synth];
        synths[t.id] = new Cls(t.options).connect(master);
      }
      Tone.Transport.bpm.value = bpm;
    } catch (err) {
      loadError = `Could not load audio: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  async function play() {
    if (playing) return;
    await ensureTone();
    if (!Tone) return;

    sequence = new Tone.Sequence(
      (time: number, step: number) => {
        for (const t of TRACKS) {
          if (pattern[t.id][step] && !muted[t.id]) {
            t.trigger(synths[t.id], time);
          }
        }
        // Update UI on the next animation frame, synced to audio time.
        Tone.Draw.schedule(() => { currentStep = step; }, time);
      },
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      '16n'
    );
    sequence.start(0);
    Tone.Transport.start();
    playing = true;
  }

  function stop() {
    if (!playing) return;
    if (Tone) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
    }
    if (sequence) {
      sequence.dispose();
      sequence = null;
    }
    playing = false;
    currentStep = -1;
  }

  function toggle() {
    playing ? stop() : play();
  }

  function clearAll() {
    for (const t of TRACKS) {
      pattern[t.id] = pattern[t.id].map(() => 0);
    }
    pattern = { ...pattern };
  }

  function reset() {
    pattern = Object.fromEntries(
      Object.entries(DEFAULTS).map(([k, v]) => [k, [...v]])
    );
  }

  function toggleCell(trackId: string, step: number) {
    pattern[trackId][step] = pattern[trackId][step] ? 0 : 1;
    pattern = { ...pattern };
  }

  function toggleMute(trackId: string) {
    muted[trackId] = !muted[trackId];
    muted = { ...muted };
  }

  // Read `bpm` unconditionally so $effect always registers a dependency on
  // it. If we put the read inside the `if (Tone)` branch, the first run
  // (before Tone is loaded) short-circuits, never reads bpm, and the effect
  // unsubscribes — so later slider changes don't re-fire it.
  $effect(() => {
    const next = bpm;
    if (Tone && Tone.Transport) Tone.Transport.bpm.value = next;
  });

  onDestroy(() => {
    stop();
    if (raf !== null) cancelAnimationFrame(raf);
    if (resizeObs) {
      resizeObs.disconnect();
      resizeObs = null;
    }
  });

  // FFT render: a single frame, called both from the rAF loop and from
  // the ResizeObserver. Only draws bars when the sequencer is actually
  // playing; otherwise the canvas stays blank and the .fft-strip wrapper
  // is hidden via CSS opacity.
  function renderFftFrame() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    // Match canvas backing store to its CSS size for crisp rendering.
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvasEl.width !== cssW * dpr) canvasEl.width = Math.max(1, cssW * dpr);
    if (canvasEl.height !== cssH * dpr) canvasEl.height = Math.max(1, cssH * dpr);
    const W = canvasEl.width;
    const H = canvasEl.height;
    ctx.clearRect(0, 0, W, H);
    if (!playing || !analyser) return;

    const data = analyser.getValue() as Float32Array;
    const bins = data.length;
    const gap = 2 * dpr;
    const barW = (W - gap * (bins - 1)) / bins;

    for (let i = 0; i < bins; i++) {
      const v = data[i]; // -100..0 dB typically
      const norm = Math.max(0, Math.min(1, (v + 100) / 70));
      const barH = norm * H;
      const x = i * (barW + gap);
      const y = H - barH;
      // Gradient: hot orange at peak, deeper at base
      const grad = ctx.createLinearGradient(0, y, 0, H);
      grad.addColorStop(0, `rgba(255, 138, 80, ${0.95 * norm + 0.05})`);
      grad.addColorStop(1, `rgba(255, 62, 0, ${0.5 * norm + 0.1})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);
    }
  }

  function startVisualizer() {
    if (raf !== null) return;
    drawFft = renderFftFrame;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderFftFrame();
    };
    raf = requestAnimationFrame(loop);
  }

  onMount(() => {
    startVisualizer();
    // Resize observer: when the .fft-strip slides open or the viewport changes,
    // redraw immediately so the canvas backing store is sized correctly for the
    // first frame instead of waiting for the next rAF tick after the transition.
    if (canvasEl && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        if (drawFft) drawFft();
      });
      resizeObs.observe(canvasEl);
    }
  });
</script>

<div class="seq" class:playing>
  <header class="seq-head">
    <div class="brand">
      <Led
        variant={loading ? 'loading' : playing ? 'live' : loadError ? 'error' : 'ready'}
        label={loading ? 'LOAD' : playing ? 'LIVE' : loadError ? 'ERR' : 'STBY'}
      />
      <span class="brand-text">Step Sequencer</span>
      <span class="brand-sub">— what you're going to build</span>
    </div>

    <div class="controls">
      <div class="bpm">
        <span class="bpm-label">BPM</span>
        <input type="range" min="60" max="180" bind:value={bpm} class="bpm-slider" />
        <span class="bpm-num lcd">{bpm}</span>
      </div>

      <button class="btn btn-ghost" onclick={clearAll} type="button" disabled={playing}>clear</button>
      <button class="btn btn-ghost" onclick={reset} type="button" disabled={playing}>reset</button>

      <button
        class="btn btn-play"
        class:active={playing}
        onclick={toggle}
        type="button"
        disabled={loading}
      >
        {#if loading}
          <span class="spin">◌</span> loading
        {:else if playing}
          <span class="play-icon">■</span> stop
        {:else}
          <span class="play-icon">▶</span> play
        {/if}
      </button>
    </div>
  </header>

  {#if loadError}
    <div class="seq-error">{loadError}</div>
  {/if}

  <div class="grid" role="grid" aria-label="Step sequencer">
    <!-- step-number ruler at the top -->
    <div class="ruler" aria-hidden="true">
      <div class="ruler-label"></div>
      <div class="ruler-cells">
        {#each Array(16) as _, i (i)}
          <div
            class="ruler-cell lcd"
            class:downbeat={i % 4 === 0}
            class:current={i === currentStep}
          >{String(i + 1).padStart(2, '0')}</div>
        {/each}
      </div>
    </div>

    {#each TRACKS as t (t.id)}
      <div class="row" style="--c-track: {t.color};" class:muted={muted[t.id]}>
        <button
          class="row-label"
          class:row-muted={muted[t.id]}
          onclick={() => toggleMute(t.id)}
          type="button"
          aria-label="Mute {t.name}"
        >
          <span class="row-color"></span>
          <span class="row-name">{t.name}</span>
          <span class="row-mute" aria-hidden="true">{muted[t.id] ? 'M' : ''}</span>
        </button>
        <div class="cells">
          {#each pattern[t.id] as on, i (i)}
            <button
              class="cell"
              class:on
              class:current={i === currentStep}
              class:downbeat={i % 4 === 0}
              onclick={() => toggleCell(t.id, i)}
              type="button"
              aria-label="{t.name} step {i + 1}: {on ? 'on' : 'off'}"
            >
              <span class="cell-glow" aria-hidden="true"></span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="fft-strip" class:on={playing}>
    <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
    <div class="fft-axis">
      <span>20Hz</span>
      <span>1k</span>
      <span>20k</span>
    </div>
  </div>

  <footer class="seq-foot">
    <span>Click any cell to toggle. Drag the BPM slider. Use mute (M) to drop a track.</span>
    <span class="foot-meta lcd">tone.js · web audio · {playing ? 'playing' : 'stopped'}</span>
  </footer>
</div>

<style>
  .seq {
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    box-shadow: var(--shadow-card);
    user-select: none;
  }

  .seq-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    flex-wrap: wrap;
  }
  .brand { display: flex; align-items: baseline; gap: var(--sp-2); }
  .brand-mark {
    color: var(--c-track-1);
    font-size: 0.8rem;
    transition: color var(--d-mid);
    animation: brand-pulse 2.4s ease-in-out infinite;
  }
  .seq.playing .brand-mark {
    animation-duration: 0.5s;
  }
  @keyframes brand-pulse {
    0%, 100% { color: var(--c-track-1); text-shadow: 0 0 8px var(--c-track-1); }
    50% { color: #ff8a5b; text-shadow: 0 0 14px var(--c-track-1); }
  }
  .brand-text {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    color: var(--c-text);
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
  }

  .controls { display: flex; align-items: center; gap: var(--sp-2); }

  .bpm {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 4px 10px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .bpm-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .bpm-num {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--c-text);
    font-weight: 600;
    min-width: 30px;
    text-align: right;
    font-feature-settings: 'tnum';
  }
  .bpm-slider {
    accent-color: var(--c-track-1);
    width: 80px;
    height: 4px;
    cursor: pointer;
  }

  .btn {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    color: var(--c-text);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 7px 12px;
    border-radius: var(--r-sm);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all var(--d-fast);
  }
  .btn:hover { border-color: var(--c-border-strong); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-ghost { color: var(--c-text-muted); }
  .btn-play {
    background: var(--c-track-1);
    border-color: var(--c-track-1);
    color: white;
    box-shadow: 0 8px 24px -10px var(--c-track-1);
  }
  .btn-play:hover { transform: translateY(-1px); }
  .btn-play.active {
    background: #c93000;
    border-color: #c93000;
    box-shadow: 0 8px 24px -10px #c93000;
  }
  .play-icon { font-size: 0.7rem; }
  .spin {
    display: inline-block;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .seq-error {
    background: color-mix(in srgb, var(--c-error) 14%, transparent);
    color: var(--c-error);
    border: 1px solid color-mix(in srgb, var(--c-error) 30%, transparent);
    border-radius: var(--r-sm);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin: 0 var(--sp-3) var(--sp-3);
  }

  .grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--c-bg-code);
    padding: var(--sp-3);
    border-radius: var(--r-md);
    border: 1px solid var(--c-border);
  }

  .ruler {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: var(--sp-3);
    align-items: center;
    padding: 0 0 4px;
    border-bottom: 1px solid color-mix(in srgb, var(--c-border) 50%, transparent);
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
    letter-spacing: 0.04em;
  }
  .ruler-cell.downbeat {
    color: var(--c-text-muted);
  }
  .ruler-cell.current {
    color: var(--c-track-1);
    text-shadow: 0 0 8px var(--c-track-1);
  }

  .row {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: var(--sp-3);
    align-items: center;
  }

  .row-label {
    display: grid;
    grid-template-columns: 6px 1fr 14px;
    align-items: center;
    gap: 6px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 8px 10px;
    height: 36px;
    cursor: pointer;
    transition: all var(--d-fast);
  }
  .row-label:hover { border-color: var(--c-border-strong); }
  .row-color {
    width: 4px;
    height: 18px;
    background: var(--c-track);
    border-radius: 2px;
    box-shadow: 0 0 6px -1px var(--c-track);
  }
  .row.muted .row-color {
    background: var(--c-text-faint);
    box-shadow: none;
  }
  .row-name {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.06em;
    color: var(--c-text);
  }
  .row.muted .row-name { color: var(--c-text-faint); }
  .row-mute {
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
    isolation: isolate;
  }
  .cell:hover {
    border-color: color-mix(in srgb, var(--c-track) 60%, var(--c-border));
    background: color-mix(in srgb, var(--c-track) 12%, var(--c-surface));
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
    z-index: 1;
  }
  .cell.on {
    background: var(--c-track);
    border-color: var(--c-track);
    box-shadow: 0 0 12px -2px var(--c-track);
  }
  .cell.on:hover {
    transform: translateY(-1px);
  }
  .cell.current {
    border-color: white;
    border-width: 2px;
  }
  .cell.on.current {
    box-shadow: 0 0 24px -2px var(--c-track), 0 0 0 1px white inset;
  }
  .cell.current .cell-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at center,
      color-mix(in srgb, var(--c-track) 90%, white) 0%,
      transparent 70%
    );
    animation: cell-flash 0.18s ease-out;
    pointer-events: none;
  }
  @keyframes cell-flash {
    0% { opacity: 1; transform: scale(1.4); }
    100% { opacity: 0; transform: scale(0.8); }
  }

  .row.muted .cell.on {
    background: color-mix(in srgb, var(--c-track) 35%, var(--c-surface));
    box-shadow: none;
    border-color: var(--c-border);
  }

  .fft-strip {
    position: relative;
    height: 0;
    margin: 0 var(--sp-3);
    background: var(--c-bg-code);
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    overflow: hidden;
    opacity: 0;
    transition:
      height var(--d-mid) var(--ease-out),
      opacity var(--d-mid),
      margin-top var(--d-mid),
      border-color var(--d-mid);
  }
  .fft-strip.on {
    height: 56px;
    margin-top: var(--sp-2);
    opacity: 1;
    border-color: var(--c-border);
  }
  .fft-strip canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .fft-axis {
    position: absolute;
    bottom: 2px;
    left: 6px;
    right: 6px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
    font-family: var(--font-lcd);
    font-size: 0.5rem;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.06em;
  }

  .seq-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--sp-2) var(--sp-3) 4px;
    margin-top: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .foot-meta { color: var(--c-text-faint); }

  @media (max-width: 720px) {
    .grid { padding: var(--sp-2); }
    .ruler { grid-template-columns: 60px 1fr; gap: var(--sp-2); }
    .row { grid-template-columns: 60px 1fr; gap: var(--sp-2); }
    .row-label { padding: 6px 6px; grid-template-columns: 4px 1fr 10px; }
    .cell { height: 28px; }
    .ruler-cell { font-size: 0.55rem; }
  }
</style>
