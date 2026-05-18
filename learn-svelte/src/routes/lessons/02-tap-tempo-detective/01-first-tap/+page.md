<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const tapBoneSource = `<script>
  // We'll record when the user taps. Start with no taps yet.
  let lastTap = $state(null);

  function handleTap() {
    lastTap = Date.now();
  }
<\/script>

<button onclick={handleTap}>TAP<\/button>

{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}<\/p>
{:else}
  <p>tap the button above<\/p>
{/if}

<style>
  button {
    background: #e5468b;
    color: white;
    border: 0;
    padding: 24px 48px;
    font-size: 20px;
    border-radius: 12px;
    font-family: system-ui;
    font-weight: 600;
    letter-spacing: 0.1em;
    cursor: pointer;
    box-shadow: 0 8px 24px -8px #e5468b;
  }
  button:active { transform: translateY(1px); }
  p { font-family: system-ui; color: #555; }
<\/style>
`;

  const showElapsedChallenge = `<script>
  let lastTap = $state(null);

  function handleTap() {
    lastTap = Date.now();
  }
<\/script>

<button onclick={handleTap}>TAP<\/button>

{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}<\/p>
  <!-- Add a second <p> showing how many milliseconds ago the tap happened. -->
{:else}
  <p>tap the button above<\/p>
{/if}

<style>
  button { background: #e5468b; color: white; border: 0; padding: 24px 48px;
    font-size: 20px; border-radius: 12px; font-family: system-ui; font-weight: 600;
    letter-spacing: 0.1em; cursor: pointer; }
  p { font-family: system-ui; color: #555; }
<\/style>
`;

  const twoButtonsSource = `<script>
  let lastAction = $state(null);

  function tap() { lastAction = { kind: 'tap', at: Date.now() }; }
  function reset() { lastAction = null; }
<\/script>

<button onclick={tap}>TAP<\/button>
<button onclick={reset}>RESET<\/button>

{#if lastAction}
  <p>{lastAction.kind} at {new Date(lastAction.at).toLocaleTimeString()}<\/p>
{:else}
  <p>nothing yet<\/p>
{/if}

<style>
  button { background: #e5468b; color: white; border: 0; padding: 14px 24px;
    margin-right: 8px; border-radius: 8px; font-family: system-ui; cursor: pointer; }
  p { font-family: system-ui; color: #555; }
<\/style>
`;
</script>

<svelte:head><title>Capture a Tap · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-2);">

<LessonHeader
  moduleSlug="02-tap-tempo-detective"
  lessonSlug="01-first-tap"
  title="Capture a Tap"
  blurb="A button that records when it was pressed. The first feature of the Tap Tempo Detective app you'll build over five lessons."
/>

## Why this lesson exists

By the end of this module you will have built a tap-tempo BPM detector — the kind of tool a musician hits to figure out the speed of a song they are trying to play. Tap a button in time with the music, the app divides 60 seconds by the average interval between your taps, and the answer is the tempo in beats per minute. Real tool, no toy.

The whole app is roughly 100 lines of Svelte. Building it across five lessons gives the rune system room to teach itself. You will meet `$state` here, arrays of `$state` next lesson, `$derived` in lesson three, `$effect` in lesson four, and then a fifth lesson that just composes what you already know into a small game. No lesson invents new framework features the previous lesson did not need.

This first lesson is the foundation: a button that records the time it was pressed. That is the smallest interactive feature the app needs. It introduces three things you will use in every component you ever write: reactive state with `$state`, event handlers wired to elements, and conditional rendering with `&lbrace;#if&rbrace;`.

## Learning objectives

By the end of this lesson you will be able to:

- Declare a reactive variable with `let x = $state(initial)` and explain what makes it reactive.
- Wire an HTML element's event to a function defined in your script using `onclick=&lbrace;handler&rbrace;`.
- Conditionally render markup with `&lbrace;#if&rbrace; / &lbrace;:else&rbrace; / &lbrace;/if&rbrace;` and explain when each branch mounts and unmounts.
- Choose between `null`, `undefined`, and `0` for "absent" sentinel values and justify the choice.
- Replace the contents of `src/routes/+page.svelte` and verify the new behavior in the dev server.

## Concept 1: Reactive state with `$state`

### What it is

A normal JavaScript `let` binding holds a value. When you reassign it, nothing in the world reacts — no DOM updates, no observers notified. That is fine for an algorithm; it is not fine for a UI. A UI needs the screen to follow the data without you wiring every update by hand.

