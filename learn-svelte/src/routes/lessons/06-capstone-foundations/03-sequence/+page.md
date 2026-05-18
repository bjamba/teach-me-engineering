<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Sample-Accurate Playback · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-6);">

<LessonHeader
  moduleSlug="06-capstone-foundations"
  lessonSlug="03-sequence"
  title="Tone.Sequence and Sample-Accurate Playback"
  blurb="Wire the audio thread to the grid. PLAY, STOP, BPM, a playhead that lines up with what you hear."
/>

## Why this lesson exists

The grid lights up but doesn't make sound. The four-drum pad from L1 makes sound but doesn't loop. This lesson stitches them together: a `Tone.Sequence` that walks the pattern every sixteenth note, triggering each lit cell as the playhead passes it, with a transport bar above the grid that the user actually drives. By the end you have a working drum machine — press PLAY and a beat plays, drag BPM and the tempo follows, toggle a cell mid-playback and the change lands on the next pass through that step.

The interesting part is not the wiring. The wiring is about thirty lines of `Tone.Sequence` configuration. The interesting part is the *timing model* — the audio thread runs on its own clock, the UI thread runs on rAF, and getting the playhead to look like it's matching what you hear requires routing the visual update through Tone's draw scheduler instead of letting `$effect` do whatever it would do. We dwell on that because it's the kind of detail that makes the difference between "it works" and "it feels right."

This lesson also introduces the unconditional-read pattern for `$effect`, which is a Svelte 5 reactivity rule you'll use anywhere a singleton needs to react to state changes. The constructor of `AudioEngine` is the canonical example.

## Learning objectives

By the end of this lesson you'll be able to:

- Build a `Tone.Sequence` that loops a 16-step pattern at a configurable BPM.
- Explain why `Tone.Draw.schedule` exists and what would break if you used a plain `$effect` for the playhead.
- Use the unconditional-read pattern in `$effect` so dependency tracking stays correct across re-runs.
- Open an `$effect.root` scope from a module-singleton constructor.
- Build a `TransportBar` component with PLAY/STOP, a BPM slider, a step readout, and an activity LED.
- Add a `current` class to the cell at `currentStep` so the playhead is visible on the grid.

## Concept 1: The audio thread runs on its own clock

### A tale of two clocks

The browser has two clocks that matter here. The main thread runs your component code, your `$effect`s, `requestAnimationFrame` callbacks, click handlers — anything JavaScript. The audio thread runs the Web Audio scheduling code that decides when each oscillator starts. They tick at different rates and they can drift relative to each other.

If you tried to schedule beats from the main thread — set a `setInterval(trigger, 125)` for 120 BPM 16th notes — you'd get the obvious problem (intervals jitter when the main thread is busy) and a subtler one (your `setInterval` and the audio context's clock disagree about what "125ms from now" means). Even a perfectly-on-time main thread call to `synth.triggerAttack()` lands on the next audio block, which is up to 256 samples late. At 44.1kHz that's about 6ms of unpredictable lateness on every trigger.

The audio-thread answer is *schedule ahead*. Instead of "play this now," you say "play this at audio-time 1.234s." The audio thread maintains its own queue and dispatches at the exact sample. The classic write-up of this architecture is Chris Wilson's "A Tale of Two Clocks" — Tone.js implements the recipe for you with its Transport and Sequence primitives.

### What Tone.Sequence does for you

`new Tone.Sequence(callback, values, subdivision)` builds a loop that calls `callback(time, value)` for each `value` at intervals of `subdivision` (`'16n'` for sixteenth notes, `'8n'` for eighths, `'4n'` for quarters). The crucial parameter is `time` — it's the *audio-thread time* at which this step is scheduled to play, not the wall-clock time of the call. Your callback may run several milliseconds early (Tone looks ahead and schedules the audio in advance), but if you pass `time` into `triggerAttack(note, time)`, the sound lands at exactly that sample.

This means a perfectly steady beat even when the main thread is doing heavy lifting — rendering a complex grid, garbage-collecting, handling a click. The audio thread already has the next step queued.

