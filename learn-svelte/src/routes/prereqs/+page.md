<script>
</script>

<svelte:head><title>Prerequisites · Make / Svelte</title></svelte:head>

<article class="page prose">

<header>
  <p class="kicker">BEFORE YOU START</p>
  <h1>Prerequisites</h1>
  <p class="lede">
    What you should already know before starting, what you need installed, and what to expect from the course's pacing.
  </p>
</header>

## What you should already be comfortable with

This course doesn't teach you JavaScript. It teaches you Svelte. The assumed baseline:

- **HTML and CSS.** You know what tags, attributes, classes, IDs, and selectors are. You've written CSS that uses flexbox or grid. You don't need to be a designer — just literate.
- **JavaScript.** You can write functions, use arrow functions, destructure objects, use array methods (`map`, `filter`, `reduce`, `forEach`), use async/await, and read code with template literals and spread operators. Things like `const`, `let`, modules (`import`/`export`), and `Promise` are familiar.
- **Terminal basics.** You can `cd` into a directory, run `npm install`, run `npm run dev`, and read what the terminal prints back. You don't need to be a shell wizard.
- **A code editor with Svelte support.** VS Code with the official Svelte extension is the recommended setup. The same extension works in Cursor, Windsurf, and other VS Code forks. WebStorm, Zed, and Neovim all have working Svelte support too.
- **A browser with dev tools.** Chrome, Firefox, Edge, Safari — any modern browser. You'll open dev tools occasionally to inspect what's happening.

If you've shipped a Node app or a React/Vue/Solid component before, you're more than prepared. If you've only done HTML/CSS websites, you'll be OK but will move slower through Modules 2-4 as you pick up JavaScript patterns.

## What you should install

Required:

- **Node 20 or newer.** Check with `node --version`. Get it from nodejs.org if needed.
- **npm.** Comes with Node.
- **Git.** Required for the deploy modules (5 and 8). Get it from git-scm.com.
- **A GitHub account.** Free. You'll push your code there and deploy via GitHub Pages.

Strongly recommended:

- **VS Code** (code.visualstudio.com) with the **Svelte for VS Code** extension. This gives you syntax highlighting, autocompletion, type checking, and inline errors as you write `.svelte` files.
- **The Svelte DevTools** browser extension. Lets you inspect component state and effect timelines while debugging.

Optional:

- A second monitor or a half-screen browser. You'll often want the course on one side and your code/dev server on the other.
- **An audio output device.** Modules 3 onward involve sound — speakers or headphones make the music-themed apps work as intended.

## Setup commands you'll run

The course assumes you can run these from a terminal in whatever directory you've picked for code projects:

```sh
node --version          # confirms Node is installed
npm create svelte@latest project-name
cd project-name
npm install
npm run dev             # starts the dev server, prints a localhost URL
```

For each module, you'll create a fresh project (or reuse one). The course's lessons tell you what to install per module (mostly just `npm install tone` for the music modules).

## What to expect from the course

- **Module 1** is the warm-up. Three short lessons; total commitment ~1 hour.
- **Modules 2–4** are each a small build-along. ~2–3 hours each. By the end of M4 you've shipped three working music apps (tap-tempo, metronome, chord player).
- **Module 5** is SvelteKit proper. ~3 hours. Your apps go from "running on localhost" to "deployed on the internet."
- **Modules 6–7** are the capstone — the DAW. ~6–10 hours total across both modules. The most substantial project you build.
- **Module 8** is deploy + framework synthesis. ~1–2 hours.

Total budget: **20–30 hours** if you do every exercise and build everything in your own project alongside the lessons. Faster (~10–15 hours) if you skim and focus on the capstone.

If you have ~5 hours a week, plan for 4–6 weeks.

## How to learn from this course

A few things that'll make this go better:

- **Build alongside.** Don't just read. Open a terminal, type the code, see it run. The lessons assume you have a project up.
- **Use the embedded sandboxes** (where they exist — mostly in Module 1) to experiment without leaving the page.
- **Don't skip the `<Try this>` sections.** They're where the learning actually happens. Reading code is passive; modifying it is active.
- **Use the supporting routes** in the title bar:
  - `/troubleshooting` — when something breaks
  - `/reference` — when you forget the syntax for something
  - `/demos` — for inspiration / examples of what's possible
- **Read the capstone-reference project** if you get stuck on Modules 6 or 7. It's a complete working DAW; you can compare your work to it at any point.
- **The Svelte DevTools extension** is unreasonably useful. Install it; use the "Components" tab to inspect state, the "Reactivity" tab to see what triggers what.

## What this course doesn't do

A few honest exclusions:

- **It doesn't teach JavaScript fundamentals.** If you're rusty on closures, this/that semantics, async/await, or modules, get fluent on those first (MDN's JS guide is great).
- **It doesn't go deep on CSS.** You'll write CSS but the course assumes you can already make things look reasonable.
- **It doesn't cover testing in depth.** There's a brief mention of Vitest and Playwright in the deploy module but real test-driven development is a separate skill.
- **It doesn't make you a Web Audio expert.** You'll use Tone.js, which abstracts most of the audio thread complexity. If you go on to build serious audio software, you'll want to learn the underlying API directly.
- **It's web-only.** No React Native equivalent. No desktop framework. If you want to ship to iOS/Android/desktop, that's a different curriculum.

## Ready?

If those prerequisites match what you have and what you're up for, head back to the dashboard and start Module 1. The first lesson takes about 10 minutes.

</article>

<style>
  .page {
    max-width: 760px;
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
  .prose ul { margin: var(--sp-3) 0; }
</style>
