<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Effects · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-7);">

<LessonHeader
  moduleSlug="07-capstone-polish"
  lessonSlug="01-effects"
  title="Filter, Delay, Reverb"
  blurb="A reactive effect chain. Knobs bound to Tone parameters. Smooth ramping so dragging doesn't click."
/>

## Why this lesson exists

The DAW from Module 6 makes drum sounds. They land where you put them on the grid, they keep time, they persist across reloads — and they sound exactly like the raw synth output, which is to say a little flat. Real drum machines have a knob row at the bottom that bends the sound after it's been generated: a filter that pulls the brightness down, a delay that throws echoes off the back wall, a reverb that turns the whole thing into a room instead of a sample-fired-into-a-vacuum.

This lesson adds that knob row. The interesting Svelte content sits inside a slightly larger lesson on Web Audio routing: how to build a graph of audio nodes, what `connect()` actually does, why dragging an audio parameter to a new value without `rampTo` produces an audible click, and how to wire a Tone.js node's parameter to a Svelte rune so the UI and the audio stay synchronized without a single manual subscription. The pattern you learn here — one `$effect` per parameter, reading the rune unconditionally, calling `rampTo` on the live node — is the pattern that the mixer (next lesson) reuses sixteen times.

## Learning objectives

By the end of this lesson you'll be able to:

- Describe the Web Audio graph as a directed graph of nodes connected source-to-destination.
- Build a serial effect chain in Tone.js — `Tone.Filter` → `Tone.FeedbackDelay` → `Tone.Reverb` → `Tone.Gain` master → `Tone.Destination`.
- Bind a Svelte rune to a live Tone.js parameter using `$effect` and `rampTo`.
- Explain why `rampTo(value, 0.05)` prevents zipper noise during slider drags, and what would happen without it.
- Recognize the "read state unconditionally before any branching" pattern for `$effect` dependency tracking, and explain why it's required.

## Concept 1: Web Audio as a graph

### What a Web Audio graph is

The Web Audio API doesn't think in terms of "sounds." It thinks in terms of nodes connected by edges, where each node either produces audio (an oscillator, a buffer player), modifies audio (a filter, a delay), or consumes audio (the destination, which is your speakers). Each node has an output (sometimes multiple), each node accepts inputs (sometimes multiple), and you wire them up by calling `nodeA.connect(nodeB)`. The browser then runs that graph in real time on a dedicated audio thread, completely separate from the main JavaScript thread that runs your Svelte code.

Tone.js is a wrapper over the Web Audio API. It gives you nicer constructors (`new Tone.Filter(8000, 'lowpass')` instead of `audioCtx.createBiquadFilter()` plus three setter calls), nicer scheduling (the `Tone.Transport` you used in M6), and a few higher-level nodes (`Tone.FeedbackDelay` is "a delay with internal feedback wired" — saving you from building it from primitives). But underneath it's the same graph. Every Tone node has a `.connect()` method that wires it to a downstream node. Every Tone parameter is a wrapped Web Audio `AudioParam`.

The DAW's audio graph after this lesson, drawn left-to-right:

```
[kick synth]  ──┐
[snare synth] ──┤
[hat synth]   ──┼─→ [filter] ─→ [delay] ─→ [reverb] ─→ [master gain] ─→ [destination]
[perc synth]  ──┘
```

Four synths fan into a shared filter. The filter feeds the delay, the delay feeds the reverb, the reverb feeds the master gain, the master gain reaches the destination (the OS audio output). Audio flows downstream. You build the graph back-to-front: create the destination-side node first, then create each upstream node with `.connect(downstream)` so the wiring exists by the time audio starts flowing.

### Why this graph order

The order isn't arbitrary. Filter before delay means the delay receives already-filtered audio, so the echoes inherit the filter's tone. Delay before reverb means the reverb smears the echoes together into a tail. Master gain last means the master volume affects everything uniformly without re-running through the effects.

You could reorder. Reverb before delay produces a denser, more washed-out sound — the delays are repeating already-reverbed audio. Filter at the very end damps the reverb tail too, not just the dry signal. There's no canonical order; the order is the sound. We pick filter-delay-reverb because it's the most common convention and the controls feel intuitive in that arrangement.

