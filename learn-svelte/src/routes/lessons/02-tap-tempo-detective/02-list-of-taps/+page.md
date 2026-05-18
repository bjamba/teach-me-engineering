<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const tapsListSource = `<script>
  let taps = $state([]);

  function handleTap() {
    taps.push(Date.now());
  }

  function reset() {
    taps = [];
  }
<\/script>

<div class="row">
  <button class="tap" onclick={handleTap}>TAP<\/button>
  <button class="reset" onclick={reset} disabled={taps.length === 0}>reset<\/button>
<\/div>

<p class="count">{taps.length} {taps.length === 1 ? 'tap' : 'taps'} recorded<\/p>

{#if taps.length > 0}
  <ol class="taps">
    {#each taps as t, i (i)}
      <li>{i + 1}. {new Date(t).toLocaleTimeString()}<\/li>
    {/each}
  <\/ol>
{/if}

<style>
  .row { display: flex; gap: 12px; align-items: center; }
  button {
    border: 0; font-family: system-ui; font-weight: 600; letter-spacing: 0.08em;
    cursor: pointer; padding: 14px 24px; border-radius: 10px; font-size: 16px;
  }
  .tap { background: #e5468b; color: white; padding: 24px 48px; font-size: 20px; }
  .tap:active { transform: translateY(1px); }
  .reset { background: #f0f0f0; color: #333; }
  .reset:disabled { opacity: 0.5; cursor: not-allowed; }
  .count { font-family: system-ui; color: #555; }
  .taps { font-family: monospace; font-size: 14px; padding-left: 20px; }
  .taps li { color: #444; }
<\/style>
`;

  const lastFiveChallenge = `<script>
  let taps = $state([]);

  function handleTap() {
    taps.push(Date.now());
  }

  function reset() {
    taps = [];
  }

  // Add a function that returns ONLY THE LAST 5 TAPS.
  // Then update the {#each} below to iterate over those instead of all taps.
<\/script>

<div class="row">
  <button class="tap" onclick={handleTap}>TAP<\/button>
  <button class="reset" onclick={reset}>reset<\/button>
<\/div>

<p>{taps.length} taps recorded · showing last 5<\/p>

{#each taps as t, i (i)}
  <p>{new Date(t).toLocaleTimeString()}<\/p>
{/each}

<style>
  .row { display: flex; gap: 12px; }
  .tap { background: #e5468b; color: white; padding: 18px 32px; border: 0; border-radius: 10px; font-size: 18px; cursor: pointer; }
  .reset { background: #eee; padding: 8px 14px; border: 0; border-radius: 6px; cursor: pointer; }
  p { font-family: system-ui; color: #555; margin: 4px 0; }
<\/style>
`;

  const objectArraySource = `<script>
  let entries = $state([]);
  let nextId = 0;

  function add() {
    entries.push({ id: ++nextId, label: 'tap ' + nextId, at: Date.now() });
  }

  function removeAt(id) {
    entries = entries.filter((e) => e.id !== id);
  }

  function reset() { entries = []; }
<\/script>

<button onclick={add}>add<\/button>
<button onclick={reset}>reset<\/button>

<ul>
  {#each entries as e (e.id)}
    <li>
      {e.label} — {new Date(e.at).toLocaleTimeString()}
      <button onclick={() => removeAt(e.id)}>x<\/button>
    <\/li>
  {/each}
<\/ul>

<style>
  button { font-family: system-ui; padding: 6px 12px; margin-right: 8px; cursor: pointer; }
  ul { font-family: system-ui; }
  li { margin: 4px 0; }
  li button { padding: 2px 8px; margin-left: 8px; }
<\/style>
`;
</script>

<svelte:head><title>A List of Taps · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-2);">

<LessonHeader
  moduleSlug="02-tap-tempo-detective"
  lessonSlug="02-list-of-taps"
  title="A List of Taps and a Reset"
  blurb="Push to an array, show every tap. Add a reset button. Reactive arrays and your first &lbrace;#each&rbrace; block."
/>

## Why this lesson exists

To compute a tempo we need the intervals between taps, which means we need more than one tap remembered at a time. Last lesson, each tap overwrote the previous one — the variable held a single timestamp. This lesson, the variable holds a list, and we record every tap. That is the data shape the rest of the module assumes.

