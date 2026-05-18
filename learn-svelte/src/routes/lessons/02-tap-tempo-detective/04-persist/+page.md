<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const persistedSource = `<script>
  import { browser } from '$app/environment';

  // Read previous BPM from localStorage on initial load (client-only).
  let lastBpm = $state(browser ? Number(localStorage.getItem('tapTempo_lastBpm')) || null : null);

  let taps = $state([]);
  let bpm = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    return Math.round(60000 / (total / (recent.length - 1)));
  });

  // Whenever bpm changes to a real value, save it.
  // Read bpm into a local BEFORE the conditional so the dep is always tracked.
  $effect(() => {
    const value = bpm;
    if (value !== null && browser) {
      localStorage.setItem('tapTempo_lastBpm', String(value));
      lastBpm = value;
    }
  });

  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }
<\/script>

<div class="card">
  <div class="bpm-display">
    {#if bpm}
      <span class="num">{bpm}<\/span><span class="unit">BPM<\/span>
    {:else if lastBpm}
      <span class="prompt">tap to start <small>(last: {lastBpm} BPM)<\/small><\/span>
    {:else}
      <span class="prompt">tap to start<\/span>
    {/if}
  <\/div>
  <button class="tap" onclick={handleTap}>TAP<\/button>
  <div class="meta">
    <span>{taps.length} taps<\/span>
    <button class="reset" onclick={reset} disabled={taps.length === 0}>reset<\/button>
  <\/div>
<\/div>

<style>
  .card { max-width: 280px; margin: 0 auto; padding: 24px; background: #1a1d2a;
    border-radius: 16px; font-family: system-ui; color: #ecedf3; }
  .bpm-display { text-align: center; padding: 24px 0; border-bottom: 1px solid #262a3a; margin-bottom: 24px; }
  .num { font-size: 72px; font-weight: 700; color: #e5468b; line-height: 1; }
  .unit { font-size: 16px; color: #9ea3b8; margin-left: 8px; }
  .prompt { font-size: 18px; color: #5e6378; }
  .prompt small { display: block; margin-top: 4px; font-size: 13px; color: #e5468b; }
  .tap { width: 100%; background: #e5468b; color: white; border: 0; padding: 24px;
    font-size: 24px; font-weight: 700; border-radius: 12px; letter-spacing: 0.1em;
    cursor: pointer; box-shadow: 0 8px 24px -8px #e5468b; }
  .tap:active { transform: translateY(1px); }
  .meta { display: flex; justify-content: space-between; align-items: center;
    margin-top: 16px; color: #9ea3b8; font-size: 14px; }
  .reset { background: transparent; color: #9ea3b8; border: 1px solid #262a3a;
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit; }
  .reset:disabled { opacity: 0.4; cursor: not-allowed; }
<\/style>
`;

  const shortCircuitBug = `<script>
  let count = $state(0);
  let multiplier = $state(2);
  let logs = $state([]);

  // BUGGY: reading 'multiplier' is gated by 'count > 0', so on the first run
  // (count = 0) only 'count' is tracked. Changing 'multiplier' later does
  // nothing until 'count' changes again.
  $effect(() => {
    if (count > 0) {
      logs = [...logs, \`count=\${count}, mult=\${multiplier}\`];
    }
  });
<\/script>

<button onclick={() => count++}>count++ ({count})<\/button>
<button onclick={() => multiplier++}>multiplier++ ({multiplier})<\/button>
<ul>{#each logs as line}<li>{line}<\/li>{/each}<\/ul>

<style>
  button { font-family: system-ui; margin-right: 6px; padding: 6px 12px; }
  ul { font-family: monospace; font-size: 13px; }
<\/style>
`;

  const shortCircuitFix = `<script>
  let count = $state(0);
  let multiplier = $state(2);
  let logs = $state([]);

  // FIXED: read both reactive values up-front, unconditionally.
  // The dependency set is { count, multiplier } on every run.
  $effect(() => {
    const c = count;
    const m = multiplier;
    if (c > 0) {
      logs = [...logs, \`count=\${c}, mult=\${m}\`];
    }
  });
<\/script>

<button onclick={() => count++}>count++ ({count})<\/button>
<button onclick={() => multiplier++}>multiplier++ ({multiplier})<\/button>
<ul>{#each logs as line}<li>{line}<\/li>{/each}<\/ul>

<style>
  button { font-family: system-ui; margin-right: 6px; padding: 6px 12px; }
  ul { font-family: monospace; font-size: 13px; }
<\/style>
`;

  const cleanupExample = `<script>
  let running = $state(false);
  let ticks = $state(0);

  $effect(() => {
    if (!running) return; // no setup, no cleanup
    const id = setInterval(() => ticks++, 500);
    return () => clearInterval(id);
  });
<\/script>

<button onclick={() => running = !running}>{running ? 'stop' : 'start'}<\/button>
<p>ticks: {ticks}<\/p>

<style>
  button { font-family: system-ui; padding: 8px 14px; }
  p { font-family: monospace; }
<\/style>
`;
</script>

