<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Project Setup · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-6);">

<LessonHeader
  moduleSlug="06-capstone-foundations"
  lessonSlug="01-setup"
  title="Project Setup and the Audio Engine Class"
  blurb="Scaffold a SvelteKit project for the DAW. Build the singleton audio engine. Hello, drum sounds."
/>

## Why this lesson exists

This is the capstone. By the end of M6 you'll have a working 4-track step sequencer that plays real audio, persists patterns, and records output to downloadable files. M7 adds polish on top (effects, mixer, FFT visualizer, performance tuning). All of it runs in the browser — no backend, no service workers, no native shell.

Before we can sequence anything we need three things in place: a SvelteKit project configured for static hosting, the Tone.js library, and a singleton audio engine class with the right shape. The engine class is the load-bearing piece. Every other lesson in M6 and M7 adds methods or state to it. Get its shape right now and the rest of the module slots cleanly in.

The big new ideas this lesson introduces:

- A `.svelte.ts` module-level singleton (the same pattern you saw in M5, but bigger).
- A user-gesture-gated AudioContext (`Tone.start()` must run inside a click handler).
- The static adapter with `ssr = false` — the right combo for browser-only apps.
- Tone.js's per-instrument trigger functions, where each drum sound is just a synth tuned to behave like its role.

## Learning objectives

By the end of this lesson you'll be able to:

- Scaffold a SvelteKit project configured to deploy to a static host (no Node server required).
- Explain why an audio app needs `ssr = false` and what the static adapter actually does at build time.
- Write a `.svelte.ts` singleton that owns Tone.js audio nodes alongside reactive `$state` fields.
- Defer AudioContext creation until the first user interaction, and explain why every audio web app does this.
- Build four distinct drum sounds with Tone.js's built-in synths (MembraneSynth, NoiseSynth, MetalSynth) and trigger them on demand.

## Concept 1: A SvelteKit project shaped for the browser

### What we're picking and why

```sh
npm create svelte@latest svelte-daw
cd svelte-daw
npm install
npm install tone
npm install -D @sveltejs/adapter-static
```

The CLI prompts:

- **Template** — *Skeleton project*. Same as M1; no demo content to delete.
- **Type checking** — *Yes, using TypeScript syntax*. The engine class uses generics that read more clearly with types.
- **ESLint / Prettier** — your call; the course is fine either way.
- **Playwright / Vitest** — *No*. The DAW is more fun to test with your ears.

The two added dependencies:

- **`tone`** — Tone.js, the Web Audio library we use for all sound generation, scheduling, and routing. It's a wrapper over the raw Web Audio API that smooths over the rough edges (Transport, sample-accurate scheduling, instrument helpers).
- **`@sveltejs/adapter-static`** — the SvelteKit adapter that builds a fully static site (HTML, CSS, JS only). Lets you deploy to GitHub Pages, Netlify, Cloudflare Pages, S3, or any plain web server.

### Configure the static adapter

Replace `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: false
    })
  }
};
```

The `fallback: 'index.html'` line is doing real work. It tells the adapter to emit a single `index.html` that any unmatched route falls back to. This is what makes dynamic routes like `/share/abc123/` work on a static host — the host serves `index.html`, the client router runs `load()` in the browser, and the page renders. Without `fallback`, the host would 404 on any URL that wasn't pre-generated at build time.

`strict: false` lets SvelteKit emit the build even though `/share/[encoded]/` has no enumerable pre-rendered URLs.

### A layout that disables SSR

```ts
// src/routes/+layout.ts
export const ssr = false;
export const prerender = true;
export const trailingSlash = 'always';
```

Three lines, three decisions:

- **`ssr = false`** — no server-side rendering. The DAW touches `Tone`, `AudioContext`, `MediaRecorder`, `IndexedDB`, `localStorage` — every one of those is browser-only. SSR would crash trying to evaluate the module. Disabling SSR turns SvelteKit into a single-page app builder.
- **`prerender = true`** — at build time, generate an HTML shell for each statically-known route. Combined with `ssr = false` and the static adapter's fallback, this gives you a working static site that hydrates into a live app.
- **`trailingSlash = 'always'`** — every URL ends with `/`. Matters for the share route because `/share/abc123` vs. `/share/abc123/` resolve to different files on most static hosts.

If you've done React SPAs deployed to Netlify, you know this combo: SPA fallback for the host, no server. SvelteKit's static adapter is the same idea, just expressed in framework terms.