### Common mistakes with audio timing

- **You call `synth.triggerAttack()` without passing `time`.** Defaults to "now," which means whenever this call lands on the audio thread. Jitter shows up as uneven beats during heavy main-thread work. Always pass `time`.
- **You compute the next step from `Date.now()`.** Wall-clock time and audio-context time aren't the same clock. Drift accumulates over minutes. Read `Tone.now()` if you need the audio context's current time.
- **You expect the callback to fire exactly on the beat.** It fires *before* the beat, because Tone schedules ahead. Don't put anything time-sensitive in the callback that should happen "at" the beat — schedule that on the audio thread too.

## Concept 2: Pattern playback in the engine

### Adding transport state

Open `src/lib/audio/engine.svelte.ts` and add the playback-related fields. The full reactive state list — what was there before plus what's new for this lesson:

```ts
isReady = $state(false);
isLoading = $state(false);
isPlaying = $state(false);
bpm = $state(120);
currentStep = $state(-1);
loadError = $state<string | null>(null);

pattern = $state<Record<string, number[]>>({
  kick:  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
  hat:   [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
  perc:  [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1]
});
```

And the non-reactive plumbing fields for the sequence itself:

```ts
private sequence: Tone.Sequence | null = null;
```

`currentStep` starts at `-1` so the grid renders with no cell highlighted before the first beat. The first call to the sequence callback will set it to `0`.

### The play method

```ts
async play() {
  if (this.isPlaying) return;
  await this.ensureReady();
  if (!this.isReady) return;

  this.sequence = new Tone.Sequence(
    (time, step) => {
      for (const t of TRACKS) {
        if (this.pattern[t.id][step]) {
          t.trigger(this.synths[t.id], time);
        }
      }
      Tone.Draw.schedule(() => {
        this.currentStep = step;
      }, time);
    },
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    '16n'
  );
  this.sequence.start(0);
  Tone.Transport.start();
  this.isPlaying = true;
}
```

Going through it:

- **`if (this.isPlaying) return;`** Guard against double-press. PLAY is idempotent.
- **`await this.ensureReady();`** Tone needs a user gesture to unlock the audio context. PLAY is one such gesture, so we unlock on first click. After that, `ensureReady` is a no-op.
- **The callback signature: `(time, step)`.** `time` is the audio-thread time this step plays. `step` is the value from the array — which we made the integers 0..15, so it doubles as the step index.
- **`for (const t of TRACKS)`** — for each track, check if this step is lit, trigger the synth if so. The trigger uses `time` (not `Tone.now()`) so the audio lands sample-accurately.
- **`Tone.Draw.schedule(() => &lbrace; ... &rbrace;, time)`** — the playhead update. We talk about this in Concept 3 because it deserves its own section.
- **The values array `[0, 1, 2, ..., 15]`.** You could pass `Array.from(&lbrace; length: 16 &rbrace;, (_, i) => i)` instead. The explicit list is clearer at the cost of two characters per index.
- **`'16n'`** — sixteenth notes. At 120 BPM that's 125ms between steps, 2 seconds for a full 16-step bar.
- **`this.sequence.start(0)`** — the sequence starts at transport time 0, which is "now" once `Tone.Transport.start()` runs.
- **`Tone.Transport.start()`** — kicks off the master clock. Until this runs, nothing schedules.

### The stop method

```ts
stop() {
  if (!this.isPlaying) return;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  this.sequence?.dispose();
  this.sequence = null;
  this.isPlaying = false;
  this.currentStep = -1;
}
```

Four cleanup steps in order:

- **`Tone.Transport.stop()`** — halts the master clock. In-flight scheduled triggers won't fire.
- **`Tone.Transport.cancel()`** — clears any leftover scheduled events on the transport. Without this, the next `start()` would pick up where you left off and play a stale tail.
- **`this.sequence?.dispose()`** — releases the sequence's audio nodes. Forgetting this leaks scheduling state every play/stop cycle.
- **`this.currentStep = -1`** — resets the playhead so the grid doesn't show a stale highlight when stopped.

### The toggle helper

