<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const bpmSource = `<script>
  let taps = $state([]);

  // Average interval between consecutive taps, in milliseconds.
  // null when there aren't enough taps to compute an interval.
  let avgInterval = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8); // last 8 taps for a stable average
    let total = 0;
    for (let i = 1; i < recent.length; i++) {
      total += recent[i] - recent[i - 1];
    }
    return total / (recent.length - 1);
  });

  // BPM = 60,000ms per minute / interval in ms
  let bpm = $derived(avgInterval ? Math.round(60000 / avgInterval) : null);

  function handleTap() {
    taps.push(Date.now());
  }

  function reset() {
    taps = [];
  }
<\/script>

<div class="card">
  <div class="bpm-display">
    {#if bpm}
      <span class="num">{bpm}<\/span>
      <span class="unit">BPM<\/span>
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
  .card {
    max-width: 280px; margin: 0 auto; padding: 24px; background: #1a1d2a;
    border-radius: 16px; font-family: system-ui; color: #ecedf3;
  }
  .bpm-display {
    text-align: center; padding: 24px 0; border-bottom: 1px solid #262a3a;
    margin-bottom: 24px;
  }
  .num { font-size: 72px; font-weight: 700; color: #e5468b; line-height: 1; }
  .unit { font-size: 16px; color: #9ea3b8; margin-left: 8px; }
  .prompt { font-size: 18px; color: #5e6378; }
  .tap {
    width: 100%; background: #e5468b; color: white; border: 0;
    padding: 24px; font-size: 24px; font-weight: 700; border-radius: 12px;
    letter-spacing: 0.1em; cursor: pointer;
    box-shadow: 0 8px 24px -8px #e5468b;
  }
  .tap:active { transform: translateY(1px); }
  .meta {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 16px; color: #9ea3b8; font-size: 14px;
  }
  .reset {
    background: transparent; color: #9ea3b8; border: 1px solid #262a3a;
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font: inherit;
  }
  .reset:disabled { opacity: 0.4; cursor: not-allowed; }
<\/style>
`;

  const accuracyChallenge = `<script>
  let taps = $state([]);
  let bpm = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    return Math.round(60000 / (total / (recent.length - 1)));
  });

  // Add a derived "consistency" value: the standard deviation of intervals.
  // Lower stddev = more consistent tapping. Display it next to the BPM.

  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }
<\/script>

<button onclick={handleTap}>TAP<\/button>
{#if bpm}<p>BPM: {bpm}<\/p>{/if}
<button onclick={reset}>reset<\/button>

<style>
  button { background: #e5468b; color: white; border: 0; padding: 16px 28px;
    margin-right: 8px; border-radius: 8px; font: inherit; cursor: pointer; }
  p { font-family: system-ui; font-size: 24px; }
<\/style>
`;

  const doubleReadSource = `<script>
  let count = $state(0);

  // Two derived values reading the same state.
  let doubled = $derived(count * 2);
  let squared = $derived(count * count);
  let summary = $derived(\`count=\${count}, doubled=\${doubled}, squared=\${squared}\`);
<\/script>

<button onclick={() => count++}>+<\/button>
<button onclick={() => count = 0}>reset<\/button>
<p>{summary}<\/p>

<style>
  button { font-family: system-ui; padding: 8px 14px; margin-right: 6px; }
  p { font-family: monospace; }
<\/style>
`;
</script>

<svelte:head><title>Derive the BPM · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-2);">

<LessonHeader
  moduleSlug="02-tap-tempo-detective"
  lessonSlug="03-derive-bpm"
  title="Derive the BPM with $derived"
  blurb="Compute the average interval between taps. Display it as BPM. Your first $derived — the rune for 'this value is a function of other reactive values.'"
/>

## Why this lesson exists

The list of taps is raw data. What the user actually wants is a number: a tempo in beats per minute. To get there, we compute — take the intervals between consecutive taps, average them, divide 60,000 milliseconds by the average. That's BPM.

