<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
</script>

<svelte:head><title>Troubleshooting · Make / Svelte</title></svelte:head>

<article class="page prose">

<header>
  <p class="kicker">TROUBLESHOOTING</p>
  <h1>When something breaks</h1>
  <p class="lede">
    The things that go wrong while you're building, organized by the symptom you see. If your code isn't doing what the lesson says it should, look here before digging through Stack Overflow.
  </p>
</header>

## Audio

### "I clicked PLAY and nothing happened"

The first time audio plays, the browser has to create an `AudioContext`. Browsers require this to happen in response to a user gesture (click, key press, tap). If `Tone.start()` runs anywhere except inside an event handler, it silently fails and the audio context stays suspended.

**Fix:** make sure `await Tone.start()` is called from inside a click handler — never at module load, never inside `onMount`, never inside `$effect` unless you're sure that effect is triggered by a user interaction.

A typical pattern:

```ts
async function play() {
  await Tone.start();  // first click unlocks audio
  // ... rest of play logic
}
```

If you're still getting silence after the first click, check the browser console for `"The AudioContext was not allowed to start"` warnings.

### "Audio works in dev, breaks in production"

Likely SSR (server-side rendering) is trying to instantiate Web Audio nodes at module load. The server doesn't have an `AudioContext`, so anything that calls `new Tone.Synth()` at top level errors during the prerender.

**Fix 1:** add `export const ssr = false` to your route's `+layout.ts` or `+page.ts`.

**Fix 2:** lazy-construct synths inside `ensureReady()`-style methods that only run client-side, never at module load.

**Fix 3:** wrap any top-level audio setup in `if (browser)` from `$app/environment`.

### "My audio glitches or stutters"

Audio scheduling runs on a separate thread, but it needs the main thread to keep the event queue topped up. If your main thread is busy (heavy DOM, GC pauses, expensive `$effect` work), the audio thread runs out of events and clicks/glitches.

**Fix 1:** increase Tone's lookahead: `Tone.context.lookAhead = 0.2` (200ms — more buffer for the audio thread).

**Fix 2:** find the main-thread bottleneck via DevTools Performance tab. Look for long script-execution blocks during playback.

**Fix 3:** move expensive per-frame work out of the `$state` system. 60fps data in `$state` triggers microtask flushes on every change; use plain `let` + direct DOM manipulation in `requestAnimationFrame` callbacks for hot paths.

### "The playhead visual lags the audio"

Visual updates queued naively will fire on the next animation frame, which can lag the audio by 16–32ms. To sync visual updates with audio time, use `Tone.Draw.schedule(fn, time)`:

```ts
new Tone.Sequence((time, step) => {
  // play the audio at exact `time`
  synth.triggerAttackRelease('C2', '8n', time);
  // schedule the visual to update at the right animation frame for `time`
  Tone.Draw.schedule(() => { currentStep = step; }, time);
}, [...], '16n');
```

### "MediaRecorder records but the file is silent"

You probably connected a Tone node to your `MediaStreamAudioDestinationNode` but forgot the source needs to flow through both the destination AND your master gain (or wherever sound was previously going).

**Fix:** the master gain should have TWO connections: one to `Tone.Destination` (speakers) AND one to the `MediaStreamAudioDestinationNode` (recorder). Web Audio nodes can fan out — the same source feeds both. Make sure you're not disconnecting one when adding the other.

```ts
const master = new Tone.Gain(0.9).toDestination();   // → speakers
const mediaDest = ctx.createMediaStreamDestination();
master.connect(mediaDest);                            // → recorder, in parallel
```

## Reactivity

### "My binding doesn't update when the state changes"

Most common cause: you read a reactive value into a non-reactive variable.

```svelte
<!-- BAD -->
<script>
  let count = $state(0);
  let copy = count;          // captures the current value, not reactive
</script>
<p>{copy}</p>              <!-- never updates -->
```

`copy` is a plain `let`. Reading from it doesn't track `count`. The compiler doesn't insert reactive plumbing for non-rune declarations.

**Fix:** if you want `copy` to track `count`, declare it as a `$derived`:

```svelte
let copy = $derived(count);
```

Or just use `count` directly wherever you'd use `copy`.

### "My effect doesn't fire when the state changes (sometimes)"

You're hitting the conditional-tracking pattern. Reactive dependencies are registered when they're READ during effect execution. If your effect short-circuits before reading the value on its first run, the dependency isn't tracked.

```ts
// BAD
$effect(() => {
  if (someCondition) {
    doSomethingWith(bpm);  // bpm only read when someCondition is true
  }
});
// if someCondition was false on the first run, the effect won't re-fire when bpm changes
```

**Fix:** read the dependency unconditionally before any branching:

```ts
$effect(() => {
  const v = bpm;            // always tracked
  if (someCondition) {
    doSomethingWith(v);
  }
});
```

This pattern shows up CONSTANTLY when you're syncing rune state to an external system (Tone.js, localStorage, DOM). Internalize it.

### "Effect cycle detected" error

You're writing to a signal from inside an effect that reads that same signal — directly or indirectly. The runtime catches it.

**Fix:** restructure so the value is computed by a `$derived` (not assigned by an `$effect`):