### The audio graph runs on its own thread

Worth pausing on: when you press PLAY in the DAW, your synth nodes start producing audio. That audio doesn't go through your JavaScript. The audio thread (a separate OS thread, or the browser's equivalent) pulls samples from the graph at the audio sample rate — typically 44,100 or 48,000 samples per second — and pushes them to the OS audio buffer. Your JavaScript runs at whatever rate the main thread can manage (16ms per frame at 60fps, often slower). The two are decoupled.

This is why a janky main thread doesn't immediately produce audio glitches. The audio thread keeps running. It's only when the main thread blocks long enough that it can't schedule the next batch of events into the audio thread's queue that you'll hear gaps. Tone.js's `Tone.Transport` is what schedules those events; its lookahead (~100ms by default) is the cushion between main-thread events and audio-thread playback.

When you change a parameter — say, the filter cutoff — you're not telling the audio thread "play this new sound." You're telling the audio thread "change the value of this parameter, starting now, over this many seconds, using this interpolation curve." The audio thread handles the change at sample rate. That's what `rampTo` is for.

## Concept 2: Adding effects to the engine

### The state additions

Five new runes on the engine: four effect parameters and a master volume. All on the `AudioEngine` class in `src/lib/audio/engine.svelte.ts`:

```ts
// Effects.
filterFreq = $state(8000);
delayTime = $state(0.25);
delayFeedback = $state(0.3);
reverbWet = $state(0.15);
masterVolume = $state(0.9);
```

Each is a plain number. The slider in the UI will write to it, the `$effect` we add next will read it and push the new value to the corresponding Tone node. The defaults are chosen so the DAW sounds neutral on first load — filter wide open at 8kHz, delay short with moderate feedback, reverb at 15% wet so the room is there but not overwhelming.

Alongside the runes, five private fields for the Tone nodes themselves. These aren't reactive — they're created once, in `ensureReady`, and they live until the page unloads:

```ts
private master: Tone.Gain | null = null;
private filter: Tone.Filter | null = null;
private delay: Tone.FeedbackDelay | null = null;
private reverb: Tone.Reverb | null = null;
```

They're nullable because the engine is constructed on page load but the Tone graph isn't built until the user interacts (browser autoplay policy requires a user gesture before any audio context can start). Until `ensureReady` runs, these fields are `null` and the `$effect` ramps no-op via optional chaining.

### Building the graph in `ensureReady`

The graph gets built once, lazily, on the first user interaction that wants audio. Here's the relevant part of `ensureReady`:

```ts
async ensureReady() {
  if (this.isReady || this.isLoading) return;
  this.isLoading = true;
  try {
    await Tone.start();

    // Build the graph back-to-front so each upstream node can call
    // `.connect(downstream)` on creation.
    this.master = new Tone.Gain(this.masterVolume).toDestination();

    // Passive FFT tap on the master. Connecting an analyser does not
    // double the audio — it's a side-chain.
    this.analyser = new Tone.Analyser('fft', 64);
    this.master.connect(this.analyser);

    this.reverb = new Tone.Reverb({ decay: 2, wet: this.reverbWet }).connect(this.master);
    this.delay = new Tone.FeedbackDelay(this.delayTime, this.delayFeedback).connect(
      this.reverb
    );
    this.filter = new Tone.Filter(this.filterFreq, 'lowpass').connect(this.delay);

    for (const t of TRACKS) {
      const ch = this.channels[t.id];
      this.gainNodes[t.id] = new Tone.Gain(ch.gain);
      this.panNodes[t.id] = new Tone.Panner(ch.pan);
      // synth → gain → pan → filter (effects bus)
      this.synths[t.id] = t.buildSynth();
      this.synths[t.id].connect(this.gainNodes[t.id]);
      this.gainNodes[t.id].connect(this.panNodes[t.id]);
      this.panNodes[t.id].connect(this.filter);
    }

    Tone.Transport.bpm.value = this.bpm;
    this.isReady = true;
  } catch (err) {
    this.loadError = (err as Error).message;
  } finally {
    this.isLoading = false;
  }
}
```