We could compute it inside the template every time. That works. It also re-runs on every render even when the inputs have not changed, and forces the template to carry computation logic that does not belong there. Svelte gives you a better tool: `$derived`, a rune that declares "this value is a function of those reactive values." The runtime tracks the dependencies automatically, caches the result, and re-evaluates only when something it depends on actually changes.

This lesson introduces `$derived` and `$derived.by`, walks through both syntactic forms, and contrasts the approach with React's `useMemo`. By the end you will have a working BPM detector you can tap a beat into and read the tempo off the screen.

## Learning objectives

By the end of this lesson you will be able to:

- Declare a derived value with `$derived(expr)` and explain what reactive dependencies it tracks.
- Use the `$derived.by(() => { ... })` form when the computation needs more than one expression.
- Explain why `$derived` does not need a dependency array the way React's `useMemo` does.
- Choose between `$derived` and a plain function for a computed value.
- Recognize when an attempt to use `$derived` is really an attempt to write an effect, and pick the right tool.

## Concept 1: `$derived` — values that are functions of other values

### What it is

A `$derived` declaration binds a name to the result of an expression that reads reactive state. The runtime watches which signals get read during evaluation, registers them as dependencies, and re-evaluates the expression whenever any dependency changes. The latest value is cached; reading the binding multiple times in one render produces one computation.

The shape is `let name = $derived(expression)`. It looks like a plain assignment but it is not — the right-hand side is not evaluated at declaration time and stored, it is evaluated reactively. Every read of `name` inside another reactive context (template binding, another derived, an effect) reaches into the cache or recomputes, depending on whether dependencies have changed.

This is the same idea as Vue 3's `computed()`, Solid's `createMemo()`, MobX's `computed`. The algorithm is the standard one: lazily evaluate, track dependencies during evaluation, mark stale on dependency change, recompute on next read. Svelte 5 wraps it in the rune syntax and lets the compiler hide the `.value` or `()` wrapper noise those other libraries leave you with.

### Worked example

```svelte
let avgInterval = $derived.by(() => {
  if (taps.length < 2) return null;
  const recent = taps.slice(-8);
  let total = 0;
  for (let i = 1; i < recent.length; i++) {
    total += recent[i] - recent[i - 1];
  }
  return total / (recent.length - 1);
});

let bpm = $derived(avgInterval ? Math.round(60000 / avgInterval) : null);
```

Two deriveds. The first, `avgInterval`, computes the average milliseconds between consecutive taps. We slice off the last 8 taps so the average tracks the user's current tempo instead of being dragged down by old, slow taps. The function is multi-line, so we use `$derived.by` and pass a function.

The second, `bpm`, converts the interval to beats per minute. 60,000 milliseconds in a minute divided by the interval in milliseconds gives beats per minute. The expression is a single line, so we use `$derived` directly. It reads `avgInterval`, so the runtime knows `bpm` depends on `avgInterval`, which depends on `taps`. When `taps` changes, both deriveds invalidate; the next read recomputes `avgInterval`, then `bpm`.

The dependency graph is `taps -> avgInterval -> bpm`. The runtime computed this without any declaration from you. Compare that to React, where you would have to write:

```js
const avgInterval = useMemo(() => {
  if (taps.length < 2) return null;
  // ...
}, [taps]); // <-- you tell React what to watch

const bpm = useMemo(() => {
  return avgInterval ? Math.round(60000 / avgInterval) : null;
}, [avgInterval]);
```

Two dependency arrays you have to keep in sync with the function bodies. Forget an entry and the value goes stale; add too much and it re-runs needlessly. The React linter catches some of these mistakes; not all. Svelte sidesteps the whole class of bugs by tracking at runtime.

### Variation: the two syntactic forms

`$derived(expression)` is the single-expression form. The expression is evaluated, and its result is the value:

```svelte
let count = $state(0);
let doubled = $derived(count * 2);
```

`$derived.by(() => { ... })` is the multi-line form. You pass a function; it is called; its return value is the value:

```svelte
let summary = $derived.by(() => {
  if (count === 0) return 'none';
  if (count === 1) return 'one';
  return `${count} of them`;
});
```

They are behaviorally identical. The compiler emits roughly the same runtime call. Use whichever reads better — `$derived` for a one-liner, `$derived.by` when you need locals, branches, or a loop.

### Variation: derived chains

Deriveds can read other deriveds. The dependency graph extends naturally:

<CompileSandbox initialSource={doubleReadSource} height="320px" />

`summary` reads `count`, `doubled`, and `squared`. All four bindings update on a single click of the + button. The runtime computes `doubled` and `squared` first (they depend only on `count`), then `summary` (which depends on all three). Each is computed once per `count` change, no matter how many times the template reads them.

### Variation: derived holding objects

A derived can return any value — including objects or arrays:

```svelte
let stats = $derived.by(() => {
  if (taps.length < 2) return null;
  return {
    count: taps.length,
    bpm: computeBpm(taps),
    consistency: computeStddev(taps)
  };
});
```

Read `stats.bpm` in the template. The runtime tracks the read; when `taps` changes, `stats` recomputes, the new object replaces the old, the template reads the new fields. Returning an object is a clean way to group several related computed values without writing three separate deriveds when they share input handling.

### Common mistakes

- **Mutating reactive state inside a `$derived`.** Deriveds must be pure. If you mutate state, the next read might cause the derived to re-run and mutate again, leading to infinite loops or unpredictable updates. Symptom: the framework warns ("derived expressions should be pure"), or behavior gets weird. Fix: move the mutation into an event handler or `$effect`.
- **Using a plain function and then wondering why the template feels expensive.** A plain function is recomputed every time its caller re-evaluates. A `$derived` is computed once per dependency change and cached. For trivial work the difference is invisible; for non-trivial work, prefer `$derived`.
- **Asking `$derived` to compute side effects.** `$derived(localStorage.setItem('k', v))` — wrong tool. Side effects belong in `$effect` (next lesson). The clue is that the value being declared has no meaningful "result"; you only wanted the function to run.
- **Reaching for `$derived` in a `.ts` file that is not `.svelte.ts`.** Runes only work in `.svelte` and `.svelte.ts` files. Rename the file if you need shared deriveds.
- **Treating `$derived` as a writable.** You cannot assign to a derived — it is computed. Symptom: type error or runtime "cannot assign to derived" message. Fix: move the value into `$state` if you need to write to it.

### TypeScript notes

The derived's type is inferred from the expression's return type. If you need to be explicit:

```ts
let bpm = $derived<number | null>(
  avgInterval ? Math.round(60000 / avgInterval) : null
);
```

For `$derived.by`, the type is the function's return type — also usually inferred correctly.

## Concept 2: `$derived` vs a plain function

### What it is

You can compute a value two ways: declare it as a `$derived` and read the binding, or write a plain function and call it where you need the value. Both work. The differences are caching and tracking semantics.

A `$derived` is cached. Reading it ten times in one render produces one computation. The runtime knows the cached value is still good as long as no dependency has changed since the last evaluation.

A plain function has no cache. Every call runs the body. If the body reads reactive state, the reads are still tracked by whatever reactive context is calling — but the function itself does not cache, and calling it ten times runs it ten times.

For trivial work, the difference does not matter. For computations that read large arrays, do real arithmetic, or get called in many places, the caching is worth a lot.

### Worked example

The function version:

```svelte
<script>
  let taps = $state([]);
  function computeBpm() {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) total += recent[i] - recent[i - 1];
    return Math.round(60000 / (total / (recent.length - 1)));
  }
</script>

<p>BPM: {computeBpm()}</p>
<p>also BPM: {computeBpm()}</p>
```

This works. Both reads call `computeBpm`. Both calls slice the array, walk it, divide. Two computations per render. The template binding tracks `taps` (because the function read it during the call) so the bindings re-evaluate on push.

The derived version:

```svelte
<script>
  let taps = $state([]);
  let bpm = $derived.by(() => { /* same body */ });
</script>

<p>BPM: {bpm}</p>
<p>also BPM: {bpm}</p>
```

Same template, but only one computation per render. The runtime caches the result of the derived. Reading `bpm` twice hits the cache the second time.

For our 8-element slice the saving is meaningless. For a derived that filters a thousand items or runs an FFT, you would want the cache.

### Variation: when a function is correct

A function is the right tool when the value depends on an argument that is not state. For example, "what is the formatted version of this timestamp" takes a timestamp as input:

```svelte
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString();
}
```

You would not write this as a derived because there is no single "the timestamp" — it is whatever you pass in. Call `formatTime(t)` inside the each block, you get the right formatted string per item.

The rule of thumb: if the computation depends only on reactive state, use `$derived`. If it depends on an argument, use a function.

### Variation: a function inside a derived

Both can collaborate:

```svelte
function tail(arr, n) {
  return arr.slice(-n);
}

let recentTaps = $derived(tail(taps, 8));
```

The derived calls the function. The function reads no state itself — it operates on its argument. The dependency on `taps` comes from passing `taps` in. This pattern keeps the function reusable (you could call `tail(otherList, 4)` elsewhere) and the derived focused on naming the specific computed value.

### Common mistakes

- **Defining a function and then writing `$derived(myFn)` without the parens.** Stores the function itself as the derived value, not the result of calling it. You meant `$derived(myFn())`. Symptom: the template renders `[Function: myFn]` or similar. Fix: call the function.
- **Calling a function from a derived where the function takes time and you do not want it re-running.** Memoize the function or move its logic into the derived. Reads are cheap; redundant calls to expensive functions are not.
- **Using a function for cosmetics' sake when a derived is clearer.** "It's just a function call, what's the difference?" is a fine argument until the derived's name documents intent. `bpm` reads better in a template than `computeBpm()` does.

## Concept 3: No dependency array

### What it is

The most striking thing about `$derived` if you come from React is what is missing. There is no array of dependencies. You do not declare what the derived depends on. The runtime figures it out by watching which signals are read during evaluation.

This is possible because Svelte's reactive values go through proxies and getters that can intercept reads. JavaScript does not let you intercept plain variable reads, so the compiler rewrites references to `$state` variables into calls to runtime helpers (`$.get(...)`) — and those calls register subscriptions when called inside a tracking context.

The upshot: every time a derived re-evaluates, the runtime tears down the previous dependency list and rebuilds it from the reads that happened this time. So if a derived has a conditional that reads `a` on one run and `b` on the next, the dependencies switch automatically. You do not have to think about it.

### Worked example

```svelte
<script>
  let mode = $state('a');
  let a = $state(1);
  let b = $state(2);

  let value = $derived.by(() => {
    return mode === 'a' ? a : b;
  });
</script>
```

`value` depends on `mode` (always read) plus `a` or `b` depending on `mode`'s value. When `mode` is 'a', the derived's dependency set is `&lbrace; mode, a &rbrace;`. When `mode` flips to 'b', the derived re-runs (because `mode` changed), reads `b` instead of `a`, and its new dependency set becomes `&lbrace; mode, b &rbrace;`. Subsequent writes to `a` will not invalidate `value` until `mode` flips back.

This dynamic-dependency behavior is the same in Solid and Vue 3 and MobX. React's `useMemo` cannot do it because the dependency array is static — you declare `[mode, a, b]` to be safe, and any write to any of them re-runs the memo, even when the result will not change.

### Variation: indirect reads through helpers

A derived's dependencies are determined by every read that happens during evaluation, including reads inside functions it calls:

```svelte
function isHigh(n) { return n > 100; }

let bpm = $state(120);
let label = $derived(isHigh(bpm) ? 'fast' : 'slow');
```

`label` depends on `bpm` even though the read happens inside `isHigh`. The function call is transparent to dependency tracking — the read is the read, regardless of where in the call stack it happens.