```ts
toggleTransport() {
  if (this.isPlaying) this.stop();
  else void this.play();
}
```

The `void` in front of `this.play()` tells TypeScript "I'm deliberately not awaiting this promise." Without it, the function would be implicitly returning `Promise<void> | void`, which is awkward to type. The transport bar's onclick doesn't need the result, so we drop it.

### Common mistakes with the play/stop lifecycle

- **You forget `Tone.Transport.cancel()` and patterns "skip" on restart.** Old scheduled events fire alongside the new sequence. Always cancel.
- **You create a new `Tone.Sequence` in the constructor and `start()` it once.** Works until the first stop, then you can't restart without re-creating. Easier to build/dispose per play/stop cycle.
- **You forget `await ensureReady()` in `play()`.** First click after page load fails silently because the audio context isn't unlocked yet. Audio playback requires a user gesture; PLAY is that gesture.
- **You assign `this.isPlaying = true` before `Transport.start()`.** UI shows "playing" but no audio. Not a bug per se, but it's clearer to flip the flag last so the state matches reality.

## Concept 3: `Tone.Draw.schedule` for visual sync

### Why you can't just update from a regular effect

A naive playhead implementation would be: have the sequence callback set `this.currentStep = step` directly, and let the component re-render. That sort of works. But the assignment runs whenever the callback fires, which is *before* the beat plays (because Tone schedules ahead). So your visual playhead lights up the cell five-or-so milliseconds before you actually hear it.

You'd also lose the sample-accurate alignment. The visual update would happen on the audio thread's call stack, get processed by whatever rAF-aware code Svelte uses to flush DOM mutations, and land on the screen at the next paint — anywhere from 0 to 16ms later depending on where in the frame you are. The audio is sample-accurate; the visual is best-effort. They drift.

### What `Tone.Draw.schedule` does

`Tone.Draw.schedule(callback, time)` puts `callback` on a queue that fires inside the next `requestAnimationFrame` after audio-time `time`. The audio thread enqueues, the rAF callback dequeues and calls. So the visual update runs at the paint nearest the audio sample, not before.

The mechanics: the audio thread maintains a sorted list of (time, callback) entries. The main thread's rAF callback reads `Tone.now()`, walks the list, calls every callback whose `time` has passed. Anything scheduled for the future stays in the queue. The result is a one-frame-latency visual that's as close to the audio as the browser allows.

```ts
Tone.Draw.schedule(() => {
  this.currentStep = step;
}, time);
```

The `time` here is the same `time` the sequence callback received — the moment this step plays. The arrow function runs on the main thread when rAF reaches that moment.

### Why mutating reactive state from `Tone.Draw` is fine

The function inside `Tone.Draw.schedule` runs on the main thread, so it sees the live `$state` proxy and the assignment goes through the normal Svelte reactivity path. Components reading `audio.currentStep` re-evaluate. The grid's `class:current=&lbrace;i === audio.currentStep&rbrace;` flips on the right cell.

You couldn't mutate state from the audio thread directly even if you wanted to — `audioWorklet` code runs in a separate worker context with no access to the main thread's heap. But Tone's sequence callback isn't actually running on the audio thread; it's running on the main thread, scheduled from a `setTimeout` Tone manages internally. So the assignment works. `Tone.Draw` just adds the rAF-alignment trick on top.

### Common mistakes with `Tone.Draw`

- **You update `currentStep` from the sequence callback AND from `Tone.Draw.schedule`.** Now you double-update. The grid still works (the second update overrides), but the first one wastes a render. Pick one — use Draw.
- **You schedule a Draw callback without `time`.** Draw treats `undefined` time as "now," which loses the alignment. Always pass the same `time` the sequence callback received.
- **You assume Draw guarantees frame-accurate alignment.** It guarantees the callback fires on the next rAF after `time`. If the frame budget is exhausted (jank), it fires later. The audio doesn't wait. Severe main-thread lag will desync visually even with Draw.

## Concept 4: The unconditional-read pattern for `$effect`

### The trap

