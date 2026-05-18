<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Render Modes · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-5);">

<LessonHeader
  moduleSlug="05-practice-journal"
  lessonSlug="04-render-modes"
  title="About Page Prerendered, Dashboard SSR"
  blurb="Per-route render mode flags. The most underrated SvelteKit feature."
/>

## Why this lesson exists

Frameworks usually pick one rendering strategy for the whole app and you live with it. SPA-only Next 12, SSR-everywhere Next 13 by default, fully static Astro. Each works fine for its target case and starts to chafe outside it. Your about page doesn't need SSR. Your dashboard can't be prerendered. Your marketing landing wants the HTML to ship without JS at all.

SvelteKit's answer is per-route flags. Each route picks `prerender`, `ssr`, and `csr` independently. The build figures out what to do — static HTML for prerendered routes, server-rendered HTML for SSR routes, JS-only shells for SPA routes, no JS at all for CSR-disabled routes. You configure it with three `export const` lines in a `+page.ts` or `+layout.ts` and the build does the rest.

This matters specifically for our journal because we're going to deploy it to GitHub Pages, which is a *static host* — no server, just files. The static adapter requires every route to be either prerendered or served from a SPA fallback. That fallback is a single `index.html` that bootstraps the client router for any unmatched URL. So we need to tell SvelteKit which routes prerender (the About page) and which routes go through the SPA fallback (everything localStorage-backed). That's this lesson.

## Learning objectives

By the end of this lesson you'll be able to:

- Explain what `prerender`, `ssr`, and `csr` flags do, separately and in combination.
- Pick the right combination for each route in the journal.
- Set defaults at the layout level and override at the page level.
- Configure the static adapter with a `fallback` HTML for SPA routes.
- Inspect the build output and verify each route was processed correctly.
- Diagnose common rendering failures (browser API access on the server, hydration mismatches).

## Concept 1: The four render-mode flags

### What it is

Three flags determine how a route renders, plus a fourth that's a URL convention. They live as `export const` declarations in a `+page.ts`, `+page.server.ts`, `+layout.ts`, or `+layout.server.ts`:

```ts
export const prerender = true;          // build to static HTML at build time
export const ssr = false;               // skip server-side rendering at request time
export const csr = false;               // ship NO client-side JavaScript
export const trailingSlash = 'always';  // URL convention (with/without trailing slash)
```

Each flag is independent. They compose to produce the rendering mode you want.

- **`prerender`** runs at *build time*. SvelteKit visits the route, renders it as HTML, and writes the result to disk. At deploy time, the HTML file is served directly. No server work per request, no JS to bootstrap. Best for content that doesn't change per-request.
- **`ssr`** runs at *request time* on the server. The server renders the route into HTML on demand, sends it to the browser. The browser shows real content immediately, then "hydrates" — Svelte's runtime attaches to the rendered DOM and takes over for interactivity. Best for first-paint speed and SEO when the content varies per-request.
- **`csr`** is "client-side rendering" — Svelte's JS bundle runs in the browser to render or hydrate. Disabling it ships pure HTML with no JS. Useful for pages that don't need any client interactivity (a static about page, an email-rendered receipt). The HTML still needs to be produced somehow — either prerendered or SSR'd.
- **`trailingSlash`** is `'always'`, `'never'`, or `'ignore'`. Determines whether `/songs` and `/songs/` are treated as the same URL, redirected, or both valid. Mostly a URL-aesthetics decision; relevant for prerendering because the file path differs (`/songs.html` vs `/songs/index.html`).

The default for all three render flags is `true` for `ssr` and `csr`, and `false` for `prerender`. So an unconfigured route is server-rendered with client hydration — the most general-purpose option.

### Worked example: the four combinations

| `prerender` | `ssr` | `csr` | What you get |
|---|---|---|---|
| true | true | true | Static HTML at build time, hydrated by JS on the client. Good for marketing pages with interactive widgets. |
| true | true | false | Static HTML, no JS. Pure content. Fastest possible delivery. |
| false | true | true | Server-rendered per request, then hydrated. The default SvelteKit experience. |
| false | false | true | SPA mode — server sends a JS-only shell, client renders. Good for localStorage-backed apps. |

For most apps you don't think about this matrix consciously — you pick a default for the layout and override the few exceptions.

### Variations