### File layout we're working toward

```
src/
├── lib/
│   ├── audio/
│   │   ├── engine.svelte.ts   # singleton audio engine
│   │   ├── tracks.ts          # track + synth definitions
│   │   ├── encoding.ts        # URL share (L4)
│   │   └── idb.ts             # IndexedDB wrapper (L5)
│   └── components/
│       ├── Sequencer.svelte
│       ├── TransportBar.svelte
│       ├── SavedPatterns.svelte
│       └── Recordings.svelte
└── routes/
    ├── +layout.svelte
    ├── +layout.ts
    ├── +page.svelte
    └── share/[encoded]/
        ├── +page.ts
        └── +page.svelte
```

`lib/audio/` is the engine and supporting code — no Svelte components, just TS modules. `lib/components/` is the UI that reads from the engine. Keeping the two cleanly separated means the audio code is testable in isolation (you could write Vitest tests against the engine without ever rendering a component) and the UI components stay thin.

### Common mistakes during setup

- **`npm run dev` fails with "Cannot find module 'tone'"**. You ran `npm install` before adding Tone. Run `npm install` again after `npm install tone`.
- **The dev server starts but the page is blank with `ReferenceError: window is not defined` in the terminal.** You imported something audio-related from `+layout.svelte` or `+page.svelte` without the `ssr = false` line. Add it to `+layout.ts`.
- **Build succeeds but the deployed site 404s on `/share/xxx/`.** Either `fallback` isn't set in the adapter config, or your host isn't serving the SPA fallback. On GitHub Pages, you also need a `static/404.html` that re-serves the app.
- **`adapter-static` complains about a "prerenderable" page that depends on dynamic data.** This is the situation `strict: false` solves — by default the adapter wants every route to be enumerable at build time. The share route can't be.

## Concept 2: Track definitions — sounds as data

### What a "track" is in this DAW

A track is a row in the step grid. There are four of them: kick, snare, hat, perc. Each one is conceptually a synth plus a way to trigger it. Putting both in a single data structure lets us iterate over `TRACKS` everywhere — when building the audio graph, when rendering the grid, when running the sequence callback — without special-casing any track.

```ts
// src/lib/audio/tracks.ts
import * as Tone from 'tone';

// `any` here because Tone.js's `Instrument` type isn't part of its public
// export surface; the synth classes we use (MembraneSynth, NoiseSynth,
// MetalSynth) don't share a useful common interface for triggerAttackRelease
// (NoiseSynth's signature omits the note arg), so we cast at the call site.
export type TrackInstrument = any;

export type TrackDef = {
  id: string;
  name: string;
  color: string;
  buildSynth: () => TrackInstrument;
  trigger: (synth: TrackInstrument, time: number) => void;
};
```

Five fields:

- `id` — stable string key. Used as an object key in `pattern`, `channels`, the synth lookup table.
- `name` — the UI label.
- `color` — the track's accent color, used to theme the row in the grid.
- `buildSynth()` — a factory that returns a fresh Tone.js synth tuned for this track. We call it once per track during engine init.
- `trigger(synth, time)` — fires the sound. Takes a `time` argument because the sequence callback needs to schedule firings into the audio future, not just play "now."

The `trigger` signature is the load-bearing detail. Tone's `triggerAttackRelease` takes `(note, duration, time, velocity)` for pitched synths and `(duration, time, velocity)` for `NoiseSynth` — the snare. Different signatures across the synth zoo is why we wrap them: every track's `trigger` looks the same from outside, the differences hide behind the function.

### The four tracks

```ts
export const TRACKS: TrackDef[] = [
  {
    id: 'kick',
    name: 'KICK',
    color: '#ff3e00',
    buildSynth: () =>
      new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
      }),
    // MembraneSynth: triggerAttackRelease(note, duration, time, velocity)
    trigger: (s, time) => (s as any).triggerAttackRelease('C2', '8n', time)
  },
  {
    id: 'snare',
    name: 'SNARE',
    color: '#e5468b',
    buildSynth: () =>
      new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 }
      }),
    // NoiseSynth: triggerAttackRelease(duration, time, velocity) — no note arg!
    trigger: (s, time) => (s as any).triggerAttackRelease('16n', time, 0.6)
  },
  {
    id: 'hat',
    name: 'HAT',
    color: '#2dbfb8',
    buildSynth: () =>
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      }),
    trigger: (s, time) => (s as any).triggerAttackRelease('C6', '32n', time, 0.18)
  },
  {
    id: 'perc',
    name: 'PERC',
    color: '#9b6cff',
    buildSynth: () =>
      new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.01 },
        harmonicity: 8,
        modulationIndex: 16,
        resonance: 8000,
        octaves: 0.5
      }),
    trigger: (s, time) => (s as any).triggerAttackRelease('C5', '16n', time, 0.25)
  }
];
```

