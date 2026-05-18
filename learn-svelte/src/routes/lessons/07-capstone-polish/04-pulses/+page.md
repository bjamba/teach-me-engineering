<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>60fps Pulses · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-7);">

<LessonHeader
  moduleSlug="07-capstone-polish"
  lessonSlug="04-pulses"
  title="60fps Pulses Without Effect Storms"
  blurb="When to use $state for animation. When not to. The rule that prevents reactivity bugs in audio-heavy apps."
/>

## Why this lesson exists

The DAW has several things happening at 60Hz: the FFT visualizer renders, the audio thread schedules events, the browser repaints. Most of that runs invisibly. The temptation, especially for someone coming from a more reactive-flavored framework, is to wire 60Hz values through `$state` because that's the default tool you reach for. Every animation becomes a reactive stream. Every per-frame value becomes a rune. It works for a while — Svelte is fast — and then it starts to drag in the kinds of ways that are hard to attribute back to the cause.

This lesson formalizes the rule you've already been following in Lessons 1-3: not every value should be reactive. There's a category of data — high-frequency, internally-consumed, never-bound — that belongs in plain variables, sometimes mutated directly to the DOM. Getting this distinction right means your DAW (and any future Svelte app you write) stays smooth at scale. Getting it wrong means an "effect storm" where one frame's worth of state changes cascades through hundreds of dependent effects, each scheduling a microtask, each running, each maybe re-triggering more effects. You can build a lot before this hurts, but the moment you do hit it, the fix is architectural — not a tweak.

## Learning objectives

By the end of this lesson you'll be able to:

- State the rule: don't put 60fps-changing data in `$state`.
- Distinguish the three correct homes for fast-changing data: plain `let` for animation bookkeeping, direct DOM mutation in `rAF` callbacks for display values, no storage at all when the source already owns the data.
- Recognize an "effect storm" by its symptoms (Performance tab shows long microtask queues, sluggish input response under load, visible jank during interaction).
- Use `untrack` to read a reactive value inside an effect without subscribing to it.
- Use `flushSync` to force a reactive write to flush synchronously, then describe the rare cases where it's needed.
- Audit a Svelte component and identify which `$state` declarations should be downgraded to plain `let`.

## Concept 1: The rule, stated and justified

### The rule

**Don't put data that changes at frame rate (or faster) in `$state`.**

Use `$state` for values that change at user-interaction rate — clicks, slider drags, key presses, network responses, audio steps. These tend to fire at most a few times per second under normal use. The reactive overhead per write (a microtask schedule, a subscriber loop) is invisible at that rate.

Use plain variables for values that change at frame rate — `requestAnimationFrame` callbacks running 60 times per second, intermediate animation state, scroll positions during smooth scroll, raw audio data, particle positions. The reactive overhead per write × 60 writes per second × N subscribers stops being invisible at some N.

### Why the rule exists

Each write to a `$state` rune does work:

1. The proxy's setter runs.
2. The setter checks if the new value differs from the old (so identity-stable writes are cheap).
3. If different, the setter iterates the subscriber list and marks each subscriber dirty.
4. If any subscriber wasn't already in the microtask queue, the setter schedules a microtask flush.
5. When the microtask runs, dirty subscribers re-evaluate. Each re-evaluation reads its dependencies, computes its output, possibly writes to another rune (cascading), possibly mutates the DOM, possibly triggers a Svelte template re-render of the bound region.

For one write to one rune with one subscriber: maybe 10 microseconds. Fine.

For 60 writes per second to one rune with one subscriber: 600 microseconds per second. Still fine.

For 60 writes per second to one rune with ten subscribers, each of which writes to a derived, each derived having three subscribers: now we're at thousands of effect runs per second, each doing work. Visible in Performance traces as a long unbroken microtask track. The main thread is busy with reactivity bookkeeping when it could be idle or responsive to user input.

### The "effect storm" symptom

You'll see it in DevTools' Performance tab as:

- A long, contiguous purple band on the main thread track labeled "Microtask" or "RunMicrotasks."
- Long Recalculate Style / Layout bars proportional to the number of dependent DOM updates.
- Frame durations creeping over 16ms; some frames stretched to 30-50ms.
- Input handlers (click, drag) showing visible delay when the storm is in progress.

In Svelte DevTools' effect timeline (the extension), you'll see hundreds of effect fires per second, often in repeating patterns where one rune's change triggers a fixed set of dependent effects that all run before the next frame.

The diagnostic: if you see this pattern AND the data triggering it changes at frame rate, you've stumbled into the storm. The fix is to take the high-frequency data out of `$state`.

### Cases the rule doesn't apply to

The rule has carve-outs. Some "frequent" data is still cheap enough in `$state` that the rule doesn't matter:

- **Mouse position.** Mouse move events fire 60+ times per second during a drag, but if you have one subscriber (the position display) and no derived chains, the cost is negligible. Could be `$state`.
- **Smooth scroll position.** Same logic. If the position drives one transform and not much else, `$state` is fine.
- **The DAW's `currentStep`.** Updates per audio step, which at 120 BPM 16th-notes is 8 times per second. Way below frame rate. Always fine in `$state`.

The cases where the rule MATTERS are:

- **Per-frame audio data.** FFT bins, waveform samples, meter levels.
- **Particle systems.** Hundreds of positions, all updating per frame.
- **Animated values with broad downstream dependencies.** A "current playback time" rune that drives a timeline UI, a progress bar, a label, and three derived "is past X" booleans — that's enough subscribers to feel the cost at 60Hz.

If in doubt, profile. The rule is a default to start with; the Performance tab is the arbiter.

## Concept 2: The three patterns for fast-changing data

### Pattern A: Plain `let` (animation bookkeeping)

For values used only by your component, internally, in non-reactive code paths:

```ts
let raf: number | null = null;
let lastFrameTime = 0;
let peakLevel = 0;
let particles: Particle[] = [];
```

Each of these is mutated in a `rAF` callback, used in subsequent frames, and never read by anything reactive. They're component state in the sense that they hold values between events, but they're not framework state.

The FFT visualizer's `raf` variable is this pattern. So is a peak-hold meter's decaying peak. So is a particle system's array of particle objects.

### Pattern B: Direct DOM mutation in rAF (display values)

For values that drive a SINGLE piece of visible UI, where you can write directly to the DOM:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';

  let displayEl: HTMLElement | undefined = $state();
  let raf: number | null = null;

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!displayEl) return;
    displayEl.textContent = `${(performance.now() / 1000).toFixed(2)}s`;
  }

  onMount(() => { raf = requestAnimationFrame(tick); });
  onDestroy(() => { if (raf !== null) cancelAnimationFrame(raf); });
</script>

