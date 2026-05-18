<script>
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Many Counters · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-1);">

<LessonHeader
  moduleSlug="01-hello-svelte"
  lessonSlug="03-many-counters"
  title="Many Counters and the Compiler's Trick"
  blurb="Three counters on one page. Then you split into a component. Then you crack open the compiled JS to see what just happened."
/>

## Why this lesson exists

You have one counter. Real apps have many components that look similar — three of one kind of thing, or thirty. Copy-pasting code works for small cases but fails the moment you want to change anything (you change it three times, you miss one, the inconsistency becomes a bug).

This lesson does two things. First, it shows the right way to handle "I need many of these" — extract a component, render it multiple times, each instance is independent. Second, it cracks open the JavaScript the Svelte compiler emits for your component so you can SEE what "the compiler is the framework" actually means. By the end you'll have read real compiled output and identified the patterns. That makes everything in the rest of the course concrete — when something behaves unexpectedly, you can crack open the compiled file and see exactly what the runtime is doing.

## Learning objectives

By the end of this lesson you'll be able to:

- Recognize when to extract a reusable component vs. duplicating markup.
- Create a `.svelte` file under `src/lib/` and import it into another component.
- Render the same component multiple times, knowing each instance has independent state.
- Open the dev server's network tab or the `.svelte-kit/` build output to inspect the compiled JS for a component.
- Identify the key runtime calls in compiled output: `$.state`, `$.get`, `$.update`, `$.template_effect`, `$.from_html`, `$.delegated`.
- Explain in your own words what "no virtual DOM" means in concrete terms.

## Concept 1: when to extract a component

### Three counters, inline (the wrong way)

Suppose you want three independent counters on a page. The lazy version:

In `src/routes/+page.svelte`:

```svelte
<script>
  let countA = $state(0);
  let countB = $state(0);
  let countC = $state(0);
</script>

<button onclick={() => countA++}>A: &lbrace;countA&rbrace;</button>
<button onclick={() => countB++}>B: &lbrace;countB&rbrace;</button>
<button onclick={() => countC++}>C: &lbrace;countC&rbrace;</button>

<style>
  button {
    background: #ff3e00;
    color: white;
    border: 0;
    padding: 10px 16px;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
    margin-right: 8px;
  }
</style>
```

This works. Three independent state variables, three buttons, each updates its own count. But notice:

- If you want to change the button styling, you'd update one CSS rule (fine — the rule applies to all of them since they share the `button` selector). Good.
- If you want to add a "reset" button alongside each counter, you write the reset markup three times. Bad.
- If you want to add hover state, log to analytics on click, change the increment to something else — all of these changes happen three times.

A fourth counter is another `let countD = $state(0);` plus another `<button>`. A tenth counter is ten of each. The work grows linearly with no payoff in clarity.

### The same thing as a component

Create a new file: `src/lib/Counter.svelte`. The contents:

```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>&lbrace;count&rbrace;</button>

<style>
  button {
    background: #ff3e00;
    color: white;
    border: 0;
    padding: 10px 16px;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }
</style>
```

That's a complete component. Identical structure to a counter you'd write inline — script, markup, style — just in its own file.

Now in `src/routes/+page.svelte`:

```svelte
<script>
  import Counter from '$lib/Counter.svelte';
</script>

<Counter />
<Counter />
<Counter />
```

Four lines. Three counters. Each `<Counter />` is an independent instance with its own `count` state. Clicking one doesn't affect the others — because each instance executed the script independently, each got its own `$state` declaration, each binding only reads its own counter's value.

### Why this works

Components in Svelte are templates. Importing a component gives you the template. Each `<Counter />` use creates a new instance — the script runs again, fresh state is created, fresh DOM is mounted. The instances don't share anything except their `<style>` block (which is the same scoped CSS for all of them).

This is the same model you'd recognize from React, Vue, Solid. Components are reusable units. The thing that's different in Svelte is just the file format: one `.svelte` file is one component, with markup, script, and style colocated.

### Variations

**A component with no script.**

```svelte
<!-- src/lib/Divider.svelte -->
<hr class="divider" />

<style>
  .divider {
    border: 0;
    border-top: 1px solid #ddd;
    margin: 16px 0;
  }
</style>
```