The same applies if you call a function from another file. As long as the read goes through the reactive runtime (i.e. the value is a `$state` or a getter on a state-backed object), it gets tracked.

### Variation: reads not tracked

Some reads do NOT establish dependencies. Reading via `$state.snapshot(value)` produces a plain JavaScript copy and does not subscribe. Reading inside `untrack(() => ...)` (from `svelte`) also skips subscription. These are escape hatches for the rare case where you want the current value but do not want the derived to re-run on future changes.

We will not need either in this module. They exist because sometimes you really do want to peek without subscribing — for example, reading a setting once when constructing a derived that should not re-run if the setting changes later.

### Common mistakes

- **Putting state writes inside a derived to "trigger" re-runs.** The dependency tracking handles this — you do not need to nudge it. State writes inside a derived are wrong (deriveds should be pure). Fix: remove the writes; trust the tracker.
- **Worrying that reading a deeply nested object property will not be tracked.** With `$state` proxies, every property read on a tracked object is tracked, recursively. There are no gotchas — you do not have to "shallow" or "deep" anything. The proxy handles it.
- **Trying to short-circuit dependency tracking by reading inside `setTimeout` or `requestAnimationFrame`.** Those callbacks run outside the tracking context, so reads inside them do not subscribe. If you want the derived to update, do the read directly in the derived body. If you want to NOT subscribe to a particular read, use `untrack`.

## Putting it together

The whole BPM-detector component:

<CompileSandbox initialSource={bpmSource} height="640px" />

Tap to a steady beat. The display updates after the second tap and stabilizes as you keep going. Try tapping along to a song you know — most pop is in the 100-130 BPM range, dance music 120-140, ballads 60-90.

The script in full:

```svelte
<script>
  let taps = $state([]);

  let avgInterval = $derived.by(() => {
    if (taps.length < 2) return null;
    const recent = taps.slice(-8);
    let total = 0;
    for (let i = 1; i < recent.length; i++) {
      total += recent[i] - recent[i - 1];
    }
    return total / (recent.length - 1);
  });

  let bpm = $derived(avgInterval ? Math.round(60000 / avgInterval) : null);

  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }
</script>
```

One `$state` array, two `$derived` values, two event handlers. The derivation chain (`taps -> avgInterval -> bpm`) is the heart of the app. Everything else is presentation.

<OpenTheHood title="How dependency tracking works under the hood">

When a derived evaluates, the runtime sets a global "current effect" pointer to the derived's internal effect object. Every signal read during evaluation calls a helper like `$.get(signal)`, which checks the current effect pointer and, if non-null, registers a subscription edge from the signal to the current effect.

When evaluation finishes, the runtime clears the pointer and stashes the new dependency set on the effect. Old subscriptions that did not get re-established are torn down. New ones are persisted.

When any signal in that dependency set is written to, the runtime walks its subscriber list and marks each subscriber dirty. Dirty derives are not immediately recomputed — they are recomputed lazily, when something tries to read their value next. This keeps unused derivations from costing anything.

For effects (next lesson), the lazy semantics flip — the runtime schedules them for re-execution in the next microtask. Effects fire actively; deriveds compute on demand.

This algorithm is small. The actual Svelte 5 implementation lives in `packages/svelte/src/internal/client/runtime.js` and is around 1000 lines including related plumbing. The core of it is the same algorithm Solid and Vue 3 use. Worth reading once if you want a clear mental model of reactive systems.

The compiler's job: rewrite reads of `$state` variables into `$.get(...)` calls so the runtime can intercept them. JavaScript itself does not let you intercept variable reads, so without the compile step, you would have to write something like `myState.value` everywhere, the way you do in Solid (`mySignal()`) or Vue (`myRef.value`). The runes are syntactic sugar that the compiler peels back into the same lower-level operations.

</OpenTheHood>

## Exercises

### Exercise 1: Wire it into your project

**Setup:** the SvelteKit project with last lesson's array-based tap component.

