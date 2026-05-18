<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>A Ticking Sound · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-3);">

<LessonHeader
  moduleSlug="03-metronome-studio"
  lessonSlug="01-first-tick"
  title="A Ticking Sound (Tone.js, hello)"
  blurb="Load Tone.js. Trigger a click on a fixed interval. The audio thread vs setInterval, and why one of them is wrong."
/>

## Why this lesson exists

This module builds a metronome. By the end of the five lessons you'll have a configurable click with subdivisions, an accent pattern, a visual indicator with spring physics, and the audio engine split cleanly from the UI components. The reason the metronome is the project for this module isn't that the world needs another metronome — it's that a metronome forces you to confront browser audio properly. You can't fake a metronome with `setInterval` and a `<audio>` tag; it'll wobble badly enough that a musician would refuse to use it. You have to use the audio thread. So this is a project that pushes you out of the "JavaScript is one thread and that's fine" comfort zone, into Web Audio.

This first lesson is about getting one sound out of the browser at the right tempo. That sounds small, but there's an entire model of how browser audio works that you need before any of the later lessons make sense. Specifically: the audio thread runs separately from the main thread, scheduling is done ahead of time on the audio thread's clock, and the user has to gesture at the page before any sound can play. Tone.js gives you a comfortable API over all of this, but the API only makes sense if you understand what it's wrapping.

## Learning objectives

By the end of this lesson you'll be able to:

- Install Tone.js into a SvelteKit project and import it from a `.svelte` file.
- Explain why `setInterval` is the wrong tool for music timing, and what the audio thread does instead.
- Start an `AudioContext` from inside a user-gesture handler using `await Tone.start()`.
- Use `Tone.Loop` with musical-time notation (`'4n'`, `'8n'`, `'16n'`) to schedule callbacks at a tempo.
- Trigger a sound on the Tone Transport with a `Tone.MembraneSynth` and explain what `triggerAttackRelease` is doing.
- Tear the Transport down cleanly on stop without leaking scheduled events.

## Concept 1: Why `setInterval` is wrong for music

### What `setInterval` actually does

If you've never thought about it, `setInterval` looks like the obvious fit for a metronome. You want a thing to happen every 500 milliseconds; `setInterval(fn, 500)` runs `fn` every 500ms. Done.

Here's the version that looks fine:

```svelte
<script>
  let isPlaying = $state(false);
  let intervalId = null;

  function tick() {
    new Audio('/click.mp3').play();
  }

  function start() {
    intervalId = setInterval(tick, 500); // 120 BPM = 500ms
    isPlaying = true;
  }

  function stop() {
    clearInterval(intervalId);
    isPlaying = false;
  }
</script>
```

This works in the sense that it produces clicks roughly every half-second. It does not work in the sense that a musician would call it a metronome. Over a minute of ticking you'll hear it drift, you'll hear it stutter, and during a layout reflow or a garbage collection pause you'll hear it pause entirely.

The reason: `setInterval` schedules a callback on the main thread's event loop. The main thread is the same thread that runs your component code, your style recalculation, your layout, your scroll handlers, your React-or-Svelte reactivity, and any third-party script. The browser will fire the callback as close to "500ms later" as it can manage, but "as close as it can manage" depends on whatever else the main thread is doing. If a click handler ran a 30ms operation, your `setInterval` fires 30ms late.

Worse: when the tab is backgrounded, browsers clamp `setInterval` to fire at most once per second. So your 500ms metronome becomes a 1-second metronome the moment the user switches tabs. There is no flag you can pass to opt out.

### What the audio thread does instead

The browser's Web Audio API runs on a separate thread, sometimes a separate process, that does nothing but generate audio samples at the sound card's sample rate (44.1 kHz or 48 kHz). Every sample has a precise moment in time, and there's a clock — `audioContext.currentTime` — that ticks at sample rate.

You don't tell the audio thread "play this now." You tell it "play this at time t=2.500." It puts the event in a queue sorted by time, and when its clock reaches 2.500 it plays the sample. Sample-accurately. Regardless of what the main thread is doing, regardless of whether the tab is foregrounded, regardless of garbage collection.