`$state` is the rune that gives a variable that property. You write `let lastTap = $state(null)` and you now have a variable that behaves like a regular `let` in every respect — read it, assign to it, pass it around — except that every read inside reactive code is tracked, and every write notifies anything that read it. The compiler rewrites the source so the runtime can do this bookkeeping. You do not call any update function. You just assign.

This is the central abstraction of Svelte 5. Almost every component you write will start with one or more `$state` declarations. Once you have reactive state, most of the rest of the framework is "things that automatically respond to it" — derived values, effects, template bindings, conditional blocks.

### Worked example

Here is the entire script for this lesson's app:

```svelte
<script>
  let lastTap = $state(null);

  function handleTap() {
    lastTap = Date.now();
  }
</script>
```

Two declarations.

The first declares a reactive variable named `lastTap`, initialized to `null`. `null` means "no tap recorded yet." When the runtime sees a template binding that reads `lastTap`, it records a subscription from that binding to this state. When `lastTap` is later reassigned, every subscribed binding re-evaluates.

The second is a plain function. It is not special — no `$` prefix, no rune. The body assigns `Date.now()` (the current Unix timestamp in milliseconds) to `lastTap`. The assignment is the reactive bit; the function is just a way to package it so we can attach it to a button.

Read those two pieces literally. `lastTap` starts as `null`. When `handleTap` runs, `lastTap` becomes a number. Anything that reads `lastTap` and cares about the change gets notified.

### Variation: choosing the initial value

We initialized `lastTap` to `null`. Why not `0`?

`0` is a valid timestamp. It means midnight on January 1, 1970, UTC. A check like `&lbrace;#if lastTap&rbrace;` would treat `0` as falsy and behave as if no tap had been recorded — but only because of an accidental quirk of the value, not because it actually meant "absent." If someone managed to tap at exactly that millisecond (impossible in practice, easy in tests), the check would lie.

`null` is unambiguous: it means "no value." Use `null` (or `undefined`) when you mean absent. Use a real default value when one exists and is meaningful. The cost of getting this wrong in a one-screen app is zero; the cost in a five-screen app is an afternoon of confused debugging.

### Variation: a state that holds an object

State is not limited to primitives. You can hold an object, an array, a Map, anything. The same rules apply: assign to the variable, the binding tracks. The sandbox here shows a state that holds either `null` or an object describing the most recent action:

<CompileSandbox initialSource={twoButtonsSource} height="400px" />

Notice how `lastAction` is reassigned wholesale in both `tap()` and `reset()`. You never mutate the existing object — you replace it. With primitives there is no difference; with objects there is, and we will look at the mutation path in detail next lesson when we start working with arrays.

### Common mistakes

- **Forgetting the `$state(...)` wrapper.** Writing `let lastTap = null` and expecting the UI to react. The compiler will not warn you — it will compile a plain let binding, and the binding will simply never update. Symptom: clicking the button does nothing visible. Fix: wrap the initial value in `$state(...)`.
- **Calling `$state` outside a `.svelte` or `.svelte.ts` file.** `$state` is a compiler intrinsic; the compiler only processes Svelte files. Symptom: a runtime error or a missing import. Fix: put your state in a Svelte file, or rename your shared-state module to end in `.svelte.ts`.
- **Treating `$state` like a setter function.** Writing `lastTap($state.set(Date.now()))` or similar. There is no setter. Just assign with `=`. The compiler rewrites the assignment for you.
- **Reading `$state` from a non-tracked context and being surprised it does not update.** If you read a reactive variable inside `setTimeout` or an async callback that runs outside the tracking system, you get whatever the value was at read time. We will see when tracking applies and when it does not throughout the module.

### TypeScript notes

`$state` takes a generic parameter. If TypeScript cannot infer the type from the initial value, you can be explicit:

```ts
let lastTap = $state<number | null>(null);
```

Without the annotation, `$state(null)` would infer as `null` alone, which would block you from later assigning a number. With the union, the type matches the lifetime of the variable.

## Concept 2: Event handlers on elements

### What it is

To run code when the user does something, attach a function to an event on the element. In Svelte 5 the syntax is exactly the HTML attribute syntax: `onclick=&lbrace;handler&rbrace;`. The braces are Svelte's expression marker — anything inside them is a JavaScript expression that resolves to the handler.

