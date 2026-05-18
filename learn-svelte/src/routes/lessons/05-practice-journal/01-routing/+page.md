<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Routing and Layouts · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-5);">

<LessonHeader
  moduleSlug="05-practice-journal"
  lessonSlug="01-routing"
  title="Routing and Layouts in SvelteKit"
  blurb="Filesystem routing, dynamic params, layouts. Build the bones of an app any musician would actually use."
/>

## Why this lesson exists

The three apps you built before this one were all a single page. One URL, one component tree, everything mounted into `+page.svelte`. That's fine for a tap-tempo detector, but it's not how real apps are shaped. Real apps have routes — a dashboard, a list of things, a detail view for one of those things, a form for creating new things, an About page nobody reads. You navigate between them. The URL changes. The browser back button does what you'd expect.

SvelteKit handles all of that through filesystem routing. The folder structure under `src/routes/` *is* the URL structure. There is no router config, no `<Route path="...">` component, no `createBrowserRouter` call. You make a folder called `songs`, drop a `+page.svelte` inside, and `/songs` exists. This sounds too simple until you realize that's basically the entire mental model.

This module builds a Practice Journal — a multi-route app that tracks songs you're learning and the practice sessions you log against them. By the end of L5 it'll be deployed to a public URL. This first lesson is the skeleton: routes, layouts, navigation. No data yet — that's L2.

## Learning objectives

By the end of this lesson you'll be able to:

- Scaffold a new SvelteKit project for the practice journal.
- Create routes by placing `+page.svelte` files inside folders under `src/routes/`.
- Wrap every route in a shared layout via `+layout.svelte` and render the page slot with `&lbrace;@render children()&rbrace;`.
- Define a dynamic segment with `[param]` and read its value via `page.params`.
- Highlight the active link in the nav using `page.url.pathname` from `$app/state`.
- Navigate programmatically with `goto()` and prefetch on hover with `data-sveltekit-preload-data`.
- Add a global error page with `+error.svelte`.

## Concept 1: Filesystem routing

### What it is

Every folder under `src/routes/` corresponds to a URL path. A file named `+page.svelte` inside that folder is the component that renders when a browser visits the URL. The folder `src/routes/songs/` is the URL `/songs`. The folder `src/routes/sessions/new/` is `/sessions/new`. The root folder `src/routes/` is `/`.

The `+` prefix is reserved. SvelteKit looks for specific filenames: `+page.svelte` for the page component, `+layout.svelte` for a wrapping layout, `+page.ts` for a load function, `+page.server.ts` for a server-only load function, `+error.svelte` for an error boundary, `+server.ts` for an API endpoint. Files in the same folder that *don't* start with `+` are treated as regular modules or components — not routes. This is how you can colocate a `SongCard.svelte` next to `+page.svelte` without it accidentally becoming the page at `/songs/SongCard`.

The point of all this convention is that you can read a project's URL structure by looking at the folder tree. No mental map between "the route config says X" and "the URL is Y". The folder tree *is* the route config.

### Worked example: scaffold the journal

First, make a new project. If you already have one named `practice-journal` from earlier exploration, delete it or pick a different name — we want a clean slate.

```sh
npm create svelte@latest practice-journal
cd practice-journal
npm install
```

When the CLI prompts:

- Template: **Skeleton project**.
- Type checking: **Yes, using TypeScript syntax**.
- ESLint, Prettier: **Yes** to both. Vitest, Playwright: **No**.

Now create the route structure. From the project root:

```sh
mkdir -p src/routes/about
mkdir -p src/routes/songs/'[id]'
mkdir -p src/routes/sessions/new
touch src/routes/+layout.svelte
touch src/routes/about/+page.svelte
touch src/routes/songs/+page.svelte
touch src/routes/songs/'[id]'/+page.svelte
touch src/routes/sessions/new/+page.svelte
```

The `[id]` folder name needs to be quoted in your shell so the brackets aren't interpreted as a glob. On Windows PowerShell or cmd, the syntax differs — just make the folders by hand in the file explorer if it's easier.

You should now have:

```
src/routes/
├── +layout.svelte         # wraps every page (nav, footer, etc.)
├── +page.svelte           # /  (dashboard)
├── about/
│   └── +page.svelte       # /about
├── sessions/
│   └── new/
│       └── +page.svelte   # /sessions/new
└── songs/
    ├── +page.svelte       # /songs  (list)
    └── [id]/
        └── +page.svelte   # /songs/<anything>  (detail)
```

