<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>BPM Knob and Visual Click · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-3);">

<LessonHeader
  moduleSlug="03-metronome-studio"
  lessonSlug="02-bpm-knob"
  title="BPM Knob and a Visual Click"
  blurb="A slider bound to the BPM, an effect that updates Tone, a flashing dot synced to the click."
/>

## Why this lesson exists

The metronome from lesson 1 plays at 120 BPM forever. That's not a metronome anyone would use; it's a click track. To make it useful you need to change the tempo, and to make it feel like a real metronome you need a visual indicator that flashes with the audio.

Both of those touch interesting Svelte 5 patterns. The slider uses `bind:value`, which is the simplest case of two-way binding. The "push BPM into Tone when the value changes" pattern uses `$effect`, which is fine until you hit the dependency-tracking trap that bit you in Module 2. And syncing visual updates to audio that's running on a separate thread requires `Tone.Draw.schedule`, which is the bridge between audio time and animation frames.

The visual flash, in particular, hits a Svelte template feature you haven't used yet: `&lbrace;#key value&rbrace;`. It's the right tool for "re-trigger this CSS animation every time something changes," and once you've seen it, you'll spot the use case everywhere.

## Learning objectives

By the end of this lesson you'll be able to:

- Bind a numeric `$state` to an `<input type="range">` with `bind:value`.
- Write an `$effect` that pushes a reactive value into a non-reactive external API (in this case, `Tone.Transport.bpm.value`).
- Recognize the dependency-tracking trap and apply the unconditional-read pattern to avoid it.
- Use `Tone.Draw.schedule` to align visual updates with audio thread timing.
- Use `&lbrace;#key value&rbrace;` to re-mount a subtree whenever a value changes, which restarts CSS animations cleanly.
- Style a small UI panel with scoped CSS, including a CSS animation triggered by re-mount.

## Concept 1: Two-way binding with `bind:value`

### What `bind:value` does

Svelte's `bind:value` on a form input wires the input's value to a reactive variable in both directions. Read direction: the input displays whatever the variable currently holds. Write direction: when the user changes the input, the variable updates.

```svelte
<script>
  let bpm = $state(120);
</script>

<input type="range" min="40" max="240" bind:value={bpm} />
<p>BPM: {bpm}</p>
```

Move the slider; the paragraph updates. Set `bpm = 200` from anywhere in the script (a button handler, an effect, the console); the slider thumb moves to 200. Two way.

This is one of the things React doesn't have a direct equivalent for. In React you'd write `value={bpm} onChange={e => setBpm(+e.target.value)}` — the value is one-way (state to input), and you wire up the inverse manually via an event handler. Svelte collapses both into one declaration.

### Works on every input that has a "value"

`bind:value` is generic across input types:

- `<input type="text">` — the value is a string.
- `<input type="number">` — the value is a number (auto-coerced from the string the browser reports).
- `<input type="range">` — the value is a number.
- `<input type="checkbox">` — the property is `checked`, not `value`, so you use `bind:checked={isOn}`.
- `<input type="radio">` — `bind:group={selected}` for radio groups.
- `<select>` — `bind:value` for single, `bind:value` with an array for `multiple`.
- `<textarea>` — `bind:value` (string).

For our slider, `bind:value={bpm}` does what you want: the slider's value is the number from 40 to 240, and the bound variable is a `$state(number)`.

### Worked example: a slider with a number display

```svelte
<script>
  let bpm = $state(120);
</script>

<div class="bpm-control">
  <input type="range" min="40" max="240" step="1" bind:value={bpm} />
  <output>{bpm} BPM</output>
</div>

<style>
  .bpm-control { display: flex; gap: 12px; align-items: center; }
  output { font-variant-numeric: tabular-nums; min-width: 5ch; }
</style>
```

`<output>` is the semantically correct element for displaying a value computed or derived from form inputs. `font-variant-numeric: tabular-nums` makes the digits monospace-width so the number doesn't jiggle as it changes.