If you have written Svelte 4, the syntax used to be `on:click=&lbrace;handler&rbrace;`. Svelte 5 dropped the colon. The new syntax aligns with React and standard HTML, makes spreading easier, and looks like the rest of the markup.

The handler is just a function. It can be a named function defined in the script, an inline arrow, or any expression that evaluates to a function. The event object is passed as the first argument when the handler is called.

### Worked example

```svelte
<button onclick={handleTap}>TAP</button>
```

This element has one Svelte-specific feature: `onclick=&lbrace;handleTap&rbrace;`. The `handleTap` inside the braces is a reference to the function defined in the script. When the button is clicked, the browser fires a `click` event; Svelte's event binding calls `handleTap()` with the event object.

You can read the event if you need it:

```svelte
<button onclick={(e) => console.log(e.clientX, e.clientY)}>where</button>
```

Or ignore it entirely, as we do.

### Variation: inline arrow

For one-liners, inline an arrow function:

```svelte
<button onclick={() => lastTap = Date.now()}>TAP</button>
```

This is the same thing as the named-function version, just without the indirection. Use whichever reads better. The inline form is fine for trivial handlers; the named form is better when the handler is longer than one line, when it is used in more than one place, or when its name documents intent.

### Variation: other events

Every DOM event works the same way. `onmousedown`, `onkeydown`, `oninput`, `onfocus` — anything an HTMLElement supports, you can write `on<event>=&lbrace;handler&rbrace;`. The names match the lowercase property names in the DOM.

For our tap-tempo case, you might wonder whether `onmousedown` would feel snappier than `onclick`. It would, because `click` waits for the release. We are using `onclick` because it has the right semantics — keyboard activation (space and enter on a focused button) also fires click — and because the difference is not perceptible until you are pushing it harder than this lesson does. The metronome module will return to event timing in earnest.

### Common mistakes

- **Calling the function instead of passing it.** Writing `onclick=&lbrace;handleTap()&rbrace;` (with the parens) calls `handleTap` immediately during render and assigns its return value (probably `undefined`) as the handler. Symptom: the button does nothing, or the tap fires once during render and never again. Fix: drop the parens — `onclick=&lbrace;handleTap&rbrace;`.
- **Mixing Svelte 4 syntax.** Writing `on:click=&lbrace;handleTap&rbrace;`. Svelte 5 supports both during the migration period but will warn. Use the new form.
- **Forgetting that the handler runs once per event, not on a loop.** New developers sometimes wire up a click handler and then ask why a counter is not incrementing every frame. It increments per click. If you want continuous behavior, you need a timer (covered in M3) or an animation frame loop.
- **Trying to attach a handler to an element that does not exist yet.** Writing the handler in markup that is inside an `&lbrace;#if&rbrace;` branch that is not currently rendered means no element to attach to. The binding takes effect when that branch mounts. Usually fine; occasionally surprising.

## Concept 3: Conditional rendering with `&lbrace;#if&rbrace;`

### What it is

`&lbrace;#if condition&rbrace;` is Svelte's block syntax for conditional markup. The block has three forms — `&lbrace;#if&rbrace;`, optional `&lbrace;:else if&rbrace;`, optional `&lbrace;:else&rbrace;` — and is closed with `&lbrace;/if&rbrace;`. The condition is re-evaluated whenever any reactive value it reads changes; the matching branch mounts, the previously-matching branch unmounts.

This is template syntax, not JavaScript. You do not need an expression that returns markup, the way you do with JSX's ternary trick. You write the block in the markup section directly, and the compiler turns it into runtime code that mounts and unmounts subtrees.

The mental model: a Svelte template is a tree of fragments that the runtime conditionally and reactively mounts. `&lbrace;#if&rbrace;` controls one fragment. `&lbrace;#each&rbrace;` (next lesson) controls a list of them. Everything else is plain HTML.

### Worked example

```svelte
{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{:else}
  <p>tap the button above</p>
{/if}
```

On mount, `lastTap` is `null`, which is falsy, so the `&lbrace;:else&rbrace;` branch renders. The user sees "tap the button above."

After the first click, `handleTap` assigns `Date.now()` to `lastTap`. The runtime notices `lastTap` changed, re-evaluates the `&lbrace;#if&rbrace;` condition, finds it truthy, unmounts the else paragraph, and mounts the if paragraph. The expression `&lbrace;new Date(lastTap).toLocaleTimeString()&rbrace;` runs and produces a string like "3:14:15 PM."