Fill the page files with placeholders so you can see something:

```svelte
<!-- src/routes/+page.svelte -->
<h1>Dashboard</h1>
<p>Welcome to Practice Journal. Use the nav to add songs and log sessions.</p>
```

```svelte
<!-- src/routes/about/+page.svelte -->
<h1>About</h1>
<p>A small SvelteKit app for tracking what you practice.</p>
```

```svelte
<!-- src/routes/songs/+page.svelte -->
<h1>Songs</h1>
<p>You haven't added any songs yet.</p>
```

```svelte
<!-- src/routes/songs/[id]/+page.svelte -->
<h1>Song detail</h1>
<p>This page renders for any URL like /songs/whatever.</p>
```

```svelte
<!-- src/routes/sessions/new/+page.svelte -->
<h1>Log a Session</h1>
<p>The form goes here in lesson 3.</p>
```

Don't fill `+layout.svelte` yet — we'll do that in Concept 2.

### Variations

**Nested static segments.** Folders nest freely. `src/routes/admin/users/active/+page.svelte` is `/admin/users/active`. SvelteKit doesn't care how deep you go.

**Grouped routes without URL impact.** A folder name wrapped in parentheses — `(marketing)` — is a *route group*. It doesn't add a URL segment. So `src/routes/(marketing)/about/+page.svelte` is still `/about`, but the group lets you scope a different layout to all routes inside `(marketing)/`. We don't need this for the journal, but it's the standard way to give different sections of a site different chrome.

**Multiple dynamic segments and matchers.** You can chain dynamic segments — `src/routes/songs/[id]/sessions/[sessionId]/+page.svelte` matches `/songs/abc/sessions/xyz`, giving you `params.id === 'abc'` and `params.sessionId === 'xyz'`. You can also constrain a parameter with a matcher: `[id=integer]` only matches numeric values. Matchers live in `src/params/integer.ts` and export a `match` function. We don't need matchers for the journal — UUIDs match `[id]` fine — but they're useful when you want `/posts/[slug]` and `/posts/[id=integer]` to coexist as different routes.

### Common mistakes

- **Forgetting the `+`.** `page.svelte` (no `+`) is not a route. SvelteKit ignores it. Easy to fix; surprisingly common after a refactor.
- **Putting routes outside `src/routes/`.** A folder under `src/lib/routes/` is not a route. Only `src/routes/` is special.
- **Brackets eaten by the shell.** `mkdir src/routes/songs/[id]` without quoting may silently make a folder named `[id]` in *some* shells and a folder named `id` in others (or nothing at all). Quote `'[id]'` or use the file explorer.
- **Capitalizing `+Page.svelte`.** Filenames are case-sensitive on Linux (CI) and case-insensitive on macOS/Windows. A capitalized version works in dev on your Mac and breaks on the GitHub Actions runner that builds the deploy. Stick to lowercase.
- **Two pages, one URL.** `src/routes/songs/+page.svelte` and `src/routes/(group)/songs/+page.svelte` both resolve to `/songs`. SvelteKit errors at build time, but it's a confusing error if you haven't seen it before.

### TS notes

There's no type setup required for routing itself — folders are folders. But each `+page.svelte` can import `PageProps` (autogenerated) from `'./$types'` to type the `data` prop the load function returns. We'll use this in L2.

## Concept 2: Layouts

### What it is

A layout is a component that wraps every page inside its folder (and every folder beneath). You put one at `src/routes/+layout.svelte` and it wraps the entire app — every route shares the same header, footer, nav. You put another at `src/routes/songs/+layout.svelte` and it wraps only `/songs`, `/songs/[id]`, and any other `/songs/*` route — useful for things like a secondary tab strip that's only visible inside a section.

The layout receives a `children` snippet via `$props()`. You render it wherever the page content should appear with `&lbrace;@render children()&rbrace;`. Anything outside that call is the chrome — the parts that stay visually constant when the user navigates.

Layouts nest. The root layout wraps every child. A nested `+layout.svelte` wraps everything below it AND is itself wrapped by the parent layout. You don't have to do anything to make this happen — SvelteKit composes them automatically based on folder depth.

### Worked example: the app-wide layout

Put this in `src/routes/+layout.svelte`:

```svelte
<script>
  import { page } from '$app/state';

  let { children } = $props();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/songs', label: 'Songs' },
    { href: '/sessions/new', label: '+ Log Session' },
    { href: '/about', label: 'About' }
  ];

  function isActive(href) {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<header>
  <a href="/" class="brand">PRACTICE JOURNAL</a>
  <nav>
    {#each links as l (l.href)}
      <a href={l.href} class:active={isActive(l.href)}>{l.label}</a>
    {/each}
  </nav>
</header>

<main>
  {@render children()}
</main>

<style>
  :global(body) { margin: 0; background: #0a0b10; color: #ecedf3; font-family: system-ui; }
  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 32px; background: #11131a; border-bottom: 1px solid #262a3a;
  }
  .brand { font-weight: 700; letter-spacing: 0.1em; color: #f5b100; text-decoration: none; }
  nav { display: flex; gap: 4px; }
  nav a {
    padding: 8px 14px; border-radius: 8px;
    color: #9ea3b8; text-decoration: none; font-size: 14px;
  }
  nav a:hover { color: #ecedf3; background: #1a1d2a; }
  nav a.active { color: #f5b100; background: #262a3a; }
  main { max-width: 800px; margin: 32px auto; padding: 0 24px; }
</style>
```

Three things doing the work here:

1. **`let &lbrace; children &rbrace; = $props()`** destructures the children snippet. The name `children` is the default — SvelteKit always passes the matched page's component as `children`.
2. **`&lbrace;@render children()&rbrace;`** invokes the snippet. This is where the matched page renders inside the layout. Move it elsewhere in the markup and the page content moves with it.
3. **`page` from `$app/state`** is a reactive object. When the URL changes, `page.url.pathname` changes, and any `class:active` directive reading from it re-evaluates. The right link highlights without any subscriptions or effects.

Save and visit `/`, `/songs`, `/sessions/new`, `/about`. The chrome stays put. The page content swaps. The active link follows you.

### Variations

**Nested layouts.** Add `src/routes/songs/+layout.svelte` to wrap just the songs section. Useful if you want a sub-nav (List / Add / Recently Played) that's only visible inside `/songs/*`. The nested layout also receives `children` and renders it with `&lbrace;@render children()&rbrace;`. The page component is wrapped first by `songs/+layout.svelte`, then by the root `+layout.svelte`.

**Layouts that opt out.** A folder named `(reset)` or a `+page@.svelte` filename can break out of the layout chain. This is more advanced — useful for things like a print-friendly invoice page that shouldn't render the app nav. The docs call this "layout resetting" and it uses the `@` symbol in filenames. You probably won't need it for the journal.

**Multiple slots.** The default is one snippet called `children`. You can pass other snippets up the tree using Svelte's snippet system, but it's rare. Most layouts have one main slot.

### Common mistakes

- **Forgetting `&lbrace;@render children()&rbrace;`.** The layout renders but the page is invisible — there's no slot for it. Symptom: every URL shows the same chrome with no content below.
- **Importing `page` from `$app/stores` instead of `$app/state`.** `$app/stores` is the older Svelte 4 store-based API (`$page.url.pathname` with a leading `$`). `$app/state` is the Svelte 5 rune-friendly API (`page.url.pathname`, no `$`). Both still work; use `$app/state` in new code.
- **Putting global styles inside a non-global selector.** `body &lbrace; margin: 0 &rbrace;` in a `<style>` block doesn't reach `<body>` because Svelte scopes it. Wrap with `:global(body) &lbrace; margin: 0 &rbrace;`. Confused me the first time too.
- **Putting `<html>` or `<head>` tags in a layout.** Don't. Those live in `src/app.html`. The layout starts at `<body>`'s contents. For per-page `<title>` use `<svelte:head>`.
- **A "leaky" layout state.** Layouts are mounted once per nav into their scope. State declared in `+layout.svelte` persists across navigations within that scope. Sometimes that's what you want (e.g., a search input value); sometimes it surprises you (e.g., a modal that doesn't close).

### TS notes

The `children` prop is typed as `Snippet` from `'svelte'`. If you want explicit types in your layout:

```ts
import type { Snippet } from 'svelte';
let { children }: { children: Snippet } = $props();
```

Usually unnecessary — the auto-inferred type from `$props()` is correct.

## Concept 3: Dynamic segments

### What it is

