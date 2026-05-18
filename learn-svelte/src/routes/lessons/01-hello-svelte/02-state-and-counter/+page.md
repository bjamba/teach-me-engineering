<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const counterSource = `<script>
  let count = $state(0);
<\/script>

<button onclick={() => count++}>
  clicked {count} {count === 1 ? 'time' : 'times'}
<\/button>

<style>
  button {
    background: #ff3e00;
    color: white;
    border: 0;
    padding: 12px 18px;
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }
<\/style>
`;

  const noStateBug = `<script>
  // What's wrong with this? Click the button — what happens to the count?
  let count = 0;
<\/script>

<button onclick={() => count++}>
  clicked {count} times
<\/button>

<style>
  button { background: #ff3e00; color: white; border: 0; padding: 12px 18px; border-radius: 8px; font: inherit; cursor: pointer; }
<\/style>
`;

  const decrementChallenge = `<script>
  let count = $state(0);
<\/script>

<button onclick={() => count++}>+1<\/button>

<!-- Add a second button below that decrements the counter. -->
<!-- Then add a third button that resets the counter to 0. -->

<p>count: {count}<\/p>

<style>
  button {
    background: #ff3e00; color: white; border: 0; padding: 8px 16px;
    border-radius: 6px; font: inherit; cursor: pointer; margin-right: 8px;
  }
  p { font-family: system-ui; font-size: 18px; }
<\/style>
`;

  const multipleStates = `<script>
  let count = $state(0);
  let name = $state('world');
  let isOn = $state(false);
<\/script>

<p>hello, {name}!<\/p>
<input bind:value={name} />

<p>count: {count}<\/p>
<button onclick={() => count++}>increment<\/button>

<p>switch: {isOn ? 'ON' : 'OFF'}<\/p>
<button onclick={() => isOn = !isOn}>toggle<\/button>

<style>
  p, button, input { font-family: system-ui; }
  button { background: #ff3e00; color: white; border: 0; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
  input { padding: 6px; border: 1px solid #ccc; border-radius: 6px; }
<\/style>
`;

  const objectState = `<script>
  let user = $state({ name: 'Chris', count: 0 });
<\/script>

<p>{user.name} clicked {user.count} times<\/p>

<button onclick={() => user.count++}>increment<\/button>
<input bind:value={user.name} />

<style>
  p, button, input { font-family: system-ui; }
  button { background: #ff3e00; color: white; border: 0; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 8px; }
  input { padding: 6px; border: 1px solid #ccc; border-radius: 6px; }
<\/style>
`;

  const conditionalDisplay = `<script>
  let count = $state(0);
<\/script>

<button onclick={() => count++}>clicked {count} times<\/button>

<p>status: {count === 0 ? 'untouched' : count < 5 ? 'getting started' : count < 10 ? 'warming up' : 'committed'}<\/p>

<style>
  button, p { font-family: system-ui; }
  button { background: #ff3e00; color: white; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
<\/style>
`;
</script>

<svelte:head><title>$state and Your First Counter · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-1);">

<LessonHeader
  moduleSlug="01-hello-svelte"
  lessonSlug="02-state-and-counter"
  title="$state and Your First Counter"
  blurb="One button. One number. One increment. The most important rune in Svelte 5 and what it actually means."
/>

## Why this lesson exists

A component without state is a static document — you can render it, but it can't respond. Real applications need values that change over time and UI that reflects those changes automatically. In Svelte 5 you declare those values with the `$state` rune.

This lesson introduces `$state` properly — what it is mechanically, how to use it for different value types, what common bugs look like, and how the rest of Svelte's reactivity flows from this one primitive. If you internalize `$state` here, every other rune becomes a small variation on the same idea.

## Learning objectives

By the end of this lesson you'll be able to:

- Declare a reactive variable with `$state` and use it for primitives (number, string, boolean), arrays, and objects.
- Attach event handlers to elements using the `onclick={fn}` syntax (and recognize the `oninput`, `onsubmit`, etc. variants).
- Interpolate reactive values into markup with `{expression}`, including conditional expressions.
- Recognize the bug pattern of "I forgot `$state`" — what it looks like and how to fix it.
- Explain to someone else what `$state(0)` returns and why it isn't really a number.