The mixer and analyser code is from later lessons — for this lesson, focus on the filter/delay/reverb/master quartet plus the synth loop. (You're reading the final reference engine; the per-channel mixer comes in Lesson 2 and the analyser tap comes in Lesson 3.)

A walkthrough of the relevant pieces:

- `await Tone.start()` — starts the underlying `AudioContext`. Must be called from a user-gesture handler. `ensureReady` is invoked from the play button's onclick, which satisfies that requirement.
- `new Tone.Gain(this.masterVolume).toDestination()` — creates the master gain at the rune's current value and connects it directly to `Tone.Destination` (the OS audio output). `toDestination()` is sugar for `.connect(Tone.Destination)`.
- `new Tone.Reverb({ decay: 2, wet: this.reverbWet }).connect(this.master)` — a 2-second reverb tail, wet level read from the rune. The `.connect(this.master)` puts it upstream of the master gain.
- `new Tone.FeedbackDelay(this.delayTime, this.delayFeedback).connect(this.reverb)` — delay with internal feedback wired. Upstream of the reverb.
- `new Tone.Filter(this.filterFreq, 'lowpass').connect(this.delay)` — lowpass filter at the rune's frequency, upstream of the delay.
- The synth loop wires each per-track synth → its gain node → its pan node → the filter (which sits at the entrance to the shared effects bus).

After this runs, the graph in the diagram is alive. Hit a synth and audio flows downstream through the chain to the speakers.

### The parameter-sync effects

This is the Svelte content. Five runes need to push their current value to a live Tone parameter whenever they change. In the constructor, inside `$effect.root` (because the engine is a module singleton with no component context):

```ts
this.effectScopeDispose = $effect.root(() => {
  // ... other effects (BPM sync, auto-save) ...

  // ----- Effect parameter sync -----
  // Each effect parameter has its own $effect that rampTo's the new value
  // when the rune changes. The 0.05s ramp prevents zipper noise on drags.
  $effect(() => {
    const f = this.filterFreq;
    this.filter?.frequency.rampTo(f, 0.05);
  });
  $effect(() => {
    const t = this.delayTime;
    this.delay?.delayTime.rampTo(t, 0.05);
  });
  $effect(() => {
    const fb = this.delayFeedback;
    this.delay?.feedback.rampTo(fb, 0.05);
  });
  $effect(() => {
    const w = this.reverbWet;
    // Reverb.wet is a Signal but the type is `unknown` in some Tone
    // versions; cast through any to satisfy the compiler.
    (this.reverb?.wet as any)?.rampTo(w, 0.05);
  });
  $effect(() => {
    const v = this.masterVolume;
    this.master?.gain.rampTo(v, 0.05);
  });
});
```

Five effects, one per parameter. Each one:

1. Reads the rune into a local `const` on the first line.
2. Calls `rampTo(value, 0.05)` on the live Tone parameter via optional chaining (so it's a safe no-op if the graph hasn't been built yet).

The optional chaining matters because of the lazy-build pattern. When the page first loads, the constructor runs and registers these effects. They fire immediately. But the Tone nodes don't exist yet — `this.filter` is `null` — so `this.filter?.frequency.rampTo(f, 0.05)` short-circuits to `undefined` and does nothing. Once `ensureReady` runs and assigns the nodes, the effect fires again (because... well, it doesn't, automatically — but the next time the rune changes, the effect re-runs with the now-existing node).

Actually, wait — the initial node values come from the rune at construction time (`new Tone.Filter(this.filterFreq, ...)`), so the graph starts in sync with the runes. The effects only need to push subsequent changes. The optional chaining is purely for the "constructor ran, ensureReady hasn't" window.

### The "read state unconditionally first" pattern

Look at every effect above. The pattern is identical: the first line reads the rune into a `const`, the rest of the body uses that `const`. Not this:

```ts
// WRONG: read happens inside a conditional.
$effect(() => {
  if (this.filter) {
    this.filter.frequency.rampTo(this.filterFreq, 0.05);
  }
});
```

Why this is wrong: Svelte's dependency tracker subscribes the effect to whichever reactive values were read on the most recent run. If `this.filter` is `null` on the first run, the `if` short-circuits, the `this.filterFreq` read never happens, and the effect never subscribes to `filterFreq`. Later, when the user drags the slider and `filterFreq` changes, the effect doesn't re-fire — there's no subscription.