Once you have a reactive array, two things follow: a way to render it (the `&lbrace;#each&rbrace;` block) and a way to think about mutating it (push, splice, reassign). Both are quietly different from how React handles the same problem, and the differences are worth understanding rather than memorizing. We also pick up two small but useful idioms — keying an each block and binding an HTML attribute to a reactive expression — that will be repeated dozens of times across the rest of the curriculum.

## Learning objectives

By the end of this lesson you will be able to:

- Declare a reactive array with `let xs = $state([])` and explain why mutating it (e.g. `xs.push(...)`) triggers updates.
- Render a list with `&lbrace;#each items as item, i (key)&rbrace; ... &lbrace;/each&rbrace;` and choose an appropriate key.
- Justify when an index key is acceptable and when it is not.
- Bind an HTML attribute to a reactive expression — `disabled=&lbrace;cond&rbrace;`, `value=&lbrace;n&rbrace;`, etc.
- Distinguish between mutating the array in place and reassigning it, and choose between them.

## Concept 1: Reactive arrays

### What it is

`let taps = $state([])` declares a reactive variable whose value is an array. From the outside it looks like a plain JavaScript array — you can `push`, `pop`, `splice`, index into it, read `length`. From the inside, the compiler has wrapped the array in a Proxy so the runtime can observe reads and writes.

This is the part that surprises React developers. In React you would never write `taps.push(...)` — you would write `setTaps([...taps, x])` to produce a new array, because React's reconciler relies on referential identity to detect changes. Svelte does not. The Proxy intercepts the mutation, fires the right notifications, and the bindings update. You can write the code the way you would write plain JavaScript.

The tradeoff is that every property access on the array goes through the Proxy. For the typical UI workload (a few hundred items, a few mutations per second), this cost is invisible. For very hot paths — a tight loop over thousands of cells on every animation frame — there is an escape hatch, `$state.raw`, that gives you a plain value with whole-value reactivity instead. We will reach for it once in the capstone. For the rest of the curriculum, the default `$state` is exactly right.

### Worked example

```svelte
<script>
  let taps = $state([]);

  function handleTap() {
    taps.push(Date.now());
  }

  function reset() {
    taps = [];
  }
</script>
```

`taps` starts as an empty array. `handleTap` pushes a timestamp onto the end — the Proxy fires a write notification for the new index and a notification for the changed `length`. Anything that reads `taps` or `taps.length` in a tracked context gets re-evaluated.

`reset` reassigns `taps` to a new empty array. That is a different operation than mutating — it replaces the entire binding. The runtime fires a write notification on the variable itself; subscribers re-evaluate. This is the same kind of update as last lesson's `lastTap = ...` assignment.

You can mix the two styles. In real code I tend to mutate when the change is small (push one item, splice one out) and reassign when the change is wholesale (clear, replace with a filtered version). The Proxy handles both correctly.

### Variation: an array of objects with stable IDs

If your array holds objects you intend to identify (for keying, for delete buttons, for reordering), give each one a stable ID. Here is a sandbox where each entry has a sequence-assigned `id`, and a remove button uses the ID to filter:

<CompileSandbox initialSource={objectArraySource} height="420px" />

Notice three things. First, `entries.push(...)` adds a new object. Second, `entries = entries.filter(...)` reassigns the whole array. Third, the `&lbrace;#each&rbrace;` block keys on `e.id`, which is stable across the lifetime of the entry — even if you remove entries from the middle, the surviving entries keep their DOM nodes.

### Variation: nested reactivity

The Proxy is recursive. If your array contains objects, those objects are also wrapped. Mutating a property on a nested object — `entries[0].label = 'first'` — fires a notification just like a top-level write.

```ts
let entries = $state([{ label: 'a' }]);
entries[0].label = 'b'; // tracked, fires notifications
```

This is convenient and easy to misuse. Be deliberate about whether you want deeply tracked state. For our tap-tempo app the array holds raw timestamps (primitives), so the Proxy only intercepts the array itself.

### Common mistakes