## Concept 1: `$state` — your first rune

### What `$state` actually is

`$state` is a "rune" — a special syntax the Svelte compiler recognizes. When you write `let count = $state(0)`, the compiler reads that line and does something different than if you'd written `let count = 0`:

- It registers `count` as a reactive variable in the file.
- Every later reference to `count` in this file gets rewritten into a runtime call.
- Reads of `count` become `$.get(count)`.
- Writes (`count = 5`) become `$.set(count, 5)`.
- Increments (`count++`) become `$.update(count)`.

You don't see any of this. You write what looks like normal JavaScript:

```js
let count = $state(0);
count++;
console.log(count);  // 1
```

And the runtime tracks reads and writes invisibly. Bindings in the template that read `count` re-evaluate automatically when `count` changes. No subscription bookkeeping, no manual notification.

The mental model in one sentence: **`$state` is syntax the compiler reads, not a function you call.** It marks a variable as reactive so the compiler can wire up the bookkeeping for you.

### A worked example: the counter

```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>
  clicked {count} {count === 1 ? 'time' : 'times'}
</button>
```

Open the sandbox below. Click the button. Watch the count and the singular/plural form update.

<CompileSandbox initialSource={counterSource} height="380px" />

Three things to notice:

1. **`count++` works.** No `setCount` function call, no destructured tuple. The variable behaves like a normal mutable JavaScript number — you can `++`, `+=`, assign directly, anything that's valid for a number.

2. **The button text updates.** When `count` changes, the bindings `{count}` and `{count === 1 ? 'time' : 'times'}` re-evaluate. The text node inside the button updates from "clicked 0 times" through "clicked 1 time" to "clicked 2 times" and onward.

3. **The component function does not re-run on click.** The script ran once when the component mounted. After that, only the bindings that depend on `count` re-evaluate when `count` changes. The button stays in the DOM the whole time; only its text node updates.

The third point is genuinely different from React. In React, your component function re-runs from the top on every state change, producing a new virtual DOM that React reconciles against the old one. In Svelte, the function ran once; reactivity targets the specific DOM bindings that read the value. Updates are local to what changed.

### Variations: $state for different value types

`$state` works for any JavaScript value. Different shapes have slightly different ergonomics.

**Primitives** (numbers, strings, booleans) are the simplest. Read and write like normal variables:

```svelte
let count = $state(0);     // number
let name = $state('Chris'); // string
let isOpen = $state(false); // boolean

count++;                    // works
name = 'Chris L';           // works
isOpen = !isOpen;           // works
```

**Arrays** are reactive too, and you can mutate them directly:

```svelte
let items = $state<string[]>([]);

items.push('first');        // tracked, triggers reactivity
items.pop();                // tracked
items[0] = 'updated';       // tracked
items = ['fresh', 'list'];  // also fine (reassignment)
```

This is one of the genuinely nicer differences from React. In React, you'd write `setItems(prev => [...prev, 'first'])` because mutating state directly is forbidden. In Svelte, `items.push('first')` works AND triggers reactivity because the array is wrapped in a Proxy that catches mutations.

**Objects** behave the same — mutate properties directly:

```svelte
let user = $state({ name: 'Chris', count: 0 });

user.count++;               // tracked at the .count level
user.name = 'Chris L';      // tracked at the .name level
user = { name: 'New', count: 0 };  // also fine
```

The Proxy is recursive. Nested object access is also tracked: `user.profile.email = 'new@x.com'` works.

### A sandbox with three different states

<CompileSandbox initialSource={multipleStates} height="480px" />

Three independent reactive values. Each updates only the bindings that read it. Type in the name input and only the "hello, X!" line updates. Click toggle and only the switch line updates. Click increment and only the count line updates.

### Common mistakes with `$state`

**Mistake 1: forgetting `$state`.**

```svelte
<script>
  let count = 0;  // not reactive!
</script>

<button onclick={() => count++}>{count}</button>
```