The pattern you build on top of this: every ~25ms, your main-thread code looks at the next ~100ms of upcoming musical events, and schedules each one onto the audio thread with its precise time. The audio thread plays them at the right moments while the main thread is doing other things. This is called "lookahead scheduling," and it's described in Chris Wilson's "A Tale of Two Clocks" article, which is the canonical reference for this stuff.

### Common mistakes when reaching for `setInterval`

- **"It works on my machine, so it's fine."** It probably does work on a fast laptop with no other tabs open. The wobble shows up on slower machines, on backgrounded tabs, or under load. Test on something slow.
- **"I'll just use `requestAnimationFrame` instead."** RAF is also main-thread, also throttled in background tabs, and additionally tied to the display refresh rate (so 60 or 120 ticks per second, but not arbitrary). Same problem.
- **"I'll start a `Worker` and time it there."** Workers don't have the throttling problem, but you still can't play audio from a worker — you have to message back to the main thread, which loses the precision.
- **"I'll preload the audio element to avoid the loading delay."** That helps with the latency of the first click, but doesn't help with timing accuracy. `<audio>` playback latency is still subject to the main thread.

## Concept 2: Tone.js and the AudioContext gesture rule

### What Tone.js is

Tone.js is a JavaScript library that wraps the Web Audio API with a music-aware abstraction. Instead of thinking in samples and oscillators, you think in notes and beats. Instead of building a scheduler yourself, you use `Tone.Transport` (a global musical clock) and `Tone.Loop`, `Tone.Sequence`, `Tone.Part` (different ways to schedule events on it).

Tone.js is small, well-maintained, and stable. The API has barely changed in years. You could build this metronome with raw Web Audio — it's not that much code — but you'd spend the lesson on bookkeeping rather than the actual lesson topic. So we use Tone.

Install it in your project:

```sh
cd my-svelte-app
npm install tone
```

You import it with a namespace import: `import * as Tone from 'tone'`. Tone exports a lot of stuff, and the namespace makes it obvious where any given symbol came from.

### The user-gesture requirement

Browsers will not let your page produce audio until the user has interacted with it. This is called the "autoplay policy," and it exists because the web used to be full of pages that played sound at you the moment you visited them.

In practice, the `AudioContext` starts in a `'suspended'` state. Any audio you schedule before it's resumed will silently fail to play. To resume it, you call `audioContext.resume()` — but only from inside an event handler triggered by a user gesture (click, keypress, touch).

Tone.js wraps this as `await Tone.start()`. You call it once, from inside a click handler, and from then on audio works freely for the rest of the page's lifetime.

```js
async function start() {
  await Tone.start(); // first call must be inside a user gesture
  // now audio works
}
```

If you call `Tone.start()` from outside a user gesture — say, at the top of your `<script>` block, or inside an `$effect` that runs on mount — it returns a resolved promise but the AudioContext stays suspended. No error, no warning, just silence. This is the single most common "why doesn't audio work" issue in browser audio code.

### Common mistakes with `Tone.start()`

- **Calling it on mount.** Doesn't work. The page mounted without a user gesture. Move the call into a click handler.
- **Calling it once and then assuming it's done.** Calling it again is harmless (returns immediately if already started), but if the AudioContext was somehow suspended again — for example, the tab was backgrounded for a long time on iOS — you may need to start it again from the next user gesture. For our metronome, gating audio behind the START button handles this for free.
- **Forgetting `await`.** `Tone.start()` returns a promise. If you don't await it, the next line might run before the AudioContext is actually resumed. The next call (creating a synth, scheduling a loop) might fail or silently do nothing.
- **Trying to test it without a gesture.** Most browser-test tooling doesn't simulate user gestures convincingly. If you're writing a Playwright test that exercises audio, you need to actually `page.click()` something to satisfy the gesture requirement.

## Concept 3: `Tone.Transport`, `Tone.Loop`, and musical time

### What the Transport is

`Tone.Transport` is a global musical clock. It has a tempo (`Tone.Transport.bpm.value`), a time signature, a position (in bars/beats/sixteenths), and methods to start, stop, and pause. Once started, it runs in audio-thread time — sample-accurate, independent of the main thread.