**What to do:** update `src/routes/+page.svelte` with the BPM-detector version. Tap along to a song you know. The BPM should match (within a few) after 4-5 taps.

**Verify by:** the BPM number appears after the second tap, then stabilizes as you keep tapping. Reset clears the BPM back to "tap to start."

**Stretch:** add a `<small>` element near the BPM that shows the underlying `avgInterval` in milliseconds — a debug display showing the framework's intermediate value.

<details>
<summary>Show solution</summary>

```svelte
{#if bpm}
  <span class="num">{bpm}</span>
  <span class="unit">BPM</span>
  <small style="display: block">avg interval: {Math.round(avgInterval)}ms</small>
{:else}
  <span class="prompt">tap to start</span>
{/if}
```

Reading `avgInterval` in the template tracks the dependency the same way reading `bpm` does. Both deriveds update on every tap.

</details>

### Exercise 2: Add a consistency indicator

**Setup:** the sandbox below has the working BPM detector with a comment marking where to add a consistency display.

**What to do:** add a `$derived` value that computes the standard deviation of the recent intervals. Display it next to the BPM as "±NN ms." Lower means more consistent tapping.

**Verify by:** tap steadily, the number stays small. Tap erratically, the number gets large. Resetting clears both displays.

<CompileSandbox initialSource={accuracyChallenge} height="540px" />

<details>
<summary>Show solution</summary>

```svelte
<script>
  let consistency = $derived.by(() => {
    if (taps.length < 3) return null;
    const recent = taps.slice(-8);
    const intervals = [];
    for (let i = 1; i < recent.length; i++) {
      intervals.push(recent[i] - recent[i - 1]);
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    return Math.round(Math.sqrt(variance));
  });
</script>

{#if consistency !== null}<p>±{consistency}ms</p>{/if}
```

Standard deviation of the intervals: take each interval, subtract the mean, square, average, square-root. The "±NN ms" formatting is more meaningful than raw stddev — the musician can read it as "I'm tapping within ±N ms of perfect."

You could alternatively share the interval calculation between `bpm`, `avgInterval`, and `consistency` by deriving `recentIntervals` as a separate value first. That refactor is left as a stretch.

</details>

### Exercise 3: Tempo classification

**Setup:** the working BPM detector.

**What to do:** add a `$derived` value that classifies the tempo as 'slow' (under 90), 'medium' (90 to 130), or 'fast' (above 130), or `null` if there is no BPM yet. Display it in the prompt area as small text — for example, "120 BPM / medium."

**Verify by:** tapping slowly produces "slow," tapping at jogging pace produces "medium," tapping fast produces "fast." The classification changes when the BPM crosses a threshold.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let tempo = $derived.by(() => {
    if (bpm === null) return null;
    if (bpm < 90) return 'slow';
    if (bpm < 130) return 'medium';
    return 'fast';
  });
</script>