By reading `this.filterFreq` on the first line, unconditionally, the tracker always sees the read and always subscribes. The conditional `?.` after only affects whether the call goes through, not whether the dependency is registered.

This pattern shows up everywhere in this codebase. It's the most important reactivity rule of thumb in M7 and the one most likely to bite you if you don't internalize it.

### Common mistakes

- **"My slider drags don't change the sound."** Almost always the conditional-read bug above. Check that the rune read is the FIRST line in the effect, outside any `if`. Or: check that the `$effect.root` body is actually running — module singletons need an explicit root scope.
- **"My slider works but I hear clicks."** You used `param.value = ...` instead of `param.rampTo(value, 0.05)`. The `.value` setter sets instantly; `rampTo` schedules a smooth transition.
- **"My master volume doesn't change anything."** The master node was created before the rune existed, or the constructor's effect never wired up because it's outside `$effect.root`. Trace: `new Tone.Gain(this.masterVolume)` reads `masterVolume` once at construction; the `$effect` ramps it on subsequent changes.
- **"The audio is silent on first load until I touch a slider."** `ensureReady` didn't run, or `Tone.start()` failed. Browsers require a user gesture before any audio plays. Check that your play handler awaits `ensureReady`.
- **"My TypeScript build complains about `reverb.wet`."** Tone's types declare `wet` as `unknown` in some versions. The cast `(this.reverb?.wet as any)?.rampTo(w, 0.05)` is intentional. Don't fight it.

## Concept 3: `rampTo` and why it matters

### What `rampTo` does

`Tone.Param.rampTo(targetValue, durationSeconds)` schedules a smooth transition from the parameter's current value to `targetValue`, completing over `durationSeconds`. Internally it cancels any previously-scheduled value events for that parameter and then schedules a linear (or exponential, depending on the param) ramp to the target.

Under the hood this is `AudioParam.cancelScheduledValues(...)` plus `AudioParam.linearRampToValueAtTime(...)`. Tone wraps it in a friendlier API.

The audio thread reads the parameter at sample rate (typically 48,000 times per second). During the ramp window, it computes the interpolated value at each sample. The result: a smooth transition, audibly continuous, no discontinuities.

### Why instant changes click

