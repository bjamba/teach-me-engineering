<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Mixer · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-7);">

<LessonHeader
  moduleSlug="07-capstone-polish"
  lessonSlug="02-mixer"
  title="Per-Channel Mixer with Mute and Solo"
  blurb="Per-track gain, pan, mute, solo. Where per-cell reactivity actually pays off — 16 reactive cells, no full re-renders."
/>

## Why this lesson exists

The effects chain from Lesson 1 affects every track equally. That's fine for a global "make it sound bigger" knob, but it's not how anyone actually mixes drums. The kick wants to sit dead center, loud. The snare wants to be slightly right and slightly quieter. The hat wants to pan left to leave room for the snare. The perc wants to ride at the back, panned hard right, and sometimes you want to solo it for a moment to hear what it's doing — silencing everything else without losing the mute states you already set.

This lesson adds the mixer that makes all of that possible. Per-channel gain, per-channel pan, per-channel mute, per-channel solo, with the standard "if anything is soloed, only soloed channels are audible" logic. The Svelte content is the most interesting part of the lesson: sixteen reactive cells (four channels × four properties: gain, pan, muted, solo), each updating independently, each pushing exactly one Tone parameter change when it changes. No full re-renders, no manual subscriptions, no diffing. The pattern scales: a real DAW with 64 channels and 8 properties per channel would have 512 reactive cells with the exact same architecture.

## Learning objectives

By the end of this lesson you'll be able to:

- Design a per-channel reactive state shape (`Record<trackId, Channel>`) where each channel is independently observable.
- Wire a per-channel Tone.js audio routing (synth → gain → pan → effects bus).
- Implement industry-standard solo logic: "if anySolo, only soloed channels audible; otherwise, mute state governs."
- Write one `$effect` per channel-concern (gain+mute+solo combined into one, pan in another) inside a `for` loop, and explain why the gain effect re-fires for all channels when any one channel's solo changes.
- Build a vertical-fader UI with `appearance: slider-vertical` plus the writing-mode fallback for Firefox.
- Explain how mutating a nested property (`audio.channels.kick.gain = 0.5`) propagates through Svelte's deep proxy to trigger the right effect.

## Concept 1: Per-channel state shape

### The `Channel` type and the record

The mixer needs four independent things per track: a gain (volume), a pan (stereo position), a muted boolean, a solo boolean. Each track's state is a small object:

```ts
type Channel = {
  id: string;
  gain: number; // 0..1
  pan: number; // -1..1
  muted: boolean;
  solo: boolean;
};
```

Four channels, indexed by track id (`'kick'`, `'snare'`, `'hat'`, `'perc'`), in a single rune:

```ts
channels = $state<Record<string, Channel>>({
  kick:  { id: 'kick',  gain: 0.9, pan: 0,    muted: false, solo: false },
  snare: { id: 'snare', gain: 0.8, pan: 0.1,  muted: false, solo: false },
  hat:   { id: 'hat',   gain: 0.6, pan: -0.3, muted: false, solo: false },
  perc:  { id: 'perc',  gain: 0.7, pan: 0.4,  muted: false, solo: false }
});
```

The defaults are a sensible starting mix: kick loudest and centered, snare slightly right and slightly quieter, hat panned left to leave room for the snare, perc panned right.

### Why a record-of-objects, not parallel arrays

A few alternative shapes you might reach for:

```ts
// Parallel arrays
gains = $state([0.9, 0.8, 0.6, 0.7]);
pans = $state([0, 0.1, -0.3, 0.4]);
mutes = $state([false, false, false, false]);
solos = $state([false, false, false, false]);
```

```ts
// Flat record per property
channelGain = $state<Record<string, number>>({ kick: 0.9, snare: 0.8, ... });
channelPan = $state<Record<string, number>>({ kick: 0, snare: 0.1, ... });
// ... etc
```

```ts
// Record of objects (what we chose)
channels = $state<Record<string, Channel>>({ ... });
```

The record-of-objects wins for a few reasons:

1. **Cohesion.** All of one channel's state is in one place. Adding a new per-channel property (say, `eqHigh`) is one type change and one object update, not four.
2. **Iteration.** `Object.values(this.channels).some(c => c.solo)` is clean. Parallel arrays would force `this.solos.some(s => s)` plus separate iteration when you needed a different property — and you'd have to remember the array index ordering.
3. **Reactivity granularity.** Svelte's deep proxy makes `audio.channels.kick.gain` an observable subscription target. Writing `audio.channels.kick.gain = 0.5` notifies subscribers that read THAT specific path. Subscribers that read `audio.channels.snare.gain` don't fire. We get sixteen independent reactive cells from a single `$state` declaration.

That last point is the interesting one. Svelte 5's `$state` proxies are deep — every nested property of a `$state` record is independently observable. You don't have to declare each cell as its own rune.

### Mute/solo as toggle methods

The engine exposes two helper methods alongside the state:

```ts
toggleMute(trackId: string) {
  const ch = this.channels[trackId];
  if (!ch) return;
  ch.muted = !ch.muted;
}

toggleSolo(trackId: string) {
  const ch = this.channels[trackId];
  if (!ch) return;
  ch.solo = !ch.solo;
}
```

These exist for callers that want the engine as a clean API. The mixer component bypasses them and mutates `ch.muted` directly via the button's onclick — both styles work. The direct mutation is fine because the proxy catches the write and triggers the right effects either way.

## Concept 2: The per-channel audio routing

### The graph after this lesson

Before this lesson, all four synths fan into the shared filter. After this lesson, each synth gets its own gain node and panner before the filter:

```
[kick synth]  → [kick gain]  → [kick pan]  ─┐
[snare synth] → [snare gain] → [snare pan] ─┤
[hat synth]   → [hat gain]   → [hat pan]   ─┼─→ [filter] → [delay] → [reverb] → [master] → [destination]
[perc synth]  → [perc gain]  → [perc pan]  ─┘
```

Two new nodes per track — `Tone.Gain` for the volume, `Tone.Panner` for the stereo position — sitting between the synth and the shared effects bus. The effect chain from Lesson 1 is unchanged downstream.

Why gain and pan are per-track but the effects are shared: per-channel effects would be much more flexible (a real DAW has per-channel effect inserts) but they cost more — four times the filter, delay, and reverb nodes, four times the CPU. For a learning DAW the shared chain plus per-channel gain/pan/mute/solo gives 80% of the expressive power for 20% of the complexity.

### The `ensureReady` additions

The non-reactive plumbing for per-channel nodes — alongside the existing private fields:

```ts
private gainNodes: Record<string, Tone.Gain> = {};
private panNodes: Record<string, Tone.Panner> = {};
```

In `ensureReady`, the synth loop now wires three nodes per track:

```ts
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
```

Three connects per track. The `Tone.Gain(ch.gain)` constructor reads the channel's initial gain; subsequent changes come through the `$effect` we add next. Same for `Tone.Panner(ch.pan)`.

The order — gain before pan — matters subtly. Putting gain first means muting (gain → 0) silences the channel before the panner does its stereo math, which is microscopically more efficient and means a hard mute always produces silence regardless of pan state. Pan before gain would also work but feels semantically backwards: you're "panning, then turning down."

## Concept 3: The per-channel sync effects

### One effect per concern, in a loop

Two effects per channel, created in the constructor's `$effect.root` inside a `for (const t of TRACKS)` loop:

```ts
// ----- Per-channel mixer sync -----
// One effect per channel concern. The gain effect combines gain + mute
// + the global "any solo" derived value, so changing solo on one channel
// re-runs the gain effects for ALL channels (which is what we want).
for (const t of TRACKS) {
  const id = t.id;

  $effect(() => {
    const ch = this.channels[id];
    const g = ch.gain;
    const m = ch.muted;
    // anySolo derived from all channels — touch each .solo so the
    // tracker subscribes to all of them.
    let anySolo = false;
    for (const c of Object.values(this.channels)) {
      if (c.solo) anySolo = true;
    }
    const audible = !m && (!anySolo || ch.solo);
    this.gainNodes[id]?.gain.rampTo(audible ? g : 0, 0.02);
  });

  $effect(() => {
    const p = this.channels[id].pan;
    this.panNodes[id]?.pan.rampTo(p, 0.02);
  });
}
```

Eight effects total (four channels × two effects each). Each one reads its dependencies on the first lines, then calls `rampTo` on the corresponding Tone parameter with the new value.

A few things to notice:

**The `id = t.id` capture.** Inside the loop body, `const id = t.id` captures the track id into a local variable so the closure inside `$effect` refers to a stable value. Without it, you'd write `t.id` inside the effect, and that's fine in this loop (`t` is the `const` from `for (const t of TRACKS)`, so it's per-iteration) — but the explicit capture makes the intent obvious and protects against the kind of refactor where someone changes `const` to `let` and breaks every effect simultaneously.

**The ramp duration is 20ms, not 50ms.** Gain and pan changes feel "snappier" than effect-chain changes, and the human ear is more tolerant of fast gain transitions (we hear them as natural attack/decay envelope). 20ms is below the click threshold but quick enough that mute toggles feel instant.

**Optional chaining on `this.gainNodes[id]?`.** Same lazy-build reason as the effect-chain effects: the engine's constructor runs (registering these effects) before `ensureReady` has built the nodes. The `?` keeps the early no-op safe.

### The solo logic, in detail

The interesting line:

```ts
const audible = !m && (!anySolo || ch.solo);
```

In English: "the channel is audible if it isn't muted AND (no channel is soloed OR this channel is soloed)." Equivalently: muting always silences; soloing on any channel silences every non-soloed channel.

The standard DAW solo behavior. If you click S on the kick, you hear only the kick. Click S on the snare too, you hear kick and snare. Click S off on the kick, you hear only the snare. Click S off on the snare, you hear everything that isn't muted again.

The implementation reads every channel's `.solo` property in the `Object.values(...)` loop. This isn't an accident — it's the correct dependency-tracking behavior for "anySolo" derived state. By touching every `c.solo`, the effect subscribes to all of them. When ANY channel's solo state changes, every channel's gain effect re-fires and recomputes `audible`. That's what we want: soloing the kick should re-evaluate audibility for the snare, hat, and perc too (they should all go silent).

### Why one combined effect, not three separate ones

You could split the gain effect into three: one for gain, one for mute, one for solo. Each one reads only its own dependencies and calls `rampTo`. But then you'd have a coordination problem: if a gain change and a mute change happen on the same microtask, the order of effect execution determines the final ramp target, and you can race.

By combining all three deps in one effect, the computation is atomic per channel: the effect reads all relevant state, computes `audible`, calls `rampTo` once. The next change to any of those deps re-runs the entire computation. There's no "stale gain" or "stale mute" window.

This is the pattern: when several reactive inputs determine one reactive output, write one effect that reads all the inputs and updates the output. Don't split unless the inputs naturally live in unrelated subsystems.

### Common mistakes

- **"Solo doesn't silence other channels."** You wrote `anySolo` as a `$derived` that's computed once and captured, instead of recomputing inside each gain effect. The fix is the explicit `Object.values(this.channels).some(c => c.solo)` pattern — every channel's gain effect needs to read every channel's solo property to subscribe.
- **"Muting one channel mutes them all."** You captured the wrong `t` or `id` inside the loop. Check that `const id = t.id` is the line inside the loop body and that the effect closes over `id`, not over a shared variable.
- **"The ramp to 0 produces a click."** 20ms is too short for some browser/OS combos when going from full gain to silence. Bump to 30 or 40ms if you hear clicks. Or: never set gain.value to 0; ramp to a very small positive value (0.0001) which is silent enough for practical purposes and avoids edge-case clicks in some Web Audio implementations.
- **"Dragging the pan slider doesn't change the stereo position."** Likely the conditional-read bug from Lesson 1 — make sure the first line of the pan effect reads the rune unconditionally.
- **"Audio keeps playing when I mute."** The synth still triggers (we don't skip `t.trigger()` in the sequence callback); the gain node is what silences it. Check that `gainNodes[id]` actually got created in the `ensureReady` loop and that the `$effect` is firing.

## Concept 4: The `Mixer` component

### Structure: per-channel strips plus a master strip

The component is one outer container with five children: four per-track strips and one master strip. Each per-track strip has the same shape — name label, vertical fader, pan slider, mute and solo buttons. The master strip is similar but with only a fader and a name (no pan, no mute, no solo).

Here's the full `src/lib/components/Mixer.svelte`:

```svelte
<!--
  Per-channel mixer: gain (vertical fader), pan, mute, solo per track. Plus
  a master volume fader on the right.

  All sliders are two-way bound to the engine's channels state; the engine has
  one $effect per channel-concern that rampTo's the live Tone.js gain/pan node
  with the combined mute+solo logic.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';
</script>

<div class="mixer">
  <h3>MIXER</h3>
  <div class="channels">
    {#each TRACKS as t (t.id)}
      {@const ch = audio.channels[t.id]}
      <div class="channel" style="--c-track: {t.color}">
        <span class="name">{t.name}</span>

        <div class="fader-wrap">
          <input
            type="range"
            class="fader"
            min="0"
            max="1"
            step="0.01"
            bind:value={ch.gain}
            aria-label="{t.name} gain"
            style="--fader-pct: {Math.round(ch.gain * 100)}%"
          />
          <span class="fader-num lcd">{Math.round(ch.gain * 100)}</span>
        </div>

        <div class="pan">
          <label class="pan-label" for="pan-{t.id}">PAN</label>
          <input
            id="pan-{t.id}"
            type="range"
            class="pan-slider"
            min="-1"
            max="1"
            step="0.01"
            bind:value={ch.pan}
            aria-label="{t.name} pan"
          />
        </div>

        <div class="buttons">
          <button
            type="button"
            class="ms"
            class:active={ch.muted}
            onclick={() => (ch.muted = !ch.muted)}
            aria-label="Mute {t.name}"
          >M</button>
          <button
            type="button"
            class="ms solo"
            class:active={ch.solo}
            onclick={() => (ch.solo = !ch.solo)}
            aria-label="Solo {t.name}"
          >S</button>
        </div>
      </div>
    {/each}

    <div class="channel master">
      <span class="name">MAST</span>
      <div class="fader-wrap">
        <input
          type="range"
          class="fader master-fader"
          min="0"
          max="1"
          step="0.01"
          bind:value={audio.masterVolume}
          aria-label="Master volume"
        />
        <span class="fader-num lcd">{Math.round(audio.masterVolume * 100)}</span>
      </div>
      <div class="pan-spacer"></div>
      <div class="buttons-spacer"></div>
    </div>
  </div>
</div>
```

Walking through the per-channel block:

- `{@const ch = audio.channels[t.id]}` — local alias for the channel object, so subsequent `bind:value={ch.gain}` reads cleanly. The proxy still tracks the access through `ch`, so reactivity isn't lost. This is purely for code clarity.
- `bind:value={ch.gain}` — two-way binding to the channel's gain. Writes back to the proxy on each input event, triggering the gain `$effect`.
- `style="--fader-pct: &lbrace;Math.round(ch.gain * 100)&rbrace;%"` — a CSS custom property in case you want a fill style on the fader track (not heavily used in the reference, but available for visual customization).
- `<input id="pan-&lbrace;t.id&rbrace;" ...>` paired with `<label for="pan-&lbrace;t.id&rbrace;">` — programmatic label association. Important for screen readers.
- `class:active=&lbrace;ch.muted&rbrace;` — Svelte's class directive. Adds the `active` class to the button when `ch.muted` is true. Reactive: the class toggles instantly as the rune changes.
- `onclick=&lbrace;() => (ch.muted = !ch.muted)&rbrace;` — direct mutation of the rune. The parens around `ch.muted = !ch.muted` are required because arrow-function-with-expression-body without parens is ambiguous when the expression starts with `&lbrace;`. With parens it's clearly an assignment expression.

The master strip is structurally similar but bound to `audio.masterVolume` (a flat rune on the engine, not nested in `channels`). The two empty `<div class="pan-spacer">` and `<div class="buttons-spacer">` are visual placeholders that keep the master strip the same height as the channel strips so the row is aligned.

### Styles

The full style block, with vertical-fader handling that works across browsers:

```svelte
<style>
  .mixer {
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
    padding: var(--sp-3) var(--sp-4);
  }
  h3 {
    margin: 0 0 var(--sp-2);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    color: var(--c-track-4);
  }
  .channels {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--sp-2);
  }
  @media (max-width: 720px) {
    .channels { grid-template-columns: repeat(5, minmax(72px, 1fr)); overflow-x: auto; }
  }
  .channel {
    --c-track: #888;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .channel.master { --c-track: var(--c-text-muted); }
  .name {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--c-track);
    letter-spacing: 0.1em;
    font-weight: 700;
  }

  .fader-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  /* Vertical fader. Browser support for slider-vertical varies — we use
     -webkit-appearance for Chrome/Safari + writing-mode for the fallback
     so it stays vertical on Firefox too. */
  .fader {
    appearance: slider-vertical;
    -webkit-appearance: slider-vertical;
    writing-mode: vertical-lr;
    direction: rtl;
    width: 24px;
    height: 100px;
    accent-color: var(--c-track);
  }
  .master-fader { accent-color: var(--c-accent); }
  .fader-num {
    font-size: 0.7rem;
    color: var(--c-track);
    font-feature-settings: 'tnum';
    min-width: 26px;
    text-align: center;
  }

  .pan { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .pan-label {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--c-text-faint);
    letter-spacing: 0.08em;
  }
  .pan-slider {
    width: 100%;
    accent-color: var(--c-track);
  }
  .pan-spacer { height: 18px; width: 100%; }

  .buttons { display: flex; gap: 4px; }
  .buttons-spacer { height: 24px; }
  .ms {
    background: transparent;
    color: var(--c-text-faint);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    padding: 3px 9px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    cursor: pointer;
  }
  .ms:hover { border-color: var(--c-border-strong); color: var(--c-text); }
  .ms.active {
    background: var(--c-error);
    color: white;
    border-color: var(--c-error);
  }
  .ms.solo.active {
    background: var(--c-warning);
    color: black;
    border-color: var(--c-warning);
  }
</style>
```

### Vertical faders are hard

The fader CSS is worth a closer look. Native HTML `<input type="range">` is horizontal by default. Making it vertical isn't standardized; each browser engine handles it differently:

- **Chrome / Safari (WebKit, Blink):** `-webkit-appearance: slider-vertical` flips the slider. This is the cleanest approach but doesn't work in Firefox.
- **Firefox:** uses CSS `writing-mode: vertical-lr` plus `direction: rtl` to flip the slider visually. Firefox honors the standard `appearance: slider-vertical` value too (recent versions), so we set both.

The combination — both the WebKit-specific value AND the writing-mode hack — gets a working vertical fader in all current browsers. The `direction: rtl` flips the orientation so 0 is at the bottom and 1 is at the top (matching real-world fader conventions; without `rtl`, vertical sliders default to "high value at top" only on some engines).

This is the kind of multi-browser CSS that you don't need to memorize. You write it once, test in three browsers, and copy the working version going forward. Or you avoid the problem entirely by using a custom-built fader with a `<div>` and pointer events — which is what some component libraries do, at the cost of reimplementing keyboard navigation, accessibility, etc.

### Wiring it into the page

In the page that mounts the DAW:

```svelte
<TransportBar />
<Sequencer />
<EffectPanels />
<Mixer />
```

Press PLAY. Drag the kick's fader — the kick gets quieter without affecting other tracks. Drag the snare's pan slider to the right — the snare moves audibly right in your headphones. Click M on the hat — the hat goes silent. Click S on the perc — every track except perc goes silent. Click S on the kick too — now kick and perc are both audible.

## Concept 5: What the reactivity actually looks like

### One drag, one effect run, one Tone call

Drag the kick fader from 0.9 to 0.5. Maybe 30 input events fire over half a second. For each event:

1. `bind:value={ch.gain}` writes `ch.gain = 0.71` (or whatever interpolated value).
2. The write goes through the proxy. The proxy notifies subscribers of `audio.channels.kick.gain`.
3. The subscribers are: the text node `{Math.round(ch.gain * 100)}` (the readout) and the kick's gain `$effect`.
4. The text node re-renders to `71`. Nothing else in the DOM changes.
5. The gain `$effect` re-runs. It reads `ch.gain` (0.71), `ch.muted` (false), iterates through all channels' `.solo` (all false), computes `audible = true`, calls `gainNodes.kick.gain.rampTo(0.71, 0.02)`.
6. The Tone node receives the ramp. The audio thread interpolates from the previous gain to 0.71 over 20ms.

Notice what didn't happen: the snare's gain effect didn't run. The hat's pan effect didn't run. The perc's mute button didn't re-render. The sequencer didn't re-render. The FFT visualizer (next lesson) didn't re-render. The cost of the drag is exactly one effect run per input event, on one channel.

Compare against a re-render-on-state-change framework: dragging the kick fader would likely re-render the entire `Mixer` component (the parent owns the `channels` state, the child strips destructure it, a state change re-renders the parent which re-renders all children). React's `useMemo` and `React.memo` can prevent this but require deliberate work and discipline. In Svelte you get the granularity for free because the subscription target is the property path, not the component.

### Toggling solo: the multi-effect cascade

Click S on the kick. Here's what happens:

1. The button onclick runs `ch.solo = !ch.solo`, writing `audio.channels.kick.solo = true`.
2. The proxy notifies subscribers of `audio.channels.kick.solo`.
3. Subscribers: the kick's solo button's `class:active=&lbrace;ch.solo&rbrace;` (re-renders the button), AND every channel's gain `$effect` (because every gain effect reads every channel's solo in the `Object.values` loop).
4. Four gain effects re-run. Each one recomputes `audible`. The kick's `audible` is true (it's soloed). The snare/hat/perc's `audible` is false (anySolo is true, but they aren't soloed).
5. Each gain effect calls `gainNodes[id].gain.rampTo(audible ? g : 0, 0.02)`. Three channels ramp to 0. One channel stays at its current gain.
6. Three channels audibly fade to silence over 20ms.

