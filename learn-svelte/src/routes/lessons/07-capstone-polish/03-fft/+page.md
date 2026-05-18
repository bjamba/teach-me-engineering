<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>FFT Visualizer · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-7);">

<LessonHeader
  moduleSlug="07-capstone-polish"
  lessonSlug="03-fft"
  title="Live FFT Visualizer Below the Grid"
  blurb="A canvas reading from Tone.Analyser. The audio you're hearing becomes the audio you're seeing. Animation loops at 60fps."
/>

## Why this lesson exists

The DAW makes sound. It looks like a drum machine but the only visual feedback for "is this thing actually working" is the playhead sweeping the grid. Add a live spectrum visualizer below the grid and suddenly the DAW has a face. Hits on the kick light up the left side (low frequencies). Hats produce a cluster of activity at the right (high frequencies). Reverb tails smear across the bottom in long-decaying gradients. The visualizer turns invisible audio into a thing you can see, which makes mixing-by-ear meaningfully easier — you can correlate the sound you hear with the bars you see and develop intuition for what frequencies your drums occupy.

This is also the right place in the curriculum to introduce a different kind of reactivity question: what data should live in `$state`, and what data shouldn't? Audio analyser output changes 60 times per second. Animation frame IDs change 60 times per second. Both should be plain `let` variables, not runes — but the canvas DOM reference should be `$state` because Svelte needs to know when it's been assigned by `bind:this`. The mixer (Lesson 2) showed where per-cell reactivity shines; this lesson shows where it shouldn't even be involved.

## Learning objectives

By the end of this lesson you'll be able to:

- Tap an audio graph with `Tone.Analyser` as a parallel branch (passive read, doesn't affect the audible signal).
- Drive a canvas animation with `requestAnimationFrame`, including correct cleanup with `cancelAnimationFrame` in `onDestroy`.
- Apply DPI scaling to a canvas (backing store = CSS size × `devicePixelRatio`) so renders are crisp on retina displays.
- Identify which variables should be `$state` (canvas reference for `bind:this`) versus plain `let` (rAF id, per-frame state) versus neither (audio data — read fresh from analyser each frame).
- Map FFT dB values (−100..0) to normalized 0..1 and then to bar heights.
- Reason about why drawing a baseline when not playing is preferable to stopping the rAF loop.

## Concept 1: `Tone.Analyser` as a passive tap

### What an analyser does

`Tone.Analyser` is a Web Audio node that maintains a rolling FFT (Fast Fourier Transform) of the audio passing through it. Every audio buffer that flows through is fed into the analyser, which transforms it from a time-domain waveform into a frequency-domain spectrum — a set of bins, each representing the energy at a particular frequency range.

For our DAW we use 64 bins, which gives roughly 360Hz of resolution per bin at a 48kHz sample rate (since the FFT covers 0 to Nyquist = 24kHz, divided by 64). That's coarse enough that a kick's fundamental at ~60Hz lands in the first or second bin and a hi-hat's energy at 8-12kHz spreads across the upper bins. Visually pleasing without being information-overload.

You read the current FFT data with `analyser.getValue()`, which returns a `Float32Array` of bin values in decibels (typically -100 dB at silence, 0 dB at full scale). The values update continuously; reading is just a snapshot of the current frame's spectrum.

### Parallel branch, not in-line

This part bears repeating from Lesson 1. The analyser is connected from the master gain, but not into the audible signal path:

```ts
this.analyser = new Tone.Analyser('fft', 64);
this.master.connect(this.analyser);
```

The graph looks like this:

```
[synths] → ... → [master] → [destination]   ← audible signal
                    └────→ [analyser]        ← passive tap
```

`master.connect(analyser)` adds a parallel edge from master to analyser. Audio flowing into master goes BOTH to destination (audible) AND to analyser (for measurement). The analyser doesn't have anything connected to its output, so it doesn't affect the audible signal — it's a measurement tap, not an in-line effect.

If you wired the analyser in-line — `master.connect(analyser)`, then `analyser.connect(destination)` — audio would flow through the analyser before reaching the speakers. That's not harmful in itself (the analyser doesn't process the audio), but it adds an unnecessary node to the audible path and conceptually conflates "measurement" with "processing." The parallel pattern is the standard.

### The getter on the engine