Subsequent clicks keep `lastTap` truthy. The branch does not unmount and remount — the runtime knows the condition stayed truthy, so it just re-evaluates the bindings inside (the timestamp expression updates to the new value). Mount and unmount only happen when the condition flips.

The whole app in one place:

<CompileSandbox initialSource={tapBoneSource} height="440px" />

Click the button. Watch the timestamp appear and update. The button event triggers the assignment; the assignment triggers the conditional; the conditional mounts or updates the paragraph. Three pieces, one round-trip.

### Variation: `&lbrace;:else if&rbrace;` chains

You can branch on multiple conditions:

```svelte
{#if taps.length === 0}
  <p>no taps yet</p>
{:else if taps.length < 4}
  <p>{taps.length} taps — keep going</p>
{:else}
  <p>{taps.length} taps</p>
{/if}
```

Each branch is its own fragment. Exactly one is mounted at a time. Adding more branches has no per-render cost; the runtime only mounts the matching one.

### Variation: nested conditionals

`&lbrace;#if&rbrace;` blocks nest like HTML. You can have an `&lbrace;#if&rbrace;` inside an `&lbrace;#if&rbrace;` branch, or inside an `&lbrace;#each&rbrace;` iteration. The mount/unmount semantics compose naturally — when an outer branch unmounts, everything inside unmounts too.

Avoid deeply nested conditionals when you can. They get hard to read. Often the fix is to extract a component (M3) or compute a derived label in the script and just render the label.

### Common mistakes

- **Using a JavaScript `if` instead of `&lbrace;#if&rbrace;`.** Writing a JavaScript `if` in the script section is fine for control flow inside a function, but it cannot conditionally render markup. The markup section needs the block syntax. Symptom: a runtime error or a confused template. Fix: use `&lbrace;#if&rbrace;` in markup.
- **Forgetting to close the block.** `&lbrace;#if cond&rbrace;` requires `&lbrace;/if&rbrace;`. The compiler will tell you, but the error message is sometimes far from the actual mistake. Symptom: a parse error. Fix: count your opening and closing tags.
- **Putting the condition in a string.** Writing `&lbrace;#if "lastTap"&rbrace;` — the string is always truthy. The condition is a JavaScript expression, no quotes. Fix: drop the quotes.
- **Trying to put `&lbrace;#if&rbrace;` inside an HTML attribute.** You cannot. Attributes take expressions, not blocks. If you need a conditional attribute, use a ternary: `&lt;button disabled=&lbrace;cond ? true : false&rbrace;&gt;` or just `&lt;button disabled=&lbrace;cond&rbrace;&gt;`. We will use this in the next lesson.
- **Truthy-falsy traps.** Writing `&lbrace;#if count&rbrace;` and being surprised the branch does not render when `count` is `0`. `0` is falsy. If you mean "is count defined," check explicitly: `&lbrace;#if count !== null&rbrace;` or `&lbrace;#if count !== undefined&rbrace;`.

## Putting it together

The whole component, in one file:

```svelte
<script>
  let lastTap = $state(null);

  function handleTap() {
    lastTap = Date.now();
  }
</script>

<button onclick={handleTap}>TAP</button>

{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{:else}
  <p>tap the button above</p>
{/if}
```

Three Svelte features in one screen: a `$state` declaration, an event binding, a conditional block. The rest is plain HTML, plain JavaScript. That ratio — a few framework primitives per file, mostly the language — is the experience of writing Svelte most of the time.

<OpenTheHood title="What this template compiles to">

The Svelte compiler rewrites this component into a JavaScript module that, when run, sets up the DOM and the reactivity. Lightly cleaned up, the `&lbrace;#if&rbrace;` becomes something like:

```js
$.if(anchor, () => $.get(lastTap), ($$anchor) => {
  // truthy branch — mount the timestamp paragraph
}, ($$anchor) => {
  // falsy branch — mount the prompt paragraph
});
```

`$.if` is a runtime helper. The second argument is a condition function the runtime calls to decide which branch to render. The runtime tracks every signal that condition reads (here, `lastTap`) and re-evaluates whenever any of them change.

When the condition's truthiness flips, the matching branch's setup function runs (creating DOM nodes, attaching bindings) and the other branch's teardown runs (removing nodes, cleaning up bindings). When the truthiness stays the same, the runtime does nothing — the inner bindings handle their own updates.