**Function-valued `prerender`.** You can set `prerender = 'auto'`, which means "prerender if possible, fall back to SSR if not." Useful for routes with optional dynamic segments where some URLs are known at build time.

**`config` export for adapter-specific settings.** Some adapters accept per-route config — Vercel's adapter, for instance, supports `export const config = &lbrace; runtime: 'edge' &rbrace;` to deploy a route as an edge function. We don't need adapter config for the static adapter.

**Inherited flags.** Page flags override layout flags, but only for that specific page. Sibling pages still inherit the layout default. This is how you set "SPA by default, except About is prerendered" cleanly.

### Common mistakes

- **Confusing `prerender` with `ssr`.** Both produce HTML on the server side, but `prerender` happens at build time (once, ahead of deploy) and `ssr` happens at request time (per visit). For static-only hosts like GitHub Pages, only `prerender` works. For Vercel/Netlify/Cloudflare/Node, both work.
- **Setting `csr = false` on an interactive page.** No JS means no `bind:value`, no `onclick`, no `$state`. The page is dead HTML. Only use when the page truly has zero interactivity.
- **Forgetting these are `export const`, not function calls.** `export const prerender = true` — bare value at module scope. Not inside `load`.
- **Setting them in `+page.svelte` instead of `+page.ts`.** They live in the `.ts` file (or the layout's `.ts`). The Svelte component file is for markup; the `.ts` file is for route metadata.

### TS notes

Each flag has a specific type from `'./$types'`: `Prerender = boolean | 'auto'`, `Ssr = boolean`, `Csr = boolean`. You don't usually need to import these — the const exports infer fine. If you're using a `+page.server.ts`, the same flags work there too.

## Concept 2: Picking per-route for the journal

### What it is

For every route in the app, ask:

1. Does this route's content depend on per-user, runtime-only data? (If yes, can't prerender.)
2. Does this route's content require browser-only APIs? (If yes, can't SSR — or you need to guard.)
3. Is this route purely content with no interactivity? (If yes, `csr = false` ships no JS.)

For the journal:

- The **About** page is static text. Same for everyone. No browser APIs. → Prerender it. (We'll keep CSR on for now to keep the layout nav interactive.)
- The **Dashboard, Songs, Songs/[id], Sessions/new** pages all read from localStorage. localStorage doesn't exist on the server. → Disable SSR. They'll render on the client only.
- All pages use the layout nav, which is interactive (active link). → Keep CSR enabled everywhere.

Result: a layout-wide default of `ssr = false`, with About overriding to enable both prerendering and SSR.

### Worked example: the per-route config

Start with the layout default. Create `src/routes/+layout.ts`:

```ts
export const ssr = false;
export const trailingSlash = 'always';
```

This says: by default, no SSR for any route. Every page is SPA-rendered.

Now override for About. Create `src/routes/about/+page.ts`:

```ts
export const prerender = true;
export const ssr = true;
```

`prerender = true` writes `/about/index.html` at build time. `ssr = true` overrides the layout's `ssr = false` because we *want* the About page to render server-side — it's just static text, there's nothing browser-only on it.

The other pages don't need any per-page config — they inherit `ssr = false` from the layout and the default `prerender = false`. They'll go through the SPA fallback.

### Variations

**Make About ship zero JS.** Add `export const csr = false` to `src/routes/about/+page.ts`. The page renders to static HTML at build, ships no JS. The drawback: the layout nav loses its `class:active` reactivity *for visits to /about* — because without CSR, `page.url.pathname` isn't a reactive signal in the browser, just whatever the build-time renderer produced. For most static pages this is acceptable; for the journal, you might keep CSR on so the active link stays correct.

**Prerender the songs list with build-time mock data.** If you wanted, you could prerender `/songs` with an empty list as a fallback. The client-side load would replace it with real data. This is over-engineering for our case — just disabling SSR is simpler.

**SSR for a server-backed app.** When the journal eventually gets a real backend, the pages flip back to SSR — they'd fetch from the server at request time, render fully, send HTML to the browser. The layout's `ssr = false` would be removed.

### The whole picture

For our journal:

| Route | prerender | ssr | csr |
|---|---|---|---|
| `/` (dashboard) | false | false | true |
| `/about` | true | true | true |
| `/songs` | false | false | true |
| `/songs/[id]` | false | false | true |
| `/songs/new` | false | false | true |
| `/sessions/new` | false | false | true |

Five SPA routes, one prerendered. The SPA routes will all be served by the static adapter's `fallback` HTML. The prerendered About page is its own file.

### Common mistakes

- **Forgetting to override `ssr` on About.** If you set `ssr = false` on the layout and don't override on About, the About page can't be prerendered (you can't statically render a page that explicitly opts out of server rendering). The build will error. Fix by setting `ssr = true` on About's `+page.ts`.
- **Setting `prerender = true` on a dynamic route without entries.** SvelteKit doesn't know which IDs exist. It either errors at build time, prerenders nothing, or (for some adapters) prerenders the parameterized variants if they're discovered via links. Our `/songs/[id]` is SPA-only — never prerendered — so this doesn't apply.
- **Per-page flags being silently ignored.** Make sure you put them in `+page.ts` (or `+page.server.ts`), not in `+page.svelte` and not in `+layout.svelte`. Wrong file, no effect.
- **Mixing `+page.ts` and `+page.server.ts` with conflicting flags.** If both export `ssr`, SvelteKit will warn. Pick one file.

### TS notes

The flag exports don't need explicit types. If you want to be explicit:

```ts
import type { LayoutLoad } from './$types';
export const ssr: false = false;
export const prerender: false = false;
```

Almost never necessary.

## Concept 3: How browser-only APIs interact with rendering modes

### What it is

The render-mode flags exist mostly *because* of the server-vs-browser API split. If every API worked in both contexts, you could SSR everything and the choice wouldn't matter. But localStorage, `window`, `document`, MediaRecorder, AudioContext — these only exist in the browser. Trying to use them on the server during SSR throws `ReferenceError`.

There are two ways to deal with this:

1. **Skip SSR entirely** for routes that touch browser APIs. `ssr = false`. The page only renders in the browser. This is what we're doing for the journal — localStorage is everywhere, no point trying to SSR.
2. **Gate the API access** with `browser` from `$app/environment`, or move the access into `onMount` / `$effect` (which only run client-side). Then the route can SSR — it just renders without the browser-only data, and the client picks up after hydration.

The first option is simpler. Use it when most of the page depends on browser-only data. Use the second when only a small bit does.

### Worked example: the browser guard pattern

Our `getSongs()` helper already does this:

```ts
export function getSongs(): Song[] {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(SONGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
```

On the server, `browser` is `false`, the function returns `[]` early. No localStorage access, no error. On the client, `browser` is `true`, the function reads from localStorage.

If we were to enable SSR for the songs list route, the server would render with `data.songs === []`, the HTML would say "you haven't added any songs yet", then the client would hydrate, the load would re-run with real data, and the list would populate. The flicker between "empty" and "populated" would be visible — which is why we're disabling SSR instead, getting one render with the right data.

The guard pattern is also useful for `onMount`-style work that only makes sense in the browser:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  onMount(() => {
    if (!browser) return; // belt-and-suspenders — onMount already only runs in browser
    document.title = 'My Page';
  });
</script>
```

Note that `onMount` already only fires in the browser — the `browser` check is technically redundant inside `onMount`. The guard is more important inside `load` or at module top-level.

### Variations

**`$effect` for browser-only side effects.** `$effect(() => &lbrace; ... &rbrace;)` runs in the browser after mount and on dependency changes. Don't confuse with `load` (which can run on both).

**`if (typeof window !== 'undefined')`.** The poor-man's `browser` check. Works but lacks the framework-aware semantics of `browser` from `$app/environment` (e.g., during prerendering, `browser` knows that's a build-time render even if `window` happens to be polyfilled).

**`crypto.randomUUID()` in older Node.** Available in Node 19+ and all browsers. If you target older runtimes, fall back to a library or polyfill. SvelteKit's defaults are modern enough that this rarely comes up.

### Common mistakes

- **Module-top-level browser access.** `const songs = localStorage.getItem(...)` at the top of a `.ts` file runs at import time on the server. Even with `ssr = false` at the page level, the module might be imported during build. Guard everything.
- **Assuming `ssr = false` is enough to skip all server work.** It skips render, not module loading. Code that runs at import time (top-level effects) still runs on the server.
- **`window?.localStorage` as a guard.** Optional chaining doesn't protect against `window` being undefined — it'd throw on the `localStorage` access. Use the `browser` constant from `$app/environment`.
- **Hydration mismatches.** If SSR renders `<p>0 songs</p>` and then the client (with localStorage data) immediately renders `<p>4 songs</p>`, you get a hydration warning in the console. Either keep SSR off (our choice) or render a loading state that matches in both contexts.

### TS notes

`browser: boolean` from `'$app/environment'`. The narrowing works — after `if (!browser) return;`, the rest of the function knows it's in the browser. (Though TypeScript can't statically guarantee `localStorage` exists; you may still want to cast or use `globalThis.localStorage`.)

## Concept 4: The static adapter's SPA fallback

### What it is

The static adapter (`@sveltejs/adapter-static`) produces a `build/` directory containing only static files — HTML, JS bundles, CSS, assets. No server. You upload it to a static host (GitHub Pages, Cloudflare Pages, Netlify static, S3, plain Nginx) and it works.

The catch: a pure static host can't run server code at request time. Every URL must map to a file. For prerendered routes, the file exists — `build/about/index.html` for `/about`. For non-prerendered routes (our SPA pages), there's no file to serve. The static adapter solves this with a *fallback*: a single HTML file (usually `build/index.html`) that bootstraps the SvelteKit client router. When the static host gets a request for a URL it doesn't have a file for, it serves the fallback. The fallback boots the JS, the router looks at the URL, and the right route renders client-side.

This requires the host to be configured to serve the fallback for unknown URLs. GitHub Pages does this automatically if you have a `404.html` (it serves the 404 page for any not-found URL, and we exploit that by making the 404 page our SPA bootstrap). Some other hosts require explicit routing rules.

The adapter config:

```js
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html', // or '404.html' for GitHub Pages
      strict: true
    })
  }
};
```

`strict: true` makes the build fail if it finds a non-prerenderable route without a fallback. Without `fallback`, every route must be prerenderable; with `fallback`, anything not explicitly prerendered uses the fallback.

### Worked example: configuring the adapter

We'll install and configure the adapter in L5 (the deploy lesson). For now, conceptually:

```sh
npm install -D @sveltejs/adapter-static
```

Replace `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      strict: true
    })
  }
};
```

Run `npm run build`. The output:

```
build/
├── _app/                    # JS bundles and chunks
│   └── immutable/
│       └── ...
├── about/
│   └── index.html           # the prerendered about page
├── favicon.png
└── index.html               # the SPA fallback
```

`build/about/index.html` is real, full HTML for the About page. The static host serves it directly when someone visits `/about`. `build/index.html` is the SPA shell — it loads the JS bundle and lets the client router render whatever URL the user is on.

### Variations

**`fallback: '404.html'` instead.** Some hosts (like GitHub Pages) serve `404.html` for any not-found path while keeping `index.html` as the literal root. Naming the fallback `404.html` makes the GitHub Pages behavior do the right thing without extra config. We'll use this in L5.

**No fallback, fully prerendered.** If every route in your app can be prerendered, you don't need a fallback. The build produces an HTML file for each URL. Possible for a blog or docs site; not possible for our journal because half the routes need per-user data.

**Prerender entries for dynamic routes.** If you have `/posts/[slug]` and want each slug prerendered, export `prerender = true` on the route AND tell SvelteKit which slugs exist. You can do this with a `entries` export in `+page.server.ts`:

```ts
export const prerender = true;
export function entries() {
  return [{ slug: 'first' }, { slug: 'second' }];
}
```

We're not doing this — `/songs/[id]` is SPA-only.

### Common mistakes

- **Forgetting `fallback` and getting "the following routes were not prerendered" errors.** Add `fallback: 'index.html'`.
- **Setting `strict: false` to suppress build errors instead of fixing them.** Don't. The strict mode is there because non-prerendered routes without a fallback will be 404s in production. Configure the fallback properly.
- **Deploying to a static host that doesn't support SPA routing.** Some hosts don't serve `index.html` for unknown URLs. The SPA pages 404. Either pick a host that supports it (GitHub Pages does via `404.html`; Netlify via `_redirects`) or configure the host's rewrite rules.
- **Mixed-mode confusion at runtime.** A user visits `/songs/abc` directly. The static host serves `index.html`. The JS boots, the router sees `/songs/abc`, runs the load function. If the load throws (e.g., 404 because the song doesn't exist in *this user's* localStorage), the `+error.svelte` renders. All correct, but it can feel like things are working "by accident" the first time. They aren't.

### TS notes

Adapter config is plain JS. No types involved unless you want them.

## Putting it together

Apply the config from this lesson. After making the changes, run `npm run build` (you'll need the static adapter installed first, which is L5's first step). Inspect `build/`. You should see:

- `build/about/index.html` — fully-rendered About page HTML.
- `build/index.html` — the SPA fallback shell. Open it in a text editor; you'll see a small `<body>` and a `<script>` that loads the SvelteKit bundle.
- `build/_app/` — the JS bundles, CSS, and other assets that both the prerendered pages and the SPA fallback load.

Run `npx vite preview` to test the production build locally. Visit `/about` — full HTML on first paint. Visit `/songs` — brief blank moment as the JS loads, then your songs render. Reload `/songs/anything` directly in the URL bar — same fallback behavior, the load runs client-side, the page renders.

You now have an app where the right pages are statically delivered (About) and the right pages are SPA-routed (everything else), all in the same build, deployable to any static host. The next lesson connects this to GitHub Pages specifically.

## Exercises

### Exercise 1: Add a fully-static help page

**Setup:** The journal has no help page. You know how to prerender.

**What to do:** create `src/routes/help/+page.svelte` with some FAQ-style content (no interactivity). Add `src/routes/help/+page.ts` that exports `prerender = true`, `ssr = true`, and `csr = false`. Add a "Help" link to the layout nav. Run `npm run build` and inspect `build/help/index.html` — it should be fully-rendered HTML with no JS-loading scripts.

**Verify by:** the page works in `npm run dev`. After build, `build/help/index.html` has the rendered FAQ text inline and doesn't include a `<script>` that loads the SvelteKit bundle (only static-asset references like CSS).

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/help/+page.svelte -->
<h1>Help</h1>

<h2>How do I add a song?</h2>
<p>Click "Songs" in the nav, then "+ add song" in the empty state, or visit /songs/new directly.</p>

<h2>Where does my data live?</h2>
<p>In your browser's localStorage. It's per-device — your phone and laptop don't share state.</p>

<h2>Why does the dashboard go blank for a moment when I refresh?</h2>
<p>The journal is a single-page app. The HTML shell loads first, then JavaScript boots and renders your data from localStorage.</p>
```