- **Treating reassignment and mutation as the same.** `taps = taps.concat([x])` (reassign with a new array) and `taps.push(x)` (mutate in place) both work, but they have different runtime cost. Mutation fires one notification for the new index; reassignment fires a notification for the whole variable, which can re-evaluate more things. For our app it does not matter; for a large list it might.
- **Reaching for `[...taps, x]` out of React habit.** This works (`taps = [...taps, x]`), but it allocates a new array every tap and triggers a whole-variable reassignment. `taps.push(x)` is the idiomatic Svelte form.
- **Mutating outside the script.** If you grab `taps` from a getter and mutate it from elsewhere, the Proxy still intercepts the mutation — that is fine. But if you assign the array to a non-state variable first (`const arr = taps`) and then mutate `arr`, you are mutating the Proxy through a different reference, which still works but can confuse you when debugging. Read the value through the state variable when possible.
- **Reading `taps[0]` when `taps` is empty.** Plain JavaScript gives you `undefined`; the Proxy does the same. Guard with `&lbrace;#if taps.length > 0&rbrace;` or a `taps.length` check in the script.
- **Expecting `console.log(taps)` to show the array.** It shows a Proxy. To dump the contents to the console, log `$state.snapshot(taps)` instead — that gives you a plain JavaScript array copy.

### TypeScript notes

Annotate when the inferred type is too narrow or too broad:

```ts
let taps = $state<number[]>([]);
let entries = $state<Array<{ id: number; label: string }>>([]);
```

For an empty initial value, the inferred element type defaults to `never`, which blocks you from pushing anything. The explicit annotation fixes it.

## Concept 2: Rendering lists with `&lbrace;#each&rbrace;`

### What it is

`&lbrace;#each&rbrace;` is the block syntax for rendering a list. It takes an iterable expression and a binding for the element (and optional index), and renders the body once per item. When the list changes, the runtime reconciles: items added get new DOM, items removed get torn down, items unchanged keep their existing nodes.

The block looks like a `for ... of` loop made into template syntax:

```svelte
{#each items as item, i (key)}
  <li>{item.name}</li>
{/each}
```

Three pieces: the iterable (`items`), the element binding (`item`), and an optional index binding (`, i`). After that, in parentheses, the key — an expression that uniquely identifies each item, used by the runtime to know which DOM node belongs to which item.

### Worked example

```svelte
{#if taps.length > 0}
  <ol class="taps">
    {#each taps as t, i (i)}
      <li>{i + 1}. {new Date(t).toLocaleTimeString()}</li>
    {/each}
  </ol>
{/if}
```

We wrap the each block in an `&lbrace;#if&rbrace;` so the empty case shows nothing instead of an empty `<ol>`. Inside, the each block iterates over `taps`. For each item, the body renders a `<li>` with the 1-indexed position and a formatted timestamp.

The key here is `(i)` — the index. This is acceptable for our app because we only ever append to the end of the array. Old items keep their indices; new items take new ones at the end. The DOM nodes for existing items do not need to be moved or replaced.

When you click TAP, `taps.push(Date.now())` adds an item at the new index. The runtime sees a new key (the new index), creates one new `<li>`, appends it to the `<ol>`. Existing list items are untouched. When you click reset, `taps = []` removes all items; the runtime tears them all down.

The full sandbox:

<CompileSandbox initialSource={tapsListSource} height="540px" />

### Variation: keying on item identity instead of index

If you were going to insert items in the middle of the array, or sort them, or filter them, the index would be the wrong key. Two items could trade indices, and the runtime would think the items themselves changed when actually they just swapped positions.

A better key is something intrinsic to the item — for our app, the timestamp itself, which is unique per tap by definition:

```svelte
{#each taps as t, i (t)}
  <li>{i + 1}. {new Date(t).toLocaleTimeString()}</li>
{/each}
```

For objects, use an ID:

```svelte
{#each entries as entry (entry.id)}
  <li>{entry.label}</li>
{/each}
```

The rule: pick the most stable thing that uniquely identifies the item across mutations. If you cannot think of one, you might need to assign IDs yourself (a counter, `crypto.randomUUID()`, etc.).

### Variation: unkeyed each blocks

If you omit the key entirely:

```svelte
{#each taps as t, i}
  <li>{t}</li>
{/each}
```