A 30-second tour through the synthesizer choices, because none of these are arbitrary:

- **MembraneSynth (kick).** Models a struck membrane (think kick drum or floor tom). `pitchDecay: 0.05` slides the pitch down quickly from the start — that's the *thump* of a kick. `octaves: 6` is how far it slides. The envelope's long release (`1.4`) gives the kick body that hangs after the initial hit.
- **NoiseSynth (snare).** White noise with a fast envelope. A snare drum is essentially noise + a transient — the rattle of snare wires is broadband. No oscillator, no pitched note. That's why the trigger signature drops the note argument.
- **MetalSynth (hat).** A high-frequency FM-style synth designed to sound metallic. `harmonicity: 5.1` makes inharmonic partials (real cymbals are inharmonic — that's why they sound like cymbals and not bells). Short decay (`0.04`) = closed hat. Low velocity (`0.18`) keeps it from dominating.
- **MetalSynth (perc).** Same synth as the hat, retuned. Lower fundamental, longer decay, different harmonicity. A second metallic voice with a distinct character.

### TypeScript notes on the `any` cast

The `(s as any).triggerAttackRelease(...)` cast is ugly. The reason: Tone.js doesn't export a public `Instrument` base type, and the synths' overloaded signatures aren't compatible. Three options:

- **Cast to `any` at the call site** (what we did). Localizes the type hole.
- **Write per-track typed triggers.** Verbose; you lose the uniform-iteration win.
- **Use `Tone.Instrument` from internal types.** Brittle — Tone has refactored internal types between major versions.

For a 4-track DAW the cast is the right trade-off. The trigger functions are 10 lines total; the type hole stays local.

### Common mistakes with track definitions

- **You use `buildSynth: new Tone.MembraneSynth(...)` instead of `buildSynth: () => new Tone.MembraneSynth(...)`.** The synth gets constructed at module load time, before `Tone.start()` has run. Tone's constructors touch the audio context; this either crashes or produces a silent synth that can't be revived. Always wrap in a factory.
- **You pass `time` to NoiseSynth's `triggerAttackRelease` as the third arg.** NoiseSynth's signature is `(duration, time, velocity)` — no note. Putting `time` third makes Tone interpret it as a velocity (0..1), which silently turns your snare's volume up or down by orders of magnitude.
- **You share one synth across all four tracks.** Polyphony breaks (the synth only voices the most recent trigger), and you lose per-track effect routing. One synth per track is the rule.

## Concept 3: The singleton audio engine

### Why a singleton

The DAW has exactly one Tone Transport, one set of synths, one master gain, one MediaRecorder. There is no scenario where you'd want two engines fighting over the audio context. A module-level singleton is the right shape — instantiate once at module load, import the same instance everywhere.

You saw this pattern in M5 with the chord player. The DAW engine is bigger but the shape is identical: a class with reactive `$state` fields, exported as a single instance from a `.svelte.ts` module.

### The minimum engine

This is the version we're shipping in L1. By L5 it'll have ~500 lines. For now:

```ts
// src/lib/audio/engine.svelte.ts
import * as Tone from 'tone';
import { browser } from '$app/environment';
import { TRACKS, type TrackInstrument } from './tracks';

class AudioEngine {
  // ----- reactive state -----
  isReady = $state(false);
  isLoading = $state(false);
  loadError = $state<string | null>(null);

  // ----- non-reactive audio plumbing -----
  private master: Tone.Gain | null = null;
  private synths: Record<string, TrackInstrument> = {};

  constructor() {
    if (!browser) return;
    // Later lessons add $effect.root() here for BPM sync, auto-save, etc.
  }

  async ensureReady() {
    if (this.isReady || this.isLoading) return;
    this.isLoading = true;
    try {
      await Tone.start();
      this.master = new Tone.Gain(0.9).toDestination();
      for (const t of TRACKS) {
        this.synths[t.id] = t.buildSynth();
        this.synths[t.id].connect(this.master);
      }
      this.isReady = true;
    } catch (err) {
      this.loadError = (err as Error).message;
    } finally {
      this.isLoading = false;
    }
  }

  trigger(trackId: string, time?: number) {
    const t = TRACKS.find((x) => x.id === trackId);
    const synth = this.synths[trackId];
    if (!t || !synth) return;
    t.trigger(synth, time ?? Tone.now());
  }

  get masterGain() {
    return this.master;
  }
}

export const audio = new AudioEngine();
```

Six fields, three methods, one getter. Let's walk through every load-bearing piece.

### `if (!browser) return` in the constructor

The `.svelte.ts` module is imported by components. If SSR were enabled (it isn't, but the guard is cheap insurance), the import would run on the server, where `Tone` and `AudioContext` don't exist. Bailing out of the constructor early means the singleton instance still exists (other code can import it) but never tries to touch browser-only APIs in a non-browser environment.

`browser` comes from `$app/environment` — SvelteKit's official way to ask "am I on the client?" Don't roll your own `typeof window !== 'undefined'`; the framework guard is the one that interacts correctly with the build.

### `ensureReady()` — the user-gesture gate

Modern browsers will not let you start an `AudioContext` outside a user gesture. If you try, the context starts in a `suspended` state and stays there until a click, key press, or touch. Tone.js's `Tone.start()` is the official "now resume the context" call, and it returns a promise that resolves once the context is running.

The shape we want is: nothing happens at module load time. The first time the user does something that needs audio (clicks PLAY, clicks REC, taps a drum button), we call `ensureReady()`. The method short-circuits if we're already ready or in the middle of loading; otherwise it awaits `Tone.start()`, builds the audio graph, and flips `isReady`.

A few details that look small but matter:

- **`isLoading` flag.** Prevents a double-click on PLAY from firing two parallel `ensureReady()` calls. The second one returns immediately.
- **try/catch with `loadError`.** Audio start can fail (permissions, context creation race, browser bugs). Caught errors surface in the UI rather than going to the console where the user doesn't see them.
- **`finally` for `isLoading`.** Always reset the flag, even on error. Otherwise a single failed start would lock out future attempts.

### Building the audio graph

```ts
this.master = new Tone.Gain(0.9).toDestination();
for (const t of TRACKS) {
  this.synths[t.id] = t.buildSynth();
  this.synths[t.id].connect(this.master);
}
```

Web Audio is a directed graph. Sources connect to processing nodes, processing nodes connect to the destination (your speakers). Tone.js wraps the same model.

Right now the graph is simple:

```
synth[kick]  ─┐
synth[snare] ─┼→ master(Gain 0.9) → destination (speakers)
synth[hat]   ─┤
synth[perc]  ─┘
```

Every track's synth feeds into a single master Gain node, which feeds the destination. The master gain gives us one place to add taps later — the FFT analyser for the visualizer, the `MediaStreamAudioDestinationNode` for recording. Without it, we'd have to tap each synth individually.

`.toDestination()` is sugar for `.connect(Tone.getDestination())`. The destination is your output device.

### The `trigger` method

```ts
trigger(trackId: string, time?: number) {
  const t = TRACKS.find((x) => x.id === trackId);
  const synth = this.synths[trackId];
  if (!t || !synth) return;
  t.trigger(synth, time ?? Tone.now());
}
```

Takes a track id, looks up both the definition (for the trigger function) and the synth (the live audio node). If either is missing — say you typo'd `'kik'` — bail silently. The optional `time` defaults to "right now" via `Tone.now()`. When the sequencer calls this from inside a Tone.Sequence callback (L3), it'll pass the audio-thread-scheduled time.

This is the public surface for "play a sound." Test pages call it. The sequencer callback calls it. Anything that needs to make a sound call it.

### Why `.svelte.ts` and not `.ts`

The `.svelte.ts` extension tells the Svelte compiler to process the file for runes. Plain `.ts` files can't use `$state`, `$effect`, `$derived`. The compiler refuses.

There's nothing magic about the extension itself — it's a build-tool signal. Inside, you write normal TypeScript with the runes available.

### Common mistakes with the engine

- **You call `new Tone.Gain()` at module top-level, outside a class.** Same problem as the synth-not-wrapped-in-factory mistake: the constructor touches the audio context before `Tone.start()` has resumed it. Always build audio nodes inside `ensureReady()` or after.
- **You forget to `await audio.ensureReady()` before triggering.** The synth lookup returns `undefined`, the trigger bails silently, you stare at silence wondering what's wrong. Every entry point that triggers audio must `await ensureReady()` first.
- **You expect `audio.isReady` to be true synchronously after the first click.** It's set after the awaited `Tone.start()` resolves. UI that depends on `isReady` is reactive and will update, but inline checks right after calling `ensureReady()` without awaiting it will see `false`.
- **You instantiate the engine as `export const audio = browser ? new AudioEngine() : null`.** Now every call site has to null-check. Better to always export the instance and let the constructor's `if (!browser) return` early-exit handle the SSR case. The instance exists but does nothing on the server.

## Concept 4: A test page that plays sounds

### A drum-pad page to confirm everything works

We don't have a step grid yet (that's L2). But we have an engine that can trigger four sounds. A four-button page is the smallest possible "yes audio is working" smoke test.

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';

  async function tap(id: string) {
    await audio.ensureReady();
    audio.trigger(id);
  }
</script>

<svelte:head><title>SVELTE DAW</title></svelte:head>

<h1>SVELTE DAW</h1>
<p>Click a button to test each drum sound. The full sequencer comes in lesson 2.</p>

<div class="row">
  {#each TRACKS as t (t.id)}
    <button
      type="button"
      style="background: {t.color}"
      onclick={() => tap(t.id)}
    >
      {t.name}
    </button>
  {/each}
</div>

<style>
  :global(body) {
    background: #0a0b10;
    color: #ecedf3;
    font-family: system-ui;
    margin: 0;
    padding: 32px;
  }
  h1 { letter-spacing: 0.1em; margin-bottom: 8px; }
  p { color: #9ea3b8; font-family: monospace; font-size: 12px; }
  .row { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
  button {
    padding: 24px 32px;
    color: white;
    border: 0;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    letter-spacing: 0.1em;
    cursor: pointer;
    box-shadow: 0 8px 24px -10px currentColor;
  }
  button:active { transform: translateY(1px); }
</style>
```

Run `npm run dev`. Open the printed URL. Click each button. Listen.

- **KICK** — low thud, quick attack, body that hangs for a beat.
- **SNARE** — sharp burst of noise, fast decay. Crisp.
- **HAT** — high metallic tick. Should sit on top of the mix.
- **PERC** — mid-frequency metallic rip, a bit longer than the hat.

If you only hear silence on the first click but sound on subsequent clicks, that's expected. The first click was the gesture that resumed the AudioContext; by the time `Tone.start()` resolved, the trigger had already missed its window. Subsequent clicks have the context already running.

If you don't hear anything at all, see the troubleshooting list below.

### Why per-key `(t.id)` blocks in `{#each}`

```svelte
{#each TRACKS as t (t.id)}
```

The `(t.id)` is the keyed-each form (introduced in M2). For a static array of four tracks it doesn't matter functionally, but it's good habit — when you later sort, filter, or animate the array, the key tells Svelte which DOM nodes correspond to which items.

### Common mistakes with the test page

- **The page renders four buttons but clicking does nothing.** Open dev tools. If you see a "Tone is not defined" error, you didn't install `tone` or the import path is wrong. If you see "AudioContext was not allowed to start," the gesture-gate didn't catch — verify that the `onclick` handler actually runs (add a `console.log`).
- **The buttons render but the styles are missing.** The `:global(body)` rule depends on the scoped-CSS rules from M1 — make sure your `<style>` block contains the `:global(...)` wrapper, otherwise the body rule gets scoped to nothing.
- **The first click works but the AudioContext stays suspended.** Some browsers (Safari especially) need the context to be resumed inside the same call stack as the gesture. Wrapping the `Tone.start()` call in an async function that's *awaited* from the click handler is fine — but firing-and-forgetting it from a `setTimeout` or `requestAnimationFrame` won't satisfy the gesture rule.

## Putting it together

The full set of files after L1:

```
svelte-daw/
├── package.json                # tone + adapter-static added
├── svelte.config.js            # static adapter configured
├── src/
│   ├── routes/
│   │   ├── +layout.ts          # ssr=false, prerender=true
│   │   └── +page.svelte        # the four-button drum pad
│   └── lib/
│       └── audio/
│           ├── tracks.ts       # four track definitions
│           └── engine.svelte.ts # singleton AudioEngine
```

About 200 lines total. Not much code; the entire foundation of a Web Audio app is in there.

The compelling part of this setup is what it doesn't have. No state-management library. No service worker. No `useEffect`-style lifecycle dance. No prop drilling — components read from the singleton directly. The reactivity system handles the rest.

## Exercises

### Exercise 1: Add a fifth drum sound

**Setup:** the `TRACKS` array has four entries. Tone.js has more synths than the three we used — `Tone.PluckSynth`, `Tone.FMSynth`, `Tone.AMSynth`, `Tone.Synth`.

**What to do:** add a fifth track called `'tom'` (or anything you like). Pick a synth, tune it, write a trigger function. The drum pad picks it up automatically because it iterates `TRACKS`.

**Verify by:** the page renders five buttons. The fifth one plays a distinct sound.

**Stretch:** make the new track's synth use a different Tone synth class than any of the existing four.

<details>
<summary>Show solution</summary>

```ts
// add to TRACKS in src/lib/audio/tracks.ts
{
  id: 'tom',
  name: 'TOM',
  color: '#f5b042',
  buildSynth: () =>
    new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 1.6 }
    }),
  trigger: (s, time) => (s as any).triggerAttackRelease('A2', '8n', time)
}
```

Same family as the kick (MembraneSynth) but tuned higher and with less pitch slide — the result is a mid-tom rather than a low kick. The grid lesson (L2) will pick this up automatically because it iterates `TRACKS`.

</details>

### Exercise 2: Surface the load error

**Setup:** `audio.loadError` is reactive `$state<string | null>`, but the page doesn't display it.

**What to do:** add a banner to the test page that shows `audio.loadError` if it's non-null. Style it red.

**Verify by:** if you sabotage `ensureReady()` (temporarily throw an error inside it), the banner appears in the UI rather than being buried in the console.

**Stretch:** add a "retry" button that resets `loadError` to `null` and calls `ensureReady()` again.

<details>
<summary>Show solution</summary>

```svelte
{#if audio.loadError}
  <div class="err">Audio error: {audio.loadError}</div>
{/if}

<style>
  .err {
    background: #3a0f12;
    color: #ff8080;
    border: 1px solid #ff404040;
    border-radius: 6px;
    padding: 12px 16px;
    font-family: monospace;
    margin-bottom: 16px;
  }
</style>
```

The `if` block re-evaluates whenever `loadError` changes because the read is reactive — same mechanism as every other reactive read in Svelte 5.

</details>

### Exercise 3: Pre-build the synths

**Setup:** right now the engine builds synths inside `ensureReady()`, after `Tone.start()` resolves. Build can take 20–80ms on a cold load.

**What to do:** instead of building synths inside `ensureReady`, build them lazily on first use. Add a private `getSynth(id)` method that returns the synth, building it if it doesn't exist yet.

**Verify by:** the first `audio.trigger('kick')` builds and plays the kick. The second call uses the cached synth.

**Stretch:** measure the timing. Use `performance.now()` to compare bulk-build vs. lazy-build cold-load times. (Probably negligible at four tracks; would matter more at 32.)

<details>
<summary>Show solution</summary>

```ts
private getSynth(id: string): TrackInstrument | null {
  if (this.synths[id]) return this.synths[id];
  const t = TRACKS.find((x) => x.id === id);
  if (!t || !this.master) return null;
  const synth = t.buildSynth();
  synth.connect(this.master);
  this.synths[id] = synth;
  return synth;
}

trigger(trackId: string, time?: number) {
  const t = TRACKS.find((x) => x.id === trackId);
  const synth = this.getSynth(trackId);
  if (!t || !synth) return;
  t.trigger(synth, time ?? Tone.now());
}
```

Remove the synth-building loop from `ensureReady`. The trade-off: lazy builds cause a small delay on each track's *first* trigger. For a DAW where you press play and all four tracks immediately fire, eager building is probably correct. For a sampler with hundreds of voices, lazy is the only viable strategy.

</details>

### Exercise 4 (stretch): A keyboard layout

**Setup:** the drum pad responds to clicks. Some people would rather use keys.

**What to do:** add a `<svelte:window onkeydown={...}>` handler that maps `q`/`w`/`e`/`r` (or any four keys) to the four tracks. Pressing the key triggers the sound, exactly like clicking the button.

**Verify by:** with the page focused, pressing `q` plays the kick. Hold `q` and the kick fires at a normal repeat rate (limited by `keydown` repeat, which is fine for a quick test).

**Stretch:** prevent the audio gesture lockout — call `audio.ensureReady()` once on the first keypress. After that, key presses fire instantly with no AudioContext warmup latency.

<details>
<summary>Show solution</summary>

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { TRACKS } from '$lib/audio/tracks';

  const KEY_MAP: Record<string, string> = {
    q: 'kick',
    w: 'snare',
    e: 'hat',
    r: 'perc'
  };

  async function onKey(e: KeyboardEvent) {
    const id = KEY_MAP[e.key.toLowerCase()];
    if (!id) return;
    await audio.ensureReady();
    audio.trigger(id);
  }
</script>

<svelte:window onkeydown={onKey} />
```

`<svelte:window>` is the framework's pseudo-element for binding handlers to the window object. It's the right tool for global keyboard handlers — auto-cleans on unmount.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `package.json` with `tone` and `@sveltejs/adapter-static` as dependencies
- `svelte.config.js` configured with the static adapter
- `src/routes/+layout.ts` with `ssr = false; prerender = true; trailingSlash = 'always'`
- `src/lib/audio/tracks.ts`
- `src/lib/audio/engine.svelte.ts`
- `src/routes/+page.svelte`

### Verify it works

- `npm run dev` starts the dev server without errors
- You see four colored buttons (KICK, SNARE, HAT, PERC) on a dark page
- Clicking each button plays its distinct drum sound (the first click may eat the audio while the context resumes — subsequent clicks fire immediately)
- The browser console shows no errors
- `npm run build` completes without errors; the `build/` directory contains an `index.html` and a `_app/` folder

### Compare against the reference

If your version doesn't match: `capstone-reference/src/lib/audio/engine.svelte.ts` and `capstone-reference/src/lib/audio/tracks.ts`. For L1 you should only have the `isReady` / `isLoading` / `loadError` fields, `ensureReady`, `trigger`, and the `masterGain` getter. The reference has additional fields (pattern, channels, effect params) that we add in later lessons.

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why Tone.js? Couldn't we use raw Web Audio?**
A: You could, and for a single-oscillator app it'd be fine. Tone wraps three things that get painful fast in raw Web Audio: the Transport (a clock you can schedule against in musical time), sample-accurate scheduling primitives (`Tone.Sequence`, `Tone.Draw`), and a library of pre-built instruments (`MembraneSynth` is ~80 lines of WaveShapers and envelopes — fine to write once, not fun to write four times). For a DAW the wrapper pays for itself in lesson 3 alone.

**Q: Why `.svelte.ts` instead of a regular `.ts` file with a class?**
A: Runes (`$state`, `$effect`, `$derived`) only work in files the Svelte compiler processes. `.svelte` and `.svelte.ts` both get processed; plain `.ts` doesn't. You could keep the audio plumbing in `.ts` and a separate `.svelte.ts` for the reactive fields, but combining them into one file is simpler and the cost is zero.

**Q: What does `Tone.start()` actually do?**
A: It resumes the global `AudioContext` Tone created at module load time. Browsers spawn AudioContexts in `suspended` state when the user hasn't interacted yet. `Tone.start()` calls `audioContext.resume()` and waits for the state transition. After it resolves, you can schedule sounds.

**Q: Why does the singleton work even though we never await its instantiation?**
A: The class constructor synchronously instantiates the fields and ends. No async work happens in `new AudioEngine()`. The audio context creation Tone does at module load is also synchronous — it just creates the context in suspended state. All the awaiting (`Tone.start()`, synth-building) happens in `ensureReady()`, which is called later from a user-gesture-triggered handler.

**Q: Can I unit-test the engine without running a browser?**
A: Not really, because Tone.js requires a live AudioContext. You can run the engine in jsdom but Tone will throw. Two options: (1) use Playwright/Vitest browser mode to run actual browser tests, or (2) extract the pure logic (pattern editing, encoding, slot management) into separate modules that don't touch Tone, and test those in Node. The capstone-reference does (2) implicitly — `encoding.ts` and the pattern-toggling logic are pure.

## What's next

L2 adds the visual heart of the DAW: a 4×16 step grid. Each row is a track, each column is a 16th-note step in the pattern. Clicking a cell toggles it. The grid is pure Svelte — no new audio code — but it sets up the reactivity story we'll need in L3 when these cells start making sounds at exact moments in audio time.

<SourcesSection lessonKey="06-capstone-foundations/01-setup" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