Four effects ran, four Tone calls. That's the cost. In exchange, the user got the correct solo behavior with no manual coordination.

### Why this scales

Imagine 64 channels with eight properties each (gain, pan, mute, solo, EQ low/mid/high, send level). 512 reactive cells. Each cell is independently observable. Dragging one fader still costs one effect run + one Tone call (plus whichever cascading effects depend on that property — solo cascades, send doesn't). The architecture doesn't change at all between a 4-channel mixer and a 64-channel mixer — the for-loop in the constructor just iterates 64 times instead of 4, and the UI's `{#each}` block iterates 64 times instead of 4.

This is the case for fine-grained reactivity. For data shapes with lots of small, independent observable cells, the framework's overhead is proportional to changes, not to total cells. A 64-channel mixer where you change one slider has the same cost as a 4-channel mixer where you change one slider.

## Putting it together

The mixer + the effects + the existing M6 transport gives you a full virtual drum machine console. You can mix tracks against each other (gains, pans). You can isolate elements (solo). You can audition without certain elements (mute). You can shape the overall sound (filter, delay, reverb). You can adjust the global level (master).

Every interaction routes through the same architecture: a UI element with `bind:value` (or an onclick that mutates state), a rune that the proxy observes, an `$effect` in the engine that reads the rune and pushes the change to a Tone parameter via `rampTo`. The pattern is repeated nine times in this lesson's engine code (four gain effects, four pan effects, one master volume effect from Lesson 1). Adding a tenth would be more of the same.

## Exercises

### Exercise 1: Add a stereo width control to the master

**Setup:** The master gain ramps based on `audio.masterVolume`.

**What to do:** Add a `Tone.StereoWidener` node between the reverb and the master gain. Add a `stereoWidth = $state(1)` rune (range 0..2; 1 = unchanged, 0 = mono, 2 = exaggerated stereo). Wire a `$effect` that ramps the widener's `.width.rampTo(value, 0.05)`. Add a slider to the master strip in the mixer (you'll need to add a row above the master fader, or modify the master strip's structure).

**Verify by:** With width at 0, all panning is collapsed to mono — the snare moves to center even though its pan is set to 0.1. With width at 2, the existing pans are exaggerated. With width at 1, behavior is unchanged.

**Stretch:** Add a "MONO" button on the master strip that toggles between width=1 and width=0. Visually highlight the button when in mono mode.

<details>
<summary>Show solution</summary>

In the engine:

```ts
stereoWidth = $state(1);
private widener: Tone.StereoWidener | null = null;

// in ensureReady, modify the chain so reverb feeds widener feeds master:
this.widener = new Tone.StereoWidener(this.stereoWidth).connect(this.master);
this.reverb = new Tone.Reverb({ decay: 2, wet: this.reverbWet }).connect(this.widener);
// ... rest unchanged

// in $effect.root:
$effect(() => {
  const w = this.stereoWidth;
  this.widener?.width.rampTo(w, 0.05);
});
```

In `Mixer.svelte`, modify the master strip:

```svelte
<div class="channel master">
  <span class="name">MAST</span>
  <div class="fader-wrap">
    <input type="range" class="fader master-fader"
      min="0" max="1" step="0.01"
      bind:value={audio.masterVolume} aria-label="Master volume" />
    <span class="fader-num lcd">{Math.round(audio.masterVolume * 100)}</span>
  </div>
  <div class="pan">
    <label class="pan-label" for="stereo-width">WIDTH</label>
    <input id="stereo-width" type="range" class="pan-slider"
      min="0" max="2" step="0.01" bind:value={audio.stereoWidth} />
  </div>
  <div class="buttons-spacer"></div>
</div>
```

Why this works: `Tone.StereoWidener` is a standard width effect. The graph reroute puts it just before the master so it affects the entire sum. The `$effect` follows the same pattern as every other effect parameter sync.

</details>

### Exercise 2: Show a clip indicator on each channel

**Setup:** The mixer has per-channel gain. You can drive the gain past sensible limits.

**What to do:** Add a per-channel meter that reads the channel's gain node output and lights a "CLIP" indicator when it exceeds 0 dBFS. You'll need to tap each channel with a `Tone.Meter` node (separate from the existing chain — parallel branch). Add a derived rune per channel (or one record-of-numbers) for the meter levels. Update them via a `requestAnimationFrame` loop in a new component or in the mixer itself.

**Verify by:** Crank the kick's gain to 1.0 and the master to 1.0. The kick clipping shows on its strip. Other channels stay quiet.

**Stretch:** Show a continuous meter, not just a binary clip indicator. Use a small vertical bar next to the fader that fills from bottom (silent) to top (clipping).

<details>
<summary>Show solution</summary>

The 60fps-data lesson (Lesson 4) discusses exactly this case. Quick sketch:

In the engine:

```ts
private meterNodes: Record<string, Tone.Meter> = {};

// in ensureReady's loop:
this.meterNodes[t.id] = new Tone.Meter();
this.panNodes[t.id].connect(this.meterNodes[t.id]);
// (meter is a parallel branch off pan, before the effects bus)

// expose a getter, NOT $state (per Lesson 4 guidance):
getMeterLevel(trackId: string): number {
  return (this.meterNodes[trackId]?.getValue() as number) ?? -100;
}
```

In `Mixer.svelte`, add a small canvas or div per channel with a `requestAnimationFrame` loop that polls `audio.getMeterLevel(t.id)` and updates the DOM directly. Don't put the per-frame meter levels in `$state` — see Lesson 4.

Why this works: the meter level changes 60 times per second; putting it in `$state` would generate too much reactivity work. Direct DOM manipulation from rAF is the right pattern.

</details>

### Exercise 3: Demonstrate the per-cell reactivity claim

**Setup:** The mixer is working.

**What to do:** Open browser DevTools → Elements panel. Drag one channel's gain fader. Watch which DOM nodes update (DevTools flashes them briefly in dev tools' "highlight updates" mode).