The runtime falls back to index-based reconciliation. This is equivalent to using `(i)` as the key. Svelte will warn you in development if it thinks you should have a key — generally a sign the data is more than append-only.

### Variation: rendering an empty state inside the each

`&lbrace;#each&rbrace;` supports an `&lbrace;:else&rbrace;` branch that renders when the iterable is empty:

```svelte
{#each taps as t, i (i)}
  <li>{i + 1}. {new Date(t).toLocaleTimeString()}</li>
{:else}
  <p>no taps yet</p>
{/each}
```

This is sometimes cleaner than wrapping in `&lbrace;#if taps.length > 0&rbrace;`. Pick whichever reads better for the situation.

### Common mistakes

- **Wrong key choice.** Using an index when items can move or be inserted in the middle. Symptom: DOM nodes attach to the wrong items after a mutation, sometimes manifesting as input values jumping between rows. Fix: pick a stable per-item key.
- **Non-unique keys.** Two items with the same key. The runtime cannot tell them apart; weird behavior follows. Svelte warns on this in development. Fix: make the key actually unique.
- **Forgetting the parens around the key.** Writing `&lbrace;#each taps as t, i i&rbrace;` instead of `&lbrace;#each taps as t, i (i)&rbrace;`. Parse error. Fix: parens around the key.
- **Iterating over a non-iterable.** `&lbrace;#each undefined as x&rbrace;` throws at runtime. Guard with `&lbrace;#if list&rbrace;` or default the value to `[]`.
- **Reading the index for sorting decisions.** The index is the position in the rendered iteration, not a stable identity. If you sort the underlying array, indices change. Do not use the index for anything you would not want to change when the list reorders.

### TypeScript notes

The element binding inherits the array element type. If `taps: number[]`, then `t: number` and `i: number` inside the block. No annotation needed.

## Concept 3: Reactive attribute bindings

### What it is

Any HTML attribute can be bound to a Svelte expression: `attr=&lbrace;expression&rbrace;`. The binding is reactive — when the expression's dependencies change, the attribute updates. Behaviorally this is similar to assigning `element.setAttribute('attr', value)` whenever the value changes, with one exception: boolean attributes (like `disabled`, `checked`, `readonly`) are set to the property on the element, so `disabled=&lbrace;false&rbrace;` actually removes the attribute, not sets it to the string "false."

This is the path you take for any UI that has to disable a button, toggle a class, set a value on an input, or wire any HTML attribute to state. The same expression syntax works for all of them.

### Worked example

```svelte
<button class="reset" onclick={reset} disabled={taps.length === 0}>reset</button>
```

The `disabled` attribute is bound to `taps.length === 0`. When the expression is true (no taps yet), the button is disabled. When false (one or more taps), the button is enabled.

Notice that we did not have to write an effect that sets `button.disabled = ...` on changes to `taps.length`. The framework wires that for us as part of the attribute binding. When `taps.length` changes — which it does on every push and on every reassignment — the binding re-evaluates.

The CSS in the example also styles `:disabled` to reduce opacity and change the cursor. The disabled state is a real HTML property, so all the usual accessibility behaviors come with it (clicks are ignored, keyboard activation is blocked, screen readers announce "disabled").

### Variation: a count display with a conditional plural

```svelte
<p>{taps.length} {taps.length === 1 ? 'tap' : 'taps'} recorded</p>
```

Two expressions in one paragraph: the count and a ternary that picks "tap" vs "taps." Both re-evaluate when `taps.length` changes. This is the right place for a ternary — short, in-template, obvious. For more elaborate text logic, prefer computing the string in the script.

### Variation: class strings with multiple parts

```svelte
<button class="reset {taps.length === 0 ? 'dim' : ''}">reset</button>
```

You can interpolate values into a class string. Cleaner alternatives exist (the `class:` directive and the `&lbrace;classList&rbrace;` shorthand) and we will meet them properly in lesson 5. For now, string interpolation works.

### Common mistakes