### Variations

- **A "reset" button.** `<button onclick={() => bpm = 120}>Reset</button>`. The slider thumb snaps back. Because the binding is two-way, setting the variable updates the input.
- **Bind to a derived range.** If you want the slider to go from 0 to 100 but represent BPM 40-240, derive: `<input bind:value={sliderValue} />` then `let bpm = $derived(40 + sliderValue * 2)`. The binding writes to `sliderValue`; the derived value follows.
- **Constrain at the model level.** If something else (an effect, an API response) sets `bpm = 9999`, the slider clamps to 240 visually but the model still holds 9999. If that matters, wrap the write: `function setBpm(v) { bpm = Math.max(40, Math.min(240, v)); }` and use that everywhere instead of direct assignment.

### Common mistakes with `bind:value`

- **Forgetting that range inputs return strings until you bind.** If you set `value={bpm}` and read `event.target.value` in `oninput`, you get a string. `bind:value` does the conversion for you — it knows the variable is a number and coerces.
- **Trying to bind to a non-reactive variable.** `let bpm = 120` (no `$state`) won't work. The binding writes to `bpm`, but nothing else in the component re-renders on the change. Use `$state`.
- **Binding to a derived value.** `let bpm = $derived(...)` is read-only. Trying to `bind:value={bpm}` errors at compile time.
- **Forgetting `min` / `max` / `step` on a range input.** Browsers default to `min=0`, `max=100`, `step=1`. Without explicit bounds, your slider goes 0-100 even if your model expects 40-240.

## Concept 2: `$effect` and the dependency-tracking trap

### Why we need an effect

We want the slider to control Tone's tempo while it's running. The slider writes to the `bpm` variable; we need to push that into `Tone.Transport.bpm.value`.

The naive version:

```js
$effect(() => {
  Tone.Transport.bpm.value = bpm;
});
```

This LOOKS right. It reads `bpm`, writes to Tone. Svelte tracks `bpm` as a dependency, so when `bpm` changes, the effect re-runs and pushes the new value.

In simple cases this works. The trap is what happens when you start guarding the body with conditionals.

### The trap

Suppose you want to only push to Tone after the Transport exists:

```js
$effect(() => {
  if (Tone.Transport) {
    Tone.Transport.bpm.value = bpm;  // bpm is INSIDE the conditional
  }
});
```