**Verify by:** Only the dragged channel's `.lcd` readout and slider value attribute update. No other channel's DOM changes. The mixer container doesn't re-render. The sequencer doesn't re-render.

**Then:** Compare against the Svelte DevTools (extension) effect timeline. You should see exactly one effect firing per input event — the kick's gain effect.

**Why this matters:** This is the per-cell reactivity claim made concrete. In a re-render-on-state-change framework, you'd see the entire mixer subtree flash on each input event. Svelte updates only the subscribers of the changed value.

<details>
<summary>Show solution</summary>

No code change — this is an observation exercise. The "Show Updates" toggle in Chrome DevTools' "Rendering" pane is the easiest way to visualize. Toggle it on, drag a fader, watch the highlighted updates. They should be confined to one channel strip.

If you see updates spreading more widely, you've accidentally written something that reads `audio.channels` (the whole record) instead of `audio.channels.kick.gain` (one property). The Svelte tracker subscribes to whatever path you read.

</details>

### Exercise 4: Add a "reset all channels" button

**Setup:** The mixer's channels start at known defaults but get modified by the user.

**What to do:** Add a small "RESET" button at the top of the mixer that resets all channels to their default gain/pan/mute/solo values. Use the same defaults the engine ships with. Make sure the button doesn't reset the master volume (master is independent).