<svelte:head><title>Persist with $effect · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-2);">

<LessonHeader
  moduleSlug="02-tap-tempo-detective"
  lessonSlug="04-persist"
  title="Persist with $effect"
  blurb="When the BPM stabilizes, save it to localStorage. Reload the page, see the previous value. Your first $effect — and the test for when not to use one."
/>

## Why this lesson exists

The app forgets everything on refresh. Real apps do not. A tap-tempo detector that loses your last tempo when the page reloads is a toy; a tap-tempo detector that remembers is a tool. The difference is one side effect: write the latest stable BPM to `localStorage` when it changes, read it back on the next visit, show it in the prompt.

This requires the rune we have been avoiding so far: `$effect`. It is the rune for "do something in response to reactive state changing" — talking to imperative APIs, syncing with the DOM, setting up subscriptions. It is also the rune developers from React reach for the most, and the one they misuse the most. About 80% of the `$effect` calls in the wild should be `$derived` or an event handler instead. This lesson teaches the rune AND teaches the test for when to reach for it.

By the end of this lesson the tap-tempo detector remembers your last reading, and you have a clear mental model of when `$effect` is the right tool, the pattern that prevents the most common reactivity bug, and what to do about server-side rendering.

## Learning objectives

By the end of this lesson you will be able to:

- Declare an `$effect` and explain when it runs (mount + every dependency change, batched into a microtask).
- Apply the "read all dependencies unconditionally" pattern and explain why it prevents subtle short-circuit bugs.
- Recognize the two-question test for whether a piece of work belongs in an `$effect` at all.
- Return a cleanup function from an effect and explain when it runs.
- Gate browser-only code (`localStorage`, `window`, `document`) with `browser` from `$app/environment` so SSR does not blow up.
- Distinguish `$effect`, `$effect.pre`, and `$effect.root` and pick the right one.

## Concept 1: `$effect` — side effects in response to reactive state

### What it is

`$effect(fn)` registers a function to be run inside a reactive context. When the component mounts, the runtime evaluates `fn`. While `fn` runs, every read of a reactive value (a `$state`, a `$derived`, a property of a state-backed object) registers a dependency. After `fn` finishes, the runtime knows the effect's dependency set. When anything in that set is written, the runtime schedules the effect to re-run in the next microtask.

That re-execution is batched. If you write to three different dependencies in the same synchronous tick, the effect re-runs once, not three times. This matters for the localStorage persist case — a flurry of taps that produces ten BPM changes turns into one `localStorage.setItem` call after the dust settles, not ten.

Effects are the escape hatch from the declarative world into the imperative world. Everything you write inside an effect is plain JavaScript with full access to the DOM, `setInterval`, `fetch`, third-party libraries, the global `console`, anything. The reactive system pulls you back in when dependencies change. Use this pattern when you need to bridge to an API that is not reactive — and only then.

### Worked example

The persistence effect for the tap-tempo detector:

```svelte
import { browser } from '$app/environment';

let taps = $state([]);
let bpm = $derived.by(() => { /* ...averaging logic... */ });

$effect(() => {
  const value = bpm;
  if (value !== null && browser) {
    localStorage.setItem('tapTempo_lastBpm', String(value));
    lastBpm = value;
  }
});
```

Walk through this line by line. The effect reads `bpm` first thing and assigns it to a local `value`. That read registers `bpm` as a dependency — meaning the effect will re-run whenever `bpm` changes. Since `bpm` is itself a `$derived` of `taps`, the dependency chain is `taps -> bpm -> this effect`. Push a new tap, `taps` invalidates, `bpm` recomputes, the effect schedules itself, and on the next microtask flushes a write to `localStorage`.

