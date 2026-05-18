<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Load Functions · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-5);">

<LessonHeader
  moduleSlug="05-practice-journal"
  lessonSlug="02-load"
  title="Load Functions for Songs and Sessions"
  blurb="Where data comes from. +page.ts vs +page.server.ts. The mental model that replaces useEffect-for-fetching."
/>

## Why this lesson exists

In React, the standard data-fetching pattern is: mount the component, fire `useEffect`, set loading state, await the fetch, update component state, re-render. That works, but it puts the fetch inside the component — which means the component renders once with no data, then again with data. It also tangles "what data does this page need?" with "how does this component manage its render lifecycle?", which makes both harder to reason about.

SvelteKit inverts the relationship. The route declares what it needs in a `load` function. SvelteKit runs `load` *before* rendering the page. The page component receives a `data` prop containing the load result and renders once with everything in place. No loading state inside the component, no `useEffect`, no race conditions between mount and fetch.

This is the part of SvelteKit that takes the longest to get used to if you're coming from a React-y mental model, and the part that pays off most after you do. This lesson wires up the journal's data layer — songs in localStorage for now — so the routes from L1 actually have something to show.

## Learning objectives

By the end of this lesson you'll be able to:

- Write a `load` function in `+page.ts` that returns data and have it appear as the `data` prop on the page.
- Use `params` from the load function's argument object to read dynamic route segments.
- Throw a 404 from a load function using `error()` from `@sveltejs/kit`.
- Add a layout-level load in `+layout.ts` that merges its data into every descendant page's `data`.
- Explain when to use `+page.ts` vs `+page.server.ts`.
- Trigger a manual reload of a route's data with `invalidate` and `invalidateAll`.

## Concept 1: The data layer

### What it is