Anything you schedule on the Transport — a `Loop`, a `Sequence`, a one-off `scheduleOnce` — is timed against this clock. Set the BPM to 120; schedule a callback every quarter note; the callback fires every 500ms. Change the BPM to 180; the callback now fires every 333ms. No code change needed.

### What `Tone.Loop` does

`new Tone.Loop(callback, interval)` creates a repeating event. The `interval` is a musical-time string: `'4n'` means a quarter note, `'8n'` an eighth, `'16n'` a sixteenth, `'2n'` a half, `'1n'` a whole. You can dot for "and a half": `'4n.'` is a dotted quarter (one and a half quarter notes). You can triplet: `'8t'` is an eighth-note triplet (three per beat).

The callback receives one argument, `time`, which is the audio-thread timestamp the event is scheduled for. You don't call your synth with "now"; you call it with `time`, which tells Tone "fire this on the audio thread at exactly that moment."

```js
const loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease('C2', '32n', time);
}, '4n').start(0);
```

The `.start(0)` schedules the loop to begin at Transport time 0 (the moment the Transport is started). Then `Tone.Transport.start()` actually starts the clock running.

### `triggerAttackRelease` and what a synth note is

A synth note has an attack (the moment it starts), a sustain (held duration), and a release (the moment it fades). `triggerAttackRelease(note, duration, time, velocity?)` packs all three into one call: start the note at `time`, hold for `duration`, then release.

The `note` is a pitch. You can pass it as a string (`'C2'`, `'F#4'`), as a MIDI number (`36`), or as a frequency in hertz (`440`). String notation is easiest to read.

The `duration` is again musical time. `'32n'` is a thirty-second note — short enough to sound like a click rather than a held tone. Try `'4n'` instead and you'll hear the synth sustain for the full beat, which sounds wrong for a metronome.

### Worked example: the whole start function

```js
async function start() {
  if (isPlaying) return;
  await Tone.start();                                  // 1
  if (!synth) synth = new Tone.MembraneSynth().toDestination();  // 2
  Tone.Transport.bpm.value = bpm;                      // 3
  loop = new Tone.Loop((time) => {                     // 4
    synth.triggerAttackRelease('C2', '32n', time);
  }, '4n').start(0);                                   // 5
  Tone.Transport.start();                              // 6
  isPlaying = true;
}
```

1. Unlock the AudioContext on the user gesture. Safe to call repeatedly.
2. Create the synth lazily on first start. `.toDestination()` connects it to the speakers — without this, the synth plays into the void.
3. Push the current BPM into the Transport. We'll wire a slider to this in the next lesson.
4. Build a Loop. The callback fires every quarter note at the current BPM.
5. `.start(0)` schedules the loop to start at Transport time 0. The loop is now armed but waiting for the Transport.
6. Start the Transport. The audio thread begins running the schedule.

### Variations on `Tone.Loop`

You'll see two close cousins in Tone:

- **`Tone.Sequence(callback, values, interval)`** — like `Loop` but cycles through an array of values, passing each to the callback in turn. Useful when each tick should play a different note (a drum pattern, an arpeggio).
- **`Tone.Part(callback, events)`** — schedule a list of `[time, value]` pairs. Useful for non-repeating patterns or melodies.

For a metronome, `Loop` is right because every tick is the same. We'll keep using it through Module 3.

### Common mistakes with the Transport and Loop

- **Calling `triggerAttackRelease(note, duration)` without the third `time` argument inside a Loop callback.** Without `time`, Tone uses "now" — which means the schedule is wrong by however many milliseconds the JavaScript event loop took to get here. Always pass the `time` argument through.
- **Forgetting `.start(0)` on the Loop.** The Loop is created but never scheduled. The Transport runs, but nothing happens. Common cause of "I started the Transport but I hear nothing."
- **Forgetting `Tone.Transport.start()`.** The Loop is scheduled but the Transport isn't running. Same symptom.
- **Forgetting `.toDestination()` on the synth.** The synth produces sound, but the sound has nowhere to go — the audio graph isn't connected to the speakers. Silent.
- **Creating a new synth on every tick.** Performance disaster and the sound gets cut off mid-note. Create the synth once, reuse it.