The `browser` check is the SSR guard, covered in Concept 4. The `value !== null` check skips the first run when there are not yet two taps. The write itself is plain DOM API; nothing reactive about `localStorage`.

When the effect re-runs, the previous evaluation's dependency set is torn down and rebuilt. So if the body's reads change (e.g. an `if` reads `a` on one run and `b` on the next), the dependency set updates accordingly — same dynamic dependency behavior as `$derived`.

### Variation: cleanup functions

An effect can return a function. The returned function runs before the effect re-fires AND when the component unmounts:

<CompileSandbox initialSource={cleanupExample} height="280px" />

```svelte
$effect(() => {
  if (!running) return;
  const id = setInterval(() => ticks++, 500);
  return () => clearInterval(id);
});
```

Click start — the interval kicks off. Click stop — the effect re-runs (because `running` flipped), the previous cleanup fires (`clearInterval`), and the new run hits `if (!running) return` immediately, registering no interval. The cleanup discipline keeps timers from leaking. If you forget the cleanup, every flip of `running` would orphan another interval, and the page would slow to a crawl after a minute of clicking.

The rule of thumb: if you call something that allocates a resource (a timer, a subscription, an event listener, a websocket), return a function that disposes of it.

### Variation: `$effect.pre`

`$effect.pre(fn)` is the same as `$effect`, except it runs BEFORE the DOM is updated rather than after. The default `$effect` waits for the framework to commit the latest reactive changes to the DOM, then runs your effect — by which point the DOM reflects the new state. `$effect.pre` runs in the same scheduling phase but before that commit.

You want `$effect.pre` for things like measuring the OLD DOM before it changes (e.g. capturing scroll position before a re-render so you can restore it after). Most code uses plain `$effect`.

### Variation: `$effect.root`

`$effect.root(fn)` creates an effect that is not bound to the current component's lifecycle. It does not automatically clean up when the component unmounts. Instead, the call returns a destroy function you must invoke yourself.

```js
import { mount } from 'svelte';

const stop = $effect.root(() => {
  $effect(() => { /* ...something... */ });
  return () => { /* optional cleanup */ };
});

// later:
stop();
```

This is for the rare case where you need reactivity outside a component — typically in a shared `.svelte.js` or `.svelte.ts` module that owns a long-lived effect (a global keyboard listener, a websocket manager). For the tap-tempo app you do not need it. Mentioning it here so you recognize the name when you see it.

### Common mistakes

- **Forgetting cleanup.** Symptom: timers, listeners, or subscriptions multiply on every dependency change until the page chokes. Fix: return a cleanup function whenever the effect sets up a resource.
- **Mutating a dependency inside the effect.** Symptom: infinite loop, or the framework warning "effect_update_depth_exceeded." Fix: do not write to a value the effect reads. If you genuinely need to (rare), wrap the write in `untrack(() => ...)` or rethink the design.
- **Using `$effect` to copy one state into another.** Symptom: derived-but-stale values, race conditions between the two states. Fix: use `$derived` instead. The whole class of "I need this state to equal that state" is a `$derived`, not an effect.
- **Putting an effect inside a function so it can be "called when needed."** Symptom: error "$effect can only be used inside an effect context." Fix: effects must be declared at component top-level (or inside another effect, or inside `$effect.root`). They are not callable like ordinary functions.

### TypeScript notes

`$effect` takes `() => void | (() => void)` — a function that returns either nothing or a cleanup function. The compiler enforces this; if you return anything else (like a Promise, accidentally, from an `async` function), it will flag the type error. If you need async work inside an effect, declare the async function inside and call it:

```ts
$effect(() => {
  let cancelled = false;
  (async () => {
    const data = await fetchSomething();
    if (!cancelled) state = data;
  })();
  return () => { cancelled = true; };
});
```

The cancellation flag is the standard pattern for "if the effect re-fires before the async resolves, ignore the stale result."

## Concept 2: Read all reactive deps unconditionally

### What it is

This is the single most important detail in the lesson, and it bit me hard enough while building this curriculum site to be worth a section of its own. The pattern: at the top of the effect body, before any conditional logic, read every reactive value the effect might need into a local variable. Then run the conditional logic against the locals.