The visualizer needs to read the FFT data on every animation frame. The engine exposes a getter:

```ts
getFftData(): Float32Array | null {
  return this.analyser ? (this.analyser.getValue() as Float32Array) : null;
}
```

Returns the current FFT snapshot, or `null` if the analyser hasn't been built yet (i.e., `ensureReady` hasn't run). The cast to `Float32Array` is because `analyser.getValue()`'s return type is `Float32Array | Float32Array[]`, depending on whether the analyser is in single-channel or split-channel mode. We're in single-channel mode, so it's always `Float32Array`. The cast satisfies the TypeScript compiler.

A few things to notice about this getter:

- It returns a live reference to the analyser's internal buffer. Reading the array gives you the current frame's data. Reading again on the next frame gives you the next frame's data — the buffer is overwritten in place by the audio thread.
- It doesn't copy. If you held a reference and read it later, you'd see updated data, not a snapshot of when you called. For a visualizer that reads-then-draws-then-discards each frame, this is fine; for any case where you need a snapshot, you'd `.slice()` to copy.
- It's NOT a rune, derived, or any reactive primitive. It's a plain method that returns plain data. The visualizer reads it on every animation frame from inside a `requestAnimationFrame` callback — outside Svelte's reactivity entirely.

That last point is the key Svelte takeaway: this is data that should not flow through reactivity. The next concepts explain why.

## Concept 2: The animation loop

### `requestAnimationFrame` and why it's the right primitive

`requestAnimationFrame(callback)` asks the browser to call `callback` before the next paint. On a 60Hz display the next paint is ~16ms away; on a 120Hz display it's ~8ms; on a tab in the background, the browser may delay or coalesce paints to save CPU. Either way, `rAF` is synchronized with the display's refresh and the browser's paint scheduling.

The two main alternatives, and why they're worse:

- **`setInterval(callback, 16)`** — fires every 16ms regardless of display refresh, regardless of whether the tab is visible. Causes janky animation (the interval drifts relative to paint) and wastes battery on background tabs. Bad for animation.
- **`setTimeout(callback, 0)` in a loop** — same problems as setInterval, plus you have to manage the loop manually.

`rAF` is the standard. Every browser implements it. Every animation library uses it under the hood.

### The basic loop pattern

```ts
let raf: number | null = null;

function draw() {
  raf = requestAnimationFrame(draw);
  // ... render this frame
}

onMount(() => {
  raf = requestAnimationFrame(draw);
});

onDestroy(() => {
  if (raf !== null) cancelAnimationFrame(raf);
});
```

Three pieces:

1. `let raf: number | null = null` — holds the most recent rAF id, so we can cancel it on cleanup.
2. `draw()` schedules itself for the next frame as its first line, then renders. The self-scheduling-first pattern means the next frame is queued even if the render code throws, preventing the loop from accidentally stopping. (You could put it last, but first is conventional and safer.)
3. `onMount` kicks the loop off after the component mounts (so the canvas reference is available). `onDestroy` cancels the pending frame so we don't keep rendering after the component is gone.

The `cancelAnimationFrame` cleanup matters in single-page-app contexts. Without it, if you navigated away from the page that mounts the visualizer, the rAF loop would keep firing forever, holding references to the canvas (which would now be detached from the DOM) and slowly leaking memory.

### Why the loop runs even when not playing

The reference visualizer runs the rAF loop continuously, regardless of `audio.isPlaying`. When not playing, it draws a thin horizontal baseline instead of bars. Two reasons for this:

**Simpler control flow.** Starting and stopping the loop based on `isPlaying` would mean wiring an `$effect` that watches `isPlaying` and calls `requestAnimationFrame` or `cancelAnimationFrame`. The transitions get fiddly — what if `isPlaying` changes mid-frame? What if multiple effects race? Running unconditionally avoids the whole class of bugs.

**The cost is invisible.** An empty rAF callback that checks one boolean and draws one rectangle is maybe 50 microseconds. At 60Hz that's 3ms per second of CPU time. Below noise. The user can't tell the difference between "loop is running but doing nothing" and "loop isn't running."

The alternative — gating the loop on `isPlaying` — is a premature optimization. The win is in development, not at runtime. You skip designing the state machine.

### Restating: rAF vs $effect

You might wonder why we don't write the animation loop as an `$effect`:

```ts
// DON'T DO THIS
$effect(() => {
  let raf: number;
  function draw() {
    raf = requestAnimationFrame(draw);
    // ... render
  }
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
});
```

This kind of works — the effect runs once on mount, sets up the loop, and the return function cleans up on destroy. But it's conceptually wrong: `$effect` is for reactivity (re-run when deps change), not for one-shot lifecycle hooks. The loop has no reactive deps. `onMount` + `onDestroy` is the right pair for "set this up once, tear it down on unmount."

If the draw function needed to read reactive state (it doesn't, because the FFT data isn't in `$state`), you'd still use `onMount` for the loop setup and either pass the state values explicitly or read them inside `draw` knowing they're "live reads" of whatever the current rune value is at the moment `draw` runs.

## Concept 3: What goes in `$state`, what doesn't

### The three categories of state in this component

Take a look at the variable declarations in the visualizer:

```ts
let canvasEl: HTMLCanvasElement | undefined = $state();
let raf: number | null = null;
```

`canvasEl` is `$state`. `raf` is plain `let`. The audio data (`audio.getFftData()`) isn't a local variable at all. Why?

**`canvasEl` IS state.** It's the canvas DOM reference, populated by `bind:this={canvasEl}`. Svelte's `bind:this` only works on reactive variables — the binding assigns to the variable when the element is mounted, and Svelte needs to track that assignment. Without `$state`, the bind would either not compile or not work. The canvas reference is also genuinely "state" — it transitions from `undefined` to "the canvas element" exactly once, and the rest of the code reads it as a deciding factor ("if canvasEl, draw; otherwise skip").

**`raf` is NOT state.** It changes 60 times per second. No template binding depends on it. No effect should re-fire when it changes. It's pure local bookkeeping — the most recent rAF id, used to cancel on cleanup. Putting it in `$state` would generate 60 reactive writes per second for no benefit; the value is never read by anything reactive. Plain `let` is correct.

**The audio data is NOT a variable at all.** It lives in `Tone.Analyser`'s internal buffer. The visualizer reads it on every frame via `audio.getFftData()` and uses it immediately for that frame's render. The data is never stored in component state. If you stored it — `let fftData = $state(new Float32Array(64))` — you'd generate 60 writes per second to a reactive variable AND copy the buffer 60 times per second, both for zero benefit.

### The rule, restated

Use `$state` when:
- Template bindings read the value.
- Effects need to re-fire when it changes.
- Other components / modules need to subscribe.
- `bind:this` or `bind:value` writes to it.

Use plain `let` when:
- It's local bookkeeping for the component.
- The value changes frequently (per-frame, per-microsecond).
- Nothing reactive reads it.

