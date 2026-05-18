<!--
  Tone Grid — a 2D playable surface. X = pitch (pentatonic minor across 3
  octaves), Y = volume. Notes fire on cell-boundary crossings, so movement
  speed controls density. Ripples + a fading mouse trail provide the
  visual feedback.

  Audio: Tone.js loaded from esm.sh on the first user gesture, same pattern
  as Sequencer.svelte. A single MonoSynth → Gain → Destination chain.

  rAF state lives in plain `let` — never in $state, since we redraw at 60Hz
  and don't want Svelte's reactivity walking those arrays.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Led from '$lib/components/Led.svelte';

  type Scale = 'pentatonic' | 'major' | 'minor' | 'chromatic';

  // Scale degrees (semitones from root) for a 3-octave span.
  const SCALES: Record<Scale, number[]> = {
    pentatonic: [0, 3, 5, 7, 10],
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
    chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  const ROOT_MIDI = 36; // C2
  const OCTAVES = 3;
  const GRID_N = 16; // 16x16 cells

  function scaleNotes(s: Scale): string[] {
    const degrees = SCALES[s];
    const out: string[] = [];
    for (let oct = 0; oct < OCTAVES; oct++) {
      for (const d of degrees) {
        out.push(midiToNote(ROOT_MIDI + oct * 12 + d));
      }
    }
    return out;
  }

  function midiToNote(midi: number): string {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const n = names[midi % 12];
    const o = Math.floor(midi / 12) - 1;
    return `${n}${o}`;
  }

  // ── state ────────────────────────────────────────────────────────────
  let scale: Scale = $state('pentatonic');
  let loading = $state(false);
  let loaded = $state(false);
  let loadError = $state<string | null>(null);
  let lastNote = $state<string>('—');
  let interacting = $state(false);

  let notes = $derived(scaleNotes(scale));

  // ── audio ────────────────────────────────────────────────────────────
  let Tone: any = null;
  let synth: any = null;
  let master: any = null;

  async function ensureTone() {
    if (Tone) return;
    loading = true;
    try {
      const mod: any = await import(/* @vite-ignore */ 'https://esm.sh/tone@15.0.4');
      Tone = mod;
      await Tone.start();
      master = new Tone.Gain(0.7).toDestination();
      synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.18, sustain: 0.0, release: 0.25 }
      }).connect(master);
      loaded = true;
    } catch (err) {
      loadError = `Could not load audio: ${(err as Error).message}`;
    } finally {
      loading = false;
    }
  }

  // ── rendering / interaction (plain locals, not $state) ───────────────
  let canvasEl: HTMLCanvasElement | undefined = $state();
  let wrapEl: HTMLDivElement | undefined = $state();
  let raf: number | null = null;
  let resizeObs: ResizeObserver | null = null;

  // Mouse trail: { x, y, t } in CSS pixels.
  type TrailPt = { x: number; y: number; t: number };
  let trail: TrailPt[] = [];
  const TRAIL_LIFE = 1000; // ms

  // Ripples: { x, y, t, hue }.
  type Ripple = { x: number; y: number; t: number; hue: number };
  let ripples: Ripple[] = [];
  const RIPPLE_LIFE = 600;

  // Last cell the cursor was in, for boundary-crossing detection.
  let lastCol = -1;
  let lastRow = -1;
  let mouseInside = false;
  let mouseX = 0;
  let mouseY = 0;

  function clear() {
    trail = [];
    ripples = [];
    lastCol = -1;
    lastRow = -1;
    lastNote = '—';
  }

  function emitNote(col: number, row: number, px: number, py: number) {
    const list = notes;
    const idx = Math.max(0, Math.min(list.length - 1,
      Math.floor((col / GRID_N) * list.length)));
    const note = list[idx];
    // Y maps inversely to volume: top loud, bottom soft. Range 0.05..0.7.
    const vy = 1 - row / (GRID_N - 1);
    const velocity = 0.05 + vy * 0.65;
    const hue = (idx / Math.max(1, list.length - 1)) * 320;
    if (Tone && synth) {
      try {
        synth.triggerAttackRelease(note, '32n', undefined, velocity);
      } catch {
        // Tone occasionally throws on overlapping triggers — ignore.
      }
    }
    ripples.push({ x: px, y: py, t: performance.now(), hue });
    lastNote = note;
  }

  async function handlePointerMove(e: PointerEvent) {
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseX = x;
    mouseY = y;
    mouseInside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (!mouseInside) return;

    const now = performance.now();
    trail.push({ x, y, t: now });
    if (trail.length > 240) trail.splice(0, trail.length - 240);

    const col = Math.max(0, Math.min(GRID_N - 1, Math.floor((x / rect.width) * GRID_N)));
    const row = Math.max(0, Math.min(GRID_N - 1, Math.floor((y / rect.height) * GRID_N)));

    if (col !== lastCol || row !== lastRow) {
      lastCol = col;
      lastRow = row;
      if (!interacting) interacting = true;
      // Lazy-load Tone on the first move; first few notes will be silent
      // until the import + AudioContext start resolves.
      if (!Tone && !loading) ensureTone();
      emitNote(col, row, x, y);
    }
  }

  function handlePointerLeave() {
    mouseInside = false;
    lastCol = -1;
    lastRow = -1;
  }

  // ── draw ─────────────────────────────────────────────────────────────
  function resizeBacking() {
    if (!canvasEl) return;
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (canvasEl.width !== w) canvasEl.width = w;
    if (canvasEl.height !== h) canvasEl.height = h;
  }

  function draw() {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    resizeBacking();
    const W = canvasEl.width;
    const H = canvasEl.height;
    const dpr = window.devicePixelRatio || 1;
    const cssW = W / dpr;
    const cssH = H / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    // Background panel — dim base wash.
    ctx.fillStyle = '#08090d';
    ctx.fillRect(0, 0, cssW, cssH);

    // Grid cells: hue from X, lightness from Y. Centered around the green
    // accent (#5bc85a is around hue 119).
    const cellW = cssW / GRID_N;
    const cellH = cssH / GRID_N;
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        const hue = 119 + (c / GRID_N - 0.5) * 90; // ~74..164
        const lt = 8 + (1 - r / GRID_N) * 14; // top brighter
        ctx.fillStyle = `hsl(${hue} 35% ${lt}%)`;
        ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Thin borders.
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID_N; i++) {
      const x = Math.round(i * cellW) + 0.5;
      ctx.moveTo(x, 0); ctx.lineTo(x, cssH);
      const y = Math.round(i * cellH) + 0.5;
      ctx.moveTo(0, y); ctx.lineTo(cssW, y);
    }
    ctx.stroke();

    const now = performance.now();

    // Trail — render as a soft polyline with per-segment alpha fade.
    if (trail.length > 1) {
      // Drop expired points.
      while (trail.length && now - trail[0].t > TRAIL_LIFE) trail.shift();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        const age = now - b.t;
        const k = 1 - age / TRAIL_LIFE;
        if (k <= 0) continue;
        ctx.strokeStyle = `rgba(91,200,90,${0.55 * k})`;
        ctx.lineWidth = 1.5 + 4 * k;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Ripples — expanding ring + soft fill.
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = now - rp.t;
      if (age > RIPPLE_LIFE) {
        ripples.splice(i, 1);
        continue;
      }
      const k = age / RIPPLE_LIFE; // 0..1
      const radius = 8 + k * Math.min(cssW, cssH) * 0.45;
      const alpha = 1 - k;
      ctx.strokeStyle = `hsla(${rp.hue}, 80%, 65%, ${alpha * 0.9})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Inner glow.
      const grad = ctx.createRadialGradient(rp.x, rp.y, 0, rp.x, rp.y, radius);
      grad.addColorStop(0, `hsla(${rp.hue}, 80%, 65%, ${alpha * 0.18})`);
      grad.addColorStop(1, `hsla(${rp.hue}, 80%, 65%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cursor crosshair when inside.
    if (mouseInside) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mouseY); ctx.lineTo(cssW, mouseY);
      ctx.moveTo(mouseX, 0); ctx.lineTo(mouseX, cssH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(91,200,90,0.85)';
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    draw();
  }

  onMount(() => {
    raf = requestAnimationFrame(loop);
    if (canvasEl && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => draw());
      resizeObs.observe(canvasEl);
    }
  });

  onDestroy(() => {
    if (raf !== null) cancelAnimationFrame(raf);
    if (resizeObs) resizeObs.disconnect();
    if (synth) try { synth.dispose(); } catch {}
    if (master) try { master.dispose(); } catch {}
  });