Why it matters: the dependency tracker registers dependencies based on which signals get READ during a given run of the effect. If a read is guarded behind an `if` and the `if` is false on this run, the read does not happen, and the dependency does not get tracked. The next time that signal changes, the effect does not re-fire — because as far as the tracker knows, the effect does not depend on it.

This is per-run, not permanent. As soon as something else triggers the effect AND the conditional now lets the read happen, the dependency gets registered, and from then on changes to that signal will fire the effect. But until that happens, you have a silently-broken effect that should re-run and does not.

### Worked example: the bug

<CompileSandbox initialSource={shortCircuitBug} height="320px" />

```svelte
$effect(() => {
  if (count > 0) {
    logs = [...logs, `count=${count}, mult=${multiplier}`];
  }
});
```

On the first run, `count` is 0. The body reads `count` (registering the dep), the condition is false, and the body never reads `multiplier`. The dependency set is `&lbrace; count &rbrace;`. Click "multiplier++" — nothing logs. The effect is not tracking `multiplier` yet.

Now click "count++" once. `count` is 1. The effect re-fires (because `count` changed), enters the `if`, reads `multiplier` for the first time. The new dependency set is `&lbrace; count, multiplier &rbrace;`. From here on, both buttons cause logs. But the user lost the first `multiplier++` click and would have spent the rest of the day trying to figure out why.

### Worked example: the fix

<CompileSandbox initialSource={shortCircuitFix} height="320px" />

```svelte
$effect(() => {
  const c = count;
  const m = multiplier;
  if (c > 0) {
    logs = [...logs, `count=${c}, mult=${m}`];
  }
});
```

Both reads happen up front. The dependency set is `&lbrace; count, multiplier &rbrace;` on the very first run, regardless of whether the conditional fires. Click either button — the effect re-fires, the conditional decides whether to do anything. No mystery, no silent dropped updates.

This is exactly the shape of the localStorage save in the BPM app:

```svelte
$effect(() => {
  const value = bpm; // read up front
  if (value !== null && browser) {
    localStorage.setItem('tapTempo_lastBpm', String(value));
  }
});
```

If I had written `if (bpm !== null) localStorage.setItem(..., String(bpm))`, the read inside the call would still be tracked — but only AFTER the condition passes. On the first run with `bpm === null`, the dependency would not get registered. I caught this in the dashboard sequencer on this very curriculum site, where the BPM slider stopped responding because of exactly this pattern.

### Variation: reading inside loops and async

The same rule applies to reads inside any branching structure:

```svelte
$effect(() => {
  // BUG: items only read when length > 0
  if (items.length > 0) {
    for (const item of items) { /* ... */ }
  }
});

// FIX
$effect(() => {
  const list = items; // read up front
  if (list.length > 0) {
    for (const item of list) { /* ... */ }
  }
});
```

And inside async work:

```svelte
$effect(() => {
  const id = userId; // read up front
  setTimeout(() => {
    // Reading userId here would NOT track it — setTimeout runs outside
    // the tracking context.
    fetch(`/api/users/${id}`);
  }, 100);
});
```

Anything that happens after an `await` or inside a callback runs outside the effect's tracking scope. Reads inside callbacks do not get tracked. The "read up front into a local" pattern handles all of these uniformly.

### Common mistakes

- **Reading deps deep inside nested calls.** Same problem — if the call is guarded behind a condition that is false on the first run, the deps inside it never register. Fix: read at the top.
- **Assuming the tracker is "smart enough" to see all reachable reads.** It is not. It only sees reads that actually execute. JavaScript does not have a way to statically analyze the function body cheaply at runtime.
- **Using the read-up-front pattern when you do NOT want the dep tracked.** Sometimes you genuinely want the effect to fire only when `a` changes but to peek at the current `b` without tracking it. That is what `untrack` is for: `const b = untrack(() => bValue)`. The wrap explicitly drops the dependency.

### TypeScript notes

No type-level help here — the bug is a runtime tracking issue, not a typing issue. Some teams write an ESLint rule that flags effect bodies where a reactive read happens after a conditional. The Svelte team has discussed adding a compiler warning; as of Svelte 5.x there is not one.

## Concept 3: When `$effect` is the wrong tool

### What it is