A folder named `[id]` (or any other name in brackets) is a *dynamic segment*. Any URL that matches the surrounding path with anything in that segment renders the page inside. So `src/routes/songs/[id]/+page.svelte` renders for `/songs/wonderwall`, `/songs/abc123`, `/songs/anything-here`. The value in that position of the URL becomes `page.params.id` — same name as the folder, minus the brackets.

The folder name *is* the parameter name. If you call it `[songId]`, you read `page.params.songId`. If you call it `[id]`, you read `page.params.id`. There's no separate route config that maps URL patterns to variable names — the brackets are the binding.

You can have multiple dynamic segments at different depths: `src/routes/songs/[id]/sessions/[sessionId]/+page.svelte` matches `/songs/abc/sessions/xyz` and gives you `params.id === 'abc'`, `params.sessionId === 'xyz'`.

### Worked example: the song detail page

Update `src/routes/songs/[id]/+page.svelte`:

```svelte
<script>
  import { page } from '$app/state';
</script>

<h1>Song: {page.params.id}</h1>
<p>This page renders for any URL like /songs/whatever.</p>
<p>Whatever's in the URL position is in <code>page.params.id</code>.</p>

<a href="/songs">← back to songs</a>
```

Visit `/songs/test`. The heading shows `Song: test`. Visit `/songs/wonderwall`. It shows `Song: wonderwall`. The same component renders for every URL that matches.

We're reading `page.params.id` directly in the component, which works for trivial cases. The proper pattern is to read it inside a `load` function (next lesson) and pass the looked-up data as the `data` prop — that way the page renders with the song object already resolved, instead of with a raw ID string.

### Variations

**Rest parameters.** `[...path]` captures the rest of the URL into one param. `src/routes/docs/[...path]/+page.svelte` matches `/docs/a/b/c` with `params.path === 'a/b/c'`. Useful for catch-all routes like a docs site or a wiki.

**Optional parameters.** `[[lang]]` makes the segment optional. `src/routes/[[lang]]/about/+page.svelte` matches both `/about` and `/en/about`. `params.lang` is `undefined` in the first case and `'en'` in the second.

**Matchers.** As mentioned earlier, `[id=integer]` constrains the segment. The matcher file at `src/params/integer.ts` exports `match(value)` returning true/false. SvelteKit calls it; if it returns false, the route doesn't match.

### Common mistakes

- **Wrong param name.** Folder is `[id]`, code reads `page.params.songId`. Result is `undefined`. The error is silent until you try to use the value.
- **Forgetting that any URL matches.** `/songs/anything` renders the detail page even if "anything" isn't a real song. You'll handle this in L2 with a 404 thrown from the load function.
- **Spaces or unusual chars in the URL.** SvelteKit decodes URI-encoded segments automatically — `params.id` will be the decoded value. But if you're constructing links by hand, you may want to `encodeURIComponent` IDs that could contain `/` or `#`.
- **Dynamic segment shadows a static one — order ambiguity.** SvelteKit prefers more specific routes. `src/routes/songs/new/+page.svelte` wins over `src/routes/songs/[id]/+page.svelte` for the URL `/songs/new`. Good — that's almost always what you want.

### TS notes

`page.params` is typed as `Record<string, string>` by default. SvelteKit generates more specific types per route in `./$types` — `PageProps['params']` for `[id]` is `&lbrace; id: string &rbrace;`. Import from `'./$types'` in your `+page.ts` to get them.

## Concept 4: Programmatic navigation and prefetching

### What it is

Most navigation is `<a href="...">` — declarative, browser-native, automatically intercepted by SvelteKit's client router. But sometimes you need to navigate from code: after a form submits, after a button click that should also do something else, after a timer fires. For that you use `goto(url)` from `$app/navigation`.

Separately, SvelteKit can prefetch a route's HTML and data when the user hovers over (or focuses) a link. By the time they actually click, the data's already in cache and the navigation feels instantaneous. This is opt-in via a `data-sveltekit-preload-data` attribute.

### Worked example: navigate after a save

```svelte
<script>
  import { goto } from '$app/navigation';

  async function saveAndGo() {
    // ... save logic
    await goto('/songs');
  }
</script>

<button onclick={saveAndGo}>save and view all songs</button>
```

`goto` is async — it returns a promise that resolves once the navigation completes (or fails). Usually you don't need to await it, but if you want to do something after the new page has loaded, `await` is the way.

Now enable prefetching on hover for the whole app. Edit `src/app.html`:

```html
<body data-sveltekit-preload-data="hover">
  %sveltekit.body%
</body>
```

That single attribute makes every internal `<a href>` prefetch when hovered. There's a more aggressive `"tap"` value that prefetches on `pointerdown` (a few ms earlier than `click`), and `"viewport"` that prefetches once a link scrolls into view. Hover is usually the right default.

### Variations

**Opting out of prefetching for one link.** Put `data-sveltekit-preload-data="false"` on a specific `<a>` to skip it. Useful for links to large pages, or links whose data shouldn't be fetched until the user actually clicks.

**`goto` options.** `goto(url, &lbrace; replaceState: true &rbrace;)` replaces the current history entry instead of pushing a new one — useful after a redirect-style flow. `goto(url, &lbrace; invalidateAll: true &rbrace;)` also reruns all load functions, which we'll use in L3.

**`preloadData(url)` and `preloadCode(url)`.** Programmatic prefetching from JS. Less common — the attribute-based hover/tap covers most cases.

### Common mistakes

- **Calling `goto` with a full URL.** `goto('https://example.com/foo')` triggers a full page load (it's an external URL). Use a path: `goto('/foo')`.
- **Forgetting `await` when sequencing.** `goto('/x'); doSomething()` won't wait for the navigation. If `doSomething` depends on the new page being mounted, await first.
- **Prefetching everything on a list page.** A page with 200 links would prefetch 200 routes on hover. Probably fine for a small app like ours; for a large one, scope the attribute to specific containers, not body.
- **Browser back button doesn't re-run side effects.** Navigation via back/forward doesn't trigger `goto` — it triggers a regular nav. If you need to react to nav, watch `page.url` reactively or use `afterNavigate` from `$app/navigation`.

### TS notes

`goto` is typed: `(url: string | URL, opts?: GotoOptions) => Promise<void>`. The options type is exported from `'$app/navigation'` if you need it.

## Putting it together

Start the dev server and click through the app:

```sh
npm run dev
```

You should be able to:

- Visit `/` and see the dashboard placeholder inside the layout chrome.
- Click "Songs" and land on `/songs` with the active link highlighted.
- Type `/songs/test-song` directly in the URL bar and land on the detail page with "Song: test-song".
- Type `/songs/anything-else` and watch the same page render with new params.
- Use the browser back button — SvelteKit's client router handles it.

What you have right now is a five-route SvelteKit app with shared chrome, a working dynamic route, and a layout that highlights the active link. No data, no forms, no persistence — those come in the next three lessons. But the skeleton is correct.

Add one more thing: an error page. Create `src/routes/+error.svelte`:

```svelte
<script>
  import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error?.message ?? 'something went wrong'}</h1>
<a href="/">go home</a>
```

This catches any error thrown from a load function or a route that doesn't match. Visit `/this-route-doesnt-exist`. You should see a 404 message rendered inside your layout. The `+error.svelte` at the root scope catches errors from anywhere in the app. You can also scope error boundaries — `src/routes/songs/+error.svelte` would catch errors only inside `/songs/*`.

## Exercises

### Exercise 1: Add a "Recent" route

**Setup:** the journal has routes for songs, sessions/new, and about.

**What to do:** add a new route at `/recent` that renders a placeholder like `<h1>Recent activity</h1>`. Add a "Recent" link to the layout nav, between "Songs" and "+ Log Session". Click it and confirm the active highlight follows.

**Verify by:** visiting `/recent` shows the heading inside the app chrome; the "Recent" link is highlighted; clicking other nav links un-highlights it; the browser back button returns you correctly.

<details>
<summary>Show solution</summary>

Create the folder and page:

```sh
mkdir -p src/routes/recent
```

```svelte
<!-- src/routes/recent/+page.svelte -->
<h1>Recent activity</h1>
<p>Coming soon: your most recent practice sessions.</p>
```

Update `src/routes/+layout.svelte`'s links:

```js
const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/songs', label: 'Songs' },
  { href: '/recent', label: 'Recent' },
  { href: '/sessions/new', label: '+ Log Session' },
  { href: '/about', label: 'About' }
];
```

The `isActive` function already handles new entries — `pathname.startsWith('/recent')` becomes true on `/recent`.

</details>

### Exercise 2: A nested layout for the songs section

**Setup:** `src/routes/songs/+page.svelte` and `src/routes/songs/[id]/+page.svelte` exist. They render inside the root layout.

**What to do:** add `src/routes/songs/+layout.svelte` that renders a small sub-header (e.g., "Songs > section") above the page content. Use `&lbrace;@render children()&rbrace;` to render the page. Verify the sub-header appears on both `/songs` and `/songs/anything` but NOT on `/about` or `/`.

**Verify by:** the sub-header appears only on `/songs` and `/songs/[id]`; the root layout (with the main nav) wraps everything; nothing breaks when you navigate between sections.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/songs/+layout.svelte -->
<script>
  let { children } = $props();
</script>

<section class="songs-section">
  <p class="section-label">SONGS SECTION</p>
  {@render children()}
</section>

<style>
  .section-label { color: #9ea3b8; font-size: 12px; letter-spacing: 0.1em; margin-bottom: 16px; }
</style>
```

The nested layout receives `children` (which is the matched `+page.svelte`), wraps it in the section, and is itself rendered as the child of `src/routes/+layout.svelte`. No special configuration — SvelteKit composes them by folder depth.

</details>

### Exercise 3: Programmatic redirect from a button

**Setup:** the dashboard at `/` has a heading and some intro text.

**What to do:** add a button to the dashboard labeled "Add your first song" that calls `goto('/sessions/new')` when clicked. Use `$app/navigation`'s `goto`. Optionally `await` it.

**Verify by:** clicking the button navigates you to `/sessions/new`. The browser URL bar updates. The back button returns you to the dashboard.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { goto } from '$app/navigation';
</script>

<h1>Dashboard</h1>
<p>Welcome to Practice Journal. Use the nav to add songs and log sessions.</p>

<button onclick={() => goto('/sessions/new')}>Add your first session</button>

<style>
  button {
    padding: 12px 24px; background: #f5b100; color: #14151c;
    border: 0; border-radius: 8px; font: inherit; font-weight: 700;
    cursor: pointer; margin-top: 16px;
  }
</style>
```

`goto` does what an `<a href>` would, but from JS. In this exact case, an `<a href="/sessions/new">` styled as a button would be better (it works without JS, the user can right-click "open in new tab"). `goto` is the right tool when the button also does *something else* — save data, validate, log analytics — before navigating.

</details>

### Exercise 4: A breadcrumb from `page.url`

**Setup:** the `page` object from `$app/state` exposes `page.url.pathname`.

**What to do:** inside `src/routes/+layout.svelte`, add a small breadcrumb above `&lbrace;@render children()&rbrace;` that shows the current path segments. E.g., on `/songs/wonderwall` it shows `Home / Songs / wonderwall`. Use `page.url.pathname.split('/')` and skip empty segments.

**Verify by:** navigating between routes updates the breadcrumb live; the root `/` shows just "Home"; nested routes show the full path.

<details>
<summary>Show solution</summary>

```svelte
<!-- inside src/routes/+layout.svelte's <script>, alongside existing logic -->
function crumbs(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  return ['Home', ...parts];
}
```

```svelte
<!-- in the markup, between </header> and <main> -->
<nav class="crumbs">
  {#each crumbs(page.url.pathname) as crumb, i (i)}
    {#if i > 0}<span class="sep">/</span>{/if}
    <span>{crumb}</span>
  {/each}
</nav>

<style>
  .crumbs { padding: 8px 32px; color: #9ea3b8; font-size: 13px; }
  .sep { margin: 0 8px; color: #5e6378; }
</style>
```

`page.url.pathname` is reactive — when you navigate, the call to `crumbs(page.url.pathname)` re-runs and the markup re-renders. Note this breadcrumb shows the raw URL segments, including dynamic param values like `wonderwall`. A nicer version would look up the song title — which you'll be able to do once L2's load function provides it.

</details>

### Exercise 5 (stretch): Custom 404 with route suggestions

**Setup:** `+error.svelte` catches errors. `page.url.pathname` is the URL the user tried to reach.

**What to do:** in `src/routes/+error.svelte`, only when `page.status === 404`, render a list of the four "valid" top-level routes ("Dashboard", "Songs", "Log Session", "About"). For any other status, render a generic error message.

**Verify by:** visiting `/nope` shows the 404 with the route list; throwing a non-404 (you can fake this in L2 by throwing `error(500, ...)` from a load) shows the generic message.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/+error.svelte -->
<script>
  import { page } from '$app/state';

  const routes = [
    { href: '/', label: 'Dashboard' },
    { href: '/songs', label: 'Songs' },
    { href: '/sessions/new', label: 'Log Session' },
    { href: '/about', label: 'About' }
  ];
</script>

{#if page.status === 404}
  <h1>404 — page not found</h1>
  <p>You tried to visit <code>{page.url.pathname}</code>. That's not a route.</p>
  <p>Try one of these:</p>
  <ul>
    {#each routes as r (r.href)}
      <li><a href={r.href}>{r.label}</a></li>
    {/each}
  </ul>
{:else}
  <h1>{page.status}: something went wrong</h1>
  <p>{page.error?.message ?? 'unknown error'}</p>
  <a href="/">go home</a>
{/if}
```

The `+error.svelte` renders inside the layout, so the nav stays visible — the user can still navigate. This is one of those small touches that makes an app feel finished.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- A `practice-journal/` directory created from `npm create svelte@latest`.
- The route folders: `+layout.svelte`, root `+page.svelte`, `about/+page.svelte`, `songs/+page.svelte`, `songs/[id]/+page.svelte`, `sessions/new/+page.svelte`, `+error.svelte`.
- A working layout with a header, the four nav links, active-link highlighting, and a `&lbrace;@render children()&rbrace;` slot.
- `data-sveltekit-preload-data="hover"` on `<body>` in `src/app.html`.

### Verify it works

- `npm run dev` starts without errors.
- Visiting `/`, `/songs`, `/songs/anything`, `/sessions/new`, `/about` each renders the placeholder content inside the layout chrome.
- The active link in the nav updates as you navigate.
- The browser back button works.
- Visiting `/nonsense` renders the `+error.svelte` page.

### Compare against the reference

There's no capstone reference for M5 yet — the practice journal is the running project. Your files should structurally match the file tree at the top of this lesson.

## Common questions

**Q: Why not a single config file with the routes listed out, like Express or react-router?**
A: Filesystem routing trades configurability for legibility. You can read the route tree by looking at folders. There's nothing hiding in a config file that overrides the obvious mapping. For 95% of apps this is a strict improvement; for the 5% that need programmatic routes (e.g., a CMS that generates routes at build time), SvelteKit can hook into that too, but it's rare.

**Q: What if I want two routes to share data but not chrome?**
A: Move the shared load logic into a `+layout.ts` (a layout's load runs for all child pages and is mergeable into their `data`). The layout component itself can be a no-op (just `&lbrace;@render children()&rbrace;`) if you don't want chrome. That said: most of the time when you want "shared data, different chrome" you're describing a route group with two layouts.

**Q: Does `page` from `$app/state` need to be inside a `$derived` or `$effect` to be reactive?**
A: No. `page` is a reactive object on its own — accessing properties on it (`page.url.pathname`, `page.params.id`, etc.) inside a component or template will cause that part of the component to re-render when the value changes. You can read it directly, no wrapping required. This is one of the nicer things about the `$app/state` API versus the older `$app/stores`.

**Q: Why is `+page.svelte` lowercase when most Svelte components I see are PascalCase?**
A: The `+`-prefixed files are part of SvelteKit's route convention — they're treated as files, not as components-you-import. The PascalCase convention applies to importable components (`SongCard.svelte`, `Button.svelte`). It's two different namespaces; the lowercase prefix is the SvelteKit-routing namespace.

**Q: Can I have a route that handles `/songs/[id]` AND an API endpoint at `/songs/[id]/api`?**
A: Yes. `src/routes/songs/[id]/+page.svelte` is the page. `src/routes/songs/[id]/api/+server.ts` is an API endpoint at `/songs/[id]/api`. The `+server.ts` exports HTTP methods (`GET`, `POST`, etc.) that handle the request directly. We won't use server endpoints in this module (the journal is fully static-deployable), but they're available the moment you switch off the static adapter.

## What's next

The skeleton is up. Every route renders. The nav works. What you don't have yet is *data* — the songs list shows "you haven't added any songs" forever, because there are no songs and no mechanism to add them. The next lesson introduces load functions: the SvelteKit mental model for "where does this page's data come from?" You'll wire up the songs list to actually read songs (from localStorage, for now), and the song detail page to look up the right song from `page.params.id`. You'll also see how `+page.ts` and `+page.server.ts` differ, and when you'd reach for each.

<SourcesSection lessonKey="05-practice-journal/01-routing" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