</script>

<div class="grid-card" bind:this={wrapEl}>
  <header class="seq-head">
    <div class="brand">
      <Led
        variant={loading ? 'loading' : loaded ? 'live' : loadError ? 'error' : 'ready'}
        label={loading ? 'LOAD' : loaded ? 'LIVE' : loadError ? 'ERR' : 'STBY'}
      />
      <span class="brand-text">Tone Grid</span>
      <span class="brand-sub lcd">demo · move the mouse</span>
    </div>
  </header>

  {#if loadError}
    <div class="seq-error">{loadError}</div>
  {/if}

  <div class="controls">
    <div class="ctrl-group">
      <span class="ctrl-label">SCALE</span>
      <select class="picker" bind:value={scale}>
        <option value="pentatonic">pentatonic</option>
        <option value="major">major</option>
        <option value="minor">minor</option>
        <option value="chromatic">chromatic</option>
      </select>
    </div>

    <button class="btn btn-ghost" type="button" onclick={clear}>clear</button>

    <div class="readout">
      <span class="ctrl-label">NOTE</span>
      <span class="readout-val lcd">{lastNote}</span>
    </div>
  </div>

  <div class="canvas-wrap">
    <canvas
      bind:this={canvasEl}
      onpointermove={handlePointerMove}
      onpointerleave={handlePointerLeave}
      onpointerdown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); handlePointerMove(e); }}
      aria-label="Tone grid: move the mouse to play notes"
    ></canvas>
  </div>

  <footer class="seq-foot">
    <span class="lcd">x = pitch · y = volume · move to play · ripples follow movement</span>
  </footer>