Most code that calls `$effect` does not need to. The rune is shaped like "do X when Y changes," and that shape fits a lot of intuitive descriptions — but most of those descriptions have a better tool. The two-question test:

1. **Am I trying to compute a value as a function of other values?** Use `$derived`. Not `$effect`.
2. **Am I trying to react to an event the user just performed?** Do the work inside the event handler. Not `$effect`.

If both answers are no, then ask: am I bridging to an imperative API (localStorage, document, a third-party library, a network call) or syncing with the DOM (focus, scroll, measurement) or managing a subscription (websocket, interval, event listener)? If yes, `$effect` is appropriate.

### Worked example: computing a derived value

```svelte
// WRONG
let count = $state(0);
let doubled = $state(0);

$effect(() => {
  doubled = count * 2;
});

// RIGHT
let count = $state(0);
let doubled = $derived(count * 2);
```

The wrong version works. `doubled` ends up equal to `count * 2`. But it costs an effect re-run, a state write, an extra render, and creates a window of time where `doubled` is stale relative to `count`. The right version is cached, synchronous, and has no extra state.

The signal: if your effect's only job is to write a value into another state based on reactive inputs, you wanted `$derived`.

### Worked example: reacting to events

```svelte
// WRONG — fires whenever modalOpen changes, regardless of why
let modalOpen = $state(false);

$effect(() => {
  if (modalOpen) trackAnalytics('modal_opened');
});

function openModal() { modalOpen = true; }

// RIGHT — fire it where the change happens
function openModal() {
  modalOpen = true;
  trackAnalytics('modal_opened');
}
```

The wrong version fires on every truthy transition of `modalOpen` — including programmatic ones from elsewhere, including double-fires if the state gets briefly toggled. The right version fires once, where the human meaning lives. Effects are not for tracking "this event happened"; they are for tracking "this value is now in this state."

### Worked example: legitimate use

```svelte
// Document title sync — talking to a non-reactive API
$effect(() => {
  document.title = `${unreadCount} unread — Inbox`;
});

// Focus an input when a modal opens — DOM sync
let inputRef = $state();
$effect(() => {
  if (modalOpen && inputRef) inputRef.focus();
});

// Save to localStorage — talking to a non-reactive API
$effect(() => {
  const value = bpm;
  if (value !== null && browser) {
    localStorage.setItem('tapTempo_lastBpm', String(value));
  }
});

// Keyboard listener — subscription with cleanup
$effect(() => {
  function handle(e) { if (e.key === 'Escape') modalOpen = false; }
  window.addEventListener('keydown', handle);
  return () => window.removeEventListener('keydown', handle);
});
```

All four are appropriate. They bridge to APIs the reactive system does not know about, or set up something with explicit lifecycle.

### Common mistakes

- **"It feels nicer to put it all in one place."** A common excuse for using effects where derived would do. Hold the line. The derived is the better abstraction even if you have to spread logic across more declarations.
- **"I need to fire it once after mount."** That is just an effect that runs once because it has no dependencies. Or, if you want truly one-shot behavior, write it at top-level — code that runs at component init runs once. Effects scheduled with no deps run once on mount and never re-fire.
- **"I want to debounce some work."** Set up the debounce inside the effect — `clearTimeout` in cleanup, `setTimeout` to schedule. The effect re-fires on every change, cancels the prior timeout, schedules a new one. That is a small, idiomatic pattern.

## Concept 4: SSR-safe browser-only code

### What it is

SvelteKit renders pages on the server first by default. The server is Node.js — there is no `window`, no `document`, no `localStorage`. If your code touches these globals during initial render, the server throws and your page fails to load.