If `Tone.Transport` is falsy on the first run (it isn't, in this case, but imagine), the body never reads `bpm`. Svelte tracks only the dependencies it actually reads. So the effect didn't track `bpm`, and even after `Tone.Transport` becomes truthy, the effect won't re-fire when `bpm` changes.

Worse, this is silent. There's no warning. The effect just stops re-running, and you can't tell why.

This bit me when I was building the curriculum's own dashboard sequencer — an effect with a guard, the guard was true the first run, the dependency was tracked, then a refactor moved the read into the conditional and the effect stopped responding to changes weeks later. Took an hour to figure out.

### The unconditional-read fix

Read every reactive value at the top of the effect, BEFORE any conditional. Use the values from your local copies.

```js
$effect(() => {
  const next = bpm;                  // unconditional read
  if (Tone.Transport) {
    Tone.Transport.bpm.value = next;
  }
});
```

`const next = bpm` runs unconditionally, so the effect always tracks `bpm`. The rest of the body can guard, branch, return early — as long as the reads happened first, the dependency graph is correct.

Some people prefer to underscore-name the placeholder to signal intent (`const _ = bpm`); others use the value (`const next = bpm` and then use `next`). Either works. The point is the read happens at the top of the effect, where it can't be skipped.

### Worked example: the BPM effect

```js
$effect(() => {
  const next = bpm;
  if (Tone.Transport) Tone.Transport.bpm.value = next;
});
```

This effect runs once on mount (reading `bpm = 120`, pushing 120 to Tone), then re-runs every time `bpm` changes (because the slider moved). The push is idempotent — setting the same value twice is a no-op — so even spurious extra runs are harmless.

Note: `Tone.Transport.bpm.value` is the right property. `Tone.Transport.bpm` is a `Tone.Param` object (an audio-rate parameter that supports automation curves and ramps). The `.value` is the synchronous getter/setter for the current value. If you forget the `.value` and write `Tone.Transport.bpm = next`, you replace the Param object with a number and break Tone's internals.

### Variations on the pattern

- **Multiple reads.** If the effect depends on three things, read all three at the top: `const [a, b, c] = [stateA, stateB, stateC]`. Order doesn't matter; all three get tracked.
- **Reading a $derived value.** Same rule. Read it unconditionally. The effect tracks the derived (which transitively tracks its inputs).
- **No-op when not needed.** If you only want to push when actually playing: `const next = bpm; if (isPlaying) Tone.Transport.bpm.value = next;`. The effect still runs on every `bpm` change, but the body is cheap.

### Common mistakes with `$effect`

- **Reading inside a conditional that might short-circuit.** The classic trap above.
- **Mutating reactive state inside an effect.** Allowed, but loops. If you write to `bpm` from the effect, and the effect depends on `bpm`, you've made a feedback loop. Svelte will warn at runtime.
- **Forgetting that effects run after the next microtask.** If you want something synchronous, do it inline or via a `$derived`, not in an effect.
- **Using `$effect` for things `$derived` would handle.** If you're just computing a value from other reactive values, `$derived` is the right tool. Effects are for side-effects (writing to non-reactive APIs like `localStorage`, `Tone.Transport.bpm.value`, the DOM, etc.).

### TS notes

If you're on TypeScript, `bpm` here is `number` because `$state(120)` infers it. The effect callback returns `void`. The `next` local is `number` because of the assignment.

If you want to be explicit: `let bpm = $state<number>(120)`. Usually not necessary.

## Concept 3: `Tone.Draw.schedule` and visual sync

### Why a normal `$effect` isn't enough

You might think: "OK, I'll add `pulse++` inside the audio callback and have an effect on `pulse` that updates the indicator."

The callback IS already running at the right time (audio thread, sample-accurate). But the actual `pulse++` mutation, the effect that responds to it, the DOM update — all of that runs on the main thread, on the next microtask, then the next animation frame. By the time the indicator visually changes, you're 1-2 frames late (16-32ms). The audio click happened before the visual flash.

For a metronome, that's bad UX. You watch the indicator and it lags the sound. Musicians notice this; it makes the metronome feel wrong.

### What `Tone.Draw.schedule` does

`Tone.Draw` is Tone's bridge from audio time to the main-thread requestAnimationFrame loop. You schedule a callback for a specific audio time, and Tone arranges for it to run on the requestAnimationFrame closest to that time.

```js
loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease('C2', '32n', time);
  Tone.Draw.schedule(() => { pulse++; }, time);
}, '4n').start(0);
```

`time` is the audio-thread timestamp the audio is scheduled for. `Tone.Draw.schedule(callback, time)` queues `callback` to run on the rAF tick closest to `time`. So the visual update happens within ~16ms of the audio — usually well under the perceptual threshold for "they happened at the same time."

The callback runs on the main thread. You can mutate reactive state, call DOM APIs, do anything you'd normally do in an event handler.

### Worked example: pulsing on every tick

```js
let pulse = $state(0);

loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease('C2', '32n', time);
  Tone.Draw.schedule(() => { pulse++; }, time);
}, '4n').start(0);
```

`pulse` increments on every tick, in sync with the audio. We'll use `pulse` to trigger the visual flash via a `&lbrace;#key&rbrace;` block in the next concept.

### Variations

- **Scheduling something at the END of a note.** `Tone.Draw.schedule(callback, time + duration)` where `duration` is in seconds. Useful for "the note ended" UI updates.
- **Scheduling something at a fraction of the tempo.** Compute the time offset from the BPM. At 120 BPM, half a beat is `0.25` seconds, so `time + 0.25` is the next eighth.
- **Decoupling the schedule from the audio.** You don't have to put `Tone.Draw.schedule` inside the audio callback. You can schedule purely visual events on the Transport with their own loops.

### Common mistakes with `Tone.Draw.schedule`

- **Mutating reactive state directly in the audio callback.** Works most of the time, but the visual update is then late by 1-2 frames. Use `Tone.Draw.schedule` for anything user-visible.
- **Doing slow work inside the rAF callback.** It's a normal main-thread callback. If it takes more than 16ms it'll cause a frame drop. Keep it cheap (`pulse++`, set a class, update a number).
- **Passing the wrong `time`.** Use the `time` argument from the audio callback. Don't pass `Tone.now()` (which is "now from the main thread's perspective" — slightly behind audio time).
- **Scheduling something WAY in the future.** Tone.Draw has a limited horizon. For events more than a second or two out, schedule them on the Transport itself, not on Draw.

## Concept 4: `&lbrace;#key value&rbrace;` for restarting animations

### What `&lbrace;#key&rbrace;` does

`&lbrace;#key expression&rbrace; ... &lbrace;/key&rbrace;` is a Svelte template block that destroys and recreates its contents every time `expression` changes. The DOM nodes inside get torn down and re-rendered, components inside get destroyed and re-mounted.

This is mostly used for one purpose: restarting a CSS animation. CSS animations only play once unless you have a way to "reset" them. Removing and re-adding a class works but is fiddly. Re-mounting the element runs the animation fresh because the browser sees a new element with the animation property set.

```svelte
{#key pulse}
  <div class="indicator"></div>
{/key}
```

Every time `pulse` changes, the `<div>` unmounts and re-mounts. If `.indicator` has `animation: flash 200ms ease-out`, the animation re-runs from frame 0.

### Worked example: the flashing indicator

```svelte
<script>
  let pulse = $state(0);
</script>

{#key pulse}
  <div class="indicator"></div>
{/key}

<style>
  .indicator {
    width: 60px; height: 60px; border-radius: 50%;
    background: #4a8fe7;
    box-shadow: 0 0 24px #4a8fe7;
    margin: 0 auto 24px;
    animation: flash 200ms ease-out;
  }
  @keyframes flash {
    0%   { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
</style>
```

Increment `pulse` from anywhere (a click handler, our `Tone.Draw.schedule` callback) and the dot flashes. Each flash is a fresh run of the animation: scale 1.2 -> 1.0, opacity 1.0 -> 0.3, over 200ms.

### Variations

- **Keyed on a derived value.** `&lbrace;#key Math.floor(pulse / 4)&rbrace;` flashes on every fourth tick. Useful for "downbeat indicator."
- **Keyed on an object.** Svelte uses `===` to compare; changing object identity counts as a change. If you want to flash on "any change to the BPM," `&lbrace;#key bpm&rbrace;` works.
- **Wrapping multiple elements.** The block can contain a subtree. All of it gets re-mounted together.

### Why not just toggle a class?

You can. The class-toggle version:

```svelte
<div class="indicator" class:pulsing={pulse > 0}></div>
```

This adds and removes the `.pulsing` class as `pulse` changes. But CSS animations on classes only run when the class is added. If you go from `pulse=1` to `pulse=2`, the class is already there — the browser doesn't know to restart the animation.

You could work around it by toggling the class off then back on with a timeout. That's ugly and timing-fragile. `&lbrace;#key&rbrace;` is the clean solution.

### Common mistakes with `&lbrace;#key&rbrace;`

- **Keying on a frequently-changing value with expensive children.** Re-mounting destroys and rebuilds DOM. For a single `<div>`, that's fine — for a complex subtree with its own state and components, it's wasteful and you lose internal state on every key change.
- **Keying on something that changes every tick when you only want occasional restarts.** Pick the right granularity. Key on `Math.floor(pulse / 4)` if you only want a flash every four ticks.
- **Forgetting that mounted components inside lose their state.** Any `$state` declared inside the keyed block resets on key change. That's the whole point, but it can surprise you if you have a component inside that should preserve state.

## Concept 5: Scoped styles for the metronome panel

The full metronome panel needs a container with padding, dark background, rounded corners. The slider needs to span the full width with the accent color. The button needs to be prominent.

This is all CSS, scoped to the component. Nothing exotic — but worth seeing assembled.

```svelte
<style>
  .metronome {
    max-width: 320px; margin: 40px auto; padding: 32px;
    background: #1a1d2a; color: #ecedf3; border-radius: 16px;
    font-family: system-ui; text-align: center;
  }
  .display { margin-bottom: 24px; }
  .num { font-size: 56px; font-weight: 700; color: #4a8fe7; line-height: 1; }
  .unit { font-size: 14px; color: #9ea3b8; margin-left: 6px; }
  .bpm-slider { width: 100%; margin-bottom: 24px; accent-color: #4a8fe7; }
  .play {
    width: 100%; padding: 14px; font: inherit; font-weight: 700;
    background: #4a8fe7; color: white; border: 0; border-radius: 10px;
    cursor: pointer; letter-spacing: 0.1em;
  }
</style>
```

A few small choices worth noticing:

- `accent-color: #4a8fe7` on the range input. This is a modern CSS property that themes form controls without needing custom-styled track and thumb. The browser uses the accent color for the slider track, the checkbox tick, the radio dot. Works in every modern browser.
- `font: inherit` on the button. Browsers ship buttons with a hideous default font; `font: inherit` makes the button use the page font.
- Tabular numerics are missing here but are a good addition: `font-variant-numeric: tabular-nums` on `.num` keeps the BPM display from jiggling as digits change.

Scoping means none of these styles leak. The `.num` class wouldn't conflict with a `.num` in some other component. We'll dig deeper into scoping mechanics in lesson 5.

## Putting it together

The full lesson 2 page in `src/routes/+page.svelte`:

```svelte
<script>
  import * as Tone from 'tone';

  let isPlaying = $state(false);
  let bpm = $state(120);
  let pulse = $state(0);

  let synth = null;
  let loop = null;

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease('C2', '32n', time);
      Tone.Draw.schedule(() => { pulse++; }, time);
    }, '4n').start(0);
    Tone.Transport.start();
    isPlaying = true;
  }

  function stop() {
    if (!isPlaying) return;
    Tone.Transport.stop();
    Tone.Transport.cancel();
    loop?.dispose();
    loop = null;
    isPlaying = false;
    pulse = 0;
  }

  $effect(() => {
    const next = bpm;
    if (Tone.Transport) Tone.Transport.bpm.value = next;
  });
</script>

<div class="metronome">
  {#key pulse}
    <div class="indicator"></div>
  {/key}

  <div class="display">
    <span class="num">{bpm}</span>
    <span class="unit">BPM</span>
  </div>

  <input
    type="range" min="40" max="240" step="1"
    bind:value={bpm}
    class="bpm-slider"
  />

  <button class="play" onclick={() => isPlaying ? stop() : start()}>
    {isPlaying ? '■ STOP' : '▶ START'}
  </button>
</div>

<style>
  .metronome {
    max-width: 320px; margin: 40px auto; padding: 32px;
    background: #1a1d2a; color: #ecedf3; border-radius: 16px;
    font-family: system-ui; text-align: center;
  }
  .indicator {
    width: 60px; height: 60px; border-radius: 50%;
    background: #4a8fe7;
    box-shadow: 0 0 24px #4a8fe7;
    margin: 0 auto 24px;
    animation: flash 200ms ease-out;
  }
  @keyframes flash {
    0%   { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
  .display { margin-bottom: 24px; }
  .num { font-size: 56px; font-weight: 700; color: #4a8fe7; line-height: 1; }
  .unit { font-size: 14px; color: #9ea3b8; margin-left: 6px; }
  .bpm-slider { width: 100%; margin-bottom: 24px; accent-color: #4a8fe7; }
  .play {
    width: 100%; padding: 14px; font: inherit; font-weight: 700;
    background: #4a8fe7; color: white; border: 0; border-radius: 10px;
    cursor: pointer; letter-spacing: 0.1em;
  }
</style>
```

Save. Click START. The dot pulses with each click. Move the slider while it's playing; the tempo updates immediately and the dot speeds up or slows down to match. Click STOP; everything quiets down.

## Exercises

### Exercise 1: Wire up the slider

**Setup:** start from lesson 1's working tick page.

**What to do:** add the `<input type="range">` with `bind:value={bpm}`, the BPM number display, and the `$effect` that pushes BPM into Tone. Don't add the visual indicator yet — just the slider.

**Verify by:** start the metronome. Move the slider. The audio tempo changes immediately to match. The displayed BPM number updates as you drag.

**Stretch:** add a `<button>Reset</button>` that sets `bpm = 120`. The slider thumb should snap back to the middle.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import * as Tone from 'tone';

  let isPlaying = $state(false);
  let bpm = $state(120);
  let synth = null;
  let loop = null;

  async function start() { /* unchanged from L1 */ }
  function stop() { /* unchanged from L1 */ }

  $effect(() => {
    const next = bpm;
    if (Tone.Transport) Tone.Transport.bpm.value = next;
  });
</script>

<input type="range" min="40" max="240" bind:value={bpm} />
<p>{bpm} BPM</p>
<button onclick={() => isPlaying ? stop() : start()}>
  {isPlaying ? 'STOP' : 'START'}
</button>
<button onclick={() => bpm = 120}>Reset</button>
```

The Reset button works because `bind:value` is two-way: setting `bpm = 120` updates the slider thumb position.

</details>

### Exercise 2: Add the visual indicator

**Setup:** the slider from Exercise 1.

**What to do:** add the `&lbrace;#key pulse&rbrace; <div class="indicator"></div> &lbrace;/key&rbrace;` block. Add the `.indicator` CSS with the `flash` keyframe. Increment `pulse` from inside `Tone.Draw.schedule` in the audio callback.

**Verify by:** start the metronome. The dot flashes on every click, with a scale-and-fade animation. The flash is tightly synced to the audio click (no noticeable lag).

**Stretch:** experiment with the animation's keyframes. Try a longer duration (`400ms`); try a different easing (`ease-in-out`, `cubic-bezier(0.4, 0, 0.2, 1)`). Try animating `box-shadow` size or color.

<details>
<summary>Show solution</summary>

```svelte
<script>
  // ... existing state
  let pulse = $state(0);

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease('C2', '32n', time);
      Tone.Draw.schedule(() => { pulse++; }, time);
    }, '4n').start(0);
    Tone.Transport.start();
    isPlaying = true;
  }
</script>

{#key pulse}
  <div class="indicator"></div>
{/key}

<style>
  .indicator {
    width: 60px; height: 60px; border-radius: 50%;
    background: #4a8fe7;
    box-shadow: 0 0 24px #4a8fe7;
    margin: 0 auto;
    animation: flash 200ms ease-out;
  }
  @keyframes flash {
    0%   { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.3; }
  }
</style>
```

The flash runs on every key change because the div unmounts and re-mounts.

</details>

### Exercise 3: Trigger the dependency-tracking trap deliberately

**Setup:** the working version from Exercise 2.

**What to do:** rewrite the BPM effect with the BAD pattern:

```js
$effect(() => {
  if (Tone.Transport) Tone.Transport.bpm.value = bpm;
});
```

Reload. Start the metronome at 120 BPM. Move the slider. Does the tempo change?

**Verify by:** in MOST cases the tempo still changes, because `Tone.Transport` is truthy on the first run so `bpm` does get tracked. Now try this: change the condition to something that's false on the first run, like `if (isPlaying) Tone.Transport.bpm.value = bpm`. Reload, set the BPM to 200 BEFORE starting, then click start. The Loop still uses 120 (or whatever the initial value was), because the effect didn't track `bpm` the first time it ran and never re-fired.

Fix it back to the unconditional-read pattern. Verify the bug goes away.

**Stretch:** read the Svelte 5 docs section on `$effect` and the "fine-grained reactivity" model. The reason this trap exists is the same reason Svelte 5 is fast — fine-grained tracking means only what was actually read gets tracked.

<details>
<summary>Show solution</summary>

The fixed version:

```js
$effect(() => {
  const next = bpm;       // always read
  if (isPlaying && Tone.Transport) Tone.Transport.bpm.value = next;
});
```

The reason the trap is silent: there's no error, no warning, no visible failure. The effect ran once, the dependency list it tracked is "nothing reactive," and it never re-runs because there are no dependencies to invalidate it.

If you want to be defensive, you can `console.log(bpm)` inside an effect to confirm it's tracking. Or read the dependency in a `const` at the top and reference the const everywhere — make it impossible to accidentally skip the read.

</details>

### Exercise 4: Format the BPM display nicely

**Setup:** the working metronome from Exercise 2.

**What to do:** the BPM number should show in big bold text with a small "BPM" label next to it (the version in "putting it together"). Style with `font-variant-numeric: tabular-nums` so the digits don't jiggle as the number changes.

**Verify by:** move the slider rapidly. The BPM number changes but doesn't visibly jump horizontally. Compare to a version without `tabular-nums` — you'll see the proportional digits cause horizontal jitter.

**Stretch:** add a tempo-name label (Andante, Allegro, etc.) below the BPM. Use a `$derived` to compute the name based on the BPM range.

<details>
<summary>Show solution</summary>

```svelte
<script>
  // ...
  const tempoName = $derived(
    bpm < 60 ? 'Largo' :
    bpm < 76 ? 'Adagio' :
    bpm < 108 ? 'Andante' :
    bpm < 120 ? 'Moderato' :
    bpm < 156 ? 'Allegro' :
    bpm < 168 ? 'Vivace' :
    'Presto'
  );
</script>

<div class="display">
  <span class="num">{bpm}</span>
  <span class="unit">BPM</span>
  <div class="tempo-name">{tempoName}</div>
</div>

<style>
  .num {
    font-size: 56px; font-weight: 700; color: #4a8fe7; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tempo-name { color: #9ea3b8; font-size: 14px; margin-top: 4px; font-style: italic; }
</style>
```

`$derived` re-evaluates whenever `bpm` changes. The tempo-name label updates as you drag the slider.

</details>

### Exercise 5 (stretch): Accent every fourth beat

**Setup:** the working metronome with visual indicator.

**What to do:** add a `beat` counter that increments inside `Tone.Draw.schedule`. On every fourth beat (beat 1 of a 4-beat bar), play a higher pitch (`'C3'` instead of `'C2'`) and flash the indicator in a different color (gold instead of blue). Reset `beat` to 0 on stop.

**Verify by:** the metronome alternates a louder/higher click every fourth beat with a different-colored flash. Counting along should land on "ONE-two-three-four-ONE-two-three-four."

**Stretch:** make the accent interval configurable (a `barLength` $state variable). A 3/4 bar accents every third beat; a 7/8 bar accents every seventh.

<details>
<summary>Show solution</summary>

```svelte
<script>
  // ...
  let beat = $state(0);
  let barLength = $state(4);

  async function start() {
    // ...
    loop = new Tone.Loop((time) => {
      const isAccent = beat % barLength === 0;
      const pitch = isAccent ? 'C3' : 'C2';
      synth.triggerAttackRelease(pitch, '32n', time);
      Tone.Draw.schedule(() => {
        pulse++;
        beat++;
      }, time);
    }, '4n').start(0);
    // ...
  }

  function stop() {
    // ... existing
    beat = 0;
  }

  const isAccent = $derived(beat > 0 && (beat - 1) % barLength === 0);
</script>

{#key pulse}
  <div class="indicator" class:accent={isAccent}></div>
{/key}

<style>
  .indicator.accent {
    background: #f0c050;
    box-shadow: 0 0 24px #f0c050;
  }
</style>
```

The `isAccent` derived value lags `beat` by one (because `beat` was just incremented when the flash renders), hence the `(beat - 1) % barLength === 0`. This is fiddly state-machine bookkeeping; we'll clean it up in the next lesson when we extract components and pass props.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` containing the metronome with slider and indicator.
- The audio engine code from lesson 1, plus `pulse` state, plus the BPM `$effect`.

### Verify it works

- The metronome panel renders with a dark background, large BPM display, slider, and START button.
- Clicking START plays a click and pulses the indicator on each tick.
- Moving the slider while playing changes tempo immediately. The indicator's flash rate also changes.
- Clicking STOP halts audio and resets `pulse = 0`.
- The browser console shows no errors throughout.

### Compare against the reference

For Module 3, your local `+page.svelte` is the canonical reference. Save a copy as `lessons/03/L02-bpm-knob.svelte` (or similar) if you want to keep this version around before the next lesson refactors it into components.

## Common questions

**Q: Why does the indicator only flash AFTER I start? Shouldn't it be visible just sitting there?**
A: The `&lbrace;#key pulse&rbrace;` block re-mounts whenever `pulse` changes. With the initial `pulse = 0`, the indicator is mounted once and the animation runs once on mount. After that it sits at the final keyframe state (opacity 0.3, scale 1.0) — which IS visible, just faded. If you want a different idle state, add a separate class for "not playing" with different default styles, or apply the `flash` animation only when playing.

**Q: Could I use `$derived` instead of `$effect` for the BPM push?**
A: No. `$derived` is for computing a value from other values. The BPM push is a side effect — it writes to an external mutable API (`Tone.Transport.bpm.value`). Side effects belong in `$effect`. `$derived` is meant to be pure; using it for side effects breaks Svelte's mental model and may not re-run reliably.

**Q: Is there a way to bind directly to `Tone.Transport.bpm.value` without an effect?**
A: No, because `bind:` is a Svelte template construct that works on form inputs and props, not arbitrary JavaScript objects. The effect is the right tool for "push my reactive state into a non-reactive external API." This is a common pattern: any time you wire reactive state to a library that doesn't know about Svelte (Tone, Three.js, D3, a WebSocket), you'll use an effect.

**Q: Why `Tone.Draw.schedule` instead of just `requestAnimationFrame`?**
A: rAF runs on the next animation frame, not at a specific time. If you call `requestAnimationFrame(() => pulse++)` from inside the audio callback, you get the next frame — which might be 1ms away or 16ms away, depending on where in the frame cycle the audio callback fired. `Tone.Draw.schedule(cb, time)` queues the callback for the rAF tick closest to a specific audio time, with Tone managing the queue. The end result is tighter visual sync.

**Q: The flash animation feels mechanical. Can I make it bouncier?**
A: Sure — change the keyframes, change the easing, add more keyframes. But the real upgrade is spring physics, which is what lesson 5 of this module covers. Spring-based motion has organic momentum that CSS keyframes can only approximate.

## What's next

Lesson 3 splits the growing `+page.svelte` into smaller focused components: `<ClickIndicator>`, `<BpmDial>`, `<TransportButton>`. You'll learn `$props()`, `$bindable()`, and callback props — the Svelte 5 component interface in practice. By the end of lesson 3 the page is a 30-line composition that's easier to read than the version you have now.

<SourcesSection lessonKey="03-metronome-studio/02-bpm-knob" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