A `BiquadFilter`'s frequency parameter directly controls the filter's transfer function. If you change it instantly from 8000 to 4000, every sample after the change uses the new filter coefficients. The first sample after the change is processed with one filter, the second sample with the new one — a discontinuity in the output waveform. Discontinuities sound like clicks (high-frequency content where there shouldn't be any).

For a slider dragged through many values in 100ms — say, 8000 → 7800 → 7600 → ... → 4000 in twenty steps — each step is an instant change, each step produces a tiny click. The aggregate is "zipper noise," that distinctive ZZZZ sound you hear in cheap DAWs and ungainly synthesizer plugins.

With `rampTo(v, 0.05)`, each slider step schedules a 50ms ramp. The next slider step (10ms later, mid-ramp) cancels the in-progress ramp and starts a new one to the new value. The audio thread interpolates continuously. No discontinuities, no zipper.

### Why 50ms

It's a compromise. Too short and you can still hear quantization in fast drags. Too long and the parameter feels laggy — you turn the knob, but the sound takes a perceptible moment to follow. 50ms is below human reaction-time threshold (~100ms for audio-visual sync) so it feels instant, but long enough to smear the discontinuities into smoothness.

For the master gain we use the same 50ms. For per-channel gain/pan (next lesson) we use 20ms because per-channel adjustments need to feel snappier. Both work. You can tune these.

### Tone parameters that don't have `rampTo`

A few Tone properties are plain JS properties, not `Tone.Param` instances. Examples: `Tone.Filter.type` (`'lowpass'` vs `'highpass'` etc.), `Tone.Reverb.decay`, `Tone.Distortion.distortion`. These don't have `rampTo` because changing them mid-render would require rebuilding internal DSP state, which would click anyway.

For these, you either set them at construction and don't change them at runtime, or you set them with `.dispose()` + recreate the node. Don't drag-bind a slider to one of these unless you've thought about what happens on every step.

## Concept 4: Building the UI

### The `EffectPanels` component

Three panels (FILTER, DELAY, REVERB), four sliders total. The pattern is identical for each: a `range` input two-way bound to the corresponding rune, a readout to the right of the label showing the current value.

Here's the full `src/lib/components/EffectPanels.svelte`:

```svelte
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
```

The `<fieldset>` + `<legend>` is intentional: it's a semantic grouping of related controls and screen readers announce the legend before the controls inside. The `<label for="...">` paired with each input gives every slider a programmatic label too.

`bind:value={audio.filterFreq}` is the entire interactivity story. The two-way binding writes the slider's value back to the rune on every input event. The rune is `$state`, so the write notifies subscribers. The subscriber here is the parameter-sync `$effect` in the engine, which runs and calls `rampTo` on the Tone node.

### Wiring it into the page

In whichever `+page.svelte` mounts the DAW (M6 named it `src/routes/+page.svelte`), import the component and drop it below the sequencer:

```svelte
<script lang="ts">
  import TransportBar from '$lib/components/TransportBar.svelte';
  import Sequencer from '$lib/components/Sequencer.svelte';
  import EffectPanels from '$lib/components/EffectPanels.svelte';
</script>

<TransportBar />
<Sequencer />
<EffectPanels />
```

Run `npm run dev`. Click PLAY. Drag the filter cutoff slider — the sound damps progressively as you pull it down toward 100Hz, opens back up as you push toward 20kHz. Drag delay feedback toward 0.9 — the echoes pile up; pull it back to 0 and they vanish. Crank reverb wet to 1.0 — the dry signal disappears entirely into a wash of reverb tail.

If any of those don't work, check (in this order): the parameter-sync `$effect` exists and reads the rune unconditionally; the Tone node was actually created in `ensureReady`; the `bind:value` on the slider targets the right rune.

## Concept 5: Reading values for display

### The readout pattern

Look again at the readouts inside the `.lcd` spans:

```svelte
<span class="lcd">{audio.filterFreq} Hz</span>
<span class="lcd">{audio.delayTime.toFixed(2)} s</span>
<span class="lcd">{audio.delayFeedback.toFixed(2)}</span>
<span class="lcd">{audio.reverbWet.toFixed(2)}</span>
```

Each one is a template expression reading the rune. Svelte's compiler treats this as a fine-grained subscription: only the text content inside that span re-renders when that specific rune changes. The rest of the DOM doesn't budge.

Compare against a re-render-on-state framework, where changing `filterFreq` would re-render the entire `EffectPanels` component (or, if memoized correctly, just the readout). Svelte gets the same result without you thinking about memoization, because the subscription granularity is "text node," not "component."

You can verify this in the browser's Elements panel: drag the filter slider and watch only the filterFreq readout's text node update (it'll flash briefly in dev tools). Nothing else changes.

### `toFixed` keeps the LCD stable

Without `toFixed(2)`, `delayTime` would render as `0.25`, then `0.26`, then `0.2599999999998` (because floating-point), then `0.27`. The jumping decimal width makes the readout twitch. `toFixed(2)` normalizes to two decimal places, so the readout is always exactly four characters wide and the visual is steady.

This is a small touch but it's the difference between a slider that feels "professional" and one that feels "JavaScript." Real DAW UIs spend a lot of time on these microaesthetics.

## Putting it together

A reactive round-trip, in order:

1. User drags the filter cutoff slider from 8000 to 4000.
2. Each input event fires `bind:value` writes to `audio.filterFreq`. Maybe 30 writes over the half-second drag.
3. Each write triggers Svelte's reactivity. Two subscribers run: the readout text node (`{audio.filterFreq} Hz`) and the parameter-sync `$effect`.
4. The readout updates to the new value: `7800 Hz`, then `7600 Hz`, etc.
5. The `$effect` calls `this.filter.frequency.rampTo(4000, 0.05)` — actually `rampTo(7800, 0.05)`, then `rampTo(7600, 0.05)`, etc. Each call cancels the previous ramp and starts a new one.
6. The audio thread interpolates continuously. The user hears the filter sweep smoothly down.

Nothing in this chain is bespoke to filters or audio. The same pattern works for any UI control that needs to update any continuous parameter in real time: 3D camera angles, animation speeds, simulation parameters. The Svelte side is `<input bind:value={runeName}>` plus `$effect(() => { const v = runeName; targetSystem.setParam(v); })`.

## Exercises

### Exercise 1: Add a `Tone.Distortion` to the chain

**Setup:** The engine has filter/delay/reverb. The `EffectPanels` component has three panels.

**What to do:** Add a `Tone.Distortion` node between the filter and the delay. Add a `distortionAmount = $state(0)` rune on the engine (range 0..1). Wire a `$effect` that pushes `distortionAmount` to the distortion node's `.distortion` property — note: this is a plain property, not a `Tone.Param`, so you set it directly (`this.distortion.distortion = a`) instead of using `rampTo`. Add a fourth panel to `EffectPanels.svelte` with a slider bound to `audio.distortionAmount` (min 0, max 1, step 0.01).

**Verify by:** With distortion at 0, the sound is clean. With distortion at 0.6, the kick has audible grit. The slider doesn't click when dragged (because the parameter is updated infrequently — and even when it does click, it's an artifact of the distortion node's algorithm, not zipper noise).

**Stretch:** Add an `oversample` option (`'none'`, `'2x'`, `'4x'`) as a dropdown. `Tone.Distortion` accepts an `oversample` property at construction. Toggling it at runtime requires rebuilding the node — use a `.dispose()` + `new Tone.Distortion(...)` + reconnect pattern inside the `$effect`.

<details>
<summary>Show solution</summary>

In the engine:

```ts
// alongside other effect runes
distortionAmount = $state(0);

private distortion: Tone.Distortion | null = null;

// in ensureReady, after creating the reverb:
this.distortion = new Tone.Distortion(this.distortionAmount).connect(this.delay);
// and rewire the filter to feed the distortion instead of the delay:
this.filter = new Tone.Filter(this.filterFreq, 'lowpass').connect(this.distortion);

// in the constructor's $effect.root, add:
$effect(() => {
  const a = this.distortionAmount;
  if (this.distortion) this.distortion.distortion = a;
});
```

In `EffectPanels.svelte`, add a fourth panel:

```svelte
<fieldset class="panel">
  <legend>DRIVE</legend>
  <div class="knob">
    <div class="knob-head">
      <label for="dist-amt">amount</label>
      <span class="lcd">{audio.distortionAmount.toFixed(2)}</span>
    </div>
    <input
      id="dist-amt"
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value={audio.distortionAmount}
    />
  </div>
</fieldset>
```

Why this works: distortion is a non-linear waveshaper, so `rampTo` isn't useful (the parameter doesn't smoothly interpolate audio characteristics anyway). Direct assignment is fine. The graph rewiring is the only fiddly bit — make sure filter feeds distortion and distortion feeds delay.

</details>

### Exercise 2: Demonstrate the unconditional-read rule

**Setup:** A working effect chain.

**What to do:** Temporarily change one of the parameter-sync effects to put the rune read INSIDE the optional-chain call:

```ts
// BROKEN ON PURPOSE
$effect(() => {
  this.filter?.frequency.rampTo(this.filterFreq, 0.05);
});
```

Reload the page. Drag the filter slider.

**Verify by:** The slider's value visibly changes in the LCD readout, but the audio doesn't respond. The filter stays at its initial 8000 Hz no matter where you drag the slider.

**Then:** Move the read back to the first line:

```ts
$effect(() => {
  const f = this.filterFreq;
  this.filter?.frequency.rampTo(f, 0.05);
});
```

Reload. The slider works again.

**Why:** With the broken version, on the effect's first run, `this.filter` is `null` (the `ensureReady` hasn't been called yet because no user gesture). The `?.` short-circuits, so `this.filterFreq` is never read, and the effect never subscribes. When the user later changes `filterFreq`, no notification reaches this effect. With the fixed version, `const f = this.filterFreq` reads the rune unconditionally on the first run, registering the subscription. The optional chain only affects whether the call goes through, not whether the dep is registered.

