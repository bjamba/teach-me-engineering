<script>
  import CompileSandbox from '$lib/sandbox/CompileSandbox.svelte';
  import OpenTheHood from '$lib/components/OpenTheHood.svelte';
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';

  const helloSource = `<h1>hello, svelte<\/h1>

<p>this is a working component.<\/p>

<style>
  h1 { color: #ff3e00; font-family: system-ui; }
  p { color: #444; font-family: system-ui; }
<\/style>
`;

  const styledHeading = `<h1>your name here<\/h1>
<p>edit this text — the preview updates on every keystroke.<\/p>

<style>
  h1 {
    color: #ff3e00;
    font-family: system-ui;
    font-size: 3rem;
    text-shadow: 0 0 24px rgba(255, 62, 0, 0.3);
  }
  p {
    color: #555;
    font-family: system-ui;
    font-style: italic;
  }
<\/style>
`;

  const noScript = `<p>this component has no script section.<\/p>
<p>that's allowed. components don't have to have any logic — they can be pure markup.<\/p>

<style>
  p { color: #444; font-family: system-ui; line-height: 1.6; }
<\/style>
`;

  const conflictingStyles = `<button class="primary">click me<\/button>
<p>this paragraph is not a button, but watch what happens if I write CSS that "shouldn't" apply to it.<\/p>

<style>
  button { background: #ff3e00; color: white; border: 0; padding: 8px 16px; }
  p { color: blue; }
<\/style>
`;
</script>

<svelte:head><title>Your First Component · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-1);">

<LessonHeader
  moduleSlug="01-hello-svelte"
  lessonSlug="01-hello-component"
  title="Your First Component"
  blurb="Stand up a SvelteKit project. Ship a working component. Understand the three sections of a .svelte file and what each is for."
/>

## Why this lesson exists

You can't build anything in Svelte until you can write a `.svelte` file and see it render in a browser. That sounds trivial — it mostly is — but the few things you need to set up correctly the first time are the things that get you stuck for an hour if you skip them. This lesson does the setup, ships a working component, and explains what each piece of the file is for so the rest of the course doesn't lean on assumptions.

If you already have a SvelteKit project running and `+page.svelte` displays something you wrote, skim and skip to the next lesson. If you don't, follow along.

## Learning objectives

By the end of this lesson you'll be able to:

- Create a new SvelteKit project from the command line.
- Open the project in a code editor and edit `src/routes/+page.svelte`.
- Identify the three sections of a Svelte component (`<script>`, markup, `<style>`) and explain when you'd write each.
- Recognize that the `<style>` block in a component is scoped — its rules don't bleed into other components.
- Use the embedded sandbox on this page to experiment with Svelte code without leaving the lesson.

## Concept 1: A Svelte project from scratch

### What a SvelteKit project is

SvelteKit is the application framework around Svelte. It scaffolds the project, runs the dev server, handles routing, bundles the production build. You'll learn more about it in Module 5 — for now, treat it as the wrapper that makes Svelte components into a working website.

The starter command creates a folder with everything you need: `package.json`, a Vite config, a TypeScript config (optional), and a `src/` directory with one example route.

### Setup, step by step

Open a terminal. `cd` into wherever you keep code projects. Then:

```sh
npm create svelte@latest my-svelte-app
```

The CLI asks a few questions. The answers that match this course:

- **Which Svelte app template?** — *Skeleton project*. (The other options pre-fill demo code that you'd just delete.)
- **Add type checking with TypeScript?** — *Yes, using TypeScript syntax*. The course uses light TypeScript; you can write JavaScript everywhere if you prefer.
- **Add ESLint?** — *Yes*. Optional. Catches typos.
- **Add Prettier?** — *Yes*. Optional. Formats code on save.
- **Add Playwright / Vitest?** — *No*. Skip both for now. The course covers testing later if you want it.

Then:

```sh
cd my-svelte-app
npm install
npm run dev
```

The dev server prints a URL, usually `http://localhost:5173/`. Open it. You see a blank page (or a generic "Welcome to SvelteKit" placeholder, depending on the template version). That's expected — you picked the skeleton.

### What the project's folders mean

You don't need a deep tour right now, but a quick orientation:

- **`src/routes/`** — every folder here is a URL. `src/routes/+page.svelte` is the root (`/`). We'll write all our code in here for this lesson.
- **`src/lib/`** — reusable components and helpers. You'll create components here starting in Module 3.
- **`src/app.html`** — the HTML shell. Don't usually need to touch it.
- **`static/`** — files served as-is (images, favicons). Anything in `static/x.png` is at `/x.png`.
- **`package.json`** — npm metadata and scripts. You'll run `npm run dev`, `npm run build`, `npm run check`.

If you're used to a Vite or Next.js or Nuxt project, this should feel familiar.

### Common mistakes during setup

- **"Command not found: npm".** Install Node first (nodejs.org). Version 20 or newer.
- **"EACCES" or permission errors during `npm install`.** Don't run with `sudo`. If npm is complaining about your global install, see nodejs.org's "Resolving EACCES" page — usually a permissions misconfiguration that's worth fixing.
- **Dev server starts but the browser shows nothing.** Check that the URL you opened matches what the dev server printed. Common confusion: typing `localhost:5173` works; `https://localhost:5173` does not (the dev server is HTTP).
- **Page is blank, no errors in the terminal.** Open browser dev tools (F12 / Cmd-Opt-I). Look at the console. Most early issues print there.

## Concept 2: The structure of a `.svelte` file

### Three sections, each optional

A `.svelte` file has three sections that can appear in any order (script first is conventional):

```svelte
<script>
  // setup: variables, functions, imports
</script>

<!-- markup: ordinary HTML with Svelte template features -->

<style>
  /* component-scoped CSS */
</style>
```

All three are optional. A component can be:

- **Markup only** — pure presentation, no logic, no styles. A typography component might be just `<p><slot /></p>` and nothing else.
- **Script + markup** — interactive but unstyled (rare unless using a CSS framework globally).
- **Markup + style** — presentational but styled (a button component that has no behavior beyond being a button).
- **All three** — most components.

The order doesn't matter. `<style>` first is unusual but legal. `<script>` between markup blocks is illegal — there can be at most one of each.

### A complete hello-world

Open `src/routes/+page.svelte` in your editor. Replace whatever's there with this:

```svelte
<h1>hello, svelte</h1>

<p>this is a working component.</p>

<style>
  h1 { color: #ff3e00; font-family: system-ui; }
  p { color: #444; font-family: system-ui; }
</style>
```

Save. Look back at the browser tab. The page updated WITHOUT you reloading — the dev server hot-reloaded the change. Welcome.

That component has no `<script>` section because it doesn't need one. There's no state, no logic — just markup and styles.

### The same code in the embedded sandbox

You can also experiment with Svelte code without leaving this page. The sandbox below has the same component. Source on the left, rendered output on the right. Edit the source and the preview updates on every keystroke.

<CompileSandbox initialSource={helloSource} height="420px" />

This sandbox uses the real Svelte 5 compiler running in your browser. Anything you can write in your local project, you can write in here. It's the same code paths.

### A note on `+page.svelte`

The `+` prefix is a SvelteKit convention. Files starting with `+` are special — they're routing files (pages, layouts, server endpoints). Files without the `+` are regular components or modules.

So `src/routes/+page.svelte` means "the component that renders at `/`." `src/routes/about/+page.svelte` would be `/about`. We'll cover routing properly in Module 5 — for now, just know that `+page.svelte` is the file SvelteKit looks for to render a page.

## Concept 3: Scoped styles

### What "scoped" means

Look at the `<style>` block in the hello-world. The rules `h1 { color: #ff3e00 }` and `p { color: #444 }` use plain element selectors. In a normal HTML page, these would apply to EVERY `<h1>` and `<p>` on the page.

In a Svelte component, they don't. They only apply to the `<h1>` and `<p>` elements that THIS component renders.

This is called "scoped styles." Mechanically: the Svelte compiler reads your `<style>` block, generates a unique class like `s-AbCd1234`, adds it to every element your component renders, and rewrites every selector in your CSS to be qualified by that class. The browser sees `.s-AbCd1234 h1 { color: #ff3e00 }` (plus the `s-AbCd1234` class on your `<h1>`) and only matches against THIS component's elements.

You don't have to think about this most of the time. You just write CSS, and it stays in the component. Other components' `<h1>` tags don't get affected.

### Why this matters

In a non-Svelte CSS world, you have to be careful about naming. You write `h1 { ... }` in one file and it affects every `<h1>` everywhere. You end up with BEM (`button button--primary button--primary--large`), or atomic CSS (Tailwind), or CSS-in-JS, or some convention — all to prevent the cascading-globally problem.

Scoped CSS just doesn't have that problem. You write `button { ... }` in `Button.svelte` and it only affects buttons rendered by `Button`. You write `p { color: blue }` and only THIS component's paragraphs become blue.

The sandbox below demonstrates this. The `p` selector turns paragraphs blue — but only paragraphs THIS component renders. If another component on the same page also had `p` elements, they'd be unaffected.

<CompileSandbox initialSource={conflictingStyles} height="380px" />

### Common mistakes with scoped styles

- **"Why isn't my CSS applying?"** — Most likely you wrote a selector that matches an element your component doesn't actually render. The compiler quietly drops rules with no matching elements (it'll warn at build time, but if you skip warnings it's invisible).
- **"I want this rule to apply globally."** — Wrap the selector in `:global()`. Example: `:global(body) { margin: 0 }`. This tells the compiler not to scope it.
- **"I want to style something a child component rendered."** — Use `:global()` on the descendant selector: `.container :global(.child-class) { ... }`. The `.container` part is scoped (must be a class in this component), but the descendant `.child-class` matches anywhere inside, including in child components.
- **"My selector worked, but the style isn't being applied with the priority I expected."** — Scoped selectors add a class, which increases specificity slightly. Usually this is invisible, but if you're fighting with `!important` or specificity in global CSS, it can confuse you. The dev tools' "Computed" panel shows what actually applied.

## Concept 4: The HTML you can write

### Mostly just HTML

The markup section of a Svelte component is HTML. Everything you know about HTML works:

- All elements (`<div>`, `<button>`, `<input>`, `<svg>`, etc.)
- All attributes (`class`, `id`, `aria-*`, `data-*`, etc.)
- All ARIA roles, semantic elements, form controls, etc.
- Comments: `<!-- like this -->`

```svelte
<header>
  <nav aria-label="primary">
    <a href="/" class="brand">Make / Svelte</a>
  </nav>
</header>

<main>
  <article>
    <h2>Welcome.</h2>
    <p>Standard semantic HTML, with no Svelte-specific syntax yet.</p>
  </article>
</main>
```

If you can write it in `.html`, you can write it in `.svelte`. The Svelte-specific stuff (`{expression}`, `bind:value`, `{#if}`, etc.) is additive — you opt into it when you want it. The next lesson introduces the first piece (`{expression}` for interpolating values).

### Pure-presentation components are fine

A component doesn't have to have logic. The sandbox below has no `<script>` section at all. It's just markup and a `<style>` block.

<CompileSandbox initialSource={noScript} height="360px" />

Edit it. Add a third paragraph. Add a heading. Change the colors. Everything works without a script — it's just HTML.

This is the case where "components" feel like overkill in other frameworks. In React you'd still need a function. In Svelte you don't — the file IS the component, and a content-only component is just markup.

## Putting it together

The hello-world from the first sandbox is a real complete component. It has all three sections (well, two — no script). It's the smallest possible "yes you're really writing Svelte" example.

Use the sandbox below to extend it. Try changing the colors. Add a button (it won't do anything yet — clicks come in the next lesson). Try a different font.

<CompileSandbox initialSource={styledHeading} height="420px" />

## Exercises

### Exercise 1: Change the heading text

**Setup:** the sandbox above contains a working component.

**What to do:** change the `<h1>` text to your own name. Save (the preview auto-updates).

**Verify by:** the preview pane on the right shows your name in orange.

**Stretch:** add a subtitle below the `<p>` with smaller text, in a different color, using a `<small>` element. Style it via the `<style>` block.

<details>
<summary>Show solution</summary>

```svelte
<h1>Chris</h1>
<p>edit this text — the preview updates on every keystroke.</p>
<small>working with Svelte 5</small>

<style>
  h1 { color: #ff3e00; font-family: system-ui; font-size: 3rem; }
  p { color: #555; font-family: system-ui; font-style: italic; }
  small { color: #999; font-family: system-ui; font-size: 0.9rem; }
</style>
```

</details>

### Exercise 2: Demonstrate scoped CSS

**Setup:** start from a blank sandbox (or any of the above).

**What to do:** write a component that has TWO different elements styled differently, then add a comment in the CSS explaining what scoping means in your own words.

**Verify by:** both elements render with different styles; the comment is descriptive.

**Stretch:** use `:global()` to add a rule that would apply globally (e.g., `:global(body) { background: #f0f0f0 }`). Notice that in the sandbox this affects the iframe's body, not the lesson page's body — scoping is per-render-context.

<details>
<summary>Show solution</summary>

```svelte
<h1>scoped</h1>
<p>not scoped to anything except THIS component.</p>

<style>
  /* These styles only apply to h1 and p elements rendered by this component.
     Other components' h1 and p tags stay unaffected. */
  h1 { color: tomato; }
  p { color: navy; }

  /* :global() opts out of scoping. This rule would apply to body anywhere. */
  :global(body) { background: #f0f0f0; }
</style>
```

</details>

### Exercise 3: Test the no-script case

**Setup:** start from a blank sandbox.

**What to do:** write a component with NO `<script>` section. Just markup and `<style>`. Make it visually distinctive (different colors, different fonts, a border, anything).

**Verify by:** the preview renders your styled markup. The compiled-output tab (toggle the `{ } Compiled JS` button on the sandbox) shows shorter compiled code than a component with a script — because there's no reactivity setup needed.

<details>
<summary>Show solution</summary>

```svelte
<div class="card">
  <h2>No script needed</h2>
  <p>This component is pure markup + scoped styles.</p>
</div>

<style>
  .card {
    border: 2px solid teal;
    border-radius: 12px;
    padding: 16px;
    background: #f0fafa;
    font-family: system-ui;
  }
  h2 { color: teal; margin: 0 0 8px; }
  p { color: #333; margin: 0; }
</style>
```

In the compiled output, there's no `$.state`, no `$.template_effect` — just template setup and an `append` call. The runtime cost of this component is essentially zero.

</details>

### Exercise 4 (stretch): Two different `<h1>` styles in the same lesson

**Setup:** the embedded sandboxes above each render in their own iframe. The styles in one don't affect the others.

**What to do:** prove this. In one sandbox, style `<h1>` red with a huge font. In another sandbox, style `<h1>` blue with a small font. Both are heading 1 tags. Both styles work without conflict.

**Verify by:** both sandboxes render their `<h1>` correctly. Neither's `<h1>` styling leaks to the other.

**Why this works:** each sandbox iframe is its own document. Even without Svelte's scoping, iframes don't share styles. But notice that the scoping IS demonstrably working — the sandbox iframe's `<body>` has its own `:global(body)` rules in some examples, separate from the lesson page's body. That's the same per-component scoping at work, just visible across iframe boundaries.

## Checkpoint

By the end of this lesson, your project should have:

- A SvelteKit project directory (e.g., `my-svelte-app/`).
- `node_modules/` populated by `npm install`.
- `src/routes/+page.svelte` with the hello-world component (or any variation you wrote).
- The dev server running via `npm run dev`.

### Verify it works

- Visiting `http://localhost:5173/` in a browser shows your component rendered with the styling you wrote.
- Editing the `+page.svelte` file and saving causes the browser tab to update without manual refresh (this is hot module replacement working).
- The browser console shows no errors.
- The terminal shows no errors from the dev server.

### Compare against the reference

For this lesson there's no reference repo to compare against — you're writing your first component. From Module 2 onward, the `capstone-reference/` project will be the canonical comparison for capstone work.

## Common questions

**Q: Do I need to install Svelte separately?**
A: No. `npm create svelte@latest` runs `npm install` for you implicitly through the template scaffolding, and Svelte is one of the dependencies. You don't import the framework anywhere — the compiler handles that.

**Q: Can I use this with my existing Vite / Webpack project?**
A: Svelte can integrate with other build setups, yes. But SvelteKit assumes you start with its scaffolding. If you have an existing app and want to add Svelte components to it without using SvelteKit, look up `@sveltejs/vite-plugin-svelte` — that's the underlying Vite plugin, usable standalone. This course assumes the SvelteKit setup throughout.

**Q: Why TypeScript? Can I use plain JavaScript?**
A: Yes. The `npm create svelte` CLI offers a "JavaScript with JSDoc comments for type checking" option. The course uses light TypeScript (type annotations on `$props()`, occasional generic types) — easy to translate to plain JS. The Svelte language server gives you autocomplete either way.

**Q: The dev server prints a URL with a different port number. Is that wrong?**
A: No. Vite picks the next free port if 5173 is taken. Whatever it prints, open. The port isn't significant; everything else stays the same.

**Q: What if I'm not using VS Code?**
A: The Svelte language server (the engine behind editor support) is editor-agnostic. The Svelte team maintains plugins for VS Code, JetBrains, Zed, Sublime, and Neovim. Any modern editor with LSP support can work. The official VS Code extension is the most polished, but you don't HAVE to use VS Code.

**Q: Do I need to set up any linting / formatting myself?**
A: ESLint and Prettier are optional. If you said yes during the CLI prompt, they're configured already. If not, you can add them later — `npm install -D eslint prettier eslint-plugin-svelte prettier-plugin-svelte` and copy the default configs from the SvelteKit docs.

## What's next

The next lesson adds the first piece of interactivity: a `<script>` block, a `$state` declaration, and a button that increments a counter. By the end of lesson 2 you'll have written your first reactive Svelte code and seen the most important rune (`$state`) in action.

<SourcesSection lessonKey="01-hello-svelte/01-hello-component" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