## Concept 4: Picking a sound

### Built-in Tone synths

Tone provides several synth classes, each with different characteristics:

- **`Tone.Synth`** — a basic oscillator + envelope. Pure tones, configurable waveform.
- **`Tone.MembraneSynth`** — designed for kick drums. Has a "pitch sweep" envelope that makes notes feel percussive.
- **`Tone.MetalSynth`** — a metallic, bell-like sound. Good for hi-hats and cymbals.
- **`Tone.NoiseSynth`** — white/pink/brown noise with an envelope. Good for snares and claps.
- **`Tone.PluckSynth`** — Karplus-Strong plucked string.
- **`Tone.FMSynth` / `Tone.AMSynth`** — frequency- and amplitude-modulated synths. More complex tones.

For a metronome you want something punchy and short. `MembraneSynth` is what I picked because it has a built-in pitch envelope that makes the click feel snappy without configuration. But any of the above would work. Try `MetalSynth` for a more bell-like tick, or `NoiseSynth` for a more "tap-on-wood" feel.

### Tuning the click

The note you pass to `triggerAttackRelease` controls the pitch. `'C2'` is a low click (good for a kick-drum feel). `'C5'` is bright and pingy. `'A4'` (440 Hz, the standard tuning reference) is right in the middle.

A common pattern for metronomes is a low pitch on most beats and a high pitch on beat 1. We'll build that in lesson 2.

### Common mistakes when picking a sound

- **Using `'C0'` or `'C8'`.** Sub-audible bass or piercing treble. Stay in the middle of the piano keyboard (roughly `'C2'` through `'C6'`) unless you have a reason.
- **Forgetting that pitch and duration interact.** A long-duration tone at a low pitch sounds like a hum, not a click. Keep duration short (`'32n'` or shorter) for percussive sounds.
- **Stacking too many synths.** Each synth uses CPU. For a metronome, one is enough. For a drum machine with eight voices, you'd allocate eight synths once and reuse them.

## Concept 5: Stopping cleanly

### What stop has to do

Stopping the metronome isn't just "stop the audio." Three things have to happen:

1. **Stop the Transport** — `Tone.Transport.stop()`. This freezes the clock at the current position.
2. **Cancel scheduled events** — `Tone.Transport.cancel()`. This clears anything that was queued up. Without this, if you start again, the OLD Loop callbacks might still be in the schedule and fire as duplicates.
3. **Dispose the Loop** — `loop.dispose()`. This frees the Loop's internal resources and removes its callback from Tone's event registry. If you skip this, leaked Loops will accumulate and eventually you'll have ghost ticks.

The full stop:

```js
function stop() {
  if (!isPlaying) return;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  loop?.dispose();
  loop = null;
  isPlaying = false;
}
```

`loop?.dispose()` uses optional chaining: if `loop` is null (we never started, or already stopped), don't try to call `.dispose()`. Then set `loop = null` so the next start sees a clean slate.

The synth, on the other hand, we keep alive between start/stop cycles. Allocating a synth is non-trivial — a small audio graph gets built. There's no benefit to throwing it away when stopping.

### Common mistakes when stopping

- **Skipping `Tone.Transport.cancel()`.** Symptom: start, stop, start again, and now there are two clicks per beat. The first Loop is still scheduled.
- **Skipping `loop.dispose()`.** Same symptom over time. Each start/stop cycle leaks a Loop.
- **Throwing away the synth.** Works, but creates allocation pressure. Each new `Tone.MembraneSynth()` builds a small audio graph. Reuse it.
- **Setting `isPlaying = false` first.** Doesn't break anything for this simple case, but if you have any reactive code watching `isPlaying`, it might run before the audio is actually stopped. Stop audio first, update UI state after.

## Putting it together

Here's the complete first-tick page. Put this in `src/routes/+page.svelte`:

```svelte
<script>
  import * as Tone from 'tone';

  let isPlaying = $state(false);
  let bpm = $state(120);

  let synth = null;
  let loop = null;

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    loop = new Tone.Loop((time) => {
      synth.triggerAttackRelease('C2', '32n', time);
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
  }
</script>

<button onclick={() => isPlaying ? stop() : start()}>
  {isPlaying ? 'STOP' : 'START'}
</button>
```