Svelte 5's `$effect` tracks dependencies by recording which `$state` reads happen during its callback's execution. If a read happens *every time* the effect runs, that signal stays subscribed. If a read is *guarded* — only happens on some runs — it can fall out of the dependency set, and future changes to that signal won't re-fire the effect.

The bug pattern looks like this:

```ts
// BROKEN
$effect(() => {
  if (this.isReady) {
    Tone.Transport.bpm.value = this.bpm; // only read inside the if
  }
});
```

First run: `isReady` is `false`. The body short-circuits before reading `this.bpm`. The tracker doesn't subscribe to `bpm`. Later, `isReady` becomes `true`, but the effect re-runs only because `isReady` changed — and now it tries to read `bpm`, which it subscribed to *this* time. So it works once. Then the user drags the BPM slider. Does the effect re-fire? It depends on whether the *most recent* run subscribed. If the run after `isReady` became true subscribed to `bpm`, yes. But if any later run short-circuited again (it won't here, but in more complex cases it might), the subscription drops.

The safer rule: read *every* dependency unconditionally, *then* branch on what to do with the values.

### The fix

```ts
$effect(() => {
  const next = this.bpm;
  if (this.isReady) Tone.Transport.bpm.value = next;
});
```

Read `bpm` into a local `const` before the `if`. The tracker now sees the read on every run regardless of `isReady`. Subscription is stable. Any change to `bpm` re-fires the effect, and the body decides what to do.

The pattern: **all reads first, then the conditional**. You'll see it throughout the engine. The auto-save effect in L4 reads both `pattern` and `bpm` into locals before checking `browser`. The effect-parameter sync effects in L8 read the slider value into a local before calling `rampTo`.

### Why this matters more in a module singleton

In a component, `$effect` cleans up when the component unmounts. In `$effect.root` (which we use because the engine is a module-level singleton), effects live for the lifetime of the page. A subscription bug that "only matters after a complex sequence of toggles" will eventually trigger because the engine is around for the whole session.

### Common mistakes with `$effect` dependency tracking

- **You write `if (cond) doThing(this.value)` thinking `value` is tracked.** It's only tracked on runs where `cond` is truthy. Pull the read out.
- **You read inside a `try &lbrace; ... &rbrace;` block that may throw before reaching the read.** Throwing exits without registering the read. Read first, try second.
- **You read inside a function called *later* (e.g., inside a `setTimeout` callback).** Reads outside the synchronous effect body don't register. Reactivity is synchronous; the tracker runs during the effect's call, not async.
- **You destructure a reactive object and read the local.** `const &lbrace; bpm &rbrace; = this;` reads `this.bpm` once. Future changes don't re-fire. Read `this.bpm` directly inside the effect.

### TypeScript notes

`$state<Record<string, number[]>>(&lbrace;...&rbrace;)` — the generic narrows the inferred type. Useful when you later read `audio.pattern[trackId]` and want TS to know it's `number[]`.

`Tone.Sequence` is generic over the value type — `new Tone.Sequence<number>(...)` would lock the callback's `step` parameter to `number`. The inference from the literal array is fine, but if you ever pass strings or objects, the explicit generic clears up the error messages.

## Concept 5: `$effect.root` for module-level singletons

### Why the engine needs `$effect.root`

`$effect` is only legal inside a component or a `$effect.root` scope. The engine is a module singleton — instantiated once at import time, no component lifecycle around it. Without `$effect.root`, the constructor would throw "effect_orphan: $effect cannot be used outside of a component."

`$effect.root(callback)` opens a long-lived effect scope. Effects created inside `callback` track their dependencies normally; they re-fire when those dependencies change; they live until you call the returned `dispose` function. The engine never calls dispose — the page lasts the engine's lifetime — so we stash the function but don't use it.

### The full constructor

The engine's constructor opens one root scope and creates all of its effects inside. From the capstone reference:

```ts
constructor() {
  if (!browser) return;

  // ... localStorage restoration (covered in L4) ...

  this.effectScopeDispose = $effect.root(() => {
    // BPM sync — unconditional read, then conditional body
    $effect(() => {
      const next = this.bpm;
      if (this.isReady) Tone.Transport.bpm.value = next;
    });

    // ... auto-save, effect parameter sync, mixer sync ... (later lessons)
  });
}
```