- **Quoting the expression.** Writing `disabled="&lbrace;cond&rbrace;"` — the quotes turn the value into a string, which is always truthy (so the button is always disabled). Drop the quotes around expression-valued attributes.
- **Setting a boolean attribute to a string.** Writing `disabled="false"` or `disabled="0"` — both are truthy strings. The attribute remains set, the button remains disabled. Use the expression form, not the string form.
- **Forgetting that attribute updates are batched.** A flurry of state writes does not produce a flurry of DOM updates; the runtime batches them. Most of the time this is good; occasionally you want synchronous flush (use `flushSync` from `svelte`, rarely needed).
- **Trying to bind to a non-existent attribute.** Typos like `disabld=&lbrace;cond&rbrace;` compile but do nothing useful. The browser ignores unknown attributes. Symptom: the binding never has effect. Fix: spell the attribute correctly.

## Putting it together

The full component:

```svelte
<script>
  let taps = $state([]);

  function handleTap() {
    taps.push(Date.now());
  }

  function reset() {
    taps = [];
  }
</script>

<div class="row">
  <button class="tap" onclick={handleTap}>TAP</button>
  <button class="reset" onclick={reset} disabled={taps.length === 0}>reset</button>
</div>

<p class="count">{taps.length} {taps.length === 1 ? 'tap' : 'taps'} recorded</p>

{#if taps.length > 0}
  <ol class="taps">
    {#each taps as t, i (i)}
      <li>{i + 1}. {new Date(t).toLocaleTimeString()}</li>
    {/each}
  </ol>
{/if}
```

State: a reactive array. Two functions that mutate it. Markup that reads it in three places: the count, the conditional wrapper, the each block. One attribute binding (`disabled`). All wired automatically through the rune system.

This is roughly the shape of a "list view" in any Svelte app you write. Once you can read it without thinking, the rest of the module is detail.

<OpenTheHood title="The Proxy that makes `taps.push` reactive">

When the compiler sees `let taps = $state([])`, it rewrites the declaration roughly as `let taps = $.proxy([])`. The `$.proxy` helper wraps the array in a JavaScript `Proxy` with custom handlers for `get`, `set`, and array methods.

When you read `taps[0]`, the get handler fires. If a tracked context (a derived, an effect, a template binding) is currently evaluating, the handler registers a subscription edge from this read to the current evaluator. When you read `taps.length`, the same thing happens for the length property.

When you call `taps.push(Date.now())`, the array's native `push` runs. The Proxy sees it set the new index and the new length, fires write notifications on both, and the runtime walks the subscriber list for each — marking every subscriber dirty, scheduling them for re-evaluation in a microtask.

The same mechanism handles `splice`, `pop`, `shift`, `unshift`. Anything that touches indices or length flows through the Proxy and gets tracked.

The recursive part: when the get handler returns an object (an array element that is itself an object), it wraps that object in its own Proxy first. So `entries[0].label = 'b'` fires a notification at the leaf — the runtime knows exactly which subscribers care about `label` on that specific entry, not just about the array.

The escape hatch: `$state.raw(value)` skips the Proxy and gives you a plain value. The reactivity becomes whole-value — the binding only updates when you reassign the variable, not when you mutate. Use this when you have a large data structure where you do not need per-property tracking, like a buffer of audio samples.

</OpenTheHood>

## Exercises

### Exercise 1: Mirror the working component to your local project

**Setup:** the SvelteKit project with last lesson's tap component.

**What to do:** replace `src/routes/+page.svelte` with the working version from this lesson. Test in the browser. Confirm that tapping grows the list, the count updates, and reset clears the list and disables the reset button.

**Verify by:** clicking TAP a few times produces a numbered list. The count text changes from "1 tap" to "2 taps" (note the plural). Hitting reset removes the list and grays out the reset button.

**Stretch:** restyle the layout to put the count and the list inside a card with a border and padding.

<details>
<summary>Show solution</summary>

The card version:

```svelte
<div class="card">
  <div class="row">
    <button class="tap" onclick={handleTap}>TAP</button>
    <button class="reset" onclick={reset} disabled={taps.length === 0}>reset</button>
  </div>
  <p class="count">{taps.length} {taps.length === 1 ? 'tap' : 'taps'} recorded</p>
  {#if taps.length > 0}
    <ol class="taps">
      {#each taps as t, i (i)}
        <li>{i + 1}. {new Date(t).toLocaleTimeString()}</li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .card {
    border: 1px solid #ddd; border-radius: 12px;
    padding: 16px; max-width: 400px; margin: 24px auto;
    font-family: system-ui;
  }
</style>
```