```ts
// src/routes/help/+page.ts
export const prerender = true;
export const ssr = true;
export const csr = false;
```

Update the layout's `links` array:

```js
{ href: '/help', label: 'Help' },
```

Note: with `csr = false`, the layout's `class:active` highlight won't update reactively while you're on `/help` — but visiting `/help` will already have the correct highlight baked in at build time, because SvelteKit prerenders the layout with the page. Navigation *to* `/help` from another SPA route triggers a full page load (because the prerendered `/help` doesn't share a JS runtime with the SPA pages). Acceptable for a help page.

</details>

### Exercise 2: Diagnose a "localStorage is not defined" build error

**Setup:** Imagine you removed the `if (!browser) return [];` guard from `getSongs()`. The build fails with `localStorage is not defined`.

**What to do:** explain *why* the build fails when our pages have `ssr = false`. (Hint: think about when `+page.ts` modules are loaded.) Fix by restoring the guard. Then explain what would happen if you tried to set `ssr = true` on the songs list page with the guard restored.

**Verify by:** the explanation correctly identifies module-load vs render-time execution. The fix (restoring the `browser` guard) makes the build succeed.

<details>
<summary>Show solution</summary>

When you build, SvelteKit imports every route's `+page.ts` module on the server (Node) to discover route metadata, load function definitions, and exports like `prerender`. Importing a module runs its top-level code, including any imports' top-level code transitively. If `getSongs()` is called at module top-level, it runs at import time — even though the `load` function and the page itself never render on the server.