Save. Click START. You should hear a steady click at 120 BPM. Click STOP, the click stops. Open the browser console — no errors should print. If audio doesn't start, the AudioContext probably didn't resume; check that you actually clicked the button and didn't trigger START some other way.

This is the foundation. Every other lesson in this module adds something on top: a slider for the BPM, a visual indicator, components, subdivisions, spring physics. The audio engine itself — synth, loop, transport, start, stop — barely changes.

### A note on what this module's sandbox does NOT do

Most lessons in this curriculum have a live in-page sandbox. This module doesn't. Running Tone.js inside the embedded compile-and-iframe sandbox would require routing audio through cross-origin iframe channels and dealing with the AudioContext gesture requirement for each iframe, which is more work than the lessons benefit from. From this lesson on, build along in your local dev server. The non-audio examples in other modules still use the sandbox normally.

## Exercises

### Exercise 1: Wire up the basic tick

**Setup:** a fresh SvelteKit project (or your existing `my-svelte-app`). Tone.js installed via `npm install tone`. Empty `src/routes/+page.svelte`.

**What to do:** copy the "putting it together" code into `+page.svelte`. Save. Open `localhost:5173`. Click START.

**Verify by:** you hear a steady click every 500ms. STOP halts it cleanly. The browser console shows no errors. Clicking START a second time resumes cleanly with no audible glitches.