The wrapper is presentational. No state changed; only styling.

</details>

### Exercise 2: Show only the last 5 taps

**Setup:** the sandbox below has the working component minus the slicing.

**What to do:** modify the each block to iterate over only the most recent 5 taps. Write a helper function `lastFive()` in the script that returns `taps.slice(-5)`, then iterate over its result.

**Verify by:** as you tap, the list grows up to 5 items and then stops growing — older taps fall off the top. The count above still shows the total number of taps recorded.

<CompileSandbox initialSource={lastFiveChallenge} height="540px" />

<details>
<summary>Show solution</summary>

```svelte
<script>
  let taps = $state([]);
  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }

  function lastFive() {
    return taps.slice(-5);
  }
</script>

<button onclick={handleTap}>TAP</button>
<button onclick={reset}>reset</button>

<p>{taps.length} taps recorded · showing last 5</p>

{#each lastFive() as t, i (i)}
  <p>{new Date(t).toLocaleTimeString()}</p>
{/each}
```

Calling `lastFive()` inside the each block works because the function reads `taps`, which is tracked. When `taps` changes, the each block re-evaluates, which calls `lastFive()` again.

The function does the slice work on every re-evaluation. For 5 items this is free; for a heavier computation, you would want `$derived`, which is the next lesson.

</details>

### Exercise 3: Remove individual taps with a per-row button

**Setup:** the working component.

**What to do:** add a small "x" button next to each `<li>` that removes that tap from the array. Use the timestamp as the key so the per-row identity stays stable across deletions.

**Verify by:** clicking the x on the third row removes the third entry. The other rows stay put — their DOM is not torn down and recreated. After deletion the count updates.

Hint: write a function `removeAt(t)` that filters `taps` to exclude `t`, then assign the result back.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let taps = $state([]);
  function handleTap() { taps.push(Date.now()); }
  function reset() { taps = []; }
  function removeAt(t) {
    taps = taps.filter((x) => x !== t);
  }
</script>

<button onclick={handleTap}>TAP</button>
<button onclick={reset} disabled={taps.length === 0}>reset</button>
<p>{taps.length} taps</p>