The `if (!browser) return` at the top of the constructor is the SSR guard. `engine.svelte.ts` gets imported on the server during SSR; the constructor runs there. We can't open audio contexts or read localStorage on the server, so we bail early. The client-side hydration will re-run the constructor with `browser === true`.

`this.effectScopeDispose` is typed `(() => void) | null` so we can stash the disposer for completeness, even though we never call it.

### Common mistakes with `$effect.root`

- **You forget the browser guard and the constructor throws on the server.** SSR breaks during build with an unhelpful "indexedDB is not defined" or similar. Always guard the constructor body with `if (!browser) return`.
- **You open `$effect.root` once per method call instead of once in the constructor.** Now each call creates a fresh scope and re-subscribes everything. The old effects from previous calls are still alive, double-firing on every change. Open the root once, in the constructor.
- **You try to dispose the root from a component's `onDestroy`.** The engine is a singleton — components come and go, the engine stays. The root scope lives for the page. Don't dispose.

## Concept 6: The TransportBar component

### What it owns

The transport bar is a controlled view onto the engine's state. It doesn't own anything — every value it shows comes from `audio.*`, every action it triggers is a method call on `audio`. The component is about a hundred and twenty lines of markup-plus-styles, of which the interesting markup is twenty.

The full reference includes REC, share, and clear/randomize buttons that we add in later lessons. For this lesson, build a simpler version with PLAY/STOP, BPM, the step readout, and the activity LED. We'll extend it in L4 (share, clear, rand) and L5 (REC).

### The script

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
</script>
```

That's the whole script for this lesson's version. The component is markup-and-bindings; no local state, no helper functions yet.

### The markup

```svelte
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

  <div class="status">
    <span class="led" class:active={audio.isPlaying}></span>
    {audio.isLoading ? 'LOADING' : audio.isPlaying ? 'PLAYING' : 'READY'}
  </div>
</div>