{#if bpm}
  <span class="num">{bpm}</span>
  <span class="unit">BPM</span>
  <small>· {tempo}</small>
{/if}
```

The derived chain is now `taps -> avgInterval -> bpm -> tempo`. Each layer re-evaluates only when its input changes. The classification updates the moment the BPM crosses a threshold.

</details>

### Exercise 4: Smooth vs raw BPM

**Setup:** the working BPM detector.

**What to do:** add a second derived `rawBpm` that uses ONLY THE LAST 2 TAPS (so it reflects the most recent interval) and display both: "120 BPM" (smoothed, 8-tap average) and "(122 raw)" (last interval only). Compare how they move as you tap.

**Verify by:** the smoothed BPM moves slowly; the raw BPM jumps around with every tap. You can see the smoothing in action.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let rawBpm = $derived.by(() => {
    if (taps.length < 2) return null;
    const last = taps[taps.length - 1];
    const prev = taps[taps.length - 2];
    return Math.round(60000 / (last - prev));
  });
</script>

<span class="num">{bpm}</span>
<span class="unit">BPM</span>
{#if rawBpm}<small>({rawBpm} raw)</small>{/if}
```

Both deriveds depend on `taps`. Both update on every push. The raw version uses just the last two timestamps; the smoothed version averages eight intervals. This is the simplest possible demo of why averaging matters — the raw value is unusable as a tempo readout.

</details>

### Exercise 5 (stretch): Per-tap interval timeline

**Setup:** the working BPM detector.

**What to do:** add a derived `intervals` that returns an array of the milliseconds between each consecutive pair of taps. Display them in a small horizontal bar chart — each interval is a `<div>` whose width is proportional to the duration.

**Verify by:** the bars appear as you tap. Tapping steadily produces evenly-sized bars. A pause produces a wider bar. The chart shows the rhythm visually.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let intervals = $derived.by(() => {
    if (taps.length < 2) return [];
    const out = [];
    for (let i = 1; i < taps.length; i++) {
      out.push(taps[i] - taps[i - 1]);
    }
    return out;
  });
</script>

<div class="chart">
  {#each intervals as ms, i (i)}
    <div class="bar" style="width: {Math.min(ms / 4, 200)}px">{ms}ms</div>
  {/each}
</div>

<style>
  .chart { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
  .bar { background: #e5468b; color: white; padding: 4px 8px; font-size: 12px; font-family: monospace; }
</style>
```

`intervals` derives from `taps`. The each block iterates over the derived array. Each bar's width is computed inline as a style — Svelte's `style="..."` attribute interpolates expressions the same way `class="..."` does.

The capping at `Math.min(ms / 4, 200)` keeps very long pauses from blowing out the layout.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` with the BPM-detector version (state, two deriveds, the BPM display).
- A working app that reads a tempo when you tap a steady beat.

### Verify it works

- The display reads "tap to start" before any taps.
- After two taps, a BPM appears.
- Tapping at a known tempo (use a metronome app or song) gives a BPM within a few of the target.
- Reset clears the display back to "tap to start."
- The reset button is disabled until at least one tap is recorded.

## Common questions

**Q: Can I use `$derived` for asynchronous data?**
A: No, not directly. Deriveds must be synchronous. For async work (fetching, timers, anything Promise-based) you write an `$effect` that updates a piece of state, then read the state from a derived if you want further computation. The SvelteKit `load` function (M5) is the proper tool for fetching data in pages.

**Q: What happens if my derived throws?**
A: The thrown error propagates to the caller — typically the template binding that read the derived. SvelteKit's error boundary will catch it and show an error page in production, or the dev overlay in development. Cleanup of stale dependencies still happens — the derived stays in a broken state until inputs change and re-evaluation works.

**Q: How does `$derived` compare to React's `useMemo` performance-wise?**
A: Generally cheaper. Svelte's tracking is at the value level; React's memo invalidation is at the dependency-array level. For the same workload, Svelte re-runs less often. For trivial computations the difference does not matter; for heavy ones it can.

**Q: Can I derive from a derived from a derived?**
A: Yes, no limit on chain depth. The runtime computes them in dependency order automatically. Avoid extremely deep chains for readability — usually one or two levels is the right size, and longer chains mean you have a domain concept that wants a name.

**Q: Why is `$derived.by(() => ...)` not just `$derived(() => ...)`?**
A: Because `$derived(() => x)` would create a derived whose value IS the function. The `.by` form unambiguously says "call this function and take its return value." It is a small disambiguation that prevents a footgun.

**Q: Do I have to use deriveds for everything?**
A: No. For values you only read once, inline the expression in the template. For values used in multiple places or computed from multiple inputs, name them with a derived. The criterion is clarity of intent; performance follows.

## What's next

Next lesson: `$effect`. The detector forgets its state on every page reload. We will use `$effect` to write the BPM to localStorage when it stabilizes, and read it back on the next visit. The lesson also covers when not to use `$effect` — the rune is the one developers from React reach for first, and it is almost always not what they want.

<SourcesSection lessonKey="02-tap-tempo-detective/03-derive-bpm" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