A pure visual component — no state, no logic. Used like any other: `<Divider />`.

**A component with default-imported and named-imported usage.**

```svelte
<script>
  import Counter from '$lib/Counter.svelte';        // default import
  import Button from '$lib/components/Button.svelte';
</script>

<Counter />
<Button>click me</Button>
```

Svelte components are always the default export of their file. You can rename on import: `import MyCounter from '$lib/Counter.svelte'`. The component is still the same; you've just called it something else locally.

**A component used in many files.**

You can import a component from anywhere. `Counter.svelte` could be imported in `+page.svelte` AND in `src/routes/about/+page.svelte` AND in another component. Each import gives you the same template; each render creates an independent instance.

### Common mistakes

**Mistake 1: importing from the wrong path.**

```svelte
import Counter from './Counter.svelte';            // relative — fragile
import Counter from '$lib/Counter.svelte';         // alias to src/lib — preferred
```

SvelteKit sets up `$lib` as an alias to `src/lib`. Using it makes imports stable when you move files. Relative paths break the moment you move the importer.

**Mistake 2: trying to share state between instances via the component.**

Each `<Counter />` instance has independent state. If you want three counters that share one count, the state needs to live OUTSIDE the component — typically in a `.svelte.ts` module (Module 4) or in the parent and passed as a prop (Module 3).

**Mistake 3: forgetting the `.svelte` extension on imports.**

```svelte
import Counter from '$lib/Counter';                // WRONG — file not found
import Counter from '$lib/Counter.svelte';         // RIGHT
```

The Vite resolver doesn't add `.svelte` automatically. You include the full filename.

**Mistake 4: trying to render a component with lowercase.**

```svelte
<counter />        <!-- treated as an HTML element, not the imported component -->
<Counter />        <!-- recognized as the component -->
```

Convention: components are PascalCase. Imports preserve case, and the parser uses case to distinguish "this is an HTML element" from "this is my component."

## Concept 2: reading the compiled output

### Where the compiled JS lives

When you run `npm run dev`, Vite compiles your `.svelte` files to JavaScript on demand. You can see the compiled output two ways:

**Option A: the dev server's network tab.**

1. Open your app in the browser.
2. Open dev tools, Network tab.
3. Reload the page.
4. Look for entries that look like `Counter.svelte?...` — they're served as compiled JS.
5. Click one. The Response tab shows the compiled output.

**Option B: build the project and read the output directory.**

Run `npm run build`. The output goes to `build/` (or `.svelte-kit/output/` during the build). Find the compiled `.js` files for your components. They're production-minified — harder to read than the dev output but a smaller surface to scan.

For learning, the dev output is better. It's not minified and includes source maps so you can see the relationship between your source line and the emitted line.

### What you'll see

Open the compiled output for a simple counter. The high-level shape:

```js
// (1) Standard imports the runtime helpers from svelte/internal/client.
import * as $ from 'svelte/internal/client';

// (2) A static template — the HTML structure parsed once, cloned per mount.
var root = $.from_html(`<button>&lbrace;0&rbrace;</button>`, 1);

// (3) The component function — runs ONCE on mount.
function App($$anchor) {
  // (a) State declaration: count = $.state(0)
  let count = $.state(0);

  // (b) Clone the template, walk to grab references.
  var fragment = root();
  var button = $.first_child(fragment);
  var text = $.child(button);
  $.reset(button);

  // (c) Reactive update: re-runs when `count` changes.
  $.template_effect(() => {
    $.set_text(text, `&lbrace;$.get(count) ?? ''&rbrace;`);
  });

  // (d) Event handler delegation.
  $.delegated('click', button, () => $.update(count));

  // (e) Append the DOM into the page.
  $.append($$anchor, fragment);
}

// (f) Register click as a delegated event for this file.
$.delegate(['click']);

export default App;
```

