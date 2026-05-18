<!--
  Live FFT visualizer reading from the engine's analyser node. Renders to
  a canvas via a requestAnimationFrame loop.

  Notes:
    - `raf` is a plain `let`, NOT $state — it changes 60 times/sec and no UI
      needs to react to it.
    - DPI scaling: backing store = CSS size × devicePixelRatio for crisp
      rendering on retina displays.
    - The loop is always running; when not playing it just draws a baseline.
-->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { audio } from '$lib/audio/engine.svelte';

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let raf: number | null = null;

  function draw() {
    raf = requestAnimationFrame(draw);
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvasEl.clientWidth;
    const cssH = canvasEl.clientHeight;
    if (canvasEl.width !== cssW * dpr) canvasEl.width = Math.max(1, cssW * dpr);
    if (canvasEl.height !== cssH * dpr) canvasEl.height = Math.max(1, cssH * dpr);

    const W = canvasEl.width;
    const H = canvasEl.height;
    ctx.clearRect(0, 0, W, H);

    const data = audio.getFftData();
    if (!data || !audio.isPlaying) {
      ctx.fillStyle = 'rgba(155, 108, 255, 0.18)';
      ctx.fillRect(0, H / 2 - dpr / 2, W, dpr);
      return;
    }

    const bins = data.length;
    const gap = 2 * dpr;
    const barW = (W - gap * (bins - 1)) / bins;

    for (let i = 0; i < bins; i++) {
      const v = data[i]; // typically -100..0 dB
      const norm = Math.max(0, Math.min(1, (v + 100) / 70));
      const barH = norm * H;
      const x = i * (barW + gap);
      const y = H - barH;
      const grad = ctx.createLinearGradient(0, y, 0, H);
      grad.addColorStop(0, `rgba(214, 154, 255, ${0.95 * norm + 0.05})`);
      grad.addColorStop(1, `rgba(155, 108, 255, ${0.4 * norm + 0.1})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW, barH);
    }
  }

  onMount(() => {
    raf = requestAnimationFrame(draw);
  });

  onDestroy(() => {
    if (raf !== null) cancelAnimationFrame(raf);
  });
</script>

<div class="fft" class:on={audio.isPlaying}>
  <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
  <div class="axis" aria-hidden="true">
    <span>20Hz</span>
    <span>1k</span>
    <span>20k</span>
  </div>
</div>

<style>
  .fft {
    position: relative;
    height: 80px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    overflow: hidden;
    opacity: 0.45;
    transition: opacity var(--d-mid);
  }
  .fft.on { opacity: 1; }
  canvas { display: block; width: 100%; height: 100%; }
  .axis {
    position: absolute;
    inset: auto 8px 4px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
    font-family: var(--font-lcd);
    font-size: 0.55rem;
    color: rgba(255, 255, 255, 0.35);
    letter-spacing: 0.08em;
  }
</style>