Effects do not run on the server. Code inside an `$effect(() => &lbrace; ... &rbrace;)` is safe — effects only fire on the client. But code at the top of `<script>` (the component's initialization code) DOES run on the server. If you write `let saved = localStorage.getItem('x')` at module top, the server crashes.

The fix is the `browser` constant from `$app/environment`. It is `true` in the client bundle and `false` in the server bundle. Wrap any top-level browser-API call in a `browser` check.

### Worked example

```svelte
import { browser } from '$app/environment';

// Top-level: runs during both SSR and hydration. Guard.
let lastBpm = $state(browser ? Number(localStorage.getItem('tapTempo_lastBpm')) || null : null);

// Effect body: only runs on the client. Technically the guard is redundant
// here, but it documents intent and survives copy-paste into a top-level scope.
$effect(() => {
  const value = bpm;
  if (value !== null && browser) {
    localStorage.setItem('tapTempo_lastBpm', String(value));
  }
});
```

On the server, `browser` is false, so the top-level expression evaluates to `null`. The page renders with no last BPM (the initial HTML shows just "tap to start"). When the bundle hits the client and hydration runs, the same code re-evaluates with `browser` true, reads `localStorage`, and the UI updates if there was a saved value.

The effect inside `$effect` is double-guarded with `browser` mostly as documentation — it would not run on the server anyway. The guard makes the intent obvious to a reader and makes the code resilient to refactoring (you might later pull this snippet into a different scope).

### Variation: the older `typeof` pattern

You will see code that uses `typeof localStorage !== 'undefined'` instead of `browser`. It works — `localStorage` is genuinely undefined on the server, so the check passes only on the client. But it is more verbose, less obvious in intent, and bypasses the SvelteKit-aware tooling that knows `browser` is a build-time constant (SvelteKit can dead-code-eliminate branches like `if (browser) { ... }` from the server bundle entirely).

Prefer `browser`. Use `typeof` only in code that is not SvelteKit-aware (e.g. a shared library you publish to npm).

### Variation: `onMount` from `svelte`

Svelte still ships `onMount(fn)`, a function that schedules `fn` to run once after the component is first inserted into the DOM. It only fires on the client. Old Svelte code uses it heavily.

`$effect(() => &lbrace; ... &rbrace;)` with no dependencies (i.e. no reactive reads inside) behaves nearly identically — runs once on mount, returns a cleanup function that runs on unmount. The difference is mostly aesthetic. Either is fine. New Svelte 5 code mostly uses `$effect`.

### Common mistakes

- **Calling a browser API at component top-level without `browser` guard.** Symptom: SSR error, "localStorage is not defined" or "window is not defined." Fix: wrap in `if (browser) { ... }` or move into an `$effect`.
- **Doing the same with `JSON.parse(localStorage.getItem(...))` and forgetting the parse can throw on garbage data.** Symptom: app crashes on load with a malformed entry. Fix: wrap parse in try/catch, default to a fallback.
- **Trying to detect SSR with `typeof window === 'undefined'` from a `.svelte.ts` shared module.** Works, but `browser` from `$app/environment` is the SvelteKit-idiomatic answer and easier to recognize.

## Putting it together

The persisted tap-tempo detector, with the `browser` guard and the read-up-front pattern, in full:

<CompileSandbox initialSource={persistedSource} height="660px" />

Tap to a tempo. Reload the sandbox. The previous BPM should appear in the prompt as "(last: X BPM)." Tap a new tempo and the saved value updates. The whole persistence layer is:

- One import (`browser` from `$app/environment`).
- One additional state (`lastBpm`), initialized from `localStorage` only on the client.
- One `$effect` that watches `bpm`, reads it up-front, writes to `localStorage` and updates `lastBpm` when non-null.

The rest of the component is the BPM detector from the previous lesson, unchanged. That is the shape of well-decomposed reactive code — persistence is added without touching the computation, the UI, or the event handlers.

<OpenTheHood title="When effects fire and the batching story">

Effects do not fire synchronously when their dependencies change. They are queued and flushed in a microtask, after the current synchronous execution completes.

This means a sequence of writes batches into a single effect re-run:

```js
count = 1;
count = 2;
count = 3;
// Effects depending on count fire ONCE, with count = 3.
```

This is the batching behavior React introduced explicitly with `unstable_batchedUpdates` and made automatic in React 18. In Svelte it is the default and there is no opt-out.

For the localStorage save, this means: if 50 taps come in quickly, the effect does not fire 50 times. It fires once after the burst, with the latest BPM. Same number of `localStorage.setItem` calls regardless of tap rate.

For cases where you need synchronous flushing — you have changed state and want the DOM to reflect it on the very next line — use `flushSync(() => &lbrace; ... &rbrace;)` from `svelte`. Rare; usually batching is what you want.

For cases where you want to read a value inside an effect WITHOUT subscribing to it (so the effect does not re-fire when that value changes), use `untrack(() => value)` from `svelte`. Also rare; useful for "read the current setting once but do not care about further changes."

The runtime model is small: signals have subscriber lists, writes mark subscribers dirty, derived recomputes are lazy (next-read), effects are scheduled (next-microtask). Reading the `runtime.js` file in the Svelte source is about an hour and pays back enormously in mental model clarity.

</OpenTheHood>

## Exercises

### Exercise 1: Wire it into your project

**Setup:** the SvelteKit project with the BPM detector from the previous lesson.

**What to do:** add the `browser` import, the `lastBpm` state, and the `$effect` that writes to localStorage. Tap to a tempo, refresh the browser, see "last: X BPM" in the prompt.

**Verify by:** the value survives a hard refresh (Cmd-Shift-R / Ctrl-Shift-R). Opening DevTools > Application > Local Storage > localhost:5173 shows a `tapTempo_lastBpm` entry with your last reading.

**Stretch:** add a "clear saved" button next to reset that calls `localStorage.removeItem('tapTempo_lastBpm')` and sets `lastBpm = null`. Verify that the prompt goes back to just "tap to start" after clicking.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import { browser } from '$app/environment';
  let lastBpm = $state(browser ? Number(localStorage.getItem('tapTempo_lastBpm')) || null : null);

  // ...taps, bpm as before...

  $effect(() => {
    const value = bpm;
    if (value !== null && browser) {
      localStorage.setItem('tapTempo_lastBpm', String(value));
      lastBpm = value;
    }
  });

  function clearSaved() {
    if (browser) localStorage.removeItem('tapTempo_lastBpm');
    lastBpm = null;
  }
</script>

<button onclick={clearSaved}>clear saved</button>
```

The `clearSaved` function is an ordinary event handler — no effect needed because it is reacting to a click, not a state change.

</details>

### Exercise 2: Reproduce the short-circuit bug

**Setup:** the sandbox from Concept 2 with the BUGGY version.

**What to do:** without modifying the code, click "multiplier++" five times. Then click "count++" once. Note that the log only shows ONE entry, with `mult=7` (the current multiplier value), not five entries with `mult=3, 4, 5, 6, 7`.

Then switch to the FIXED version and repeat. Note that every multiplier click now logs immediately (after the initial `count > 0` is satisfied).

**Verify by:** the buggy version is silent on `multiplier++` until `count` changes. The fixed version logs on every click.

**Stretch:** write a one-paragraph explanation in your own words of why the bug happens. The exercise is to be able to spot this pattern in your own code later. If you cannot explain it, re-read Concept 2.

### Exercise 3: Persist taps, not just BPM

**Setup:** the working persisted detector.

**What to do:** save the full `taps` array to localStorage on every change (so the user can refresh and resume mid-session). On load, read the array back and initialize `taps` with it.

**Verify by:** tap five times, refresh, the count meta should still say "5 taps" and the BPM display should still show the same number. Tap two more times — BPM updates based on intervals between all seven taps.

<details>
<summary>Show solution</summary>

```svelte
<script>
  import { browser } from '$app/environment';

  const initialTaps = browser
    ? (() => {
        try {
          const raw = localStorage.getItem('tapTempo_taps');
          return raw ? JSON.parse(raw) : [];
        } catch { return []; }
      })()
    : [];

  let taps = $state(initialTaps);

  $effect(() => {
    const list = taps;
    if (browser) localStorage.setItem('tapTempo_taps', JSON.stringify(list));
  });

  function reset() {
    taps = [];
  }
</script>
```

The `try/catch` defends against a malformed entry (unlikely, but cheap). The `reset` function clears the array; the effect fires and writes `[]` to localStorage. No need for explicit cleanup.

</details>

### Exercise 4: Add a "remember the room's BPM" timer

**Setup:** the working persisted detector.

**What to do:** add a `$effect` that prints `'BPM is now ' + bpm` to the console two seconds after the BPM stabilizes (i.e. two seconds after the most recent change to `bpm`). If BPM changes again before the two seconds elapse, cancel the pending print and schedule a new one.

**Verify by:** tap a tempo. Stop tapping. Two seconds later, the console prints the BPM. Tap again before two seconds elapse — the original print never fires; a new one is scheduled.

<details>
<summary>Show solution</summary>

```svelte
$effect(() => {
  const value = bpm;
  if (value === null) return;
  const id = setTimeout(() => {
    console.log('BPM is now ' + value);
  }, 2000);
  return () => clearTimeout(id);
});
```

The cleanup pattern. Every time `bpm` changes, the previous timeout is cleared and a new one is scheduled. The print only fires if the BPM stays stable for two full seconds. This is the idiomatic Svelte/Solid/MobX debounce pattern — no library needed.

</details>

### Exercise 5 (stretch): Build a generic `usePersistent` helper

**Setup:** the working persisted detector with the taps-persistence from Exercise 3.

**What to do:** factor out the read-then-write-on-change pattern into a helper in a new `.svelte.js` file. The signature: `persistent(key, initial)` returns a reactive object whose `value` property is read/written and automatically synced to localStorage.

Usage in the component:

```svelte
import { persistent } from '$lib/persistent.svelte.js';

const lastBpm = persistent('tapTempo_lastBpm', null);
// read: lastBpm.value
// write: lastBpm.value = 120
```

**Verify by:** replace the manual `lastBpm` state + effect with one `persistent(...)` call. Behavior unchanged.

<details>
<summary>Show solution</summary>

```js
// src/lib/persistent.svelte.js
import { browser } from '$app/environment';

export function persistent(key, initial) {
  let value = $state(
    browser
      ? (() => {
          try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; }
          catch { return initial; }
        })()
      : initial
  );

  $effect(() => {
    const v = value;
    if (browser) localStorage.setItem(key, JSON.stringify(v));
  });

  return {
    get value() { return value; },
    set value(v) { value = v; }
  };
}
```

The `get`/`set` accessor pattern is how you expose `$state` across a module boundary while preserving reactivity. The `$effect` lives inside the helper but is tied to the calling component's lifecycle because runes always attach to the nearest component context.

Caveat: the `$effect` call inside `persistent` only works when `persistent` is called from a component's top-level scope. Calling it from inside an event handler would fail with "$effect can only be used inside an effect context." This is fine for the use case but worth being aware of.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` with the persistence layer (the `browser` import, `lastBpm` state, the `$effect` that writes to localStorage).
- A working app that survives a page reload — your last detected BPM appears in the prompt.

