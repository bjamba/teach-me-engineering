# Learn Svelte

A comprehensive Svelte 5 curriculum, built as a SvelteKit application that gets
deployed to GitHub Pages. The site you read the lessons on **is** a Svelte app —
view source on any page to see the framework you are learning.

## Status

Mockup phase. Three pieces are wired up so the format can be reviewed before the
full curriculum is built:

- **Dashboard** at `/`.
- **First lesson** at `/lessons/01-the-compiler-is-the-framework/01-what-the-compiler-actually-does/`.
- **Live compile sandbox** embedded in that lesson — actually compiles your
  Svelte 5 source on every keystroke and renders the result in an iframe.

The remaining 9 modules' lessons are stubs in the curriculum spine
(`src/lib/curriculum.ts`) but do not yet have content files.

## Run it

```sh
cd learn-svelte
npm install
npm run dev
```

Open the printed URL. The first time the live sandbox loads it pulls the Svelte
compiler from `esm.sh`, which takes a couple of seconds. After that it is local.

## What it builds to

```sh
npm run build
```

Outputs a static site to `build/` via `@sveltejs/adapter-static`. That directory
is what GitHub Pages serves.

For project-Pages hosting at `https://<user>.github.io/learn-svelte/`, set
`BASE_PATH=/learn-svelte` at build time so the routes resolve under that prefix.
A GitHub Actions workflow that does this is in `.github/workflows/deploy.yml`
(added in the full build, not the mockup).

## Structure

```
learn-svelte/
├── src/
│   ├── app.html               # SvelteKit shell
│   ├── app.css                # design tokens; everything inherits from here
│   ├── lib/
│   │   ├── curriculum.ts      # the spine — module/lesson titles, order, slugs
│   │   ├── stores/
│   │   │   └── progress.svelte.ts   # rune-based store, persists to localStorage
│   │   ├── components/        # Nav, ModuleCard, OpenTheHood, LessonNav, ProgressRing
│   │   └── sandbox/
│   │       └── CompileSandbox.svelte  # the live compiler+preview widget
│   └── routes/
│       ├── +layout.svelte     # nav + theme bootstrapping
│       ├── +layout.ts         # `prerender = true` for static export
│       ├── +page.svelte       # dashboard
│       └── lessons/
│           └── 01-…/01-…/+page.md  # first lesson, MDsveX
├── static/                    # favicon, etc.
├── svelte.config.js
└── vite.config.ts
```

## Design choices

These are spelled out properly in `TUTOR_CONTEXT.md` (added in the full build);
the short version:

- **Svelte 5 with runes.** Svelte 3/4 syntax is called out where it still
  dominates external resources, never as the primary teaching target.
- **Capstone is a step sequencer / DAW-lite.** Built across Modules 6–7,
  shipped in Module 10.
- **Practitioner depth is the default**, with inline `<OpenTheHood>` panels
  on every lesson for contributor-depth deep dives. Closed by default.
- **The site itself is the pitch for Svelte.** Every transition, the spring
  progress ring, the scoped styles, the live compiler — all view-source-able.
- **Voice is plain authorial prose.** Not chatty, not casual-LLM, not stuffy.

## Cost

Free. Local dev needs Node 20+ and `npm`. Hosting is GitHub Pages, also free.
