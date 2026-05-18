<script>
</script>

<svelte:head><title>Reference · Make / Svelte</title></svelte:head>

<article class="page prose">

<header>
  <p class="kicker">REFERENCE</p>
  <h1>Syntax cheat-sheet</h1>
  <p class="lede">
    Every rune, directive, block, and special element you'll use in Svelte 5 + SvelteKit. Searchable via Ctrl-F. Not exhaustive — see the official docs for the long tail — but covers everything used in this curriculum.
  </p>
</header>

## Runes (the reactivity primitives)

### `$state(initial)`

Declares a reactive variable.

```ts
let count = $state(0);
let items = $state<string[]>([]);
let user = $state({ name: 'Chris', count: 0 });
```

Reads and writes go through a proxy that tracks subscriptions. Mutate freely: `items.push(x)`, `user.count++`, `count = 5` all trigger reactivity.

### `$state.raw(initial)`

Same as `$state` but skips the deep proxy. Use for large data structures you mutate atomically:

```ts
let items = $state.raw([...]);
items = [...items, newItem];  // must reassign; in-place mutations aren't tracked
```

### `$state.snapshot(value)`

Returns a non-reactive deep copy of a `$state` value. Use when you need to pass the value to non-reactive code (JSON.stringify, structuredClone, external libraries):

```ts
const plainObj = $state.snapshot(reactiveObj);
localStorage.setItem('saved', JSON.stringify(plainObj));
```

### `$derived(expression)` / `$derived.by(() => ...)`

Computed reactive value. Cached, re-evaluates when dependencies change:

```ts
let doubled = $derived(count * 2);
let summary = $derived.by(() => {
  const total = items.reduce((a, b) => a + b.price, 0);
  return { total, tax: total * 0.08 };
});
```

Use `.by` for multi-line expressions. Must be PURE — no side effects.

### `$effect(fn)`

Runs after mount, re-runs when tracked dependencies change. Return a cleanup function:

```ts
$effect(() => {
  const id = setInterval(() => console.log('tick'), 1000);
  return () => clearInterval(id);
});
```

### `$effect.pre(fn)`

Like `$effect` but runs BEFORE DOM updates. Use for measuring or capturing pre-update state.

### `$effect.root(fn)`

Creates an effect scope outside of any component. Needed for `$effect` calls in module-level singleton code (your `.svelte.ts` files):

```ts
class Store {
  count = $state(0);
  constructor() {
    $effect.root(() => {
      $effect(() => { /* runs forever, returns disposer */ });
    });
  }
}
```

Returns a disposer function. The effect doesn't clean up on its own (no component lifecycle).

### `$props()`

Returns the component's props object. Destructure to read them:

```svelte
<script>
  let { label, count = 0, onclick, ...rest } = $props();
</script>
```

Use `= bindable(...)` to opt a prop into two-way binding from the parent.

### `$bindable(initial?)`

Marks a prop as bindable. The parent can use `bind:` on it:

```svelte
<script>
  let { value = $bindable(0) } = $props();
</script>
```

### `$inspect(...values)`

Dev-only: logs values whenever they change. Replaces the old reactive `console.log` pattern:

```ts
$inspect(count);                       // logs count whenever it changes
$inspect(count).with((type, c) => {    // custom logger
  console.log(type, 'count is', c);
});
```

### `$host()`

For custom-element components: returns the host element. Rare; you'll know if you need it.

## Template directives (blocks)

### `{#if condition}` / `{:else if other}` / `{:else}` / `{/if}`

Conditional rendering. The blocks mount/unmount based on condition:

```svelte
{#if user}
  <p>welcome, {user.name}</p>
{:else if loading}
  <p>loading...</p>
{:else}
  <a href="/login">log in</a>
{/if}
```

### `{#each items as item, index (key)}` / `{:else}` / `{/each}`

List rendering. The key (in parens) tells Svelte how to identify items for diff/reorder. Use a stable unique value, not the index, when items can move:

```svelte
{#each items as item, i (item.id)}
  <li>{i + 1}. {item.name}</li>
{:else}
  <li class="empty">no items</li>
{/each}
```

### `{#key value}` ... `{/key}`

Re-mounts children whenever `value` changes. Useful for re-triggering CSS animations:

```svelte
{#key pulseCount}
  <div class="indicator pulse"></div>
{/key}
```

### `{#snippet name(args)}` ... `{/snippet}`

Defines a snippet — a parameterized chunk of markup. Pass to a component as a prop:

```svelte
{#snippet item(value)}
  <li>{value}</li>
{/snippet}

<List items={...} {item} />
```