The button increments `count` in memory but the binding never updates. Diagnostic: the count stays at 0 forever despite clicks.

This is what the sandbox below demonstrates — click the button and watch nothing happen visually. The clicks ARE registering and `count` IS incrementing, but the runtime has no way to know to update the binding.

<CompileSandbox initialSource={noStateBug} height="320px" />

The fix: wrap the initial value in `$state(...)`.

**Mistake 2: reading state into a non-reactive variable.**

```svelte
<script>
  let count = $state(0);
  let copy = count;  // captures the current value, not reactive
</script>

<p>{copy}</p>  <!-- never updates -->
```

`copy` is a plain `let` containing whatever `count` was when the script ran. It's not tracked. The `<p>{copy}</p>` binding reads `copy`, which never changes, so it never updates.

Fix: read `count` directly in the binding, or use `$derived` (next module).

**Mistake 3: forgetting `$state` is initial-value syntax, not a setter.**

```svelte
<script>
  let count = $state(0);

  function reset() {
    count = $state(0);  // WRONG — this is a syntax error
  }
</script>
```

You don't call `$state` multiple times. It's a marker the compiler sees at declaration time. To reset, just assign: `count = 0`.

**Mistake 4: trying to use `$state` outside a `.svelte` or `.svelte.ts` file.**

```ts
// in a regular .ts file
let count = $state(0);  // does nothing — $state isn't processed in .ts files
```

Runes only work in Svelte's compiled files: `.svelte`, `.svelte.ts`, `.svelte.js`. Regular `.ts` files don't get rune processing. To share reactive state across files, use a `.svelte.ts` module (covered in Module 4).

### TypeScript notes

For typed projects, declare the initial value's type explicitly when the inferred type is too narrow:

```ts
let items = $state<string[]>([]);          // empty array, inferred as never[]
let user = $state<{ name: string; age: number } | null>(null);
let count = $state<number>(0);             // inferred fine, type annotation optional
```

`$state` is generic: `$state<T>(initial: T): T` in spirit. The compiler handles the actual rewriting; the type system sees the value as `T`.

## Concept 2: event handlers

### The `onclick={fn}` pattern

Svelte 5 attaches event handlers via standard HTML-attribute-style syntax, where the value is a function:

```svelte
<button onclick={() => count++}>+1</button>
<button onclick={handleClick}>do thing</button>
<input oninput={(e) => name = e.currentTarget.value} />
<form onsubmit={(e) => { e.preventDefault(); save(); }}>...</form>
```

Two forms:

- **Inline arrow function** — convenient for one-liner handlers.
- **Named function reference** — better when the handler does several things.

Both work identically. The arrow form is more compact; the named form is easier to debug (stack traces show the name) and easier to test.

```svelte
<script>
  let count = $state(0);

  function handleClick() {
    count++;
    console.log('count is now', count);
  }
</script>

<button onclick={handleClick}>+1</button>
```

### The event object

The handler receives the standard DOM Event object as its argument:

```svelte
<input oninput={(e) => name = e.currentTarget.value} />
```

`e.currentTarget` is the element the handler is on (the `<input>`). `e.target` might be a child element if you have nested elements with bubbling events. Use `currentTarget` for "the thing I attached the handler to."

Standard methods are all there: `e.preventDefault()` to suppress browser defaults, `e.stopPropagation()` to halt event bubbling, etc.

### Variations

**Multiple handlers on the same element.** You can't have two `onclick` attributes. Combine them inside one function:

```svelte
<button onclick={(e) => { handleClick(e); trackAnalytics(); }}>...</button>
```

**Event modifiers.** Svelte 5 dropped the `on:click|preventDefault` modifier shorthand from Svelte 4. Just call `e.preventDefault()` in the handler:

```svelte
<form onsubmit={(e) => { e.preventDefault(); save(); }}>...</form>
```

**Listening on `window` or `document`.** Use the special `<svelte:window>` element:

```svelte
<svelte:window onkeydown={handleKey} onresize={handleResize} />
```

### Common mistakes with event handlers