```ts
// BAD
let doubled = $state(0);
$effect(() => { doubled = count * 2; });

// GOOD
let doubled = $derived(count * 2);
```

If you genuinely need to write inside an effect, wrap the write site with `untrack` so it doesn't loop:

```ts
import { untrack } from 'svelte';
$effect(() => {
  if (untrack(() => count) > 10) count = 0;  // doesn't track count
});
```

### "Why is my whole component re-rendering when only one thing changed?"

Svelte 5 components don't re-render. The component function runs once on mount; updates are per-binding. If you THINK the component is re-rendering, you're probably seeing all the per-binding effects flush at once.

**Fix:** use the Svelte DevTools (browser extension) to inspect which effects are firing on which state changes. The most common cause of "too much" reactivity is an effect with too-broad dependencies — like reading `audio.channels` (the whole record) instead of `audio.channels.kick.muted` (just the field you need).

## SvelteKit

### "Route returns 404 in production but works in dev"

Check that the route's directory has a `+page.svelte` (or `+page.md`) file. The leading `+` is required — SvelteKit ignores files without it.

If the file is there: check `paths.base` in `svelte.config.js`. For project Pages sites at `https://user.github.io/repo/`, you need `BASE_PATH=/repo` set at build time. Without it, your built site looks for assets at `/` but they're actually at `/repo/`.

### "Deep links 404 on GitHub Pages but work locally"

GitHub Pages doesn't natively support SPA-style routing — refreshing on `/songs/abc` looks for `songs/abc/index.html`, which doesn't exist if that route is dynamic.

**Fix:** in your GitHub Action's deploy step, copy `index.html` to `404.html`:

```yaml
- run: cp build/index.html build/404.html
```

GitHub Pages serves `404.html` for unmatched routes; SvelteKit's client router then handles the URL. Combined with the static adapter's `fallback: 'index.html'` option, deep links work.

### "Form actions don't redirect properly"

You probably returned a regular object from the action when you meant to throw a redirect:

```ts
// BAD
return { success: true, location: '/done' };

// GOOD
import { redirect } from '@sveltejs/kit';
throw redirect(303, '/done');
```

`throw redirect()` exits the action and sends a 303 status the framework knows how to handle. Returning the URL as data does nothing.

### "Hydration mismatch warnings"

Server-rendered HTML doesn't match what the client wants to render after hydration. Common causes:

- **Random data** (`Math.random()`, `crypto.randomUUID()`, `Date.now()`) used during render — different values on server vs. client.
- **Browser-only values** (`localStorage`, `window.innerWidth`) accessed during render — the server has different values (or none).
- **Conditional rendering based on `browser` from `$app/environment`** — the server sees `false`, the client sees `true`, the tree differs.

**Fix:** isolate browser-only rendering inside `onMount` or `$effect` so it only runs after hydration, never during initial render. For random values needed in render, generate them in a load function (which runs once and is consistent between server and client).

## MDsveX (`.md` lesson files in this curriculum)

These are quirks specific to writing lessons that mix markdown with Svelte components. You won't hit them in normal app development, but if you're customizing this curriculum:

### "Unexpected token" in a `.md` file

A `{` or `}` in markdown text is being interpreted as a Svelte expression. The most common offenders:

- `{#if}`, `{#each}` etc. mentioned in prose. Wrap in HTML entities: `&lbrace;#if&rbrace;`.
- `{ }` (empty braces) anywhere. Wrap as `&lbrace; &rbrace;`.
- JavaScript object literals in inline backtick code (`` `{ foo: 1 }` ``). Also need entity escaping if the braces would otherwise be interpreted as Svelte expressions.

### "`</style>` attempted to close an element that was not open"

Likely you have a literal `</style>` in a `<script>` block's template-literal source string. The Svelte parser doesn't fully respect template-literal scoping for HTML-tag-like content.

**Fix:** split the closing tag via string concatenation in the JS:

```ts
const sourceStr = `<style>...` + `</style>`;
```

Or put the example code in a separate `.ts` file and import the string.

## When in doubt

- **Open the browser console** before anything else. 90% of issues announce themselves there.
- **Read the actual stack trace.** SvelteKit's error pages are detailed — the relevant file path is usually right there.
- **Compare to the capstone-reference project** at `learn-svelte/capstone-reference/` if you're stuck on a capstone lesson. Run it locally — if it works, the bug is in your version, not the framework.
- **The Svelte Discord's `#help` channel** is fast and friendly. Provide a minimal reproduction if you can.

</article>

<style>
  .page {
    max-width: 820px;
    margin: 0 auto;
    padding: var(--sp-7) var(--sp-5);
  }
  .kicker {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--c-accent);
    margin: 0 0 var(--sp-3);
  }
  header { margin-bottom: var(--sp-6); }
  h1 { margin: 0 0 var(--sp-3); font-size: var(--fs-2xl); letter-spacing: -0.025em; }
  .lede { color: var(--c-text-muted); margin: 0; font-size: var(--fs-md); }
  .prose h2 { margin-top: var(--sp-7); }
  .prose h3 { margin-top: var(--sp-5); }
</style>