**Verify by:** Modify several channels (drag faders, click M on hat, click S on kick). Click RESET. All four channels jump back to defaults; master is unchanged.

**Stretch:** Animate the transition. Instead of a hard jump, smoothly ramp each channel's gain/pan back to defaults over 200ms. Hint: you can just assign the rune values and let the `$effect`s ramp via `rampTo` — the 20ms ramp will be visible if you watch carefully.

<details>
<summary>Show solution</summary>

Add a method on the engine:

```ts
resetChannels() {
  const defaults: Record<string, Omit<Channel, 'id'>> = {
    kick:  { gain: 0.9, pan: 0,    muted: false, solo: false },
    snare: { gain: 0.8, pan: 0.1,  muted: false, solo: false },
    hat:   { gain: 0.6, pan: -0.3, muted: false, solo: false },
    perc:  { gain: 0.7, pan: 0.4,  muted: false, solo: false }
  };
  for (const t of TRACKS) {
    const ch = this.channels[t.id];
    const d = defaults[t.id];
    ch.gain = d.gain;
    ch.pan = d.pan;
    ch.muted = d.muted;
    ch.solo = d.solo;
  }
}
```

In `Mixer.svelte`, add to the header area:

```svelte
<button type="button" class="reset" onclick={() => audio.resetChannels()}>RESET</button>
```