(The actual output is slightly different — minified, with extra defensive code, sometimes inlined — but the shape is what you'll see.)

### The patterns to recognize

The runtime helpers you'll see across most compiled components:

| Function | What it does |
|---|---|
| `$.from_html(html, walkLength)` | Parse a static HTML string into a `<template>`. Returns a cloning function. |
| `$.first_child(node)` | Get the first child element of a fragment. |
| `$.child(node)` | Get the relevant child (handles comment placeholders for dynamic content). |
| `$.sibling(node, n)` | Walk n siblings forward. |
| `$.text(value)` | Create a reactive text node. |
| `$.set_text(textNode, value)` | Update a text node's content. |
| `$.template_effect(fn)` | A reactive effect tied to template bindings. Re-runs when any signal read inside changes. |
| `$.state(initial)` | Create a writable signal (the implementation of `$state`). |
| `$.derived(fn)` | Create a cached computed signal (the implementation of `$derived`). |
| `$.get(signal)` | Read a signal's current value, registering a subscription if called inside a tracking context. |
| `$.set(signal, value)` | Write a new value. |
| `$.update(signal)` | Increment-style update (used for `count++`). |
| `$.delegated(event, element, handler)` | Register an event handler with the document-level delegation system. |
| `$.append(anchor, fragment)` | Insert the component's fragment into the DOM. |

Read a few compiled components and you'll start recognizing these without having to look them up. Most of what the compiler emits is some combination of these primitives.

### What's NOT in the compiled output

A few things are notable for their absence:

- **No virtual DOM.** No `createElement(...)`, no virtual tree of objects. The compiler emits real DOM operations.
- **No reconciler.** No tree diffing on every update. Updates target specific text nodes and attributes via the references the compiler gathered.
- **No component re-runs.** The component function (`App` above) runs ONCE. After that, only the `$.template_effect` callbacks fire when their signals change. The script-block setup code does NOT re-run.

This is what people mean when they say "Svelte has no virtual DOM." It isn't that the runtime is faster at diffing — there's nothing to diff. There's a direct reference to a text node and an instruction to update it when a signal changes.

### Common mistakes when reading compiled output

**Mistake 1: confusing dev output with production output.**

Dev output is unminified and includes source maps. Production output is minified — variables become single letters, whitespace is gone. Both follow the same patterns; production is just harder to read for a human.

**Mistake 2: assuming the output matches your source line-by-line.**

The compiler reorders things. Template setup happens before the state declarations, even if you wrote state at the top of your script. Use source maps (in dev tools) to map a compiled position back to a source line.

**Mistake 3: trying to edit the compiled output.**

You don't edit `.svelte-kit/` or `build/` — those are regenerated every build. Edit the `.svelte` source files. The compiler regenerates.

## Concept 3: what "the compiler is the framework" means concretely

### The runtime is small

Look at the imports the compiled output uses: `import * as $ from 'svelte/internal/client'`. That single module is most of Svelte's runtime. It's about 5–10 KB minified-gzipped. The framework helpers fit in less code than a typical React app's `node_modules` directory listing.

Compare to React: React's runtime (`react` + `react-dom`) is ~44 KB minified-gzipped. The reconciler, the fiber architecture, the scheduling, the synthetic event system — all of that ships with every React app. Even a "hello world" page includes it.

Svelte's compiled output USES the runtime but doesn't bring the whole thing for free. If a component doesn't use `<transition>`, no transition code is in your bundle. If it doesn't use stores, no store code. The compiler tree-shakes against what you actually use.

### Per-binding updates

In the compiled counter, the `$.template_effect` callback only updates `text` (the text node inside the button). When `count` changes, that callback fires, and ONE DOM node updates. The button itself stays. The script setup doesn't re-run.

If the component had a hundred text nodes, only the ones that read `count` would update on a `count` change. The rest stay untouched. This is per-binding update granularity — different from per-component re-render which is what React does by default.

For a small component the difference is invisible. For a complex form with many bindings, only some of which depend on a given state, the difference adds up.

### Why this matters in practice

A few practical consequences:

- **No `useMemo` / `useCallback` discipline.** React requires you to memoize expensive computations and callbacks to prevent excessive re-renders. Svelte doesn't have this problem because there ARE no excessive re-renders — bindings only update on relevant signal changes.
- **No stale-closure bugs.** A click handler in Svelte reads the current value of the state, because the compiler injected `$.get(...)` at the read site. In React, a callback captured at render N has the values from render N, and using them later can show stale data unless you use refs.
- **Smaller bundle for the same app.** A non-trivial app in Svelte ships ~30-50% less framework code than the same app in React. For mobile-heavy or slow-network audiences, this is meaningful.

## Putting it together

Open your `src/routes/+page.svelte`. Replace the contents with:

```svelte
<script>
  import Counter from '$lib/Counter.svelte';
</script>

<h1>Three counters</h1>

<Counter />
<Counter />
<Counter />

<style>
  h1 { font-family: system-ui; }
</style>
```

Save. The page renders three independent counters. Click each — they update independently.

Now open dev tools, Network tab. Reload. Find `Counter.svelte`. Click it. Read the compiled JS. Find the `$.state(0)`. Find the `$.update(count)`. Find the `$.template_effect`. You're looking at what Svelte generated for your component.

## Exercises

### Exercise 1: refactor to a component

**Setup:** the inline three-counters version from the start of this lesson (with `countA`, `countB`, `countC` all declared in `+page.svelte`).

**What to do:** extract the counter to `src/lib/Counter.svelte`. Update `+page.svelte` to import and use it three times. Verify each instance is independent.

**Verify by:** each button increments only its own counter; the page is shorter; adding a fourth counter takes one line.

**Stretch:** make the counter take a starting value as a prop (covered properly in Module 3, but `let { initial = 0 } = $props();` is the syntax you'd use, and `<Counter initial={5} />` would set it). Render three counters with different starting values.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/lib/Counter.svelte -->
<script>
  let { initial = 0 } = $props();
  let count = $state(initial);
</script>

<button onclick={() => count++}>&lbrace;count&rbrace;</button>

<style>
  button {
    background: #ff3e00; color: white; border: 0;
    padding: 10px 16px; border-radius: 8px;
    font: inherit; cursor: pointer; margin-right: 8px;
  }
</style>
```

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import Counter from '$lib/Counter.svelte';
</script>

<Counter />
<Counter initial={5} />
<Counter initial={100} />
```

</details>

### Exercise 2: read the compiled output

**Setup:** any `.svelte` component you've written that uses `$state`.

**What to do:**

1. Open dev tools → Network tab → reload the page.
2. Find your component's compiled output (look for a `.svelte` filename).
3. Identify these specific calls in the output:
   - The `$.state(...)` for your initial declaration.
   - The `$.get(...)` calls reading the state.
   - The `$.update(...)` or `$.set(...)` for the writes.
   - The `$.template_effect(...)` wrapping the binding update.
   - The `$.delegated(...)` registering the click handler.

**Verify by:** you can point at each call and describe what it does, without referencing this lesson.

**Stretch:** add a `$derived` value to your component, save, reload, and find the new `$.derived(...)` call. Notice it's a separate node — derived values get their own signal.

### Exercise 3: prove instances are independent

**Setup:** the three-counter page.

**What to do:** modify `Counter.svelte` so it also displays a `console.log` on each click (e.g., `console.log('clicked', count)`). Open the browser console. Click each counter and verify the logs show separate counts per instance.

**Verify by:** the console shows three separate click streams. Each counter logs its own value, not a shared one.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let count = $state(0);

  function handleClick() {
    count++;
    console.log('clicked, count is now', count);
  }
</script>

<button onclick={handleClick}>&lbrace;count&rbrace;</button>
```

The console will show that each component instance has its own `count`. Three separate streams.

</details>

### Exercise 4: a styled component

**Setup:** the basic Counter.svelte.

**What to do:** add a CSS variable to Counter.svelte for the button color (e.g., `background: var(--btn-color, #ff3e00)`). In `+page.svelte`, use a wrapper with inline `style="--btn-color: blue"` around one of the counters to make it blue.

**Verify by:** the three counters have different colors despite sharing the same Counter.svelte source — the CSS custom property cascades from the wrapper into the scoped style.

<details>
<summary>Show solution</summary>

```svelte
<!-- Counter.svelte -->
<button onclick={() => count++}>&lbrace;count&rbrace;</button>

<style>
  button {
    background: var(--btn-color, #ff3e00);
    /* ... rest of styling */
  }
</style>
```

```svelte
<!-- +page.svelte -->
<Counter />
<div style="--btn-color: navy"><Counter /></div>
<div style="--btn-color: teal"><Counter /></div>
```

Each wrapper sets its own value of `--btn-color`. The scoped CSS rule reads `var(--btn-color, #ff3e00)`, which inherits from whatever wrapper it's inside. This is how you theme components without prop drilling — useful, and we'll lean on it heavily in Module 3.

</details>

### Exercise 5 (stretch): a Counter inside a Counter

**Setup:** a working Counter.svelte.

**What to do:** create a new component `src/lib/CounterGroup.svelte` that contains two `<Counter />` instances and a "reset both" button. The reset button should call a function that... hmm, but the counters' state is internal to each instance. How would the reset button reach into the children?

This exercise is intentionally tricky. The answer (cleanly) involves either:
- Lifting the state to `CounterGroup.svelte` and passing it down as bindable props (Module 3).
- Using a shared `.svelte.ts` module for the state (Module 4).
- Using component instance refs via `bind:this` (covered in passing — try it!).

Try at least one of these. You'll probably hit a conceptual wall — that's the point. The wall is what Modules 3 and 4 break down.

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/Counter.svelte` — a reusable counter component.
- `src/routes/+page.svelte` — using `<Counter />` multiple times.
- A scoped style on the Counter that doesn't leak.

### Verify it works

- `npm run dev` shows three (or more) counter buttons.
- Each button updates only its own counter.
- The page didn't get longer in proportion to the number of counters — adding a fourth was one line.
- You can open the compiled output and identify the runtime calls (`$.state`, `$.update`, `$.template_effect`).

### Compare against the reference

For Module 1 there's no reference repo to compare against — your local project is the reference. The capstone-reference comes into play starting in Module 6.

## Common questions

**Q: Why is the alias `$lib`? Where's that defined?**

A: SvelteKit defines it in `svelte.config.js` under `kit.alias`. By default it maps to `src/lib`. You can add your own aliases (e.g., `$components: 'src/lib/components'`) if you want. The dollar-prefix convention is SvelteKit-specific — Vite uses `@` for similar purposes, but SvelteKit projects mostly stick with `$lib`.

**Q: Should I make a component for EVERYTHING?**

A: No. Components are appropriate when the markup represents a distinct piece of UI that has its own behavior, will be reused, or is complex enough that extracting it makes the parent easier to read. A `<div class="card">` with three lines of static content inside doesn't need its own component. A "PriceDisplay" used in seven places does.

**Q: What's the cost of a component?**

A: Negligible. Each component is a function call into the runtime. The runtime allocates the state, walks the template, attaches handlers. For a simple component this is microseconds. You can have hundreds of components on a page without noticing the cost.

**Q: How do components communicate?**

A: Props (parent → child) and callbacks (child → parent, by calling a function the parent passed). Module 3 covers both properly. For shared state across siblings or unrelated components, use a `.svelte.ts` module (Module 4) or SvelteKit's load function (Module 5).

**Q: Can I see the compiled output of a `.svelte.ts` file too?**

A: Yes, same way. `.svelte.ts` files get the rune processing pass. The compiled output of a `.svelte.ts` file looks like regular TypeScript but with `$state` declarations rewritten to `$.state(...)` calls and `$.get` / `$.set` injected at access sites.

**Q: I've read the compiled output and it doesn't look like what's described here.**

A: A few possibilities. (1) You're looking at production output, which is minified. Look at dev output instead. (2) Your Svelte version is older or newer than what this curriculum assumes (Svelte 5.x stable). The runtime helpers may have slightly different names in major version bumps. (3) The compiler did additional optimizations because of patterns in your code (constant folding, dead-code elimination). Don't be alarmed — the high-level shape is consistent.

## What's next

That's the end of Module 1. You should now be comfortable with:

- Writing single-file `.svelte` components.
- Using `$state` to make a value reactive.
- Attaching event handlers and interpolating values into markup.
- Extracting reusable components and importing them.
- Reading the compiled JavaScript output and identifying the runtime patterns.

Module 2 jumps from "I understand Svelte basics" into "I'm building real things." Over five lessons you'll build a working Tap Tempo Detector — a tool any musician would actually use. You'll learn `$derived`, `$effect`, `{#each}` loops, and how `$state` works with arrays. By the end of Module 2 you have a shippable music utility in about 100 lines of code.

<SourcesSection lessonKey="01-hello-svelte/03-many-counters" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