The unnamed `children` snippet is created automatically from a component's body.

### `{@render snippet(args)}`

Renders a snippet. Required to actually display snippet content:

```svelte
<div>
  {@render children()}
  {@render header({ title: 'Hello' })}
</div>
```

### `{@html string}`

Renders a string as raw HTML. Bypasses Svelte's escaping — dangerous with untrusted input.

### `{@const expr}` / `{@const name = expr}`

Computed inside a block scope. Useful inside `{#each}` to avoid recomputing per render:

```svelte
{#each posts as post (post.id)}
  {@const wordCount = post.body.split(' ').length}
  <article>{post.title} — {wordCount} words</article>
{/each}
```

### `{@debug variable, ...}`

Pauses in the debugger whenever the values change. Dev tool.

### `{#await promise}` / `{:then value}` / `{:catch error}` / `{/await}`

Renders a promise's pending / resolved / rejected state:

```svelte
{#await loadData()}
  <p>loading...</p>
{:then data}
  <pre>{JSON.stringify(data)}</pre>
{:catch err}
  <p>error: {err.message}</p>
{/await}
```

## Element directives

### `bind:property={value}`

Two-way binding. Variants by element/property:

```svelte
<input bind:value={text} />
<input type="checkbox" bind:checked={done} />
<input type="file" bind:files />
<input type="radio" bind:group={selected} value="a" />
<select bind:value={choice}>...</select>
<textarea bind:value={notes} />
<details bind:open={isOpen} />
<dialog bind:open={isModal} />
```

### `bind:this={ref}`

Captures a reference to the DOM element. Equivalent of React's `useRef`:

```svelte
<canvas bind:this={canvasEl}></canvas>
<script>
  let canvasEl = $state();
  $effect(() => { if (canvasEl) /* use the DOM node */ });
</script>
```

### `bind:offsetWidth`, `bind:clientHeight`, `bind:contentRect`, etc.

Capture element measurements. Updates via `ResizeObserver`:

```svelte
<div bind:offsetWidth={width} bind:offsetHeight={height}>...</div>
```

### `class:name={condition}`

Adds the class when condition is truthy:

```svelte
<button class:active={selected === id} class:disabled={!enabled}>...</button>
```

You can also use the standard `class` attribute with a string or object:

```svelte
<div class={['base', selected && 'active', disabled && 'disabled']}></div>
```

### `style:property={value}`

Sets an inline style:

```svelte
<div style:background-color={color} style:width={`${size}px`}></div>
```

### `use:action`

Calls an "action" function with the element on mount:

```svelte
<div use:tooltip={'hello'}>hover me</div>
<script>
  function tooltip(node, text) {
    // attach event listeners, set up the tooltip
    return {
      update(newText) { /* called when the parameter changes */ },
      destroy() { /* called on unmount */ }
    };
  }
</script>
```

### `on*` event handlers (Svelte 5 style)

```svelte
<button onclick={handleClick}>...</button>
<input oninput={(e) => name = e.currentTarget.value} />
<form onsubmit={(e) => { e.preventDefault(); save(); }}>...</form>
```

Inside a component, callback props use the same convention: `<MyButton onclick={...} />` passes `onclick` as a prop.

### `transition:fn={params}` / `in:fn={params}` / `out:fn={params}`

Entrance/exit animations:

```svelte
{#if visible}
  <p transition:fade>same animation both ways</p>
  <p in:fly={{ y: 20 }} out:fade>different in/out</p>
{/if}
```

Built-in transitions from `svelte/transition`: `fade`, `fly`, `slide`, `scale`, `blur`, `draw`, `crossfade`.

### `animate:fn={params}`

Animates element reordering within `{#each}` (FLIP technique):

```svelte
{#each items as item (item.id)}
  <li animate:flip={{ duration: 300 }}>{item.name}</li>
{/each}
```

`flip` is from `svelte/animate`.

## Special elements

### `<svelte:head>`

Adds content to the document `<head>`:

```svelte
<svelte:head>
  <title>Page title</title>
  <meta name="description" content="..." />
</svelte:head>
```

### `<svelte:window>` / `<svelte:document>` / `<svelte:body>`

Attach event listeners or bind properties on those root objects:

```svelte
<svelte:window on:scroll={handleScroll} bind:scrollY={y} bind:innerWidth={w} />
```

### `<svelte:element this={tagName}>...</svelte:element>`

Dynamic element type:

```svelte
<svelte:element this={heading} class="title">{text}</svelte:element>
```

### `<svelte:component this={Component} {...props} />`

Dynamic component type. In Svelte 5 it's often unnecessary — you can just use `<Variable />` directly if `Variable` is a component:

```svelte
<svelte:component this={CurrentScreen} {...props} />
```

### `<svelte:boundary>`

An error boundary. Catches errors in descendants:

```svelte
<svelte:boundary>
  <DangerousChild />
  {#snippet failed(error, reset)}
    <p>oops: {error.message}</p>
    <button onclick={reset}>retry</button>
  {/snippet}
</svelte:boundary>
```

### `<svelte:options>`

Component-level compiler options. Most commonly used for custom elements:

```svelte
<svelte:options customElement="my-button" />
```

## Lifecycle (from `svelte`)

```ts
import { onMount, onDestroy, tick, untrack, flushSync } from 'svelte';

onMount(() => { /* runs once after mount, client-only */ });
onDestroy(() => { /* runs before unmount */ });
await tick();           // resolves after next reactive flush (DOM is current)
untrack(() => value);   // read without registering as dependency
flushSync(() => { ... }); // force synchronous reactive flush
```

## Motion (from `svelte/motion`)

```ts
import { Tween, Spring } from 'svelte/motion';

const t = new Tween(0, { duration: 600, easing: cubicOut });
t.target = 1;     // animates t.current to 1 over 600ms
t.current;        // the live interpolated value

const s = new Spring(0, { stiffness: 0.15, damping: 0.4 });
s.target = 100;   // animates with spring physics
s.current;        // the live value
```

## SvelteKit primitives

### Routing files

| File | Purpose |
|---|---|
| `+page.svelte` | Renders the page |
| `+page.md` | MDsveX page (markdown + Svelte) |
| `+page.ts` | Load function (runs server + client) |
| `+page.server.ts` | Load + form actions (server only) |
| `+layout.svelte` | Wraps every route below it |
| `+layout.ts` | Layout load function |
| `+server.ts` | API endpoint (GET, POST, etc.) |
| `+error.svelte` | Error boundary for this route tree |

### Load function

```ts
// +page.ts
export function load({ params, url, fetch, parent }) {
  return { posts: [...] };  // becomes `data` on the page
}

// Per-route flags
export const prerender = true;
export const ssr = false;
export const csr = true;
export const trailingSlash = 'always';
```

### Form actions

```ts
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    if (!data.get('email')) return fail(400, { error: 'Email required' });
    await saveUser(data);
    throw redirect(303, '/done');
  },
  delete: async ({ request }) => { /* second named action */ }
};
```

### Navigation

```ts
import { goto, invalidate, invalidateAll, beforeNavigate, afterNavigate } from '$app/navigation';
import { page } from '$app/state';      // page.url, page.params, page.data
import { browser, dev } from '$app/environment';
import { base, assets } from '$app/paths';
```

```svelte
<a href="/about">about</a>                                      <!-- client-side nav -->
<a href="/about" data-sveltekit-preload-data="hover">about</a>  <!-- prefetch on hover -->
<a href="/external" data-sveltekit-reload>full reload</a>
```

## Common patterns

### Module-level shared state

```ts
// counter.svelte.ts
class Counter {
  count = $state(0);
  doubled = $derived(this.count * 2);
  increment() { this.count++; }
}
export const counter = new Counter();
```

```svelte
<script>
  import { counter } from '$lib/counter.svelte';
</script>
<button onclick={() => counter.increment()}>{counter.count}</button>
```

### Effect that depends on async state

```ts
$effect(() => {
  const next = bpm;  // always tracked
  if (Tone.Transport) Tone.Transport.bpm.value = next;
});
```

### Conditional sandbox initialization (the SSR-safe pattern)

```ts
import { browser } from '$app/environment';

class Store {
  data = $state(browser ? loadFromLocalStorage() : []);
  constructor() {
    if (browser) {
      $effect.root(() => {
        $effect(() => {
          localStorage.setItem('key', JSON.stringify(this.data));
        });
      });
    }
  }
}
```

</article>

<style>
  .page {
    max-width: 920px;
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
  .prose h2 {
    margin-top: var(--sp-7);
    font-size: var(--fs-xl);
    border-top: 1px solid var(--c-border);
    padding-top: var(--sp-5);
  }
  .prose h3 { margin-top: var(--sp-5); }
  .prose table {
    border-collapse: collapse;
    margin: var(--sp-3) 0;
    font-size: var(--fs-sm);
  }
  .prose th, .prose td {
    text-align: left;
    padding: 6px 12px;
    border-bottom: 1px solid var(--c-border);
  }
  .prose th { color: var(--c-text-muted); font-weight: 500; }
  .prose td:first-child { font-family: var(--font-mono); color: var(--c-accent); }
</style>