Why this works: each property assignment triggers the corresponding `$effect` to fire with the new value. The 20ms ramp on each one means the audio transitions smoothly even though the JS assignments are synchronous.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + per-channel state (gain, pan, muted, solo) in the engine
- + per-channel gain + pan Tone nodes routed before the effect chain
- + src/lib/components/Mixer.svelte

### Verify it works

- A 4-channel mixer appears with one channel strip per drum track
- Each fader controls only its channel's volume
- Each pan slider audibly moves the sound left/right
- Clicking M mutes the channel; clicking again unmutes
- Clicking S on one channel silences all others (solo); soloing multiple channels makes all of them audible

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/components/Mixer.svelte and the channel-state + gain/pan sync effects in engine.svelte.ts

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why does the gain effect re-fire for all channels when one channel's solo changes?**
A: Because each gain effect reads every channel's `.solo` property in the `Object.values(this.channels)` loop, subscribing to all of them. When any solo changes, all subscribed effects re-run. This is the correct behavior — the audibility of every channel depends on the global solo state, not just its own.

**Q: Can I use `$derived` for `anySolo` instead of computing it inside each gain effect?**
A: You could, but it doesn't help. A `$derived` would compute once per change and cache the result. Each gain effect would read the derived value, subscribing to it. When any solo changes, the derived invalidates, and every gain effect re-runs. Same number of effect runs as the explicit pattern, but with an extra layer of indirection. The explicit `Object.values(...).some(c => c.solo)` is clearer at small N (4 channels); a derived might be cleaner at larger N (64 channels with eight gain-determining properties each).