In our actual code, `getSongs()` is only called *inside* the `load` function, not at module top-level. So when the module imports, no call happens. The call only happens when `load` runs, which happens client-side because `ssr = false`. But if the helper itself had a top-level `const songs = localStorage.getItem(...)`, that would run on import and crash.

The fix is the `browser` guard inside the function — it makes the function safe to call from any context. With the guard restored, you *could* set `ssr = true` on the songs list page: the server-side render would call `getSongs()`, get `[]`, render the empty state, send the HTML to the client. The client would hydrate, call `getSongs()` again, get real data, and re-render. There'd be a visible flicker from empty to populated. Which is exactly why we keep SSR off — to avoid the flicker.

</details>

### Exercise 3: Trace the request lifecycle

**Setup:** Conceptual exercise. No code.

**What to do:** for each of the following user actions, write down the sequence of events from request to rendered page. Include whether the network is hit, whether JS runs server-side, whether the JS bundle is downloaded, whether load functions run.

1. First-ever visit to `/about` from a Google link.
2. First-ever visit to `/songs` from a Google link.
3. Already on `/songs`, clicks the link to `/songs/abc`.
4. Already on `/songs`, clicks the link to `/about`.

**Verify by:** the answer correctly identifies which steps occur for each case.

<details>
<summary>Show solution</summary>