Before we can write load functions, we need *something to load*. The journal is going to track songs and sessions. We're going to put them in localStorage for now — no backend, no server, no auth. That's not because localStorage is a great long-term data store (it isn't), but because it lets you focus on the SvelteKit load-function pattern without a database to set up. In a later project you'd swap localStorage out for `fetch('/api/songs')` and the load functions barely change.

The data shape:

- A **Song** has an `id`, a `title`, an `artist`, and an `addedAt` timestamp.
- A **Session** has an `id`, a `songId` (which song it's for), a `date`, a number of `minutes`, and free-text `notes`.

Songs and sessions live in two separate localStorage keys, both serialized as JSON arrays. We'll write a small module of helpers — `getSongs`, `getSongById`, `getSessionsForSong`, `saveSong`, `saveSession` — and load functions will call those.

### Worked example: the data helpers

Create `src/lib/data.svelte.ts`:

```ts
import { browser } from '$app/environment';

export type Song = {
  id: string;
  title: string;
  artist: string;
  addedAt: string;
};

export type Session = {
  id: string;
  songId: string;
  date: string; // ISO date
  minutes: number;
  notes: string;
};

const SONGS_KEY = 'pj_songs_v1';
const SESSIONS_KEY = 'pj_sessions_v1';

export function getSongs(): Song[] {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(SONGS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function getSongById(id: string): Song | null {
  return getSongs().find((s) => s.id === id) ?? null;
}

export function getSessions(): Session[] {
  if (!browser) return [];
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function getSessionsForSong(songId: string): Session[] {
  return getSessions().filter((s) => s.songId === songId);
}

export function saveSong(song: Song) {
  if (!browser) return;
  const songs = getSongs();
  const idx = songs.findIndex((s) => s.id === song.id);
  if (idx >= 0) songs[idx] = song;
  else songs.push(song);
  localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
}

export function saveSession(session: Session) {
  if (!browser) return;
  const sessions = getSessions();
  sessions.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
```

Three notes:

1. The `.svelte.ts` suffix tells Svelte that this file can use runes (`$state`, `$derived`, etc.). We're not using runes in this module yet, but we *will* in a stretch exercise, and the suffix is harmless if you're not using them.
2. The `browser` check from `$app/environment` matters because `+page.ts` runs on *both* server and client. On the server during initial render, `localStorage` doesn't exist. Without the guard, calling `getSongs()` from a load function would throw `ReferenceError: localStorage is not defined`. The guard returns an empty array on the server, and the real values populate when the client renders.
3. `try/catch` around `JSON.parse` — if the user manually edits localStorage (or if you change the data shape and forget to bump the key version), parsing fails. Falling back to `[]` is friendlier than crashing the page.

### Variations

**A versioned key.** `pj_songs_v1` — the `_v1` suffix gives you room to migrate later. If you change the Song schema in a way that breaks old data, bump to `pj_songs_v2` and old keys remain (unread). Older data either lingers harmlessly or you write a one-time migration that copies into the new key.

**A real backend.** When this app grows beyond localStorage, the helpers swap to fetch calls — `getSongs` becomes `async () => fetch('/api/songs').then(r => r.json())`. Every consumer awaits the result. Load functions are already async-aware, so the change ripples cleanly.

**Reactive state with runes.** A future version could keep the songs array as a `$state` rune in this file, with helpers that mutate the state and persist as a side effect. Then any component reading the rune updates without invalidation. We're not doing that here because it'd hide the load-function mental model we're trying to teach.

### Common mistakes

- **Calling localStorage in the module top-level.** `const songs = localStorage.getItem(...)` at the top of the file runs at import time, including on the server, and throws. Always wrap with a `browser` check (or move into a function that's only called from the client).
- **Forgetting `JSON.parse`/`stringify`.** `localStorage.setItem(K, songs)` stores the string `[object Object],[object Object]`. Always stringify.
- **Mutating the array returned by `getSongs()` and expecting persistence.** The returned array is a fresh parsed object — mutating it doesn't write to localStorage. You have to call `saveSong()` (or write a `saveAll()`) to persist.

### TS notes

The `Song` and `Session` types are exported so other modules can import them. In `+page.ts` you'll see `import type &lbrace; Song &rbrace; from '$lib/data.svelte'` — the `import type` part means it's erased at build time and adds no runtime cost.

## Concept 2: `+page.ts` load functions

### What it is

A `+page.ts` file next to a `+page.svelte` exports a function named `load`. SvelteKit calls `load` before rendering the page; whatever object `load` returns becomes the `data` prop on the page component. That's the whole API surface.

`load` receives an argument object with useful context — `params` (the dynamic route segments), `url` (the parsed URL object), `fetch` (a fetch wrapped to work both server- and client-side), `parent` (a function to await the parent layout's load result), and a few others. You destructure what you need.

The function can be `async`. Returning a promise — or awaiting fetches inside — works exactly as you'd expect. SvelteKit waits for the promise to resolve before rendering.

### Worked example: the songs list

Create `src/routes/songs/+page.ts`:

```ts
import { getSongs } from '$lib/data.svelte';

export function load() {
  return {
    songs: getSongs()
  };
}
```

Update `src/routes/songs/+page.svelte`:

```svelte
<script>
  let { data } = $props();
</script>

<h1>Songs</h1>

{#if data.songs.length === 0}
  <p>You haven't added any songs yet. <a href="/songs/new">add one</a></p>
{:else}
  <ul>
    {#each data.songs as song (song.id)}
      <li><a href="/songs/{song.id}">{song.title} — {song.artist}</a></li>
    {/each}
  </ul>
{/if}
```

The component reads `data` from `$props()`. There's no fetch, no `useEffect`, no loading state. The `load` function did its work before the component mounted; by the time the markup renders, `data.songs` is already the array.

You can't see this working yet because localStorage is empty — `data.songs` is `[]` and the "no songs" branch renders. That's L3's job to fix. For now, you can open the browser console and seed some data manually:

```js
localStorage.setItem('pj_songs_v1', JSON.stringify([
  { id: 'a', title: 'Wonderwall', artist: 'Oasis', addedAt: new Date().toISOString() },
  { id: 'b', title: 'Black', artist: 'Pearl Jam', addedAt: new Date().toISOString() }
]));
```

Refresh `/songs`. The list shows two songs. Click one — `/songs/a` shows "Song: a" because the detail page hasn't been wired up yet. That's next.

### Variations

**Async load with fetch.** A future version:

```ts
export async function load({ fetch }) {
  const res = await fetch('/api/songs');
  return { songs: await res.json() };
}
```

Use SvelteKit's wrapped `fetch` (from the load context, not the global) — it does the right thing on both server and client, and during SSR it can reuse the response for hydration.

**Returning multiple keys.** A load can return as many keys as you want. They all land on `data`:

```ts
export function load() {
  return {
    songs: getSongs(),
    sessions: getSessions(),
    user: getCurrentUser()
  };
}
```

The page reads `data.songs`, `data.sessions`, `data.user`.

**Awaiting in parallel.** If you need multiple async resources, do them in parallel with `Promise.all`:

```ts
export async function load({ fetch }) {
  const [songs, sessions] = await Promise.all([
    fetch('/api/songs').then((r) => r.json()),
    fetch('/api/sessions').then((r) => r.json())
  ]);
  return { songs, sessions };
}
```

Sequential awaits would double the latency.

### Common mistakes

- **Forgetting to `export`.** A function named `load` that isn't exported is just a private function — SvelteKit won't call it. Symptom: the page renders with `data === undefined`.
- **Returning an array or a primitive.** `load` must return an object (or undefined). Returning `[songs]` doesn't work — there's no key to read in `data`. Wrap it: `&lbrace; songs &rbrace;`.
- **Calling `localStorage` directly from the load function.** Same issue as the helpers — `+page.ts` runs on the server during initial render. Use the `browser`-guarded helpers, or move the load to `+page.server.ts` (where it only runs on the server, but localStorage still doesn't exist there!), or just rely on the helpers to return `[]` and let the client hydrate the real values.
- **Doing mutations or non-idempotent work in load.** `load` may be called multiple times (initial render, client navigation, invalidations). Sending an analytics event from inside `load` would fire repeatedly. Keep `load` pure — read data, return data.

### TS notes

For typed `load` functions, import `PageLoad` from `'./$types'`:

```ts
import type { PageLoad } from './$types';
import { getSongs } from '$lib/data.svelte';

export const load: PageLoad = () => {
  return { songs: getSongs() };
};
```

`PageLoad` is autogenerated per route based on the folder name. Inside the function, `params` is typed with the dynamic segments for *this* route, and the return type infers down to `PageProps` for the page component. The autocomplete pays for the setup cost.

## Concept 3: Dynamic routes and `error()`

### What it is

A load function on a dynamic route uses `params` to look up the right resource. If the resource doesn't exist (a URL like `/songs/nonexistent`), the right thing is to throw a 404, not render the page with `data.song === null`. SvelteKit provides an `error()` helper from `@sveltejs/kit` that does exactly that — when thrown from `load`, it triggers the nearest `+error.svelte` with the given status code and message.

This pattern keeps the page component clean. The page can assume `data.song` exists, because if it didn't, the load would have errored before render.

### Worked example: the song detail page

Create `src/routes/songs/[id]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import { getSongById, getSessionsForSong } from '$lib/data.svelte';

export function load({ params }) {
  const song = getSongById(params.id);
  if (!song) throw error(404, 'Song not found');
  return {
    song,
    sessions: getSessionsForSong(params.id)
  };
}
```

Replace `src/routes/songs/[id]/+page.svelte`:

```svelte
<script>
  let { data } = $props();
</script>

<h1>{data.song.title}</h1>
<p class="artist">by {data.song.artist}</p>

<h2>Practice sessions ({data.sessions.length})</h2>

{#if data.sessions.length === 0}
  <p>No sessions logged for this song yet.</p>
{:else}
  <ul>
    {#each data.sessions as s (s.id)}
      <li>
        {new Date(s.date).toLocaleDateString()} —
        {s.minutes} minutes
        {#if s.notes}— {s.notes}{/if}
      </li>
    {/each}
  </ul>
{/if}

<a href="/songs">← all songs</a>

<style>
  .artist { color: #9ea3b8; }
</style>
```

Visit `/songs/a` (assuming you seeded data with `id: 'a'`). You see the song title and an empty session list. Visit `/songs/nonexistent`. You get the `+error.svelte` page with status 404 and message "Song not found".

The page component doesn't need a `data.song ?? null` check or an `&lbrace;#if data.song&rbrace;` block. The load guaranteed `data.song` exists, or threw. This is the kind of "the types are right because the runtime is right" that makes SvelteKit pleasant.

### Variations

**Throwing vs returning the error.** `throw error(404, 'msg')` halts the load and renders the error page. `return &lbrace; error: 'something' &rbrace;` is just data — the page component would have to decide to render an error UI. Throw when you want the route to fail; return error data when the route partially succeeded.

**Redirects.** `throw redirect(303, '/login')` from `@sveltejs/kit` sends the browser to a different URL instead of rendering. Useful when the user isn't authorized to see this route. We won't use redirects in the journal, but they look the same as `error()` — `throw` from inside `load`.

**Custom error objects.** `error(404, &lbrace; message: 'Not found', code: 'SONG_404' &rbrace;)` accepts an object for richer error data. The `+error.svelte` component sees it as `page.error`.

### Common mistakes

- **Not throwing the error — just calling it.** `error(404, 'msg')` returns an Error object. If you don't `throw` it, nothing happens. The page renders normally. Always `throw error(...)`.
- **Catching the error inside load and returning normal data.** If you wrap your `throw` in a try/catch and swallow it, the page renders. You meant the opposite. Let it propagate.
- **Forgetting that `params.id` could be `undefined`-shaped.** TypeScript narrows `params.id: string`. But if you've used `[[id]]` (optional segment), it's `string | undefined`. Make sure you're matching the segment shape you declared.

### TS notes

`PageLoad` types `params` correctly for the route. For `[id]`, `params.id` is `string`. For `[[id]]`, it's `string | undefined`. `error` and `redirect` from `@sveltejs/kit` are typed too — TypeScript will complain if you pass a non-error status code (like 200) to `error`.

## Concept 4: `+page.ts` vs `+page.server.ts`

### What it is

SvelteKit ships two flavors of load function. The file name picks which:

- **`+page.ts`** runs on the server during initial page render *and* on the client during subsequent navigation. The same code runs in both environments. SvelteKit guarantees this — if your code uses an API that doesn't exist on one side (like `localStorage`), you need to guard with `browser`.
- **`+page.server.ts`** runs *only* on the server, ever. Use it when the load needs server secrets (DB connection strings, API keys), hits a database directly, uses Node-only APIs (filesystem, child process), or fetches a third-party API where you don't want to expose the key to the client.

Both produce a `data` prop the same way. The difference is *where the code runs* and *what's available*.

The trade-off: `+page.server.ts` always involves a server round-trip (the client has to fetch the data from the server during navigation). `+page.ts` can avoid the round-trip on the client by computing data locally. For a localStorage-backed app like ours, `+page.ts` is the right choice — the data lives in the browser, the server has no access to it.

### Worked example: when each makes sense

For the journal as it exists today (localStorage, no backend), every load is `+page.ts`. The server can't read the user's localStorage. The browser is the source of truth. So we use `+page.ts`, guarded with `browser`, and accept that during SSR the page renders with empty data (which is fine because we've set `ssr = false` for these routes — see L4).

When you eventually add a backend, the song-detail load might become:

```ts
// src/routes/songs/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function load({ params, locals }) {
  const song = await db.songs.findById(params.id);
  if (!song) throw error(404, 'Song not found');
  if (song.ownerId !== locals.user.id) throw error(403, 'Forbidden');
  return { song };
}
```

That code can't run on the client — it imports `$lib/server/db`, which is server-only, and reads `locals.user`, which only the server sees. So it has to be `+page.server.ts`.

You can also have *both* `+page.ts` and `+page.server.ts` for the same route. The server load runs first, its data is passed to the universal load via `data`, and the universal load can augment or transform before returning to the page. This is rare but useful when you want a server-loaded payload to be enriched by client-only logic.

### Variations

**Server-only load with a public-safe payload.** Even when the load runs on the server (e.g., reading a DB), the returned data is serialized and sent to the client (so it can render on the client during navigation). Don't return secrets — return them stripped to what the client needs.

**Hybrid: server load + client load.** If both exist, the server load runs first, its result is available to the client load as `data`. The client load returns the final payload. Use when you need server-only fetching plus a client-only transformation (e.g., decrypting a payload with a key from `sessionStorage`).

**Endpoints instead of server loads.** Sometimes you want client-side `fetch('/api/songs')` from inside `+page.ts`, hitting an API endpoint at `src/routes/api/songs/+server.ts`. That's another way to do server-only work — the endpoint runs server-side, the page consumes its JSON. Equivalent to `+page.server.ts` for most cases; pick based on whether other clients (mobile apps, external integrations) might want the same API.

### Common mistakes

- **Naming a `+page.ts` file `+page.server.ts` by reflex.** They look similar; the difference is huge. If you accidentally write a `+page.server.ts` that calls `localStorage`, you'll get a server error instead of the empty array you'd get from a guarded `+page.ts`.
- **Putting a secret in `+page.ts`.** Anything in `+page.ts` is shipped to the client. If you import an API key into `+page.ts`, the key is in the JS bundle. Use `+page.server.ts` for secrets and pass the result data to the client.
- **Awaiting `fetch()` from the global instead of the load context's `fetch`.** The provided `fetch` knows about cookies, base URLs, and SSR-side response caching. The global `fetch` works but you lose those features.

### TS notes

`PageServerLoad` for `+page.server.ts`, `PageLoad` for `+page.ts`. Both imported from `'./$types'`. The auto-generated types know the difference and give you the right context shape (`+page.server.ts` has access to `locals`, `cookies`, `request`; `+page.ts` doesn't).

## Concept 5: Layout loads, invalidation, parent data

### What it is

Loads aren't only for pages. A `+layout.ts` (or `+layout.server.ts`) declares a load that runs for the layout and every descendant page. Its result merges into the same `data` object the page component sees. This is the standard way to fetch data that multiple pages need — user info, a list of categories, a count for a nav badge.

Separately: loads cache their result and re-run only when SvelteKit thinks they should — on navigation, or when a tracked `params`/URL/fetch dependency changes. Sometimes you need to force a re-run after the user does something that changed the underlying data. `invalidate(url)` and `invalidateAll()` from `$app/navigation` do that.

### Worked example: a layout-wide count badge

Add `src/routes/+layout.ts`:

```ts
import { getSongs, getSessions } from '$lib/data.svelte';

export function load() {
  return {
    totalSongs: getSongs().length,
    totalSessions: getSessions().length
  };
}
```

The layout's `data` now has `totalSongs` and `totalSessions`. Every page below also sees them in its `data` prop (merged with the page's own load result). Update the layout component to use them:

```svelte
<!-- src/routes/+layout.svelte, inside <script> -->
let { data, children } = $props();

<!-- in the markup, inside <nav> or near the brand: -->
<span class="counts">{data.totalSongs} songs · {data.totalSessions} sessions</span>
```

Hover over a link — the count is stable because nothing changed. Add a song (when L3 lets you), and now the count would update only if the layout load re-ran. To force that, call `invalidateAll()` after the save:

```ts
import { invalidateAll } from '$app/navigation';
// ... after saving:
await invalidateAll();
```

`invalidateAll()` reruns every load function for the current route — the layout load and all the active page loads. `invalidate('app:songs')` reruns only loads that depend on the tag `'app:songs'`, which you'd register inside the load with `depends('app:songs')`. For a small app, `invalidateAll()` is usually fine. For an app with many parallel data sources, the fine-grained version avoids re-fetching unrelated data.

### Variations

**`await parent()`.** Inside a page load, `parent()` returns the merged data from the parent layout's load. Useful when the page load needs to read the layout's user data to make its own query:

```ts
export async function load({ parent }) {
  const { user } = await parent();
  return { posts: await db.posts.findByUserId(user.id) };
}
```

**Manual dependency tracking with `depends`.** Inside a load, call `depends('app:songs')` to mark a custom invalidation key. Then `invalidate('app:songs')` reruns only loads with that dependency.

**Conditional reload via URL params.** Loads automatically re-run when watched URL params change. So if you accept `?filter=recent` in the load, the load re-runs whenever the user changes the URL — no manual invalidation needed.

### Common mistakes

- **Expecting loads to re-run automatically when localStorage changes.** They don't — SvelteKit has no idea localStorage was written. You have to call `invalidateAll()` (or refresh the page).
- **Calling `invalidate()` with the wrong key.** `invalidate('foo')` only reruns loads that called `depends('foo')`. A typo silently does nothing.
- **Layout load merge collisions.** If the layout load returns `&lbrace; song: ... &rbrace;` and the page load also returns `&lbrace; song: ... &rbrace;`, the page wins (it's merged last). Usually not what you want — namespace the layout's keys.
- **Heavy layout loads slowing every navigation.** Layout loads run on every navigation within their scope. If yours hits a slow API, every page navigation waits for it. Move slow loads down to specific pages.

### TS notes

`LayoutLoad` from `'./$types'` types the layout load function. The page's `PageData` automatically includes the layout's load output, so reading `data.totalSongs` from the page is correctly typed without any extra work.

## Putting it together

Here's the full state of the data layer after this lesson:

- `src/lib/data.svelte.ts` — the helpers, browser-guarded.
- `src/routes/+layout.ts` — global counts, available everywhere.
- `src/routes/songs/+page.ts` — list of songs.
- `src/routes/songs/[id]/+page.ts` — one song plus its sessions, with a 404 on missing IDs.

Visit `/songs` after seeding some songs in the console. The list renders. Click a song. The detail page renders with the right title. Visit `/songs/garbage`. The 404 error page renders inside the layout. The total in the layout header reflects the seeded count.

What's still missing: a way for the user to *add* data without opening the console. That's L3 — forms.

## Exercises

### Exercise 1: Recent sessions on the dashboard

**Setup:** The dashboard at `src/routes/+page.svelte` is a placeholder. Sessions are stored in localStorage; `getSessions()` returns them.

**What to do:** add a `src/routes/+page.ts` load function that returns the 5 most recent sessions (sorted by `date` descending). Update the dashboard to render them as a list, showing the song title (look up via `getSongById`), date, and minutes. Empty-state message if there are no sessions.

**Verify by:** seed some sessions in the console (or use the L3 form once it's built). Visit `/`. The dashboard shows up to 5 recent ones, newest first. With no sessions, an empty-state message renders.

<details>
<summary>Show solution</summary>

```ts
// src/routes/+page.ts
import { getSessions, getSongById } from '$lib/data.svelte';

export function load() {
  const recent = getSessions()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((s) => ({
      ...s,
      songTitle: getSongById(s.songId)?.title ?? '(unknown song)'
    }));
  return { recent };
}
```

```svelte
<!-- src/routes/+page.svelte -->
<script>
  let { data } = $props();
</script>

<h1>Dashboard</h1>

{#if data.recent.length === 0}
  <p>No sessions yet. <a href="/sessions/new">log your first one</a>.</p>
{:else}
  <h2>Recent sessions</h2>
  <ul>
    {#each data.recent as s (s.id)}
      <li>{new Date(s.date).toLocaleDateString()} — {s.songTitle} — {s.minutes} min</li>
    {/each}
  </ul>
{/if}
```

Note the `.slice()` before `.sort()` — `sort` mutates its array, and the array returned by `getSessions()` is fresh, but defensively copying avoids surprising future-you.

</details>

### Exercise 2: Type the loads

**Setup:** Your load functions work but aren't using SvelteKit's autogenerated types.

**What to do:** add explicit type annotations using `PageLoad` (from `'./$types'`) to the songs list load and the song detail load. Confirm that VS Code (or your editor) gives you autocomplete on `params.id` for the detail load.

**Verify by:** typing `params.` inside the detail load offers `id` as a suggestion. TypeScript errors if you try to access `params.foo` (which isn't a declared dynamic segment).

<details>
<summary>Show solution</summary>

```ts
// src/routes/songs/+page.ts
import type { PageLoad } from './$types';
import { getSongs } from '$lib/data.svelte';

export const load: PageLoad = () => {
  return { songs: getSongs() };
};
```

```ts
// src/routes/songs/[id]/+page.ts
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSongById, getSessionsForSong } from '$lib/data.svelte';

export const load: PageLoad = ({ params }) => {
  const song = getSongById(params.id);
  if (!song) throw error(404, 'Song not found');
  return { song, sessions: getSessionsForSong(params.id) };
};
```

The `./$types` import is special — it's resolved by SvelteKit's tooling, not by Node, and the file doesn't exist on disk. Your TypeScript language server picks it up from the generated `.svelte-kit/` directory.

</details>

### Exercise 3: Sort the songs list alphabetically

**Setup:** `getSongs()` returns songs in insertion order.

**What to do:** in `src/routes/songs/+page.ts`, sort the returned songs by title (case-insensitive). Don't mutate the helper's return — sort a copy.

**Verify by:** seed a few out-of-order songs ("Wonderwall", "Africa", "Black"). The list page renders them as Africa, Black, Wonderwall regardless of the order you added them.

<details>
<summary>Show solution</summary>

```ts
import type { PageLoad } from './$types';
import { getSongs } from '$lib/data.svelte';

export const load: PageLoad = () => {
  const songs = getSongs()
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return { songs };
};
```

`localeCompare` with `sensitivity: 'base'` is the friendlier sort — case-insensitive, accent-insensitive. Plain `a.title.toLowerCase() < b.title.toLowerCase()` also works but doesn't handle non-ASCII well.

</details>

### Exercise 4: Per-song stats in the detail page

**Setup:** The song detail load returns `sessions` for the song.

**What to do:** also return `totalMinutes` (sum of minutes across all the song's sessions) and `lastPracticed` (date of the most recent session, or null). Display both above the session list.

**Verify by:** for a song with three 15-minute sessions, the page shows "45 minutes total". The "last practiced" date matches the newest session. A song with no sessions shows "never practiced".

<details>
<summary>Show solution</summary>

```ts
// src/routes/songs/[id]/+page.ts
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getSongById, getSessionsForSong } from '$lib/data.svelte';

export const load: PageLoad = ({ params }) => {
  const song = getSongById(params.id);
  if (!song) throw error(404, 'Song not found');
  const sessions = getSessionsForSong(params.id);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const lastPracticed = sessions.length
    ? sessions.map((s) => s.date).sort().at(-1)
    : null;
  return { song, sessions, totalMinutes, lastPracticed };
};
```

```svelte
<!-- partial: the new bits in src/routes/songs/[id]/+page.svelte -->
<p class="stats">
  {data.totalMinutes} minutes total ·
  {data.lastPracticed
    ? `last practiced ${new Date(data.lastPracticed).toLocaleDateString()}`
    : 'never practiced'}
</p>
```

`.at(-1)` reads the last element of the array — the most recent date after sort. Cleaner than `arr[arr.length - 1]`.

</details>

### Exercise 5 (stretch): A `?q=` search on the songs list

**Setup:** The songs list shows all songs.

**What to do:** in `src/routes/songs/+page.ts`, read `url.searchParams.get('q')`. If present, filter the songs to those whose title or artist contains the query (case-insensitive). Add a search input to the page that updates the URL via `goto`. The load should re-run automatically when the URL changes.

**Verify by:** typing in the search box updates the URL to `/songs?q=...`; the list filters; the browser back button restores the previous query and list state.

<details>
<summary>Show solution</summary>

```ts
// src/routes/songs/+page.ts
import type { PageLoad } from './$types';
import { getSongs } from '$lib/data.svelte';

export const load: PageLoad = ({ url }) => {
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
  let songs = getSongs();
  if (q) {
    songs = songs.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
  }
  return { songs, q };
};
```

```svelte
<!-- src/routes/songs/+page.svelte -->
<script>
  import { goto } from '$app/navigation';
  let { data } = $props();
  let q = $state(data.q);

  function search() {
    goto(`/songs${q ? `?q=${encodeURIComponent(q)}` : ''}`, { keepFocus: true, noScroll: true });
  }
</script>

<h1>Songs</h1>
<input type="search" bind:value={q} oninput={search} placeholder="filter songs" />

<!-- ... existing list rendering ... -->
```

`keepFocus: true` keeps the input focused after navigation. `noScroll: true` avoids scrolling to top on every keystroke. The load re-runs on URL change, the list updates, and the back button works because each search pushes a new history entry. (For a polished version, debounce the input to avoid one history entry per keystroke.)

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/data.svelte.ts` with the helpers and types.
- `src/routes/+layout.ts` returning `totalSongs` and `totalSessions`, with the layout component reading them.
- `src/routes/songs/+page.ts` returning the songs array, with the page rendering the list.
- `src/routes/songs/[id]/+page.ts` returning the song and sessions, with a 404 on missing IDs.
- (From the exercises, optionally) `src/routes/+page.ts` for recent sessions on the dashboard.

### Verify it works

- Seed a song in the console; the songs list renders it.
- Click a song; the detail page renders the title and artist with an empty sessions list.
- Visit `/songs/garbage`; the 404 error page renders.
- The layout's count badge updates after a manual refresh (we'll wire automatic updates in L3).

### Compare against the reference

No reference repo for M5 — the practice journal *is* the project. Your data helpers and load functions should match the shapes above.

## Common questions

**Q: Can I `fetch` from a load function and not worry about CORS / cookies?**
A: Use the `fetch` passed in the load context (not the global `fetch`). SvelteKit's wrapped version handles cookies for same-origin requests, knows the request's base URL, and during SSR can hand the response to the client as part of the hydration payload to avoid a re-fetch. Just `await fetch('/api/x')` — internal paths work because the wrapped fetch resolves them against the request URL.

**Q: Why doesn't the page re-render when I change `data.songs` directly?**
A: `data` is the result of the load, not a reactive store. Mutating it in the page component changes the local copy but doesn't trigger a re-render and doesn't persist. The pattern is: mutate the underlying source (localStorage, a DB, your `$state` store), then `invalidateAll()` to re-run the load, which produces a new `data` prop and re-renders.

**Q: What if I want some data to be loaded once and cached, not re-run on every nav?**
A: SvelteKit caches load results between navigations *within the route*. If you navigate from `/songs/a` to `/songs/b`, the load runs again (because `params.id` changed). If you navigate away and back to the same URL, the load may or may not re-run depending on cache state. For app-wide cached data (e.g., the user's profile), use a layout load — it only re-runs when its inputs change or you invalidate it.

**Q: My load is slow. The page just sits there with the old content before navigating. What's happening?**
A: That's SvelteKit's deferred navigation — by default, the browser keeps showing the current page until the new page's load completes. This avoids flashing a partial loading state. For long loads, two options: use `streamed` returns (you return a promise inside `data`, and the page renders before it resolves, then updates), or show a loading indicator via `navigating` from `$app/state`. The streaming pattern is the more modern answer.

**Q: Can a single page have multiple loads?**
A: One `+page.ts` *or* one `+page.server.ts` per route (or one of each, chained). To split data fetching, factor the data sources into the load — `Promise.all` two parallel fetches. The constraint is by-design; multiple-load-per-route would create ordering ambiguity.

## What's next

The data layer reads from localStorage and renders. The user still has to seed data through the console. The next lesson is forms — both the SvelteKit-native server-action pattern (when you have a backend) and the simpler client-side `onsubmit` pattern (what we actually use for our localStorage app). You'll build the "Log a Session" form, save sessions, and use `invalidateAll()` to refresh the loads so the dashboard and detail pages reflect the new data.

<SourcesSection lessonKey="05-practice-journal/02-load" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