### Verify it works

- Tapping a tempo and refreshing shows "(last: X BPM)" in the prompt.
- DevTools > Application > Local Storage shows a `tapTempo_lastBpm` entry with the value.
- Reading the `$effect` body, you can point to the line that reads the dependency up-front, and you can explain why it is there.
- The `browser` guard prevents the page from crashing in SSR (no errors in the terminal where `npm run dev` is running).

## Common questions

**Q: Why does my effect not fire when I update a property on a nested object?**
A: It usually does — `$state` proxies track property writes recursively. If it does not, you may have replaced the entire reference with a plain (non-state) object, or you may be reading a property only behind a conditional (see Concept 2). Check both.

**Q: Can I use `$effect` to fetch data?**
A: You can, but in SvelteKit the better tool is a `load` function (Module 5). Effects are fine for fetches that depend on client-only state — for example, refetching a user's profile when they change a filter — but the page's initial data should come from `load`.

**Q: My effect fires twice on the first render. Is that a bug?**
A: In dev with HMR/strict-mode-like behavior, no — sometimes the framework deliberately re-runs effects to surface cleanup issues. In production it does not happen. If it persists in production, the effect is probably writing to a state it also reads, causing a self-trigger. Find the write.

**Q: When should I use `flushSync`?**
A: When you need to read a DOM property that depends on a just-written state, on the line right after the write. Example: setting a child component's value via a bind and then needing to measure its rendered size. Most code never needs it.

**Q: What is the relationship between `$effect` and `onMount`?**
A: `$effect` with no reactive reads runs once on mount, just like `onMount`. `$effect` with reactive reads runs on mount AND re-fires on dep changes. `onMount` only ever fires once. New code should default to `$effect`; `onMount` is still supported for back-compat.

## What's next

Next lesson: a small game on top of the detector. The user gets a target BPM and tries to tap to match it. The accuracy verdict is a `$derived` that returns an object with a label and a CSS class. No new runes — just composing what you have already learned into a working interactive feature. It is the capstone of the module.

<SourcesSection lessonKey="02-tap-tempo-detective/04-persist" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