<details>
<summary>Show solution</summary>

The "broken" version is in the exercise prompt above. The "fixed" version (and the correct version that ships in the reference) is also above. The point of the exercise isn't writing new code — it's seeing the bug live and remembering the rule.

If you got curious about Svelte's tracker internals: every rune read inside an effect's body is recorded in a per-effect dependency set. The effect's subscription list is the union of those reads on the most recent run. Reads that didn't happen on the last run aren't subscribed. So a conditional read is a conditional subscription.

</details>

### Exercise 3: Replace one slider with a `bind:` to a `derived` value

**Setup:** The wet/dry of the reverb is bound to `audio.reverbWet`.

**What to do:** Add a derived rune on the engine — `roomSize = $state(0.5)` — representing a "room size" knob from 0 (closet) to 1 (cathedral). Add a `$derived` that maps room size to two values: `reverbDecay` (1s at 0, 8s at 1) and `reverbWet` (0.05 at 0, 0.6 at 1). Actually, you can't `$derived` into existing runes — instead, replace the `reverbWet` rune with a `$derived` that reads `roomSize`, and add a `roomSize` rune. Wire a `$effect` that updates `reverb.decay` from the derived decay value. Add a single slider in the UI bound to `audio.roomSize`.

**Verify by:** The single "room" slider now controls both wet and decay together. At low values you get a tight, dry reverb; at high values you get a long, drenched tail.