This is different from React's conditional rendering, where `&lbrace;cond && <p>...</p>&rbrace;` produces a virtual-DOM tree on every render and the reconciler diffs it against the previous tree. Svelte does no diffing for `&lbrace;#if&rbrace;` — it tracks the condition directly. The cost is paid only when the condition changes.

For the common case where conditions flip rarely, this is markedly cheaper than the diffing approach. For pathological cases (a condition that flips every frame), the two approaches end up at similar costs because both eventually become "mount one thing, unmount another."

</OpenTheHood>

## Exercises

### Exercise 1: Wire up your local project

**Setup:** the SvelteKit project you created in M1.

**What to do:** open `src/routes/+page.svelte` in your editor. Replace its contents with the working version from the sandbox above (the script with `lastTap` and `handleTap`, the button, and the conditional paragraph). Save the file.

**Verify by:** with `npm run dev` running, opening `http://localhost:5173/` shows the TAP button. Clicking it shows a timestamp. The page does not reload. The dev tools console shows no errors.

**Stretch:** add a `<h1>Tap Tempo Detective</h1>` above the button so the page has a title. Style it in the `<style>` block.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let lastTap = $state(null);
  function handleTap() { lastTap = Date.now(); }
</script>

<h1>Tap Tempo Detective</h1>
<button onclick={handleTap}>TAP</button>