**Mistake 1: passing a function call instead of a function reference.**

```svelte
<button onclick={handleClick()}>...</button>  <!-- WRONG -->
```

This CALLS `handleClick` during render and assigns its return value (probably `undefined`) as the click handler. The button does nothing useful when clicked.

Fix: pass the function itself, no parentheses. `onclick={handleClick}`.

**Mistake 2: stale captures via React-style closures.**

This is actually NOT a bug in Svelte the way it is in React. React's closures over state can capture stale values; Svelte's bindings always read the current value because the compiler injected `$.get(...)` calls. So you can write:

```svelte
<script>
  let count = $state(0);

  function delayed() {
    setTimeout(() => console.log(count), 1000);
  }
</script>

<button onclick={() => count++}>+1</button>
<button onclick={delayed}>log in 1s</button>
```

The `console.log(count)` inside `setTimeout` always logs the current value, not the value at the moment `delayed` was called. (In React, this would log the value frozen at handler-creation time unless you used a ref.)

**Mistake 3: missing `e.preventDefault()` on form submissions.**

```svelte
<form onsubmit={(e) => save()}>  <!-- form submits + page reloads -->
```

Without `e.preventDefault()`, the browser performs its default behavior (a full page navigation) after your handler runs. Almost always you want to prevent it:

```svelte
<form onsubmit={(e) => { e.preventDefault(); save(); }}>
```

## Concept 3: template interpolation

### What `{expression}` does

Curly braces in Svelte markup are template expressions. Whatever you put inside is evaluated as JavaScript, with the result inserted into the DOM:

```svelte
<p>count: {count}</p>
<p>doubled: {count * 2}</p>
<p>status: {count === 0 ? 'fresh' : 'used'}</p>
<p>label: {name.toUpperCase()}</p>
```

Any JavaScript expression works. Method calls, ternaries, computed property access, conditional chaining — anything that evaluates to a value.

### A worked example: conditional display

```svelte
<p>status: {count === 0 ? 'untouched' :
            count < 5 ? 'getting started' :
            count < 10 ? 'warming up' :
            'committed'}</p>
```

A chained ternary that picks a label based on the count. The whole expression re-evaluates whenever any of its dependencies (here, just `count`) change.

<CompileSandbox initialSource={conditionalDisplay} height="380px" />

For more complex conditional rendering (multiple paragraphs, different elements), use `{#if}` blocks — covered in the next module. Inline ternaries work great for "pick one of these short strings."

### Interpolation in attributes

You can interpolate into HTML attributes the same way:

```svelte
<a href="/users/{user.id}">profile</a>
<img src={imageUrl} alt={user.name} />
<button class="{type === 'primary' ? 'primary' : 'secondary'}">click</button>
<div style="color: {textColor}">...</div>
```

Two attribute syntaxes:

- **`attr={expression}`** when the entire value is the expression's result.
- **`attr="text {expression} more text"`** when you're mixing static text and expressions.

For the common case of "attribute name matches variable name," there's a shorthand:

```svelte
<input {value} />           <!-- equivalent to value={value} -->
<button {disabled}>...</button>
```

### Common mistakes with interpolation

**Mistake 1: stringifying objects.**

```svelte
<p>user: {user}</p>  <!-- renders "[object Object]" -->
```

JavaScript's default string conversion of an object is `[object Object]`. You probably want a specific property:

```svelte
<p>user: {user.name}</p>
```

Or `JSON.stringify(user)` if you genuinely want to dump the structure.

**Mistake 2: forgetting to escape `&lbrace;` in literal text.**

If you actually want a `{` character in your displayed text (not as part of a template expression), you need to escape it. Use the HTML entity `&lbrace;` for `{` and `&rbrace;` for `}`. Otherwise Svelte tries to interpret what comes after `{` as an expression and either errors or evaluates unexpected code.

**Mistake 3: assuming `{expression}` works inside style or script tags.**

It doesn't. The Svelte compiler only processes template expressions inside the MARKUP section. Inside `<style>` blocks, `{count}` is literal text (CSS doesn't know about your state). Inside `<script>` blocks, `{count}` is JavaScript object/block syntax.

