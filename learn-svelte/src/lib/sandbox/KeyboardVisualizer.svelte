<!--
  Playable mini keyboard with a real-time visualizer above it. Mouse or
  computer keyboard plays notes; the canvas draws an FFT spectrum across the
  bottom half and spawns particle bursts at note attacks in the top half.

  Audio is loaded the same way as Sequencer.svelte: dynamic import of
  Tone.js from esm.sh on first user gesture, so the AudioContext is created
  in response to a real user action (browser policy).
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Led from '$lib/components/Led.svelte';

  // ── note layout ──────────────────────────────────────────────────────
  // White keys C4..F5 (11 keys). Black keys are interleaved at the standard
  // piano positions. Each entry has a midi number so we can pitch-class colour
  // particles and order keys deterministically.
  type Key = {
    note: string;       // 'C4', 'C#4', etc.
    midi: number;
    isBlack: boolean;
    keyChar: string;    // ASCII keyboard binding (lowercased)
    label: string;      // shown on the key
  };

  // Home-row whites + top-row blacks. Order in the array doesn't matter for
  // rendering (we filter by isBlack in the markup).
  const WHITE_KEYS: Key[] = [
    { note: 'C4',  midi: 60, isBlack: false, keyChar: 'a',  label: 'A' },
    { note: 'D4',  midi: 62, isBlack: false, keyChar: 's',  label: 'S' },
    { note: 'E4',  midi: 64, isBlack: false, keyChar: 'd',  label: 'D' },
    { note: 'F4',  midi: 65, isBlack: false, keyChar: 'f',  label: 'F' },
    { note: 'G4',  midi: 67, isBlack: false, keyChar: 'g',  label: 'G' },
    { note: 'A4',  midi: 69, isBlack: false, keyChar: 'h',  label: 'H' },
    { note: 'B4',  midi: 71, isBlack: false, keyChar: 'j',  label: 'J' },
    { note: 'C5',  midi: 72, isBlack: false, keyChar: 'k',  label: 'K' },
    { note: 'D5',  midi: 74, isBlack: false, keyChar: 'l',  label: 'L' },
    { note: 'E5',  midi: 76, isBlack: false, keyChar: ';',  label: ';' },
    { note: 'F5',  midi: 77, isBlack: false, keyChar: "'",  label: "'" }
  ];

  // Black keys, in order. `afterWhiteIdx` says which white key (by index in
  // WHITE_KEYS) it visually sits to the right of.
  const BLACK_KEYS: (Key & { afterWhiteIdx: number })[] = [
    { note: 'C#4', midi: 61, isBlack: true, keyChar: 'w', label: 'W', afterWhiteIdx: 0 },
    { note: 'D#4', midi: 63, isBlack: true, keyChar: 'e', label: 'E', afterWhiteIdx: 1 },
    { note: 'F#4', midi: 66, isBlack: true, keyChar: 't', label: 'T', afterWhiteIdx: 3 },
    { note: 'G#4', midi: 68, isBlack: true, keyChar: 'y', label: 'Y', afterWhiteIdx: 4 },
    { note: 'A#4', midi: 70, isBlack: true, keyChar: 'u', label: 'U', afterWhiteIdx: 5 },
    { note: 'C#5', midi: 73, isBlack: true, keyChar: 'o', label: 'O', afterWhiteIdx: 7 },
    { note: 'D#5', midi: 75, isBlack: true, keyChar: 'p', label: 'P', afterWhiteIdx: 8 }
  ];

  const ALL_KEYS: Key[] = [...WHITE_KEYS, ...BLACK_KEYS];
  const KEY_BY_CHAR: Map<string, Key> = new Map(ALL_KEYS.map((k) => [k.keyChar, k]));

  // ── state ────────────────────────────────────────────────────────────
  let loading = $state(false);
  let loadError = $state<string | null>(null);
  let audioReady = $state(false);
  let pressed: Record<string, boolean> = $state({});
  // Pitch-class hue mapping. C=0deg (red), shifts by 30deg per semitone, so
  // each pitch class gets a distinct hue and octave-equivalent notes share one.
  function hueFor(midi: number): number {
    return (midi % 12) * 30;
  }
  function colorFor(midi: number, alpha = 1): string {
    return `hsla(${hueFor(midi)}, 80%, 60%, ${alpha})`;
  }

  // ── audio (loaded lazily) ────────────────────────────────────────────
  let Tone: any = null;
  let polySynth: any = null;
  let master: any = null;
  let analyser: any = null;

  async function ensureTone() {
    if (Tone) return;
    loading = true;
    try {
      const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/tone@15.0.4');
      Tone = mod;
      await Tone.start();
      master = new Tone.Gain(0.7).toDestination();
      analyser = new Tone.Analyser('fft', 64);
      master.connect(analyser);
      polySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.18, sustain: 0.4, release: 0.6 }
      }).connect(master);
      polySynth.volume.value = -8;
      audioReady = true;
    } catch (err) {
      loadError = `Could not load audio: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  async function attackNote(key: Key) {
    if (pressed[key.note]) return;
    await ensureTone();
    if (!polySynth) return;
    pressed[key.note] = true;
    pressed = { ...pressed };
    polySynth.triggerAttack(key.note);
    spawnBurst(key);
  }

  function releaseNote(key: Key) {
    if (!pressed[key.note]) return;
    pressed[key.note] = false;
    pressed = { ...pressed };
    if (polySynth) polySynth.triggerRelease(key.note);
  }

  function releaseAll() {
    if (polySynth) polySynth.releaseAll();
    pressed = {};
  }

  // ── visualizer ───────────────────────────────────────────────────────
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let raf: number | null = null;
  let resizeObs: ResizeObserver | null = null;

  // Particles intentionally live outside the rune system — they mutate at
  // 60fps and would thrash reactivity. The rAF loop reads/writes directly.
  type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    life: number;       // 0..1, decreases each frame
    radius: number;
    midi: number;
  };
  let particles: Particle[] = [];
  // Pulse rings — one per note attack, expand outward from spawn point.
  type Pulse = { x: number; y: number; r: number; life: number; midi: number };
  let pulses: Pulse[] = [];

  function spawnBurst(key: Key) {
    if (!canvasEl) return;
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    // Spawn near the bottom edge of the top half, x positioned by note
    // within the C4..F5 range so visualizer maps left-to-right with the keyboard.
    const range = 77 - 60; // F5 - C4
    const t = Math.max(0, Math.min(1, (key.midi - 60) / range));
    const x = 20 + t * (cssW - 40);
    const y = cssH * 0.5 - 4;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 0.6 + Math.random() * 1.8;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        radius: 1.5 + Math.random() * 2.5,
        midi: key.midi
      });
    }
    pulses.push({ x, y, r: 4, life: 1, midi: key.midi });
    // Cap to avoid unbounded growth on key spam.
    if (particles.length > 600) particles.splice(0, particles.length - 600);
    if (pulses.length > 60) pulses.splice(0, pulses.length - 60);
  }

  function renderFrame() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvasEl.width !== cssW * dpr) canvasEl.width = Math.max(1, cssW * dpr);
    if (canvasEl.height !== cssH * dpr) canvasEl.height = Math.max(1, cssH * dpr);
    const W = canvasEl.width;
    const H = canvasEl.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const anyHeld = Object.values(pressed).some(Boolean);
    const hasMotion = particles.length > 0 || pulses.length > 0;

    // ── bottom half: FFT bars ────────────────────────────────────────
    const halfH = cssH / 2;
    if (analyser && (anyHeld || hasMotion)) {
      const data = analyser.getValue() as Float32Array;
      const bins = data.length;
      const gap = 2;
      const barW = (cssW - gap * (bins - 1)) / bins;
      for (let i = 0; i < bins; i++) {
        const v = data[i]; // dB, typically -100..0
        const norm = Math.max(0, Math.min(1, (v + 100) / 70));
        const barH = norm * halfH;
        const x = i * (barW + gap);
        const y = cssH - barH;
        const grad = ctx.createLinearGradient(0, y, 0, cssH);
        grad.addColorStop(0, `rgba(45, 191, 184, ${0.95 * norm + 0.05})`);
        grad.addColorStop(1, `rgba(45, 191, 184, ${0.25 * norm + 0.05})`);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);
      }
    } else {
      // baseline: a thin horizontal line in track color
      ctx.strokeStyle = 'rgba(45, 191, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, cssH - 1);
      ctx.lineTo(cssW - 8, cssH - 1);
      ctx.stroke();
    }

    // mid divider — subtle horizontal line between halves
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, halfH, cssW, 1);

    // ── top half: pulses + particles ─────────────────────────────────
    // Clip to top half so particles don't leak into the FFT area.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cssW, halfH);
    ctx.clip();

    // Pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.r += 2.4;
      p.life -= 0.025;
      if (p.life <= 0) {
        pulses.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = colorFor(p.midi, p.life * 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy -= 0.04;          // float up
      pt.vx *= 0.99;
      pt.life -= 0.012;
      if (pt.life <= 0 || pt.y < -10) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = colorFor(pt.midi, pt.life);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius * (0.4 + pt.life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function startVisualizer() {
    if (raf !== null) return;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderFrame();
    };
    raf = requestAnimationFrame(loop);
  }

  // ── computer keyboard ────────────────────────────────────────────────
  // Track held physical keys to suppress OS auto-repeat retriggering.
  const held: Set<string> = new Set();

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.repeat) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const ch = ev.key.toLowerCase();
    const k = KEY_BY_CHAR.get(ch);
    if (!k) return;
    if (held.has(ch)) return;
    held.add(ch);
    ev.preventDefault();
    attackNote(k);
  }

  function onKeyUp(ev: KeyboardEvent) {
    const ch = ev.key.toLowerCase();
    const k = KEY_BY_CHAR.get(ch);
    if (!k) return;
    held.delete(ch);
    releaseNote(k);
  }

  // Release any sustained notes if the window loses focus — otherwise the
  // keyup never fires and notes ring forever.
  function onBlur() {
    held.clear();
    releaseAll();
  }

  onMount(() => {
    startVisualizer();
    if (canvasEl && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => renderFrame());
      resizeObs.observe(canvasEl);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
  });

  onDestroy(() => {
    if (raf !== null) cancelAnimationFrame(raf);
    if (resizeObs) resizeObs.disconnect();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    releaseAll();
    if (polySynth) polySynth.dispose();
    if (analyser) analyser.dispose();
    if (master) master.dispose();
  });

  // Mouse handlers on individual keys. We attach pointerdown, and use
  // pointerup/pointerleave on the key itself plus a window pointerup as a
  // safety net (drag-off-then-release).
  function onPointerDown(ev: PointerEvent, k: Key) {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    attackNote(k);
  }
  function onPointerUp(_ev: PointerEvent, k: Key) {
    releaseNote(k);
  }

  const ledVariant = $derived(
    loading ? 'loading' : audioReady ? 'live' : loadError ? 'error' : 'ready'
  );
  const ledLabel = $derived(
    loading ? 'LOAD' : audioReady ? 'LIVE' : loadError ? 'ERR' : 'STBY'
  );
  const heldCount = $derived(Object.values(pressed).filter(Boolean).length);
</script>

<div class="kbd-vis" style="--c-track: var(--c-track-8);">
  <header class="seq-head">
    <div class="brand">
      <Led variant={ledVariant} label={ledLabel} />
      <span class="brand-text">Keyboard Visualizer</span>
      <span class="brand-sub lcd">demo · play with mouse or keys</span>
    </div>
    <div class="meta">
      <span class="meta-chip lcd">VOICES <b>{heldCount}</b></span>
      <span class="meta-chip lcd">RANGE C4–F5</span>
    </div>
  </header>

  {#if loadError}
    <div class="kv-error">{loadError}</div>
  {/if}

  <div class="canvas-wrap">
    <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
    <div class="canvas-axis">
      <span>FFT</span>
      <span>{audioReady ? 'tap a key' : 'click to load audio'}</span>
    </div>
  </div>

  <div class="keyboard" role="group" aria-label="Playable keyboard">
    <div class="white-row">
      {#each WHITE_KEYS as k (k.note)}
        <button
          class="white-key"
          class:held={pressed[k.note]}
          style="--c-note: {colorFor(k.midi)};"
          onpointerdown={(e) => onPointerDown(e, k)}
          onpointerup={(e) => onPointerUp(e, k)}
          onpointerleave={(e) => onPointerUp(e, k)}
          oncontextmenu={(e) => e.preventDefault()}
          type="button"
          aria-label="{k.note} (key {k.label})"
          aria-pressed={pressed[k.note] ? 'true' : 'false'}
        >
          <span class="key-glow" aria-hidden="true"></span>
          <span class="key-note lcd">{k.note}</span>
          <span class="key-char">{k.label}</span>
        </button>
      {/each}
    </div>
    <div class="black-row" aria-hidden="true">
      {#each BLACK_KEYS as k (k.note)}
        <button
          class="black-key"
          class:held={pressed[k.note]}
          style="left: calc(({k.afterWhiteIdx} + 1) * (100% / {WHITE_KEYS.length}) - (100% / {WHITE_KEYS.length}) * 0.32); --c-note: {colorFor(k.midi)};"
          onpointerdown={(e) => onPointerDown(e, k)}
          onpointerup={(e) => onPointerUp(e, k)}
          onpointerleave={(e) => onPointerUp(e, k)}
          oncontextmenu={(e) => e.preventDefault()}
          type="button"
          aria-label="{k.note} (key {k.label})"
          aria-pressed={pressed[k.note] ? 'true' : 'false'}
        >
          <span class="key-glow" aria-hidden="true"></span>
          <span class="key-char black">{k.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <footer class="kv-foot">
    <span>click keys with mouse, or use ASCII keyboard. visualizer responds to notes.</span>
    <span class="foot-meta lcd">tone.js · polysynth · {audioReady ? 'ready' : 'idle'}</span>
  </footer>
</div>

<style>
  .kbd-vis {
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
  .brand-text {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    color: var(--c-text);
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-size: 0.62rem;
    color: var(--c-text-faint);
  }

  .meta { display: flex; gap: var(--sp-2); align-items: center; }
  .meta-chip {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 4px 8px;
    font-size: 0.6rem;
    color: var(--c-text-muted);
  }
  .meta-chip b {
    color: var(--c-track);
    font-weight: 700;
    margin-left: 4px;
  }

  .kv-error {
    background: color-mix(in srgb, var(--c-error) 14%, transparent);
    color: var(--c-error);
    border: 1px solid color-mix(in srgb, var(--c-error) 30%, transparent);
    border-radius: var(--r-sm);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin: 0 var(--sp-3) var(--sp-3);
  }

  .canvas-wrap {
    position: relative;
    height: 280px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    overflow: hidden;
    margin: 0 var(--sp-3);
  }
  .canvas-wrap canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
  .canvas-axis {
    position: absolute;
    top: 6px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    font-family: var(--font-lcd);
    font-size: 0.55rem;
    color: rgba(255, 255, 255, 0.32);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
  }

  /* ── keyboard ───────────────────────────────────────────────────── */
  .keyboard {
    position: relative;
    margin: var(--sp-3);
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: 8px;
    isolation: isolate;
  }

  .white-row {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: 4px;
    height: 150px;
  }

  .white-key {
    position: relative;
    background: linear-gradient(
      to bottom,
      #f3f4f8 0%,
      #d8dae3 100%
    );
    border: 1px solid var(--c-border);
    border-radius: 0 0 var(--r-sm) var(--r-sm);
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    padding-bottom: 8px;
    transition:
      background var(--d-fast),
      box-shadow var(--d-fast),
      transform 60ms var(--ease-out);
    overflow: hidden;
  }
  .white-key:hover {
    background: linear-gradient(to bottom, #ffffff 0%, #e8eaf2 100%);
  }
  .white-key.held {
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--c-track) 35%, white) 0%,
      var(--c-track) 100%
    );
    border-color: var(--c-track);
    box-shadow:
      0 0 18px -2px var(--c-track),
      0 0 0 1px var(--c-track) inset;
    transform: translateY(1px);
  }
  .white-key.held .key-note,
  .white-key.held .key-char {
    color: white;
  }
  .key-note {
    font-size: 0.55rem;
    color: var(--c-text-faint);
    letter-spacing: 0.06em;
  }
  .key-char {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    color: var(--c-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 6px;
    border-radius: var(--r-sm);
  }
  .white-key.held .key-char {
    background: rgba(255, 255, 255, 0.18);
  }
  .key-glow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      circle at 50% 100%,
      var(--c-note) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity var(--d-fast);
  }
  .white-key.held .key-glow { opacity: 0.35; }

  .black-row {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    height: 92px;
    pointer-events: none;
  }
  .black-key {
    position: absolute;
    top: 0;
    width: calc((100% / 11) * 0.62);
    height: 100%;
    background: linear-gradient(
      to bottom,
      #2a2d3c 0%,
      #14151c 100%
    );
    border: 1px solid #000;
    border-radius: 0 0 var(--r-sm) var(--r-sm);
    cursor: pointer;
    pointer-events: auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding-bottom: 6px;
    box-shadow:
      0 4px 8px -2px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
    transition:
      background var(--d-fast),
      box-shadow var(--d-fast),
      transform 60ms var(--ease-out);
    overflow: hidden;
  }
  .black-key:hover {
    background: linear-gradient(to bottom, #383c52 0%, #1d2030 100%);
  }
  .black-key.held {
    background: linear-gradient(
      to bottom,
      color-mix(in srgb, var(--c-track) 60%, #14151c) 0%,
      var(--c-track) 100%
    );
    border-color: var(--c-track);
    box-shadow:
      0 0 18px -2px var(--c-track),
      0 0 0 1px var(--c-track) inset;
    transform: translateY(1px);
  }
  .key-char.black {
    color: rgba(255, 255, 255, 0.55);
    background: rgba(255, 255, 255, 0.06);
    font-size: 0.58rem;
  }
  .black-key.held .key-char.black {
    color: white;
    background: rgba(255, 255, 255, 0.18);
  }
  .black-key .key-glow {
    background: radial-gradient(
      circle at 50% 100%,
      var(--c-note) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity var(--d-fast);
  }
  .black-key.held .key-glow { opacity: 0.5; }

  .kv-foot {
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
    .canvas-wrap { height: 200px; }
    .white-row { height: 120px; }
    .black-row { height: 74px; }
    .key-note { display: none; }
    .key-char { font-size: 0.55rem; padding: 1px 4px; }
  }
</style>