**Stretch:** add a `console.log('tick', time)` inside the Loop callback and watch the log for a few seconds. The `time` values should march upward by exactly 0.5 each tick. They WILL NOT be exactly 0.5s apart in wall-clock time — they're in audio-thread time, which is the whole point.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import * as Tone from 'tone';

  let isPlaying = $state(false);
  let bpm = $state(120);

  let synth = null;
  let loop = null;

  async function start() {
    if (isPlaying) return;
    await Tone.start();
    if (!synth) synth = new Tone.MembraneSynth().toDestination();
    Tone.Transport.bpm.value = bpm;
    loop = new Tone.Loop((time) => {
      console.log('tick', time);
      synth.triggerAttackRelease('C2', '32n', time);
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
  }
</script>

<button onclick={() => isPlaying ? stop() : start()}>
  {isPlaying ? 'STOP' : 'START'}
</button>
```

The `time` values printed will be increasing audio-thread timestamps, marching up by 0.5 each tick. The point is that the SCHEDULED times are exact, not the wall-clock moments when the log statement happens to run.

</details>

### Exercise 2: Change the sound

**Setup:** the working tick from Exercise 1.

**What to do:** swap `MembraneSynth` for `MetalSynth`. Change the pitch from `'C2'` to `'C5'`. Restart and listen.

**Verify by:** the click sounds noticeably brighter and more metallic. STOP and START still work without errors.

**Stretch:** try all four percussive synths in turn (`MembraneSynth`, `MetalSynth`, `NoiseSynth`, `PluckSynth`). For `NoiseSynth`, note that it doesn't take a pitch argument — `triggerAttackRelease('32n', time)` is the right signature. Pick the one that sounds best to you.

<details>
<summary>Show solution</summary>

```js
if (!synth) synth = new Tone.MetalSynth().toDestination();
// ...
synth.triggerAttackRelease('C5', '32n', time);
```

For `NoiseSynth`:

```js
if (!synth) synth = new Tone.NoiseSynth().toDestination();
// ...
synth.triggerAttackRelease('32n', time); // no pitch argument
```

`NoiseSynth` produces noise, which doesn't have a pitch in the conventional sense, so the API doesn't take one. The Tone.js docs list which synths take which arguments — the convention is "fewer arguments if the parameter doesn't apply."

</details>

### Exercise 3: Try a triplet

**Setup:** the working tick from Exercise 1.

**What to do:** change the Loop's interval from `'4n'` (quarter note) to `'8t'` (eighth-note triplet). Listen.

**Verify by:** instead of one click per half-second, you hear three clicks per half-second, evenly spaced. The tempo "feels faster" but the underlying beat is the same — 120 BPM, three subdivisions per beat.

**Stretch:** try `'4n.'` (dotted quarter — 1.5 quarter notes per click), `'16n'` (sixteenth notes — four per beat), `'2n'` (half notes — one click per second). Tone's musical-time strings are surprisingly expressive; the [Tone.js docs](https://tonejs.github.io/docs/) list them all.

<details>
<summary>Show solution</summary>

```js
loop = new Tone.Loop((time) => {
  synth.triggerAttackRelease('C2', '32n', time);
}, '8t').start(0);
```

At 120 BPM, a quarter note is 0.5 seconds. An eighth-note triplet (`'8t'`) is one-third of a quarter note, so about 167ms per click. You'll hear roughly six clicks per second, in groups of three.

This is exactly the abstraction we'll use in lesson 4 to build the subdivisions picker — switching from `'4n'` to `'8n'` to `'8t'` to `'16n'` is a one-string-swap.

</details>

### Exercise 4: Catch the missing-await bug

**Setup:** the working tick from Exercise 1.

**What to do:** remove the `await` from `await Tone.start()`. Don't call it synchronously either — just `Tone.start();` without await. Reload the page. Click START.

**Verify by:** the metronome might work on second click but not first; or it might work at all, depending on browser. The point isn't to break it permanently — it's to see how silently this can fail. Put the `await` back.

**Stretch:** check what `Tone.context.state` returns at the top of your script (in an effect that logs it on mount) versus after START is clicked. The state is `'suspended'` before the gesture, `'running'` after. This is the AudioContext state machine in action.

<details>
<summary>Show solution</summary>

The fix is to put `await` back. The reason it sometimes "works" without await is that the AudioContext was already resumed from an earlier session (Tone caches the state across navigations in some browsers), so the next line happens to succeed by luck.

```js
$effect(() => {
  console.log('audio state:', Tone.context.state);
});
```

Before any user gesture: `'suspended'`. After clicking START with proper `await`: `'running'`. After skipping `await`: still `'suspended'` for a moment, then maybe `'running'` later. The race condition is what makes this a particularly nasty bug — it works on your fast machine and fails on someone else's.

</details>

### Exercise 5 (stretch): Schedule a two-note pattern

**Setup:** the working tick from Exercise 1.

**What to do:** replace the single-note Loop with a two-note alternating pattern: high note on odd ticks, low note on even ticks. Use a counter variable to track which tick you're on.

**Verify by:** you hear a "high, low, high, low" pattern at 120 BPM.

**Stretch:** instead of a counter, use `Tone.Sequence` to express the pattern more idiomatically. `new Tone.Sequence((time, note) => synth.triggerAttackRelease(note, '32n', time), ['C5', 'C2'], '4n')`.

<details>
<summary>Show solution</summary>

With a counter:

```js
let count = 0;
loop = new Tone.Loop((time) => {
  const note = count % 2 === 0 ? 'C5' : 'C2';
  synth.triggerAttackRelease(note, '32n', time);
  count++;
}, '4n').start(0);
```

With `Tone.Sequence`:

```js
loop = new Tone.Sequence((time, note) => {
  synth.triggerAttackRelease(note, '32n', time);
}, ['C5', 'C2'], '4n').start(0);
```

`Sequence` is built for this case. It cycles through the array on each tick, calling your callback with the current value. For an alternating pattern, it's cleaner than tracking a counter yourself. We'll use `Loop` in the rest of this module because the subdivision logic is easier to express with a single callback that consults state, but for a fixed pattern, `Sequence` is the better tool.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- Tone.js installed (`npm install tone` ran successfully; `tone` appears in `package.json`'s dependencies).
- `src/routes/+page.svelte` containing the start/stop button and the audio engine code.

### Verify it works

- Visiting `http://localhost:5173/` shows a single START button.
- Clicking START produces a steady click at 120 BPM.
- Clicking STOP halts the click immediately.
- Repeatedly toggling START/STOP doesn't produce duplicate clicks, doesn't error in the console, doesn't leak (you can leave it running for minutes without it slowing down).
- The browser console shows no errors throughout.

### Compare against the reference

The capstone reference repo doesn't include the metronome — it's a recipe-builder. For this module, your local `+page.svelte` IS the reference. Save each lesson's version under a `lessons/03/L01-first-tick.svelte` (or similar) if you want to keep them around. Otherwise just overwrite as you go through the module.

## Common questions

**Q: Why Tone.js and not raw Web Audio?**
A: You could build a metronome with raw Web Audio in maybe 50 lines, plus another 30 for the lookahead scheduler. It's not that much code. The reason I picked Tone.js is that the rest of the module uses subdivisions, accent patterns, and visual sync — and each of those is one line in Tone and a paragraph of bookkeeping in raw Web Audio. The lesson is supposed to be about Svelte patterns for audio apps, not about implementing a scheduler. If you want to understand the raw Web Audio version, Chris Wilson's "A Tale of Two Clocks" walks through it in full.

**Q: Why is `Tone.Transport` a global? Doesn't that feel wrong?**
A: It does feel wrong, especially if you're coming from a React-with-context background. The reasoning: the audio thread is a single resource. There's one AudioContext per page (in practice), one Transport per AudioContext, one schedule running on the audio thread. Tone models this as a singleton because the underlying thing is a singleton. If you need multiple independent clocks (rare), Tone supports `new Tone.Transport()`, but the default singleton covers most apps.

**Q: Will this work on mobile?**
A: Yes. The user-gesture requirement is the same on mobile; the audio thread works the same way. iOS has some quirks — Safari occasionally suspends the AudioContext when the screen locks, and you may need to handle the `visibilitychange` event to re-`Tone.start()` on resume. We'll cover this if it comes up in a later module's capstone; for the metronome it's not necessary.

**Q: Can I use this offline (no network)?**
A: Yes. Tone.js is loaded as a JavaScript bundle at build time — `npm run build` produces a bundle that includes Tone. No network calls happen at runtime for the audio engine. (Some of Tone's higher-level sampler classes can load audio files, but the synths we're using generate sound mathematically.)

**Q: What's the latency? If I click the screen at the same time as a click, are they aligned?**
A: There's some latency between "audio is scheduled to play at time t" and "speaker actually produces sound." On most desktops it's around 10-20ms; on Bluetooth headphones it can be 100ms or more (Bluetooth audio is notoriously laggy). Tone.js can't help you with this — it's a hardware/OS thing. For a metronome it doesn't matter (the absolute latency is constant; the relative timing is precise). For an instrument app where you want immediate response to user input, look at `Tone.context.lookAhead` and consider using AudioWorklets directly.

## What's next

Lesson 2 adds a BPM slider bound to the value with `bind:value`, an `$effect` that pushes BPM updates into the Transport, and a visual indicator that flashes on every click using `Tone.Draw.schedule` to keep visuals synchronized with audio. You'll see the unconditional-read pattern from Module 2 used in earnest, and the `&lbrace;#key value&rbrace;` block for re-triggering CSS animations.

<OpenTheHood title="A Tale of Two Clocks (the audio scheduling story)">

Web Audio's API includes `audioContext.currentTime` — a clock that runs on the audio thread, independent of `Date.now()` or `performance.now()`. To play a sound at a specific moment, you call `oscillator.start(time)` where `time` is a value from `audioContext.currentTime` that's slightly in the future.

The audio thread runs at sample rate. When `audioContext.currentTime` reaches the scheduled time, the audio thread plays the sound — sample-accurately, regardless of what the main thread is doing.

To use this, you need to schedule sounds AHEAD of time. The classic pattern: every ~25ms, the main thread looks at the next ~100ms of musical time, and schedules every event that should fire in that window. The audio thread plays them at the right moments, and meanwhile the main thread is free to do other work.

`Tone.Transport.scheduleRepeat`, `Tone.Loop`, and `Tone.Sequence` all implement this lookahead pattern internally. You write what notes should play; Tone schedules them on the audio thread.

The canonical reference is Chris Wilson's "A Tale of Two Clocks" article (search for it). Tone.js's source is in github.com/Tonejs/Tone.js — also worth reading if you want to understand the abstraction.

</OpenTheHood>

<SourcesSection lessonKey="03-metronome-studio/01-first-tick" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