{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{:else}
  <p>tap the button above</p>
{/if}

<style>
  h1 { font-family: system-ui; color: #1a1d2a; }
  button { background: #e5468b; color: white; border: 0; padding: 24px 48px;
    font-size: 20px; border-radius: 12px; font-family: system-ui; font-weight: 600;
    letter-spacing: 0.1em; cursor: pointer; }
  p { font-family: system-ui; color: #555; }
</style>
```

The heading is just static markup — no `$state` involved because the text never changes. The styling is the same scoped-CSS story from M1.

</details>

### Exercise 2: Add an elapsed-time display

**Setup:** the sandbox below has the working tap component with a comment marking where to add the elapsed display.

**What to do:** when `lastTap` is set, also show how many milliseconds ago the tap happened — for example "2503ms ago." Use the expression `Date.now() - lastTap`. Place it in a second `<p>` inside the `&lbrace;#if&rbrace;` block.

**Verify by:** clicking TAP shows both the timestamp and an "ms ago" reading. Clicking again updates both. Note that the ms-ago value only updates on tap, not continuously — that is expected for this lesson.

<CompileSandbox initialSource={showElapsedChallenge} height="440px" />

<details>
<summary>Show solution</summary>

```svelte
{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
  <p>{Date.now() - lastTap}ms ago</p>
{/if}
```

`Date.now() - lastTap` is plain arithmetic. The expression runs whenever the surrounding binding re-evaluates, which is whenever `lastTap` changes. Between taps, nothing re-evaluates, so the ms-ago number stays put.

A continuously-updating display would need a separate state that ticks (a counter incremented in an interval), which means `$effect` to set up the interval — that comes in lesson four. For now, "updates on tap" is the honest behavior.

</details>

### Exercise 3: Replace `&lbrace;#if/&lbrace;:else&rbrace;` with two separate `&lbrace;#if&rbrace;` blocks

**Setup:** the working version uses one `&lbrace;#if/&lbrace;:else&rbrace;` block.

**What to do:** rewrite the template to use two separate `&lbrace;#if&rbrace;` blocks instead — one that renders the timestamp when `lastTap` is truthy, and a separate one that renders the prompt when `lastTap` is null. Both must be mutually exclusive in practice.

**Verify by:** behavior is identical to the original. Only one paragraph is on the page at any time.

<details>
<summary>Show solution</summary>

```svelte
{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{/if}
{#if !lastTap}
  <p>tap the button above</p>
{/if}
```

This produces the same visible output, but the compiler emits two `$.if` calls instead of one. The original `&lbrace;#if/&lbrace;:else&rbrace;` is more idiomatic and slightly cheaper — one condition tracked, one runtime helper. Use the chained form when the branches are alternatives; use separate blocks when the conditions are genuinely independent.

</details>

### Exercise 4: Two pieces of state in one component

**Setup:** a blank sandbox (or the working version).

**What to do:** add a second `$state` variable named `tapCount`, initialized to `0`. Increment it inside `handleTap`. Show its value somewhere on the page.

**Verify by:** clicking TAP increments both the timestamp and the counter. Reloading resets the counter to 0.

**Stretch:** also add a "Reset" button that sets `tapCount` back to `0` and `lastTap` back to `null`.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let lastTap = $state(null);
  let tapCount = $state(0);

  function handleTap() {
    lastTap = Date.now();
    tapCount += 1;
  }

  function reset() {
    lastTap = null;
    tapCount = 0;
  }
</script>

<button onclick={handleTap}>TAP</button>
<button onclick={reset}>RESET</button>

<p>taps: {tapCount}</p>
{#if lastTap}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{/if}
```

Two independent pieces of reactive state. Each is tracked separately; the template bindings that read each one update independently. The reset function reassigns both — the runtime fires the right notifications and the relevant bindings re-evaluate.

This component is one short step from where lesson 2 starts.

</details>

### Exercise 5 (stretch): Hold off the timestamp until two taps have happened

**Setup:** the working version.

**What to do:** modify the component so the timestamp paragraph only appears after the user has tapped at least twice. Before two taps, show "tap again to start." After two taps, show the most recent timestamp.

Hint: you will need a second state (a counter, or a separate "first tap done" flag), and a more complex `&lbrace;#if/&lbrace;:else if/&lbrace;:else&rbrace;` chain.

**Verify by:** the first tap changes the prompt; the second tap reveals the timestamp; subsequent taps update the timestamp.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let lastTap = $state(null);
  let tapCount = $state(0);

  function handleTap() {
    lastTap = Date.now();
    tapCount += 1;
  }
</script>

<button onclick={handleTap}>TAP</button>

{#if tapCount === 0}
  <p>tap to start</p>
{:else if tapCount === 1}
  <p>tap again to begin recording</p>
{:else}
  <p>last tap: {new Date(lastTap).toLocaleTimeString()}</p>
{/if}
```

Two states (`lastTap`, `tapCount`) feed one three-branch `&lbrace;#if&rbrace;` chain. Each branch is mutually exclusive. This is the shape of a lot of UI state — a few primitives feeding a small decision tree.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` containing the working tap component (or a variation you wrote in the exercises).
- The dev server running, the page reachable at `http://localhost:5173/`.

### Verify it works

- The TAP button is visible.
- Before clicking, the prompt reads "tap the button above" (or your variation).
- Clicking the button updates the page to show a timestamp.
- Each subsequent click updates the timestamp to the current time.
- The page never reloads. No browser console errors.

### Compare against reference

There is no reference repo for M1 or M2 — you are writing the project from scratch. The capstone modules (M6 onward) introduce a `capstone-reference/` directory you can diff against.

## Common questions

**Q: Why `$state` instead of just `let`?**
A: A plain `let` is opaque to the framework. The compiler has no way to know you want the UI to follow that variable. `$state` is a marker that says "watch this." The compiler rewrites reads and writes to go through the reactivity runtime, which is how the UI knows to update. The choice was deliberate: explicit reactivity is easier to reason about than the implicit-everything model in Svelte 3 and 4.

**Q: Does `$state` work with `const`?**
A: No. `$state` requires `let` because the variable is reassigned. `const` means "this binding is immutable" — incompatible with the rune. If you have a `$state` that holds an object and you only ever mutate its properties (not reassign the binding), you could argue for `const`, but the convention is to use `let` everywhere for `$state`.

**Q: Can `handleTap` read `lastTap` instead of writing to it?**
A: Yes. Functions can read and write reactive state freely. Reads inside functions called from tracked contexts (template bindings, derived values, effects) get tracked too — though for a function called from an event handler the tracking does not matter because the function ran once in response to the event, not continuously.

**Q: What about `keydown` for space or enter activation?**
A: A `<button>` element automatically fires `click` when the user presses space or enter while it has focus. You do not need to wire `onkeydown` separately. This is one of several accessibility wins you get for free by using semantic elements instead of `<div onclick={...}>`.

**Q: What if I want to debounce or throttle the tap?**
A: For a tempo detector you specifically do NOT want to debounce — every tap matters. For a search input or save button, debouncing is a common pattern and you would do it inside the handler (or extract it to a utility). The framework does not have a built-in throttle; you would use `setTimeout` or a small utility. Not relevant here.

## What's next

Next lesson: turn `lastTap` (one timestamp) into `taps` (an array of timestamps). Add a `&lbrace;#each&rbrace;` block to render the list and a reset button to clear it. You will meet your first reactive array and learn why `taps.push(...)` works in Svelte the way `setTaps([...taps, x])` would in React.

<SourcesSection lessonKey="02-tap-tempo-detective/01-first-tap" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