{#if audio.loadError}
  <div class="err">{audio.loadError}</div>
{/if}
```

Things worth pointing at:

- **`class:playing=&lbrace;audio.isPlaying&rbrace;`** — directive form. When `isPlaying` is true, the play button gets the `playing` class, which changes its color to red (it now functions as STOP).
- **Three-state button content via `&lbrace;#if&rbrace;/&lbrace;:else if&rbrace;/&lbrace;:else&rbrace;`.** Loading shows a spinner, playing shows ■, idle shows ▶. The icon character changes; so does the label. One button, three states.
- **`bind:value=&lbrace;audio.bpm&rbrace;`.** The slider drives the engine directly. No local copy, no onChange handler. The two-way binding works because `audio.bpm` is a `$state` field — Svelte generates the equivalent of `value=&lbrace;audio.bpm&rbrace;` plus an `oninput` that writes back.
- **`audio.currentStep < 0 ? '--' : String(audio.currentStep + 1).padStart(2, '0')`** — when stopped (`-1`), show `--`. When playing, show `01`..`16` (one-indexed for humans).
- **`<span class="led" class:active=&lbrace;audio.isPlaying&rbrace;></span>`** — the LED is a 8x8 dot. When playing, it pulses green via CSS animation. We talk about that in the styles.
- **`&lbrace;#if audio.loadError&rbrace;`** — a conditional error banner. Tone failed to start? Show the message. Otherwise render nothing.

### The styles

```svelte
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

  .icon { font-size: 0.7rem; }
  .spin { display: inline-block; animation: spin 0.9s linear infinite; }
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
  .bpm input { width: 140px; accent-color: var(--c-accent); }
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
```

The CSS uses the same design tokens (`--c-accent`, `--c-surface`, `--font-mono`, etc.) as the grid. If you copied the token block from `capstone-reference/src/app.css` for L2, you're set. If not, copy it now.

A couple of CSS notes:

- **`accent-color: var(--c-accent)`** — modern CSS lets you theme the native slider thumb and track with a single property. No need for custom-thumb hackery.
- **The `.led.active` animation** combines a `box-shadow` glow with a `pulse` opacity animation, which makes the LED feel alive. The shadow alone would be steady; the opacity alone would look like a blink. Together they feel like a heartbeat.

### Common mistakes with the TransportBar

- **You wire the BPM slider to a local `$state` instead of `audio.bpm`.** Slider works, tempo doesn't change. Always bind to the engine.
- **You forget `disabled=&lbrace;audio.isLoading&rbrace;` and PLAY clicks during init lose user gesture context.** A click during loading kicks off `ensureReady` again, which is harmless but confusing. Disable the button while loading.
- **You attach the LED's pulse animation to `audio.isPlaying` via `$effect`.** Don't. CSS handles the animation; just toggle the class. Effects are for non-CSS reactions.

## Concept 7: The playhead on the grid

### Add `class:current` to the cell

The grid already renders 64 buttons. The playhead is one more class toggle per cell — `class:current=&lbrace;i === audio.currentStep&rbrace;`. Open `Sequencer.svelte` and update the cell button:

```svelte
<button
  class="cell"
  class:on
  class:current={i === audio.currentStep}
  class:downbeat={i % 4 === 0}
  type="button"
  onclick={() => audio.toggleCell(track.id, i)}
  aria-label={`${track.name} step ${i + 1}: ${on ? 'on' : 'off'}`}
></button>
```

And add the styles:

```css
.cell.current {
  border-color: white;
  border-width: 2px;
}
.cell.on.current {
  box-shadow: 0 0 24px -2px var(--c-track), 0 0 0 1px white inset;
}
```

The double-class selector `.cell.on.current` is for lit cells under the playhead — they get a brighter glow plus a white inner border. Unlit cells under the playhead just get a white outer border (a subtle "you're here" marker).

### Why per-cell `class:current` instead of a separate playhead element

Three reasons. First, the grid is already CSS-grid-laid-out; a separate playhead element would have to absolutely-position itself based on the current step, which means recomputing positions on resize. Class toggle leans on the existing layout. Second, the playhead is *informational about the cell* (this cell is firing now), not a separate piece of UI. Putting the state on the cell is more semantically honest. Third, the reactivity story is simpler — when `currentStep` changes, the two affected cells (the one losing `current`, the one gaining it) update; the other 62 don't.

### Common mistakes with the playhead

- **You compute `currentStep` from a `$derived` based on `Date.now()`.** Doesn't work — `Date.now()` isn't reactive and your derived would only re-run when other dependencies changed. The audio thread is the source of truth.
- **You add a `transition: border-color 200ms` to `.cell.current`.** Now the playhead lags by 200ms because the visual transition takes that long. Transitions on the current cell make the playhead feel sluggish. Keep it instant.
- **You forget to reset `currentStep` to `-1` on stop.** The grid still shows the last-played cell highlighted forever. Always reset on stop.

## Putting it together

### Update the page to use TransportBar

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
</script>

<svelte:head><title>SVELTE DAW</title></svelte:head>

<h1>SVELTE <span class="accent">DAW</span></h1>

<TransportBar />
<Sequencer />

<style>
  :global(body) {
    background: var(--c-bg, #0a0b10);
    color: var(--c-text, #ecedf3);
    font-family: system-ui;
    margin: 0;
    padding: 32px;
  }
  h1 { letter-spacing: 0.1em; margin-bottom: 24px; }
  .accent { color: var(--c-accent, #ff3e00); }
</style>
```

Run `npm run dev`. Click PLAY. You hear the default boom-bap-ish pattern looping. The playhead sweeps across each row, lighting up cells in time. Drag the BPM slider — the tempo follows live. Click a cell mid-playback — that step is on/off the next time the playhead reaches it. Click STOP — everything halts cleanly.

That's a working drum machine. The next two lessons add persistence (L4: save patterns to localStorage, share via URL) and recording (L5: capture the output to a downloadable file).

## Exercises

### Exercise 1: Make the playhead visible when stopped

**Setup:** when stopped, `currentStep` is `-1`, so no cell gets the `current` class. The grid feels lifeless.

**What to do:** make the first cell of each row show a subtle "ready" highlight when stopped — a thin dotted border, say. Something that says "press play, things will start here." It should NOT look like the playhead-during-playback (don't reuse the `.current` class).

**Verify by:** when stopped, step 1 cells of each row have a dotted accent. When playing, the dotted accent disappears and the real playhead takes over.

**Stretch:** make the ready-state animate (a slow breathing border, maybe 2-second cycle). Use a CSS animation that's only applied when stopped.

<details>
<summary>Show solution</summary>

```svelte
<!-- in Sequencer.svelte, on the cell -->
<button
  class="cell"
  class:on
  class:current={i === audio.currentStep}
  class:downbeat={i % 4 === 0}
  class:ready={i === 0 && !audio.isPlaying}
  ...
></button>
```

```css
.cell.ready {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--c-track) 40%, var(--c-border));
  animation: breathe 2s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

Reading `audio.isPlaying` inside the class directive subscribes the cell to it; when PLAY is pressed, the class drops and the regular playhead takes over.

</details>

### Exercise 2: A play-from-step affordance

**Setup:** PLAY always starts from step 0. Some DAW workflows want you to drop the playhead anywhere — click a cell, playback resumes from there.

**What to do:** add a `playFrom(step: number)` method to the engine. When called, it (re)starts the sequence at `step` instead of `0`. Wire a shift-click on any cell to call it.

**Verify by:** shift-click on the kick row's step 9. Playback starts (or restarts) from step 9. The playhead sweeps from there.

**Stretch:** show a "drop here" visual hint on cell hover when Shift is held.

<details>
<summary>Show solution</summary>

```ts
async playFrom(step: number) {
  this.stop();
  await this.ensureReady();
  if (!this.isReady) return;

  this.sequence = new Tone.Sequence(
    (time, s) => {
      for (const t of TRACKS) {
        if (this.pattern[t.id][s]) t.trigger(this.synths[t.id], time);
      }
      Tone.Draw.schedule(() => { this.currentStep = s; }, time);
    },
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    '16n'
  );
  // Sequence start accepts a "from" offset as the second argument; the first
  // argument is the transport time to start at.
  this.sequence.start(0, `${step}*16n`);
  Tone.Transport.start();
  this.isPlaying = true;
}
```

```svelte
<!-- in Sequencer.svelte -->
<button
  class="cell"
  class:on
  ...
  onclick={(e) => {
    if (e.shiftKey) audio.playFrom(i);
    else audio.toggleCell(track.id, i);
  }}
></button>
```

The `'$&lbrace;step&rbrace;*16n'` notation tells Tone "start at `step` sixteenth notes into the loop." Tone's transport offset accepts time notation.

</details>

### Exercise 3: A tap-tempo button

**Setup:** the BPM slider is fine for known tempos but useless for matching a tempo you have in your head.

**What to do:** add a "TAP" button to the transport bar. Each tap records a timestamp. After three taps, compute the median interval and set `bpm` accordingly. Reset the tap memory after 2 seconds of no tapping.

**Verify by:** tap four times at roughly one tap per second. BPM jumps to ~60. Tap four times at twice that rate, BPM jumps to ~120.

**Stretch:** show the current tap-tempo computation live ("4 taps → 118 BPM") next to the button.

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';

  let taps = $state<number[]>([]);
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  function tap() {
    const now = Date.now();
    taps = [...taps, now];
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { taps = []; }, 2000);

    if (taps.length >= 3) {
      const intervals = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      const bpm = Math.round(60000 / median);
      audio.bpm = Math.max(60, Math.min(200, bpm));
    }
  }
</script>

<button type="button" onclick={tap}>TAP</button>
```

Median (rather than mean) is robust to one wildly-off tap. The `Math.max(60, Math.min(200, bpm))` clamps to the slider's range so a too-fast or too-slow set of taps doesn't break the BPM out of the engine's expected range.

</details>

### Exercise 4 (stretch): A swing parameter

**Setup:** straight 16th notes (every step on the beat) sound mechanical. Swing pushes even-numbered steps slightly late, giving a jazzy/shuffle feel.

**What to do:** add a `swing` field to the engine (a 0..1 value, default 0). When non-zero, the sequence's even steps fire a bit late. `Tone.Transport.swing` and `Tone.Transport.swingSubdivision` are the Tone primitives.

**Verify by:** set swing to 0.5. Listen for the jazzy pushed feel. Set back to 0; it's straight again.

**Stretch:** wire a slider in the TransportBar.

<details>
<summary>Show solution</summary>

```ts
// in engine.svelte.ts
swing = $state(0);

// in the constructor's $effect.root:
$effect(() => {
  const s = this.swing;
  Tone.Transport.swing = s;
  Tone.Transport.swingSubdivision = '8n';
});
```

```svelte
<!-- in TransportBar.svelte -->
<input type="range" min="0" max="1" step="0.05" bind:value={audio.swing} />
```

Tone applies the swing automatically; the sequence callback doesn't need to know. `swingSubdivision` of `'8n'` means "push every other 8th note" — the classic shuffle interpretation.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + src/lib/components/TransportBar.svelte
- + play / stop / sequence logic in engine.svelte.ts

### Verify it works

- Clicking PLAY produces a continuous beat at 120 BPM
- The playhead lights up cells as it sweeps across the grid
- Toggling a cell while playing immediately changes the beat
- Dragging the BPM slider changes the tempo live without clicks or stutters
- Clicking STOP halts playback and resets the playhead

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/components/TransportBar.svelte and the `play()` / `stop()` methods in engine.svelte.ts

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why use Tone.js instead of raw Web Audio?**
A: Web Audio is a flexible toolkit; Tone is the opinionated DAW-shaped wrapper on top. `Tone.Sequence`, `Tone.Transport`, `Tone.Draw`, all the synth shapes — implementing those in raw Web Audio is a project in itself. Tone is about 100KB minified and saves weeks of work. The trade-off is you're tied to Tone's abstractions; if you want raw Web Audio for some operation, you can still reach the underlying `AudioContext` via `Tone.getContext().rawContext`.

**Q: Why does the playhead sometimes skip a step on first PLAY?**
A: Most commonly because the audio context took a few milliseconds to unlock, and the first step's `time` was already in the past by the time scheduling caught up. Tone handles most of this internally, but on slow devices you may see step 0 get skipped. If it bothers you, schedule the first `Transport.start()` for `Tone.now() + 0.05` to give the scheduler a beat.

**Q: Can I have multiple `Tone.Sequence`s running at once?**
A: Yes. Each Sequence is independent and stops/starts on its own. You could have a separate sequence per track (one for kicks, one for snares) if you wanted per-track loop lengths. The reference uses one sequence for simplicity.

**Q: What's the difference between `Tone.Transport` and `Tone.now()`?**
A: `Tone.Transport` is the conductor — it has start/stop/BPM/loop. Schedule events on the transport and they fire when the transport reaches that time. `Tone.now()` returns the current audio-context time as a number — useful for "play this sound 0.1 seconds from now" without involving the transport. The drum-pad in L1 used `Tone.now()` for fire-and-forget triggers; the sequencer here uses `Tone.Transport` for synchronized loops.

**Q: Does `$effect` work the same in a class as in a component?**
A: Mostly. Inside a class, `this` refers to the instance, so `this.bpm` reads the reactive field correctly. The dependency tracker doesn't care whether you reach the read via `this.x` or `x` — both register. The one constraint is that the `$effect` call must be inside either a component or an `$effect.root` scope, which is why the constructor opens a root.

## What's next

L4 makes the DAW persistent. The pattern auto-saves to localStorage on every edit. Named slots let the user save multiple patterns. A URL-encoding scheme turns a pattern into a shareable link — paste the link to a friend, they hear the same beat. The reactivity foundation we built here (the `$effect` + unconditional-read pattern, the `$effect.root` scope) is what makes auto-save a five-line addition rather than a refactor.

<SourcesSection lessonKey="06-capstone-foundations/03-sequence" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