<p bind:this={displayEl}>0.00s</p>
```

`displayEl` is `$state` (for `bind:this`). `raf` is plain `let`. The displayed value is never stored — it's computed in the rAF callback and written directly to `textContent`. No reactive write, no subscriber notification, no microtask. The DOM update is one property assignment per frame.

Compare to the reactive version:

```svelte
<script>
  let elapsed = $state(0);
  $effect(() => {
    let raf: number;
    const start = performance.now();
    function tick() {
      elapsed = (performance.now() - start) / 1000;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

<p>elapsed: {elapsed.toFixed(2)}s</p>
```

Same visual result. Cost per frame: a `$state` write (subscriber check, mark dirty, schedule microtask), a microtask flush, an effect that re-evaluates the template binding, a DOM update. Maybe 30-50 microseconds vs the direct version's ~5 microseconds.

For one binding, neither version is noticeably slow. Add nine more bindings reading `elapsed`, and the reactive version runs ten effects per frame; the direct-DOM version still does one DOM write per binding (or one combined batch, depending on how you wired it). The reactive version's overhead is proportional to subscribers; the direct version's overhead is proportional to actual DOM updates needed.

For our DAW, the FFT visualizer is the canonical Pattern B example: the bars are drawn directly to canvas every frame; nothing reactive holds the per-frame data.

### Pattern C: Don't store it at all (source-owned data)

For values that live in some external system (audio nodes, video elements, WebSocket buffers), read them fresh each time you need them:

```ts
function draw() {
  raf = requestAnimationFrame(draw);
  const data = audio.getFftData(); // read fresh; don't store
  // ... use data for this frame, discard
}
```

This is the cleanest pattern. The data has one owner (the analyser's internal buffer). The visualizer reads from that owner, uses the data, drops it. No local copy, no reactive wrapper, no synchronization problem.

If you NEED a snapshot — e.g., recording the FFT data to a buffer for later playback — you'd `.slice()` it explicitly at the moment of capture. But the visualizer's read-then-use-then-drop pattern doesn't need a copy.

### The patterns visualized

A small table to internalize:

| Data | Pattern | Why |
|---|---|---|
| `raf` (frame ID) | plain `let` | Pure local bookkeeping, never read reactively |
| Canvas element ref | `$state` | `bind:this` requires it |
| FFT bin array (per frame) | not stored | Owned by analyser; read fresh each frame |
| Live "elapsed time" display | direct DOM in rAF | One subscriber, frame rate, no need for reactivity |
| Mouse position (during drag) | `$state` (usually OK) | Per-event rate; one subscriber typically |
| `audio.currentStep` | `$state` | Per-step rate (~8Hz); broad subscribers but acceptable cost |
| `audio.isPlaying` | `$state` | Per-interaction rate; tiny |
| Per-channel gain (Mixer) | `$state` (in `channels` record) | Per-interaction rate; fine-grained subscribers |
| Particle system positions | plain `let` array | Hundreds of values, frame rate, drawn directly |

The pattern follows the data's rate of change AND its consumer count. High-rate-low-consumer can sometimes use `$state` ($state.raw is even cheaper). High-rate-high-consumer must not.

## Concept 3: `untrack` — read without subscribing

### What `untrack` does

`untrack(fn)` runs `fn` and returns its result, but any reactive reads inside `fn` are NOT registered as dependencies of the surrounding effect.

```ts
import { untrack } from 'svelte';

let count = $state(0);
let mode = $state('A');

$effect(() => {
  // This effect subscribes to `count`. Reading `mode` via `untrack` does NOT
  // subscribe — even though `mode` is reactive, the read is hidden from the
  // tracker.
  console.log(`count=${count}, mode=${untrack(() => mode)}`);
});
```

When `count` changes, the effect fires. When `mode` changes, the effect does NOT fire (because the tracker never saw `mode` as a dep).

### When to use it

`untrack` is for the case where you need a value's CURRENT state but you don't want changes to that value to retrigger your effect. Three common reasons:

1. **Read a configuration that's reactive but stable.** A theme rune that almost never changes; you want to read it inside an effect that's primarily about something else.
2. **Snapshot at the moment an event happens.** An effect fires because A changed; you want to read B's current value as a one-time read, not subscribe to it.
3. **Avoid infinite loops.** If an effect's body writes to a rune that the effect also reads, you'd loop. `untrack`-ing the read breaks the cycle.

### A DAW-relevant example

Suppose you wanted to log every time `audio.currentStep` advances, including the current pattern at that moment. Naive version:

```ts
$effect(() => {
  const step = audio.currentStep;
  const pattern = audio.pattern;
  console.log('step', step, 'pattern', pattern);
});
```

This effect fires when `currentStep` changes (per step) AND when `pattern` changes (per cell click). The pattern-change firings are unwanted — we wanted "log on step advance," not "log when any cell is toggled."

Fix with `untrack`:

```ts
$effect(() => {
  const step = audio.currentStep;
  const pattern = untrack(() => audio.pattern);
  console.log('step', step, 'pattern', pattern);
});
```

Now the effect fires only on `currentStep` changes; `pattern` is read fresh each time but doesn't trigger the effect.

### Common mistakes with `untrack`

- **Wrapping the wrong thing.** `untrack(() => audio.pattern.kick)` untracks the read of `pattern.kick`; the read of `audio` (a property of `this`) is trivial. The point is to wrap the reactive read whose subscription you want to skip.
- **Untracking everything.** If you untrack all the reads, the effect has no dependencies and runs only once (on mount). That's almost never what you wanted. Untrack selectively.
- **Forgetting that `untrack` returns the value.** It's not a void operation. `const x = untrack(() => foo)` is the right shape; `untrack(() => x = foo)` works but is unusual.

## Concept 4: `flushSync` — force a synchronous flush

### What `flushSync` does

`flushSync(fn?)` runs `fn` (optional) and then synchronously flushes any pending reactive updates, including DOM mutations from effects. After `flushSync` returns, the DOM reflects all the writes made before it.

The default behavior of Svelte's reactivity is batched: a write to a rune doesn't update the DOM immediately. It schedules a microtask flush. The microtask runs after the current synchronous code completes. This is normally what you want — batching multiple writes into one DOM update is efficient and avoids visible flicker.

`flushSync` is the escape hatch when you need the DOM to be up-to-date NOW, mid-function.

### When you need it

The canonical case: measuring the DOM right after a state change.

```svelte
<script>
  import { flushSync } from 'svelte';

  let visible = $state(false);
  let panelEl: HTMLElement | undefined = $state();

  function showAndMeasure() {
    visible = true;
    flushSync();
    // Now the panel is in the DOM and we can read its size.
    console.log('width:', panelEl?.offsetWidth);
  }
</script>

{#if visible}
  <div bind:this={panelEl}>...</div>
{/if}
<button onclick={showAndMeasure}>show</button>
```

Without `flushSync`, the `panelEl?.offsetWidth` read happens BEFORE Svelte has updated the DOM in response to `visible = true`. The panel doesn't exist yet; `panelEl` is `undefined`; `offsetWidth` reads as undefined.

With `flushSync`, the reactive flush is forced before the next line. The panel is in the DOM. `offsetWidth` reads correctly.

### When NOT to use it

`flushSync` is heavy. It runs every pending effect synchronously, blocking until the DOM is consistent. Calling it in a hot path destroys batching and can produce visible jank.

Most code doesn't need it. If you find yourself reaching for `flushSync`:

1. Is the measurement actually necessary in this function? Could you defer the measurement to `tick()` (Svelte's promise that resolves after the next flush) instead?
2. Could you avoid the measurement entirely by computing the size from CSS rules instead of reading it from the DOM?
3. Could you observe the size change with `ResizeObserver` instead of measuring synchronously?

`tick()` is the lighter alternative for "do this after the next flush":

```svelte
<script>
  import { tick } from 'svelte';

  async function showAndMeasure() {
    visible = true;
    await tick();
    console.log('width:', panelEl?.offsetWidth);
  }
</script>
```

`tick()` returns a promise that resolves after the next microtask flush. Same effect as `flushSync` for this case, but cooperative (it yields to the event loop instead of blocking).

### The DAW case for `flushSync` (none)

The DAW doesn't need `flushSync`. None of its features require synchronous DOM consistency mid-function. The reactivity is well-aligned with user-interaction rates and the audio thread runs independently. This is the case for most apps: `flushSync` is a tool you have available, but you'll rarely use it.

## Concept 5: Auditing for the rule

### Going through the DAW

Let's audit every `$state` declaration in the engine, against the rule:

- `isReady = $state(false)` — changes once when ensureReady completes. Fine.
- `isLoading = $state(false)` — changes twice per ensureReady. Fine.
- `isPlaying = $state(false)` — changes on play/stop. Fine.
- `isRecording = $state(false)` — same. Fine.
- `bpm = $state(120)` — changes when user drags BPM slider, max ~30/sec during drag. Fine.
- `currentStep = $state(-1)` — changes per step, ~8/sec at 120 BPM 16ths. Has broad UI subscribers (every cell reads it for `class:current`). Worth keeping reactive because the cells need to highlight; the cost is one effect run per step per cell read, manageable.
- `loadError = $state<string | null>(null)` — changes rarely. Fine.
- `pattern = $state<Record<string, number[]>>(...)` — changes on cell clicks, per-interaction rate. Fine.
- `channels = $state<Record<string, Channel>>(...)` — changes on mixer interactions. Fine.
- `filterFreq`, `delayTime`, `delayFeedback`, `reverbWet`, `masterVolume = $state(...)` — change during slider drags, max ~30/sec. Each has one subscriber (the parameter-sync effect). Fine.
- `savedPatterns`, `recordings = $state<...>([])` — change on save/delete actions. Fine.

Nothing on the engine breaks the rule. All `$state` is at human-interaction or per-step rate.

In the FFT visualizer:

- `canvasEl = $state()` — set once by `bind:this`. Fine.
- `raf` is plain `let`. Correct (rule respected).

The visualizer reads `audio.isPlaying` (reactive, but slow) and `audio.getFftData()` (not reactive, read fresh). Correct.

### What WOULD break the rule

A hypothetical "particle effect on cell trigger" feature might naively store particles in `$state`:

```ts
// BREAKS THE RULE
let particles = $state<Particle[]>([]);

function tick() {
  particles = particles.map(p => ({ x: p.x + p.vx, y: p.y + p.vy, age: p.age + 1 }))
                       .filter(p => p.age < 60);
  raf = requestAnimationFrame(tick);
}
```

Particles updates per frame (60 times per second), and the array changes identity each time, triggering every subscriber. If the particles are rendered in the template:

```svelte
{#each particles as p (p.id)}
  <div class="particle" style="left: {p.x}px; top: {p.y}px"></div>
{/each}
```

The `{#each}` block re-keys 60 times per second. Even with stable IDs, that's a lot of reconciliation work. And the array assignment notifies any other subscribers (e.g., a "particle count" UI element).

The fix: particles as plain `let` (or `$state.raw` if you want to keep some reactivity for the count), rendered to canvas instead of DOM:

```ts
// CORRECT
let particles: Particle[] = [];

function tick() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.age += 1;
  }
  particles = particles.filter(p => p.age < 60); // local mutation, no reactivity

  // draw to canvas, NOT to DOM
  for (const p of particles) {
    ctx.fillRect(p.x, p.y, 4, 4);
  }
  raf = requestAnimationFrame(tick);
}
```

Same visual result. Zero reactive work per frame.

### `$state.raw` as a middle ground

`$state.raw` is shallow reactivity — the variable itself is observed (assignment triggers subscribers), but the contents aren't deep-proxied. For large arrays or objects you mutate in place, `$state.raw` is much cheaper than `$state`:

```ts
let particles = $state.raw<Particle[]>([]);
// later:
particles.push(newParticle); // does NOT notify subscribers (raw is shallow)
particles = particles.filter(...); // DOES notify (the variable itself was reassigned)
```

For a particle list where you want occasional reactive consumers (a count badge), `$state.raw` plus manual reassignment when you want to notify is a fine compromise.

For the DAW we don't have such a case. The rule is "if you don't need reactivity, don't pay for it" — and `$state.raw` is paying less than `$state`, but still some.

## Putting it together

The reactivity story for the DAW:

- **Per-interaction state** lives in `$state`: pattern cells, mixer values, transport state, effect parameters. These get user-interaction-rate writes and broad fine-grained subscribers.
- **Per-frame animation state** lives in plain variables: `raf` IDs, particle positions (if we had them), the FFT visualizer's intermediate values. Direct DOM/canvas mutation; no reactive cost.
- **Source-owned data** isn't stored anywhere: `Tone.Analyser` owns the FFT buffer, `MediaRecorder` owns the chunks queue, `Tone.Transport` owns the playhead time. Read fresh when needed.

The `untrack` and `flushSync` escape hatches haven't come up in any of the DAW code. They're there for the rare cases where the default behavior fights you — selective reads, synchronous measurement. Most apps won't need them. When you DO need them, the alternatives (broad effect deps, mis-timed measurements) are visibly broken, so the need announces itself.

The final point: this rule isn't a Svelte-specific quirk. The equivalent in React is "don't put 60fps state in `useState`; use `useRef` for non-reactive bookkeeping and animate the DOM directly." Same idea, different framework. Reactive systems are well-suited to "user-changed-this" rates, less suited to "frame-tick" rates. Match the tool to the rate.

## Exercises

### Exercise 1: Build a stopwatch the right way

**Setup:** A blank component file `src/lib/components/Stopwatch.svelte`.

**What to do:** Build a stopwatch that displays elapsed time to centisecond precision, updating every frame. Use Pattern B (direct DOM mutation in rAF). Include start, stop, and reset buttons. The start/stop state SHOULD be `$state` (per-interaction); only the displayed elapsed time should bypass reactivity.

**Verify by:** The display updates smoothly at 60fps. Open the Svelte DevTools effect timeline while the stopwatch is running — you should see effect activity only on start/stop/reset clicks, NOT per frame.

**Stretch:** Add a lap-time list that records the current elapsed time when a "lap" button is clicked. The lap list IS `$state` (it changes on click, the displayed list is bound to the template).

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';

  let running = $state(false);
  let displayEl: HTMLElement | undefined = $state();
  let raf: number | null = null;
  let startTime = 0;
  let accumulated = 0;
  let laps = $state<number[]>([]);

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!displayEl) return;
    const elapsed = accumulated + (running ? performance.now() - startTime : 0);
    displayEl.textContent = (elapsed / 1000).toFixed(2);
  }

  function start() {
    if (running) return;
    running = true;
    startTime = performance.now();
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    accumulated += performance.now() - startTime;
  }

  function reset() {
    running = false;
    accumulated = 0;
    if (displayEl) displayEl.textContent = '0.00';
  }

  function lap() {
    const elapsed = accumulated + (running ? performance.now() - startTime : 0);
    laps = [...laps, elapsed];
  }

  onDestroy(() => {
    if (raf !== null) cancelAnimationFrame(raf);
  });
</script>

<div>
  <p bind:this={displayEl}>0.00</p>
  <button onclick={start}>start</button>
  <button onclick={stop}>stop</button>
  <button onclick={reset}>reset</button>
  <button onclick={lap}>lap</button>
  <ul>
    {#each laps as l, i}
      <li>{i + 1}: {(l / 1000).toFixed(2)}</li>
    {/each}
  </ul>
</div>
```

Why this works: `running`, `displayEl`, and `laps` are `$state` because something reactive needs them. `raf`, `startTime`, `accumulated` are plain — they're animation bookkeeping. The display is mutated directly via `textContent`. The lap list IS reactive because the `{#each}` reads it.

</details>

### Exercise 2: Demonstrate the effect storm

**Setup:** A working stopwatch from Exercise 1, OR the DAW.

**What to do:** Intentionally break the rule. Store the elapsed time in `$state` and bind it via template. Add ten `$derived` runes that depend on `elapsed`. Add a few labels each reading the deriveds.

```svelte
<script>
  let elapsed = $state(0);
  let elapsedMinutes = $derived(Math.floor(elapsed / 60000));
  let elapsedSeconds = $derived(Math.floor((elapsed % 60000) / 1000));
  let elapsedMillis = $derived(Math.floor(elapsed % 1000));
  let elapsedHumanShort = $derived(`${elapsedMinutes}:${elapsedSeconds}`);
  let elapsedPercent60 = $derived(((elapsed / 60000) * 100).toFixed(1));
  // ... five more deriveds, each reading elapsed
</script>

<p>{elapsedMinutes}:{elapsedSeconds}.{elapsedMillis}</p>
<p>{elapsedHumanShort}</p>
<p>{elapsedPercent60}%</p>
<!-- bind each derived somewhere -->
```

Update `elapsed` via a rAF loop. Open Chrome DevTools → Performance, record while the timer runs, observe.

**Verify by:** The Performance trace shows continuous microtask activity. The Svelte DevTools effect timeline shows ~600 effect runs per second (10 deriveds × 60fps).

**Then:** Rewrite to Pattern B. Profile again. The microtask track is empty during animation; effects only fire on user interaction.

**Why this matters:** This is the storm in miniature. With one derived chain it's invisible. With twenty it starts to matter. With particles or per-cell live data, it's a real performance issue.

<details>
<summary>Show solution</summary>

The exercise is the comparison itself. No "correct" code — the demonstration shows the cost. The rewrite is to drop the `$state` wrapper on `elapsed`, drop the deriveds, and write each label's `textContent` directly in the rAF callback. The win is invisible at small scale and dramatic at large scale.

</details>

### Exercise 3: Use `untrack` in a real DAW context

**Setup:** The DAW has `audio.currentStep` (per step) and `audio.pattern` (per cell click).

**What to do:** Add a small "step log" component that displays the last 8 steps that fired. When `currentStep` advances, push the step number and a hash of the current pattern onto a local log. The log should NOT update when only the pattern changes (just toggling a cell shouldn't add a log entry).

**Verify by:** Press PLAY. The log fills with entries (step, pattern hash) every step. Toggle a cell while playing — no new log entry, but the next step's entry shows the new pattern hash. Stop. Toggle cells freely — log doesn't grow.

**Stretch:** Add a "clear log" button that resets the array.

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import { audio } from '$lib/audio/engine.svelte';

  type Entry = { step: number; hash: string; ts: number };
  let entries = $state<Entry[]>([]);

  function hashPattern(p: Record<string, number[]>): string {
    return Object.values(p).map(arr => arr.join('')).join('|').slice(0, 20);
  }

  $effect(() => {
    const step = audio.currentStep;
    if (step < 0) return;
    // Snapshot pattern WITHOUT subscribing
    const pattern = untrack(() => audio.pattern);
    entries = [{ step, hash: hashPattern(pattern), ts: Date.now() }, ...entries].slice(0, 8);
  });
</script>

<div>
  <h4>step log</h4>
  <ul>
    {#each entries as e (e.ts)}
      <li>step {e.step}: {e.hash}</li>
    {/each}
  </ul>
  <button onclick={() => entries = []}>clear</button>
</div>
```

Why this works: the effect subscribes to `audio.currentStep` (the read happens unconditionally). It reads `audio.pattern` via `untrack`, so the pattern's changes don't fire this effect. The log advances only on step changes. The cleared button resets the log.

If you removed the `untrack`, every cell click would also push a log entry (because the effect would re-fire on pattern changes too). The `untrack` is the difference.

</details>

### Exercise 4: When `flushSync` is actually needed

**Setup:** A component that conditionally shows a panel and needs to scroll it into view after rendering.

**What to do:** Build a component with a "show details" button. When clicked, set `showDetails = true`. The details panel should appear, AND the page should immediately scroll to it.

```svelte
<script>
  import { flushSync } from 'svelte';
  let showDetails = $state(false);
  let detailsEl: HTMLElement | undefined = $state();

  function show() {
    showDetails = true;
    flushSync();
    detailsEl?.scrollIntoView({ behavior: 'smooth' });
  }
</script>

<button onclick={show}>show details</button>
{#if showDetails}
  <div bind:this={detailsEl} class="details">... lots of content ...</div>
{/if}
```

**Verify by:** Clicking the button: the panel appears AND the page scrolls smoothly to it.

**Then:** Remove the `flushSync()`. Click again. The scroll happens to the previous DOM position (because `detailsEl` is `undefined` at the moment `scrollIntoView` is called).

**Why:** Without `flushSync`, the `{#if showDetails}` block hasn't been rendered yet when `scrollIntoView` runs. The bind:this hasn't fired. `detailsEl` is undefined. The scroll silently no-ops (or scrolls to undefined behavior).

**Alternative:** Replace `flushSync` with `await tick()` (and make `show` async). Same effect; lighter weight; conventional in Svelte 5.

<details>
<summary>Show solution</summary>

The two valid versions:

```svelte
<script>
  import { flushSync } from 'svelte';
  function show() {
    showDetails = true;
    flushSync();
    detailsEl?.scrollIntoView({ behavior: 'smooth' });
  }
</script>
```

```svelte
<script>
  import { tick } from 'svelte';
  async function show() {
    showDetails = true;
    await tick();
    detailsEl?.scrollIntoView({ behavior: 'smooth' });
  }
</script>
```

`tick()` is the more idiomatic Svelte 5 form. `flushSync` is for synchronous code that can't be made async.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- (no new files — this lesson is about patterns you applied across the existing files)

### Verify it works

- Your FftVisualizer's render loop uses `requestAnimationFrame`, not `setInterval`
- FFT data lives in `Tone.Analyser` (not in `$state`)
- Particle effects or live audio data are NOT in `$state` — only state that changes at user-interaction rate is
- No browser console warnings about effect cycles or excessive re-renders

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/components/FftVisualizer.svelte — `raf`, the canvas reference, and the analyser data are all plain `let` variables, never `$state`

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Is there a number — "data that changes more than N times per second should not be in `$state`"?**
A: No fixed cutoff. It depends on the number of subscribers, the cost of each subscriber's work, and how much else is happening on the main thread. A rough heuristic: if the data changes more than ~10 times per second AND has more than 2-3 subscribers, audit it. Per-frame data (60Hz) with even one subscriber is usually wrong. Per-step data (the DAW's `currentStep` at ~8Hz) with dozens of subscribers is fine. Profile when in doubt.

**Q: What about `$derived` vs `$state` for high-frequency data?**
A: `$derived` has the same overhead per change as `$state`, plus the cost of the derivation function. A `$derived` that depends on a 60Hz `$state` is itself a 60Hz reactive value; it has the same problem. The fix is to not put the underlying data in `$state` to begin with.

**Q: My code worked fine until I added a feature; now it's slow. How do I find what I did?**
A: DevTools Performance, record a session of the interaction that's slow. Look for unusually long Microtask bands. In the Svelte DevTools extension's effect timeline, look for effects firing in tight repeating patterns (indicating a frame-rate cause). Match the firing pattern to your recent code changes. The fix is almost always "move the high-frequency data out of `$state`."

**Q: Why does the rule apply to `$state` and not to plain JS variables?**
A: `$state` is wrapped in a proxy. Reads register dependencies; writes notify subscribers. Plain variables don't do any of that. The overhead is the proxy + the subscription bookkeeping. Plain variables have no overhead. For data that doesn't need to be observed, the proxy is pure cost.

**Q: Can I use `untrack` to "freeze" a value temporarily during a long computation?**
A: Not really — `untrack` only affects subscriptions in the surrounding effect. If you're outside an effect, `untrack` is a no-op (the reads weren't subscribing anyway). If you want to freeze a value mid-computation, copy it with `$state.snapshot(value)` or `structuredClone(value)` and use the copy.

**Q: When would I use `$state.raw` instead of plain `let`?**
A: When you want occasional reactivity (e.g., notify subscribers when the variable is reassigned) without paying for deep proxying of every mutation. `$state.raw` is the right pick for "I have a large array that I mutate in place, and I only need to notify subscribers when I replace the array entirely." If you don't need ANY reactivity, plain `let` is cheaper.

## What's next

Profiling. The DAW you have is feature-complete and should be fast on any modern machine. The last lesson in this module shows the tools you'd use IF you ever hit performance trouble — DevTools Performance tab, Svelte DevTools, the heuristics for "is this slow because of reactivity or because of the DOM or because of audio scheduling." It's a meta-skill more than a feature; the lesson is short on code and long on diagnostic technique.

<SourcesSection lessonKey="07-capstone-polish/04-pulses" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