</div>

<style>
  .grid-card {
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3);
    box-shadow: var(--shadow-card);
    user-select: none;
    --c-grid-accent: var(--c-track-4);
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
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
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

  .controls {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-3) var(--sp-3);
    flex-wrap: wrap;
  }
  .ctrl-group, .readout {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 4px 10px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .ctrl-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .picker {
    background: transparent;
    color: var(--c-text);
    border: 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
    cursor: pointer;
    padding: 2px 4px;
  }
  .picker:focus { outline: 1px solid var(--c-grid-accent); border-radius: 2px; }

  .readout-val {
    font-family: var(--font-lcd);
    color: var(--c-grid-accent);
    text-shadow: 0 0 6px color-mix(in srgb, var(--c-grid-accent) 60%, transparent);
    min-width: 3.5em;
    text-align: right;
    font-size: var(--fs-sm);
    font-weight: 600;
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
    transition: all var(--d-fast);
  }
  .btn:hover { border-color: var(--c-border-strong); }
  .btn-ghost { color: var(--c-text-muted); }

  .canvas-wrap {
    position: relative;
    margin: 0 var(--sp-3);
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    overflow: hidden;
    aspect-ratio: 1 / 1;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
    width: 100%;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-grid-accent) 14%, transparent),
                0 12px 40px -20px color-mix(in srgb, var(--c-grid-accent) 50%, transparent);
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .seq-foot {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--sp-3) var(--sp-3) 4px;
    margin-top: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--c-text-faint);
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  @media (max-width: 720px) {
    .canvas-wrap { margin-left: 0; margin-right: 0; }
    .controls { padding: 0 var(--sp-2) var(--sp-2); }
  }
</style>