To use reactive values in styles, use CSS custom properties:

```svelte
<div style="--color: {textColor}">...</div>
<!-- and in CSS: -->
<style>
  div { background: var(--color); }
</style>
```

## Putting it together

The exercises section below has you build a more complete counter. Before that, the sandbox below shows reactivity across object properties — a single state object with multiple fields, each independently updating its bindings.

<CompileSandbox initialSource={objectState} height="440px" />

Click increment and only the count text updates. Type in the name input and only the name text updates. The runtime tracks each property separately.

## Exercises

### Exercise 1: add a decrement and reset button

**Setup:** the sandbox below has a counter with a `+1` button.

**What to do:** add two more buttons. One that decrements (`-1`). One that resets the counter to 0.

**Verify by:** clicking each button updates the count correctly. The displayed count shows the current value at all times.

**Stretch:** add a fourth button that doubles the count, and a fifth that halves it (use `Math.floor` so the value stays an integer).

<CompileSandbox initialSource={decrementChallenge} height="440px" />

<details>
<summary>Show solution</summary>

```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>+1</button>
<button onclick={() => count--}>-1</button>
<button onclick={() => count = 0}>reset</button>
<button onclick={() => count *= 2}>×2</button>
<button onclick={() => count = Math.floor(count / 2)}>÷2</button>

<p>count: {count}</p>
```

</details>

### Exercise 2: disable the decrement at zero

**Setup:** your counter from Exercise 1.

**What to do:** make the decrement button disabled when `count === 0`. (HTML buttons support a `disabled` boolean attribute.)

**Verify by:** when count is 0, the decrement button looks dim and clicking it does nothing. As soon as count is 1 or more, the button becomes active again.

<details>
<summary>Show solution</summary>

```svelte
<button onclick={() => count--} disabled={count === 0}>-1</button>
```

The `disabled` attribute is bound to a reactive expression. When `count === 0` is true, the attribute is set; otherwise it's removed. The browser handles the dim visual + click-suppression automatically.

</details>

### Exercise 3: track clicks across multiple counters

**Setup:** a new component.

**What to do:** create three independent counters in the same component (each with its own `$state` variable). Display the total of all three below them.

**Verify by:** clicking each counter increments only that counter. The total at the bottom updates correctly across all three.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let a = $state(0);
  let b = $state(0);
  let c = $state(0);
</script>

<button onclick={() => a++}>A: {a}</button>
<button onclick={() => b++}>B: {b}</button>
<button onclick={() => c++}>C: {c}</button>

<p>total: {a + b + c}</p>
```

The `{a + b + c}` binding reads all three state variables. Whenever any of them changes, the binding re-evaluates. In Module 2 we'll see how `$derived` makes named "computed total" variables cleaner, but this works fine for small expressions.

</details>

### Exercise 4: a switch with a label

**Setup:** a new component.

**What to do:** a button that toggles a `$state<boolean>` value between true and false. A `<p>` above it shows the current state as "ON" or "OFF" with appropriate color (green when on, red when off).

**Verify by:** clicking the button flips the state and updates the label + color.

**Stretch:** add a second toggle. Show "BOTH ON" / "BOTH OFF" / "MIXED" based on the combined state.

<details>
<summary>Show solution</summary>

```svelte
<script>
  let isOn = $state(false);
</script>

<p style="color: {isOn ? 'green' : 'red'}">{isOn ? 'ON' : 'OFF'}</p>
<button onclick={() => isOn = !isOn}>toggle</button>
```

For the stretch:

```svelte
<script>
  let a = $state(false);
  let b = $state(false);
</script>