**Q: Why is the gain effect's ramp 20ms but the effects-chain effect's ramp is 50ms?**
A: 20ms feels snappier for per-channel adjustments — users expect mute/solo and gain changes to be near-instant. 50ms on effects parameters smooths slow knob sweeps (filter cutoff over a second) where the longer ramp prevents subtle zipper artifacts. Both are defensible defaults. You can tune them per-app.

**Q: What's the point of `{@const ch = audio.channels[t.id]}`?**
A: It's a local alias for readability. Without it, every reference inside the strip would be `audio.channels[t.id].gain`, `audio.channels[t.id].pan`, etc. The `@const` shortens these to `ch.gain`, `ch.pan`. Reactivity is unaffected — `ch` is just a reference to the same proxy object, so reads through `ch` are tracked identically.

**Q: Why not put the mute/solo logic in the sequence callback, skipping the trigger when muted?**
A: That works in principle but produces clicks at the mute boundary (a triggered-but-cancelled note has a different attack envelope than no trigger at all, depending on synth design). Using the gain node to silence instead — letting the synth always trigger, but ramping its output to 0 — is smoother and more uniform across synth types. Comment in the reference engine explains this: "This keeps the sound graph stable and avoids click artifacts from suddenly skipping triggers."

## What's next

The FFT visualizer. A canvas reading the live audio spectrum from a `Tone.Analyser` tap, animated at 60fps via `requestAnimationFrame`. The interesting Svelte content: when to use `$state` versus plain `let`, why the animation frame ID and the analyser data should both be non-reactive, and how DPI scaling keeps the canvas crisp on retina displays.

<SourcesSection lessonKey="07-capstone-polish/02-mixer" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