1. **First visit to `/about`.** Browser requests `/about`. Static host returns `build/about/index.html` (a fully rendered HTML page, prerendered at build time). Browser displays HTML. Because About has `csr = true` (default), the page also loads the SvelteKit JS bundle, hydrates the layout for nav interactivity. About's content was already rendered server-side at build time; no `load` runs.

2. **First visit to `/songs`.** Browser requests `/songs`. Static host returns the SPA fallback (`build/index.html` or `build/404.html`). Browser loads the HTML shell. Browser downloads JS bundle. SvelteKit client router boots, sees the URL is `/songs`, runs the `/songs` `load` function (in the browser). Load reads localStorage, returns songs. Page component renders. Total user-perceived time: brief blank moment between HTML load and JS-rendered content.

3. **`/songs` → `/songs/abc` from a click.** Client router intercepts the click. Layout stays mounted. Runs `/songs/[id]` `load` function in the browser. Load looks up the song from localStorage, returns it (or throws 404). New page renders inside the existing layout. No network request to the static host. Very fast.

4. **`/songs` → `/about` from a click.** Tricky. About is prerendered with its own HTML; the SPA running `/songs` doesn't know how to render About from JS alone (it'd need to fetch the prerendered HTML or have the About route in its JS bundle). What actually happens: SvelteKit's client router checks whether the destination is part of the SPA. About *is* a SvelteKit route, so the router uses the same client-side navigation — runs the load (no-op for About since no `load` function), renders the About component (which IS in the JS bundle). The prerendered `/about/index.html` is only used for *first* loads to that URL, not for in-app navigation.

The mental model: prerendered pages double as both "what gets served on first load" and "regular SvelteKit routes that render client-side after the JS is running." The two paths produce the same output.

</details>

### Exercise 4: Custom `trailingSlash` behavior

**Setup:** By default, SvelteKit treats `/songs` and `/songs/` as the same. The default is `trailingSlash = 'never'` (URLs without trailing slash are canonical).

**What to do:** set `trailingSlash = 'always'` on the root layout. Run `npm run dev`. Visit `/songs` — does it redirect to `/songs/`? Visit `/songs/abc` — does the same happen? What's the implication for prerendered files (e.g., does `build/about/index.html` change to `build/about.html` or stay the same)?

**Verify by:** with `trailingSlash = 'always'`, SvelteKit redirects URLs without trailing slashes to add one. The prerendered output for `/about` remains `build/about/index.html` because that file path serves both `/about` and `/about/`.

<details>
<summary>Show solution</summary>

Add to `src/routes/+layout.ts`:

```ts
export const trailingSlash = 'always';
```

Visit `/songs` in dev — the URL bar changes to `/songs/` (redirect). Visit `/songs/abc` — becomes `/songs/abc/`.

For prerendering, file paths under `/about` end up as `build/about/index.html` regardless — that file is served for both `/about` and `/about/` by most static hosts. The `trailingSlash = 'always'` setting affects what URL the browser is on (and what canonical URLs your links should use), not the on-disk structure.

When does this matter? For SEO canonical URLs and for matching your `BASE_PATH` config consistently. For our journal, the default is fine; revert if you set it.

</details>

### Exercise 5 (stretch): Mixed-mode page — prerendered shell with client-fetched body

**Setup:** You want the layout chrome of a route to be prerendered (so first-paint is fast), but the body to render client-side from localStorage data.