Don't store it at all when:
- The data source already holds it (e.g., a Web Audio node's internal buffer).
- You can read it fresh each time you need it.

This rule comes back in Lesson 4 with more depth. For now, the principle is "match the reactivity granularity to the access pattern."

### Common mistakes

- **"My bind:this gives me `undefined`."** Either you forgot `$state()` on the declaration, or you're reading `canvasEl` before the component mounted. `onMount` is the earliest you can rely on `bind:this` having populated the variable.
- **"My visualizer flickers."** Likely the canvas backing store isn't being resized to match its CSS size on every frame, or the resize logic is creating a new context. Make sure you only update `canvasEl.width` / `.height` when the CSS size has actually changed (the `if (canvasEl.width !== cssW * dpr)` guard in the reference).
- **"My visualizer is blurry on retina."** Missing DPI scaling. The canvas's CSS size is in CSS pixels; the backing store needs to be in physical pixels. Set `canvas.width = cssW * devicePixelRatio` and let CSS handle the visual size via `width: 100%`.
- **"`getValue()` returns all -100s."** The analyser isn't connected, or `Tone.start()` hasn't been called, or you're calling it before `ensureReady` ran. Check that `audio.analyser` is non-null and that the master is connected to it.
- **"The animation doesn't stop when I navigate away."** Missing `cancelAnimationFrame` in `onDestroy`. Without it, the loop keeps firing on a detached canvas. Memory leak, plus useless CPU.

## Concept 4: Canvas DPI scaling

### The problem

The canvas's CSS size is the size you give it via `width: 100%; height: 80px` in CSS. The canvas's "backing store" (the actual pixel buffer the browser maintains) is the size you give it via the `width` and `height` HTML attributes (or the corresponding JS properties).

These two sizes are independent. If you don't set the backing store size explicitly, it defaults to 300×150 (yes, really). The CSS scales the 300×150 buffer to fit the CSS size, which on most non-trivial canvases means scaling up — and bitmap scaling produces blur.

On a non-retina display, scaling is bad. On a retina display (where 1 CSS pixel is 2 physical pixels), you want the backing store to be twice the CSS size in each dimension, so the canvas renders with one buffer pixel per physical screen pixel.

### The fix

```ts
const dpr = window.devicePixelRatio || 1;
const cssW = canvasEl.clientWidth;
const cssH = canvasEl.clientHeight;
if (canvasEl.width !== cssW * dpr) canvasEl.width = Math.max(1, cssW * dpr);
if (canvasEl.height !== cssH * dpr) canvasEl.height = Math.max(1, cssH * dpr);
```

Step by step:

1. `devicePixelRatio` is 1 on standard displays, 2 on retina, 3 on some phones. The `|| 1` is paranoia for very old browsers.
2. `clientWidth` / `clientHeight` are the CSS sizes (the rendered size of the canvas element, in CSS pixels).
3. The backing store size we want is `cssSize * dpr` — one buffer pixel per physical screen pixel.
4. We only assign `canvasEl.width = ...` when the size has actually changed, because every assignment to `canvasEl.width` clears the canvas. If we assigned on every frame regardless, we'd never see the previous frame's content — though in this visualizer we `clearRect` every frame anyway, so it'd just be redundant work. The guard is still good practice.
5. `Math.max(1, cssW * dpr)` — defensive against a CSS size of 0 (which would otherwise produce a 0-pixel canvas and crash some drawing operations).

After this code runs, the canvas has a backing store sized to the physical screen. The CSS continues to size the visual element at whatever CSS dimensions you chose. The browser renders one buffer pixel per screen pixel — crisp.

Drawing operations now work in physical pixels. A 2px line is 2 physical pixels wide, not 2 CSS pixels wide. If you want CSS-pixel-sized strokes, multiply your stroke widths by `dpr`. The reference visualizer does this for the gap between bars (`const gap = 2 * dpr`).

### Why `clientWidth`, not `offsetWidth` or `getBoundingClientRect`

Subtle choice. `clientWidth` returns the content box width as an integer. `offsetWidth` includes borders and scrollbars. `getBoundingClientRect()` gives subpixel precision (a float, after CSS transforms). For a canvas with no border (set by `border-radius` on the parent, not the canvas itself), `clientWidth` and `offsetWidth` give the same value, and we don't need subpixel precision because the backing store is integer-sized anyway. `clientWidth` is the simplest read.

If you used `getBoundingClientRect()` and got, say, 320.5, you'd need to `Math.round(320.5 * dpr)` for the backing store, which works but adds a step.

## Concept 5: The render function

### Walking through the full draw function

```ts
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
```

Each frame:

1. **Schedule next frame first.** `raf = requestAnimationFrame(draw)` — first line, so the loop continues even if a render error throws below.
2. **Guard on canvas.** If `canvasEl` isn't bound yet (rare, but possible during very fast unmount/remount), bail out.
3. **Get the 2D context.** `getContext('2d')` returns the canvas's drawing context. Returns `null` if the canvas is in another mode (WebGL etc.) — won't happen here, but the guard is defensive.
4. **DPI scaling.** As covered above. Idempotent — running it every frame is fine because the assignment is guarded.
5. **Clear the canvas.** Every frame starts blank. Required for canvas (unlike DOM, which retains state between updates).
6. **Read the FFT data.** `audio.getFftData()` returns the current frame's spectrum.
7. **Idle branch.** If no data, or audio isn't playing, draw a thin horizontal baseline at the vertical center. Visually communicates "the visualizer is alive but waiting for sound."
8. **Compute bar dimensions.** 64 bins. Each gets a bar of width `(W - gap * 63) / 64`, with `gap` pixels between adjacent bars.
9. **Per-bar render loop.** For each bin:
   - Read the dB value.
   - Normalize to 0..1. The `(v + 100) / 70` formula maps -100 dB to 0 and -30 dB to 1 (clamping anything above -30 to full height). Why 70 dB of range and not 100? Because the upper portion of the dB range is the interesting part — sounds quieter than -30 dB don't visually register, and stretching the visible range over the audible-energy band gives a more dynamic visualization. You can tune this (`60` for more dynamic, `100` for the full range).
   - Compute bar height as `norm * H`.
   - Compute x position based on bin index.
   - Create a vertical gradient that fades from bright at the top of the bar to dim at the bottom. The alpha values mix the normalized value into both stops, so taller bars are also brighter.
   - Fill the bar rectangle.

### Why the gradient

A flat-fill bar is fine but visually flat. The vertical gradient (bright at top, dim at bottom, alpha proportional to norm) makes the bars feel like they're glowing with energy proportional to amplitude. Tall, bright bars feel "loud"; short, dim bars feel "quiet." This is purely cosmetic but it's the kind of touch that turns "JavaScript-flavored visualization" into "looks like a real DAW."

The colors (purple gradient) match the DAW's overall theme. The math (alpha = 0.95 * norm + 0.05 at top, 0.4 * norm + 0.1 at bottom) is the result of someone — me — tweaking until the result looked right. There's no canonical formula.

## Concept 6: The full component

### Template and styles

```svelte
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
```

The `class:on=&lbrace;audio.isPlaying&rbrace;` toggles the opacity transition. When playing, the visualizer is at full opacity; when not, it dims to 45%. The CSS `transition: opacity var(--d-mid)` smooths the change over ~240ms. A small but effective visual cue.

The `<canvas>` has `aria-hidden="true"` because it's purely decorative — no information is communicated that isn't also available elsewhere (you can hear the music). Hiding from screen readers is the right move.

The `.axis` overlay shows static labels at 20Hz, 1kHz, 20kHz to give the user a sense of where they are in the spectrum. Not a precise scale (FFT bins aren't log-spaced, but our visual layout is linear), but enough orientation.

### Wiring it into the page

In the page mounting the DAW:

```svelte
<TransportBar />
<Sequencer />
<FftVisualizer />
<EffectPanels />
<Mixer />
```

The visualizer goes between the sequencer and the effects panels — visually, it's a status bar at the bottom of the grid showing what's playing. Press PLAY. Watch the bars dance.

## Putting it together

The visualizer is the smallest amount of code we've written this module (about 50 lines of TS plus styles) but it's also the most architecturally interesting in terms of "what should and shouldn't be reactive." Three categories of data, each handled differently:

- **Canvas DOM reference** — reactive (`$state`), because `bind:this` needs it.
- **rAF id** — non-reactive (`let`), because it changes too fast and nothing reads it reactively.
- **Audio data** — not stored at all, read fresh from the analyser each frame.

`audio.isPlaying` IS reactive and IS read in the component (`class:on={audio.isPlaying}` and the early-return check inside `draw`). It changes a few times per session (per play/stop), so it costs nothing to be reactive. The right granularity at the right rate.

The full picture: per-cell reactivity for UI bindings that update at human-interaction rates (the mixer's faders, the playhead's `currentStep`), direct DOM/canvas manipulation for animation data that updates at frame rates (the FFT bars, hypothetical particle effects). The next lesson formalizes this rule and shows the failure modes when you get it wrong.

## Exercises

### Exercise 1: Add a peak hold line

**Setup:** The visualizer draws per-bar amplitudes that update every frame.

**What to do:** Track the maximum amplitude across all bins on each frame. Draw a thin horizontal line at that peak height, spanning the full canvas width. Decay the peak slowly: each frame, multiply it by 0.97 (so it falls toward zero over ~1 second). When a new frame's max exceeds the current peak, update the peak.

**Verify by:** Loud transients (kick hits) push the peak line high. The line decays smoothly back down. Quieter sections never push it higher than the loudest recent moment.

**Stretch:** Make the peak line a different color (yellow?) and add a "PEAK: -12 dB" readout in the corner.

<details>
<summary>Show solution</summary>

Add a non-reactive local variable to track peak:

```ts
let peakNorm = 0;

function draw() {
  // ... existing setup ...

  const data = audio.getFftData();
  if (!data || !audio.isPlaying) {
    peakNorm *= 0.97; // keep decaying even when paused
    // ... draw baseline as before
    return;
  }

  // ... existing bar rendering loop, but also compute peak:
  let frameMax = 0;
  for (let i = 0; i < bins; i++) {
    const v = data[i];
    const norm = Math.max(0, Math.min(1, (v + 100) / 70));
    if (norm > frameMax) frameMax = norm;
    // ... rest of bar drawing
  }

  // Update peak with decay
  peakNorm = Math.max(peakNorm * 0.97, frameMax);

  // Draw peak line
  const peakY = H - peakNorm * H;
  ctx.fillStyle = 'rgba(240, 200, 80, 0.7)';
  ctx.fillRect(0, peakY - dpr / 2, W, dpr);
}
```

Why this works: `peakNorm` is plain `let` because it's per-frame state with no reactive consumers. The decay-then-max pattern is the standard "ballistic" peak meter, used in every DAW.

</details>

### Exercise 2: Replace the linear amplitude mapping with logarithmic

**Setup:** The current mapping is `norm = (v + 100) / 70`, which is linear in dB.

**What to do:** Modify the mapping so it emphasizes the upper dB range (where most musical content sits). Try `norm = Math.pow((v + 100) / 100, 2)` (squared, so the upper range gets more height) or `norm = 1 - Math.exp(-v / 20 - 5)` (an exponential curve).

**Verify by:** Quiet sounds (-60 dB ambient noise) barely register. Medium sounds (-20 dB hits) are clearly visible. Loud sounds (-6 dB transients) reach near full height.

**Stretch:** Make the curve user-configurable via a `viewerSensitivity = $state(0.5)` rune and a slider somewhere in the DAW UI. Update the formula to use it.

<details>
<summary>Show solution</summary>

Replace the normalization line:

```ts
// Squared, emphasizes loud content
const norm = Math.pow(Math.max(0, Math.min(1, (v + 100) / 100)), 2);
```

Or, with sensitivity rune:

```ts
// in the engine:
viewerSensitivity = $state(0.5); // 0 = linear, 1 = highly compressed

// in draw():
const linear = Math.max(0, Math.min(1, (v + 100) / 70));
const exp = 1 + audio.viewerSensitivity * 3; // 1..4
const norm = Math.pow(linear, exp);
```

Why these work: the visualizer's "feel" is largely determined by the dB-to-pixel mapping. Linear is mathematically pure but doesn't match perceptual loudness. Logarithmic / power curves give a more "musical" response.

</details>

### Exercise 3: Demonstrate what NOT to do

**Setup:** A working visualizer.

**What to do:** Modify the component to store the FFT data in `$state`:

```svelte
<script lang="ts">
  let fftData = $state(new Float32Array(64));

  function draw() {
    raf = requestAnimationFrame(draw);
    // ... DPI scaling, etc.
    const next = audio.getFftData();
    if (next) fftData = next; // WRITES TO $state 60 TIMES/SEC
    // ... render from fftData instead of audio.getFftData()
  }
</script>

<canvas bind:this={canvasEl}></canvas>
<p>peak bin: {fftData.indexOf(Math.max(...fftData))}</p>
```

**Verify by:** Open the Svelte DevTools effect timeline. You'll see a torrent of state-update events — 60 per second. The `<p>` re-renders 60 times per second. Performance may or may not visibly degrade depending on your machine, but the work is real and unnecessary.

**Then:** Revert. Read `audio.getFftData()` inline in `draw`, no `$state`. The performance smell goes away.

**Why this matters:** This is the failure mode Lesson 4 is about. Reactive state for per-frame data generates work for no benefit. Use plain variables, or don't store the data at all.

<details>
<summary>Show solution</summary>

The exercise is the comparison itself. The fix is to delete the `$state` and read from the analyser directly each frame, as the reference does. The point is to FEEL the difference (or, if your machine is fast enough, to see the DevTools timeline showing the difference). Don't ship the broken version.

</details>

### Exercise 4: Show the playhead position in the visualizer

**Setup:** The visualizer is a horizontal strip. The DAW has a `audio.currentStep` rune that increments per step.

**What to do:** Draw a thin vertical line in the visualizer indicating the current step's position (step 0 = left edge, step 15 = right edge). Update only when `currentStep` changes (not per-frame), since the step changes a few times per second.

**Verify by:** The vertical line sweeps left-to-right in sync with the playhead's sweep across the grid above it.

**Stretch:** Make the line a small triangle pointing down (like a real DAW's playhead). Add a smooth interpolation so the line moves continuously instead of jumping by step.

<details>
<summary>Show solution</summary>

The simplest version reads `audio.currentStep` inside `draw`:

```ts
// in draw(), after the bar loop:
const step = audio.currentStep;
if (step >= 0) {
  const stepX = ((step + 0.5) / 16) * W;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(stepX - dpr / 2, 0, dpr, H);
}
```

This reads `audio.currentStep` from inside the rAF callback. Even though `currentStep` is `$state`, reading it from a non-effect context doesn't subscribe — it just returns the current value. The rAF loop's next frame will read the updated value.

For the stretch (smooth interpolation), you'd track the last step's time:

```ts
let lastStepTime = 0;
let lastStep = -1;
let interpStep = 0;

// in draw():
const step = audio.currentStep;
if (step !== lastStep) {
  lastStepTime = performance.now();
  lastStep = step;
}
// interpolate based on BPM
const elapsed = (performance.now() - lastStepTime) / 1000;
const stepDur = 60 / audio.bpm / 4; // 16th note duration
interpStep = step + Math.min(1, elapsed / stepDur);
const stepX = ((interpStep + 0.5) / 16) * W;
// ... draw line at stepX
```

Why this works: `interpStep` is a smoothly-advancing float between integer steps. Both `step` and `interpStep` are plain locals or read fresh each frame — not in `$state`.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + Tone.Analyser tapped from the master gain in the engine
- + src/lib/components/FftVisualizer.svelte

### Verify it works

- A horizontal canvas strip appears below the grid
- When playing, the canvas shows frequency bars dancing in real time
- When stopped, the canvas shows a thin baseline (or is empty)
- The bars are crisp on retina displays (no blur — DPI scaling is wired up)
- Filter cutoff changes visibly damp the high-frequency bars

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/components/FftVisualizer.svelte and the analyser setup in engine.svelte.ts

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why 64 bins and not 128 or 256?**
A: Visual density. 64 bins at our canvas width gives ~10px-wide bars with 2px gaps, which is legible. 128 bins would give ~5px bars, harder to read. 32 bins would give ~20px bars, looks chunky. 64 is the sweet spot for an 80px-tall, ~700px-wide canvas. If you scaled the visualizer up (taller, wider), more bins would make sense.

**Q: Can I use `getValue()` returning a typed array I haven't read elsewhere?**
A: Yes — that's the design. The returned `Float32Array` is the analyser's internal buffer, refreshed by the audio thread each render quantum. Read it whenever you want; the values reflect the most recent audio. Just don't hold a reference and expect a snapshot.

**Q: Why is `getFftData()` a getter instead of being called directly via `audio.analyser.getValue()`?**
A: Encapsulation. The visualizer doesn't need to know that the analyser exists or how it's configured. Hiding the analyser behind a clean engine method means we could swap implementations (e.g., compute the FFT in a Web Worker instead, or use the lower-level `AnalyserNode` directly) without changing the visualizer.

**Q: What if my visualizer needs to display the WAVEFORM, not the spectrum?**
A: `Tone.Analyser` accepts `'waveform'` instead of `'fft'` as its first argument. Returns a Float32Array of time-domain samples (one period of the audio) instead of frequency bins. The render code is simpler — plot samples as a line rather than bars. Same DPI-scaling, same rAF loop.

**Q: Is the rAF loop running continuously expensive?**
A: Practically no. An rAF callback that does ~50 microseconds of work at 60Hz is 0.3% of one CPU core. On any modern device this is invisible. The browser will also throttle / pause rAF when the tab is backgrounded, so you don't burn CPU on inactive tabs. If you're profiling and notice the rAF callback being the hot loop, that's likely a sign you're doing too much per frame (heavy DOM manipulation, allocating in the hot path, etc.) — not that the loop itself is the problem.

## What's next

The deep dive on what does and doesn't belong in `$state`, with a closer look at `untrack` and `flushSync` as escape hatches. Most of what you've already learned in this lesson and the previous two is "the right answer." Lesson 4 is the formalization: a rule, the patterns that follow it, and the failure modes when you break it.

<SourcesSection lessonKey="07-capstone-polish/03-fft" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