**Stretch:** Replace the entire FILTER+DELAY+REVERB UI with three "macro knobs" — `brightness` (controls filter cutoff), `space` (controls delay time + reverb wet together), `attack` (controls something else interesting). This is how some commercial synths organize their UIs.

<details>
<summary>Show solution</summary>

The trick is realizing that `$derived` can't replace a rune that needs to be written by a slider's `bind:value`. So `reverbWet` becomes a derived, and `roomSize` is the new written rune.

In the engine:

```ts
roomSize = $state(0.5);
reverbWet = $derived(0.05 + this.roomSize * 0.55);
private reverbDecay = $derived(1 + this.roomSize * 7);

// in ensureReady, the reverb still reads reverbWet at construction:
this.reverb = new Tone.Reverb({ decay: this.reverbDecay, wet: this.reverbWet }).connect(this.master);

// in $effect.root:
$effect(() => {
  const w = this.reverbWet;
  (this.reverb?.wet as any)?.rampTo(w, 0.05);
});
$effect(() => {
  const d = this.reverbDecay;
  if (this.reverb) this.reverb.decay = d;
  // Note: changing reverb.decay rebuilds the impulse response, which is
  // expensive. In a real DAW you'd debounce this.
});
```

In `EffectPanels.svelte`, swap the wet slider for:

```svelte
<input
  id="room-size"
  type="range"
  min="0"
  max="1"
  step="0.01"
  bind:value={audio.roomSize}
/>
```

Why this works: `$derived` produces a read-only reactive value. The slider writes to `roomSize`; the derivations cascade; the effects sync the live nodes. The `bind:value` chain is unchanged because the slider doesn't bind to a derived — it binds to the underlying `roomSize`.

</details>

### Exercise 4: Add an effects on/off toggle

**Setup:** All effects are always active.

**What to do:** Add a `effectsEnabled = $state(true)` rune. When false, route the synths' output past the filter/delay/reverb directly to the master. When true, route through the chain as currently. Add a button to the page that toggles `effectsEnabled`. The button shows a green dot when on, gray when off.

**Verify by:** Clicking the button while playing causes the sound to switch between processed (with filter/delay/reverb) and dry (clean synths only). No clicks at the transition.

**Why this is harder than it sounds:** You can't just disconnect and reconnect nodes mid-playback without clicks. The standard pattern is a "wet/dry mixer" — keep both signal paths always alive, crossfade between them with a `Tone.CrossFade` node controlled by the rune. Look up `Tone.CrossFade` for the implementation.

<details>
<summary>Show solution</summary>

Skeleton:

```ts
private dryBus: Tone.Gain | null = null;
private crossfade: Tone.CrossFade | null = null;
effectsEnabled = $state(true);

// in ensureReady:
this.crossfade = new Tone.CrossFade(this.effectsEnabled ? 1 : 0).connect(this.master);
this.reverb = new Tone.Reverb(...).connect(this.crossfade.b);  // wet
this.dryBus = new Tone.Gain(1).connect(this.crossfade.a);       // dry
// each synth feeds both the dry bus AND the filter (which is upstream of reverb):
for (const t of TRACKS) {
  this.synths[t.id].connect(this.dryBus);
  this.synths[t.id].connect(this.gainNodes[t.id]);
  // ... existing per-channel chain into filter
}

// in $effect.root:
$effect(() => {
  const enabled = this.effectsEnabled;
  this.crossfade?.fade.rampTo(enabled ? 1 : 0, 0.1);
});
```

Why crossfade: a Tone.CrossFade has two inputs (`.a` and `.b`) and one output, with a `.fade` parameter (0..1) controlling which input dominates. Ramping the fade gives a smooth A/B transition.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + filter, delay, reverb in the engine's effect chain
- + src/lib/components/EffectPanels.svelte

### Verify it works

- Three effect panels (FILTER, DELAY, REVERB) appear below the grid
- Dragging the filter cutoff slider damps high frequencies in real time
- Increasing delay feedback creates audible echoes
- Increasing reverb wet makes the sound feel bigger
- No clicks or zipper noise during rapid slider drags (the ramping is working)

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/components/EffectPanels.svelte and the effect-chain setup in engine.svelte.ts

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why is `$effect.root` necessary? Can't I just put `$effect` directly in the class?**
A: `$effect` requires a component context (a `.svelte` file's render-time scope) OR an explicit `$effect.root()` to anchor its lifecycle. The `AudioEngine` is a module singleton — it's instantiated by `export const audio = new AudioEngine()` at module load, with no component around it. Without `$effect.root`, the call would throw "$effect can only be used inside an effect context." The root scope gives the effect a place to live for the engine's entire lifetime (the lifetime of the page).

**Q: Why is the analyser tap a parallel connection instead of in series?**
A: `Tone.Analyser` reads its input and computes FFT data; it doesn't pass audio through. Or rather, it has an output that you could connect, but connecting it serially would mean the audio you hear goes through the analyser's processing pipeline, which adds latency. Connecting it as a parallel branch (the analyser receives a copy of the master's output, but isn't in the audible signal path) is the standard "tap" pattern. You'll see this come back in Lesson 3 when we wire the visualizer.

**Q: Why `rampTo(value, 0.05)` instead of `setValueAtTime(value, Tone.now())`?**
A: `setValueAtTime` instantly sets the value at the given time — same as direct assignment, with the same clicking problem. `rampTo` schedules a smooth transition. They're different primitives for different needs. `setValueAtTime` is right when you want a hard step (e.g., synth envelope attack at note-on); `rampTo` is right when you want smooth continuous control (sliders).

**Q: What does `Tone.start()` actually do?**
A: It calls `AudioContext.resume()` on the underlying Web Audio context. Browsers create audio contexts in a "suspended" state and require a user gesture (click, touch, keypress) to resume them. `Tone.start()` wraps the resume call and resolves a promise when the context is running. Until you call it, no Tone node produces sound. The DAW calls it inside `ensureReady`, which is invoked from the play button's onclick — the click satisfies the user-gesture requirement.

**Q: Can I have effects per track instead of a shared global chain?**
A: Yes. The wiring changes: each track's synth gets its own filter/delay/reverb chain that feeds the master, instead of all synths feeding a shared chain. The UI gets more complex — a per-track effects panel inside each mixer strip, or a tabbed view. For a learning DAW it's overkill; for a production tool it's the norm. The Svelte side doesn't change much — each effect parameter becomes a per-track rune, and each `$effect` is created inside a `for (const t of TRACKS)` loop instead of once.

## What's next

The mixer. Per-channel gain, pan, mute, solo — sixteen reactive cells that each update independently, and the cleanest demonstration of Svelte's per-cell reactivity in the whole DAW. The pattern from this lesson (one `$effect` per parameter, unconditional read, `rampTo` for smoothness) reappears scaled up: eight effects, one per channel, one per concern.

<SourcesSection lessonKey="07-capstone-polish/01-effects" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