<button onclick={() => a = !a}>A: {a ? 'ON' : 'OFF'}</button>
<button onclick={() => b = !b}>B: {b ? 'ON' : 'OFF'}</button>
<p>{a && b ? 'BOTH ON' : !a && !b ? 'BOTH OFF' : 'MIXED'}</p>
```

</details>

### Exercise 5 (stretch): persist the counter to localStorage manually

**Setup:** your single counter.

**What to do:** when the counter changes, save its value to `localStorage` under the key `counter`. When the page loads, restore the value from localStorage if present.

You'll need to:
- Set the initial value of `$state` by reading from localStorage (with a fallback to 0 if absent or invalid).
- Add a way to write to localStorage when count changes — most natural is to do it in the click handler, but Module 2 introduces `$effect` which is the cleaner answer.

**Verify by:** click the counter, refresh the page, the previous count is still there.

<details>
<summary>Show solution</summary>

```svelte
<script>
  // Read the stored value, parse as integer, fall back to 0.
  let count = $state(parseInt(localStorage.getItem('counter') ?? '0', 10) || 0);

  function increment() {
    count++;
    localStorage.setItem('counter', String(count));
  }
</script>

<button onclick={increment}>clicked {count} times</button>
<button onclick={() => { count = 0; localStorage.removeItem('counter'); }}>reset</button>
```

This pattern (save in the handler) works fine but doesn't scale — every click handler needs to remember to call localStorage. Module 2 introduces `$effect`, which lets you say "whenever count changes, save it" once and forget about it.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+page.svelte` containing a counter component with at least the increment button working.
- At least one variation: a decrement button, a reset button, or both (from Exercise 1).
- Optionally: a label that changes based on the count, additional `$state` declarations.

### Verify it works

- Visiting `localhost:5173/` shows the counter.
- Clicking the buttons updates the displayed count.
- The browser console shows no errors.
- The page DOES NOT reload when you click — the dev server uses HMR and the click only updates the DOM in place.

### Compare against the reference

For this lesson there's still no reference repo. Starting in Module 6 (the capstone), every lesson points to a specific part of `capstone-reference/` for comparison. For now, your `+page.svelte` is the entire reference.

## Common questions

**Q: How is this different from React's `useState`?**

A: Two main differences. (1) Svelte's runes are syntax the compiler rewrites; React's hooks are function calls into a runtime. (2) Svelte components don't re-run on state change — only the bindings that read the changed value re-evaluate. React re-runs the whole component function and reconciles via the virtual DOM. The practical consequences: no stale-closure bugs in Svelte (handlers always see current state); no `useState` dependency rules (runes work anywhere `.svelte` / `.svelte.ts` syntax is processed); much smaller bundle.

**Q: Can I declare `$state` inside a function?**

A: No. `$state` declarations must be at the top level of the script (or inside a class field — see Module 4). If you want a "reactive variable created inside a function," you'd typically use a different pattern — either a closure that returns an object with state, or moving the state to a shared module.

**Q: What's the performance cost of `$state`?**

A: Reading a state value goes through the runtime's `$.get(...)` function and a Proxy trap for object properties. The cost is tiny — a few nanoseconds per access. For typical UI workloads, you won't notice it. For very hot paths (tight loops over thousands of property accesses per frame), use `$state.raw(...)` to skip the proxy and trade per-property reactivity for raw speed. Covered in Module 7.

**Q: Do I need TypeScript to use `$state`?**

A: No. Runes work in both JavaScript and TypeScript Svelte files. TS adds type checking on top; the runes themselves are identical. If you started with the TypeScript option in `npm create svelte@latest`, you have TS. If you picked plain JS, you don't, and that's fine.

**Q: My counter isn't updating. Where do I look first?**

A: Three things to check, in order: (1) did you wrap the initial value in `$state(...)` — `let count = $state(0)`, not `let count = 0`? (2) does the binding in the template actually read the variable — `{count}`, not `{otherVariable}`? (3) does the click handler actually mutate the variable — `count++`, not `count = count` or some other no-op? If all three look right and it still doesn't update, open browser dev tools and check the console for errors.

## What's next

The next lesson takes the single-counter component and splits it into a reusable `<Counter />` component you can render multiple times. We'll also crack open the compiled JavaScript output to see what the compiler actually produced — the moment Svelte's "compiler is the framework" claim becomes concrete and readable.

<SourcesSection lessonKey="01-hello-svelte/02-state-and-counter" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