<ol>
  {#each taps as t (t)}
    <li>
      {new Date(t).toLocaleTimeString()}
      <button onclick={() => removeAt(t)}>x</button>
    </li>
  {/each}
</ol>
```

Two things to note. First, the key changed from `(i)` to `(t)` because deletions happen anywhere in the array — index keys would misalign the DOM. Second, `removeAt` reassigns `taps` (with a filtered copy) rather than mutating in place. You could equally use `taps.splice(taps.indexOf(t), 1)`, which mutates; either works.

</details>

### Exercise 4: A clear-and-undo

**Setup:** the working component.

**What to do:** modify reset so it stashes the current taps in a separate state variable before clearing. Add an "undo" button that restores the stashed taps. Undo is only available when there is something to restore.

**Verify by:** tap a few times, hit reset (list clears, undo enables), hit undo (list restored, undo disables again).

<details>
<summary>Show solution</summary>

```svelte
<script>
  let taps = $state([]);
  let lastCleared = $state(null);

  function handleTap() { taps.push(Date.now()); }

  function reset() {
    if (taps.length === 0) return;
    lastCleared = taps;
    taps = [];
  }

  function undo() {
    if (!lastCleared) return;
    taps = lastCleared;
    lastCleared = null;
  }
</script>

<button onclick={handleTap}>TAP</button>
<button onclick={reset} disabled={taps.length === 0}>reset</button>
<button onclick={undo} disabled={!lastCleared}>undo</button>

<p>{taps.length} taps</p>
{#each taps as t, i (t)}
  <p>{i + 1}. {new Date(t).toLocaleTimeString()}</p>
{/each}
```

Two reactive variables collaborating. The reset stashes the existing array reference into `lastCleared` and replaces `taps` with a fresh one. Undo swaps them back and clears the stash so the user cannot double-undo. The disabled bindings on both buttons read from the right piece of state.

</details>

### Exercise 5 (stretch): A "tap history" that keeps every reset session

**Setup:** the working component.

**What to do:** instead of throwing away taps on reset, push them as an array into a `sessions` state — `let sessions = $state([])`. Each entry in `sessions` is itself an array of timestamps. Render the sessions below the current session list, showing how many taps each historical session had.

**Verify by:** tap a few times, reset, tap a few more, reset. The page shows two historical entries — "session 1: 4 taps", "session 2: 3 taps" — plus the current session.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let taps = $state([]);
  let sessions = $state([]);

  function handleTap() { taps.push(Date.now()); }

  function reset() {
    if (taps.length === 0) return;
    sessions.push(taps);
    taps = [];
  }
</script>

<button onclick={handleTap}>TAP</button>
<button onclick={reset} disabled={taps.length === 0}>reset</button>

<p>current: {taps.length} taps</p>

{#if sessions.length > 0}
  <h3>history</h3>
  <ul>
    {#each sessions as s, i (i)}
      <li>session {i + 1}: {s.length} taps</li>
    {/each}
  </ul>
{/if}
```

An array of arrays. `sessions.push(taps)` snapshots the current reference into the history. `taps = []` then replaces the active list with a fresh array. Because `taps` was reassigned, the historical reference is no longer mutated by future pushes — `sessions[0]` keeps the original 4 timestamps even as the user records new ones in a fresh array.

This is a good place to notice why reassigning vs mutating matters. If reset had done `taps.length = 0` (mutating to clear in place), the same array object would still be referenced by `sessions[0]`, and clearing it would also clear the historical entry. Reassigning gives you a fresh reference and keeps the history intact.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` with the array-based tap component (or a variation from the exercises).
- A working TAP button that grows a numbered list.
- A reset button that clears the list and disables itself when empty.
- A count display that pluralizes correctly (1 tap / 2 taps).

### Verify it works

- Tapping multiple times in a row produces a growing list with timestamps.
- The list is numbered, starting at 1.
- The reset button is dim and unclickable when there are no taps.
- Hitting reset clears the list and disables the button.
- No console errors at any point.

## Common questions

**Q: Why does `taps.push(...)` work? In React I would have to call `setTaps`.**
A: Because Svelte 5 wraps the array in a Proxy. The Proxy intercepts the push and fires notifications. React's model is "produce a new value, call the setter, let the reconciler diff" — fine, but inherits a coding style where mutation is forbidden. Svelte's model is "mutate freely; the framework tracks it." Different tradeoff, neither obviously better. Svelte's is less typing for most code.

**Q: Should I prefer mutation or reassignment?**
A: Either. Mutation is slightly cheaper (one notification per change instead of one for the whole variable) and reads naturally for small changes — push, splice, pop. Reassignment is clearer for wholesale changes — filter, map, sort produce new arrays anyway. Use whichever the operation naturally calls for.

**Q: What is the right key for an each block?**
A: The most stable thing that uniquely identifies an item across mutations. For our timestamps, the timestamp itself is unique by definition. For objects, a database ID or a generated UUID. For purely append-only lists, the index is fine and saves you generating IDs.

**Q: Will using the index as a key bite me later?**
A: Yes, if the data later becomes non-append-only. The fix is one character — change `(i)` to `(item.id)` or whatever. If you ever see DOM weirdness like form inputs jumping between rows after a delete, suspect the key first.

**Q: How big can a `$state` array get before the Proxy cost matters?**
A: For typical UI loads — a thousand items, a few mutations per second — invisible. The capstone DAW has 64 reactive cells updated at 60fps, no problem. Where it starts to hurt is when you have tens of thousands of items in a hot loop. Then you want `$state.raw` or a flat typed-array representation. We will not hit those numbers in this curriculum until the FFT visualizer in M7.

**Q: Can `$state` hold a Map or Set?**
A: Yes. The Proxy wraps Maps and Sets too, and intercepts their `set`, `delete`, `clear`, etc. methods. Useful for keyed collections where order does not matter.

## What's next

You now have a list of timestamps. The next lesson turns that into a BPM number with `$derived` — Svelte's rune for "this value is a function of other reactive values." We will compute the average interval between consecutive taps, convert it to beats per minute, and display it. After that, the app starts to look like a real tool.

<SourcesSection lessonKey="02-tap-tempo-detective/02-list-of-taps" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