**What to do:** describe (don't necessarily build) how you'd structure this. Could you do it with the existing flags? What's the trade-off vs the current "all-SPA" approach? Hint: think about what the layout vs the page renders, and what happens on hydration.

**Verify by:** a coherent answer that identifies the mechanism (prerender the layout, SPA the page) and the trade-offs (a bit of partial-content flicker; the prerendered layout has to render to *something* meaningful without page-specific data).

<details>
<summary>Show solution</summary>

You'd set `prerender = true` and `ssr = true` on the *layout* (`src/routes/+layout.ts`), and `ssr = false` on the individual pages that need browser data. SvelteKit would prerender the layout as static HTML (header, nav, footer), with a placeholder for `&lbrace;@render children()&rbrace;`. At runtime, the client would boot the JS, look at the URL, run the page's load (in the browser, against localStorage), and render the page into the layout's children slot.

The result: instant first paint of the chrome (a brand and nav appear immediately) plus a brief "loading" or empty state in the page body until JS hydrates and the load completes.

Trade-off vs all-SPA: a few extra prerendered HTML files (one per layout-route combination, depending on how SvelteKit handles it), and the layout has to render meaningfully without page data. For our journal, the layout's count badge (`data.totalSongs`) reads from localStorage via the layout load — which can't run on the server, so we'd have to make the layout work with `data.totalSongs = 0` initially and update after hydration. Workable but adds complexity.

For this app, the all-SPA approach is the right balance — minor first-paint delay, much simpler mental model. For a content-heavy app where chrome speed matters more, the mixed-mode is worth considering.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/+layout.ts` with `export const ssr = false` (and any trailingSlash you want).
- `src/routes/about/+page.ts` with `export const prerender = true; export const ssr = true;` to override.
- (Optionally, from Exercise 1) `src/routes/help/+page.ts` for a fully-static help page.

### Verify it works

- `npm run dev` still works for every route.
- After `npm run build` (with the static adapter from L5 installed), `build/about/index.html` exists as fully-rendered HTML, and `build/index.html` exists as a small SPA shell.
- `npx vite preview` serves the built site; every route renders correctly.

### Compare against the reference

No M5 reference repo. Your `+layout.ts` and `+page.ts` files should look like the examples above.

## Common questions

**Q: Why can SSR cause a hydration mismatch?**
A: SSR renders the page on the server using whatever data is available there. The browser then takes that rendered HTML and "hydrates" — Svelte's runtime re-runs the component logic and attaches event listeners. If the runtime produces *different* HTML than the SSR did (e.g., because client-only data is now available), the browser flags a mismatch in the console. The page usually still works, but the mismatch is a bug — fix by ensuring the SSR and first-client-render produce the same DOM, or by skipping SSR for that route.

**Q: Does `csr = false` mean no Svelte component code runs at all?**
A: It runs on the server (or at build time, for prerender) to produce the HTML. After that, no JS is shipped. So a component with `csr = false` *renders* but isn't interactive — no `bind:value`, no `onclick`, no `$state` updates. It's the right choice for a true static page; the wrong choice for anything that needs interactivity after first paint.

**Q: Can I prerender a route that uses a load function?**
A: Yes. SvelteKit calls the load at build time. The load can be async, can fetch, can compute. Just make sure it doesn't depend on per-request data (which doesn't exist at build time) and doesn't use browser-only APIs (no browser at build time either). Most build-time data fetching is fine — read from a file, fetch from a public API, query a build-time DB connection.

**Q: What's the file-on-disk difference between `prerender` and SSR-without-prerender?**
A: Prerender writes the HTML file at build time. SSR-without-prerender produces the HTML at *request time*, on the server. Same content, different timing. For static hosts, only prerender works (no server to run SSR). For Node/Vercel/etc., SSR is fine.

**Q: My CSS isn't loading on the prerendered About page in dev.**
A: It should be. Make sure the layout's `<style>` block isn't gated behind a `browser` check or `if (csr) ...`. Layout styles ship with the prerendered HTML the same way they ship with any other rendered HTML. If you've used `:global(body) &lbrace; ... &rbrace;` in the layout, it should apply to the body of the prerendered About page too.

## What's next

You've configured each route's render mode and the static adapter's fallback. The journal builds to a `build/` directory of static files. All that's left is putting those files on a public URL. The next and final lesson installs the static adapter properly, wires up `BASE_PATH` for GitHub project-pages URLs, writes a GitHub Actions workflow to build and deploy on every push to main, and ships the journal to a real `https://...github.io/practice-journal/` URL.

<SourcesSection lessonKey="05-practice-journal/04-render-modes" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
