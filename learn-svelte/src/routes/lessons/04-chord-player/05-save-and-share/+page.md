<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Save and Share · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-4);">

<LessonHeader
  moduleSlug="04-chord-player"
  lessonSlug="05-save-and-share"
  title="Save Progressions and Share via URL"
  blurb="localStorage for your own. Base64-encoded URL for sharing. The same pattern the DAW capstone will use."
/>

## Why this lesson exists

The chord progression you build is gone the moment you close the tab. That's fine for a throwaway demo, hostile for anything you'd actually use. This lesson adds two persistence mechanisms — both client-side, no backend — that take the app from "demo" to "you could ship this to friends."

The first is localStorage: auto-save the current progression so a refresh doesn't wipe it, plus named save slots so you can keep multiple progressions and switch between them. The second is URL encoding: pack the progression into a base64-ish string, drop it into a URL, and any browser that opens that URL gets the progression loaded. No accounts, no database, no sync logic. The URL itself is the share format.

The Svelte features along the way: `$effect.root` for effects that live outside a component's lifetime, `$state.snapshot` for taking a non-reactive copy of reactive data, and SvelteKit's dynamic route segments for receiving the shared URL. The Web Platform features: localStorage, `btoa`/`atob`, `crypto.randomUUID`, `navigator.clipboard.writeText`.

This is also the last lesson of Module 4. By the end you'll have a chord progression player that survives refreshes and can be shared with one click.

## Learning objectives

By the end of this lesson you'll be able to:

- Use `$effect` inside a `.svelte.ts` module by wrapping it in `$effect.root`.
- Take a non-reactive deep copy of reactive state with `$state.snapshot` and `structuredClone`.
- Persist state to localStorage with proper guards for SSR and quota exceptions.
- Encode small state objects into URL-safe base64 strings.
- Receive a URL-encoded shared state via a SvelteKit dynamic route and a `load` function.

## Concept 1: `$effect.root` for module-level effects

### What it is

`$effect` in a component runs inside that component's lifetime. The runtime tracks dependencies, re-runs the effect when they change, and cleans up automatically when the component unmounts. This works because the component provides an "effect scope" — a place to register and later dispose of the effect.

A module-level singleton (like `progression`) has no component to provide a scope. Calling `$effect` from inside the class constructor would error: there's nowhere to attach the effect, no obvious moment to dispose of it.

`$effect.root` creates a standalone effect scope. You call it once, pass it a function, and any `$effect` inside that function runs in the new scope. The scope lives until you call the returned cleanup function — or, in practice, for the lifetime of the module.

This is the pattern for "I want to react to reactive state from outside a component." It's specifically designed for shared-state modules that need to do side-effecty things (write to localStorage, sync to a backend, log to telemetry) when state changes.

### Worked example

```ts
import { browser } from '$app/environment';

class ProgressionStore {
  chords = $state<Chord[]>(loadFromLocalStorage() ?? defaultChords());

  constructor() {
    if (browser) {
      $effect.root(() => {
        $effect(() => {
          const snapshot = this.chords;  // read = registers dependency
          try {
            localStorage.setItem('chordPlayer_current', JSON.stringify(snapshot));
          } catch {
            // quota exceeded or storage disabled; ignore
          }
        });
      });
    }
  }
  // ... add, remove, clear unchanged
}
```

Step by step:

- `browser` from `$app/environment` is `true` only in the browser. localStorage doesn't exist on the server during SSR. Guarding here avoids an exception during prerendering or SSR.
- `$effect.root(() => { ... })` creates the scope. The returned cleanup function (not captured here) would dispose the scope when called.
- Inside, `$effect(() => { ... })` is the actual effect: read `this.chords` (registers a dependency on the array), serialize, write to localStorage.
- The try/catch handles the case where localStorage is full or disabled (Safari private mode, e.g.). We silently drop the save — the in-memory state is still fine.

When `chords` changes (add, remove, edit), the effect re-fires. Each change is debounced by the runtime's batching: rapid back-to-back mutations only trigger one effect run, with the final state.

### Variations

Explicit cleanup:

```ts
let cleanup: (() => void) | null = null;

constructor() {
  if (browser) {
    cleanup = $effect.root(() => {
      $effect(() => { /* save to localStorage */ });
    });
  }
}

dispose() {
  cleanup?.();
}
```

Useful if you ever want to tear down the singleton (rare for a global store, common for per-request server-side stores).

A debounced save to avoid hammering localStorage:

```ts
$effect(() => {
  const snapshot = $state.snapshot(this.chords);
  const id = setTimeout(() => {
    localStorage.setItem('chordPlayer_current', JSON.stringify(snapshot));
  }, 200);
  return () => clearTimeout(id);
});
```

The cleanup function (the `return () => ...`) runs before the next effect invocation and on disposal. If you mutate the array quickly five times, only the fifth save actually fires.

Multiple effects in one root:

```ts
$effect.root(() => {
  $effect(() => saveCurrent(this.chords));
  $effect(() => saveSlots(this.saved));
  $effect(() => syncToBackend(this.chords));
});
```

Each `$effect` tracks its own dependencies. They share the scope but run independently.

### Common mistakes

- **Calling `$effect` directly in a `.svelte.ts` constructor without `$effect.root`.** Error: "effect_orphan." Wrap in `$effect.root`.
- **Forgetting the `browser` guard.** During SSR, `localStorage` is undefined and `JSON.stringify` of a `$state` proxy might throw. Even if you don't run SSR today, the guard is cheap.
- **Reading the `$state` value inside a callback that runs later.** A `setTimeout` callback reading `this.chords` doesn't track the read — it runs outside the effect's tracking phase. Snapshot the value synchronously inside the effect, then use the snapshot in the timeout.
- **Returning an async cleanup from `$effect`.** The runtime expects a synchronous cleanup function. If you need async cleanup, fire-and-forget it from inside a sync cleanup wrapper.

### TypeScript notes

`$effect.root` returns `() => void`. If you're storing the cleanup for later disposal, type it:

```ts
let cleanup: (() => void) | null = null;
cleanup = $effect.root(() => { /* ... */ });
```

## Concept 2: `$state.snapshot` and non-reactive copies

### What it is

`$state` wraps your data in a Proxy that tracks reads and writes. Most of the time you don't notice — the proxy forwards everything to the underlying value, and consumers see something that walks and quacks like the original object.

You DO notice when you try to copy the data out. `JSON.stringify(chords)` works (the proxy serializes correctly). `structuredClone(chords)` sometimes works and sometimes doesn't — depends on whether the proxy targets are clonable. `chords.slice()` returns a shallow copy that still holds proxied items. Storing a proxied item in `localStorage` or sending it to a Worker can produce surprising "could not be cloned" errors.

`$state.snapshot(value)` returns a plain, non-reactive deep copy. The proxies are stripped; what you get is regular JavaScript data. Mutations to the snapshot don't affect the original; mutations to the original don't affect the snapshot.

Useful for:
- Persisting to localStorage (the saved snapshot is "frozen at this moment").
- Sending to a Web Worker or service worker.
- Saving to a "saved slot" so subsequent edits to the current progression don't bleed into the save.

`structuredClone` is the standard browser API for deep-copying. It handles most data types (objects, arrays, Maps, Sets, Dates, primitives). On non-proxied data it's fast and correct. Combine `$state.snapshot` (strip proxies) with `structuredClone` (deep copy) for a bulletproof "give me a frozen copy of this reactive thing."

### Worked example

```ts
saveAs(name: string) {
  const entry = {
    name,
    chords: structuredClone($state.snapshot(this.chords)),
    savedAt: new Date().toISOString()
  };
  this.saved = [entry, ...this.saved.filter(e => e.name !== name)];
  this.persistSlots();
}

loadSlot(name: string) {
  const entry = this.saved.find(e => e.name === name);
  if (entry) this.chords = structuredClone(entry.chords);
}
```

Save:
- `$state.snapshot(this.chords)` strips the proxies and returns plain arrays/objects.
- `structuredClone(...)` deep-copies that plain data so the saved entry is fully independent.
- The two together mean: the user can keep editing the current progression and the saved slot won't change.

Load:
- `structuredClone(entry.chords)` deep-copies the saved data into the live store. Without this, the live `chords` would point at the same objects as the saved entry, and edits to the live one would silently mutate the save.

### Variations

When you don't need the snapshot:

```ts
JSON.stringify(this.chords);  // works fine; produces a JSON string
```

JSON serialization implicitly snapshots — the resulting string has no references to the original. If your end goal is a string for localStorage, you can skip the explicit `$state.snapshot` step. The reason to use the explicit form is when you want a structured JS value, not a string.

Shallow vs deep:

```ts
const shallow = [...this.chords];  // new array, but items are still proxies
const deep = structuredClone($state.snapshot(this.chords));  // fully detached
```

For the saved-slot case, deep is what you want — chord objects need to be independent. For "give me the array in a different order temporarily," shallow is fine.

A non-reactive read inside a class:

```ts
get currentSnapshot() {
  return $state.snapshot(this.chords);
}
```

Useful when a consumer needs a one-time copy to send somewhere external.

### Common mistakes

- **Saving a reactive reference and being confused why it changes later.** You stored `this.chords` directly; the saved slot is a live reference to the same array. Edits to the live store appear to mutate the save. Snapshot before saving.
- **Trying to `structuredClone` a $state proxy directly.** Sometimes works, sometimes errors with `DataCloneError`. Use `$state.snapshot` first to strip the proxies, then clone.
- **Snapshotting on every render.** Snapshots are O(n) deep copies. Don't put one in a tight loop or inside a derived that runs frequently. Snapshot at save/load boundaries; everywhere else, work with the live state.
- **Mutating the snapshot expecting reactivity.** Snapshots are plain data — no Svelte runtime involvement. Mutating one doesn't trigger any UI updates. Mutate the live `$state` for that.

### TypeScript notes

`$state.snapshot<T>(value: T): Snapshot<T>` where `Snapshot<T>` is a type that strips proxy wrappers. In practice the returned type is structurally identical to the input, so most usages don't need explicit annotation.

## Concept 3: localStorage persistence — auto-save and named slots

### What it is

localStorage is a synchronous string-only key/value store that browsers keep per-origin. It survives tab close, browser restart, and OS restart. It's wiped when the user clears site data or runs out of quota. Quota is typically 5-10MB per origin — comfortably more than you'd ever need for chord progressions.

For our app, two storage shapes:

- `chordPlayer_current`: a JSON string of the currently-displayed chord array. Auto-saved every time it changes.
- `chordPlayer_slots`: a JSON string of an array of named save slots, each containing a name, a chord array, and a timestamp.

Auto-save uses the `$effect` from Concept 1. Slots are a more manual save/load — the user explicitly chooses to keep a snapshot and to restore one later.

### Worked example

```ts
import { browser } from '$app/environment';

class ProgressionStore {
  chords = $state<Chord[]>(loadCurrent() ?? defaultChords());
  saved = $state<SavedEntry[]>(loadSlots());

  constructor() {
    if (browser) {
      $effect.root(() => {
        $effect(() => {
          const snapshot = $state.snapshot(this.chords);
          try {
            localStorage.setItem('chordPlayer_current', JSON.stringify(snapshot));
          } catch { /* quota; ignore */ }
        });
      });
    }
  }

  saveAs(name: string) {
    const entry: SavedEntry = {
      name,
      chords: structuredClone($state.snapshot(this.chords)),
      savedAt: new Date().toISOString()
    };
    this.saved = [entry, ...this.saved.filter(e => e.name !== name)];
    this.persistSlots();
  }

  loadSlot(name: string) {
    const entry = this.saved.find(e => e.name === name);
    if (entry) this.chords = structuredClone(entry.chords);
  }

  deleteSlot(name: string) {
    this.saved = this.saved.filter(e => e.name !== name);
    this.persistSlots();
  }

  private persistSlots() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('chordPlayer_slots', JSON.stringify(this.saved));
      } catch { /* ignore */ }
    }
  }
}

type SavedEntry = { name: string; chords: Chord[]; savedAt: string };

function loadCurrent(): Chord[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('chordPlayer_current');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadSlots(): SavedEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chordPlayer_slots');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function defaultChords(): Chord[] {
  return [
    { id: crypto.randomUUID(), root: 'C', quality: QUALITIES[0] },
    { id: crypto.randomUUID(), root: 'A', quality: QUALITIES[1] },
    { id: crypto.randomUUID(), root: 'F', quality: QUALITIES[0] },
    { id: crypto.randomUUID(), root: 'G', quality: QUALITIES[0] }
  ];
}
```

The save UI in the page:

```svelte
<script>
  let saveName = $state('');
</script>

<input bind:value={saveName} placeholder="save as..." />
<button onclick={() => { progression.saveAs(saveName); saveName = ''; }} disabled={!saveName}>
  save
</button>

<ul>
  &lbrace;#each progression.saved as s (s.name)&rbrace;
    <li>
      {s.name} ({s.chords.length} chords)
      <button onclick={() => progression.loadSlot(s.name)}>load</button>
      <button onclick={() => progression.deleteSlot(s.name)}>delete</button>
    </li>
  &lbrace;/each&rbrace;
</ul>
```

Add some chords, type a name, click save. The slot appears in the list. Refresh the page; the slot is still there. Click load; the progression switches back to that snapshot. Edit some more, click load again — the slot is unchanged (because we snapshotted on save).

### Variations

Versioned storage keys:

```ts
const STORAGE_VERSION = 1;
const CURRENT_KEY = `chordPlayer_current_v${STORAGE_VERSION}`;
```

When you change the chord schema in a way that breaks deserialization, bump the version. Old saved data is ignored (or you write a migration). Avoids the "user upgraded, their saved data crashes the app" scenario.

Schema validation on load:

```ts
function loadCurrent(): Chord[] | null {
  const raw = localStorage.getItem(CURRENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every(isValidChord)) return null;
    return parsed;
  } catch { return null; }
}
```

Doesn't trust the stored data. Even without an attacker, a future schema change or a user editing devtools can leave junk in storage; defensive parsing handles it.

Quota awareness:

```ts
try {
  localStorage.setItem(key, value);
} catch (e) {
  if (e instanceof DOMException && e.name === 'QuotaExceededError') {
    // tell the user; offer to clear old slots
  }
}
```

In practice, chord progressions are tiny. You'll never hit quota. If you ever store images or audio in localStorage, you might.

### Common mistakes

- **Forgetting to JSON.stringify.** `localStorage.setItem('key', obj)` calls `obj.toString()`, which produces `"[object Object]"`. The value reads back as garbage on load. Always stringify.
- **Reading without JSON.parse.** Same in reverse. `localStorage.getItem` returns a string; you need to parse it.
- **Saving a `$state` proxy directly.** Often works because `JSON.stringify` walks the proxy correctly, but can fail for exotic types. Snapshot first to be safe.
- **Storing per-user data in localStorage on a shared origin.** localStorage is per-origin, not per-user. If two users share a browser they share storage. Don't store credentials.
- **Listening for `storage` events.** localStorage has a `storage` event that fires in OTHER tabs of the same origin. Useful for cross-tab sync; not used here.

## Concept 4: URL encoding for share links

### What it is

A chord progression is small — tens of bytes per chord, a few hundred bytes for a typical 4-8 chord progression. You can pack it into a URL.

The trick is keeping the URL short and using only URL-safe characters. Three steps:

1. Build a compact representation: drop the IDs (they'll be regenerated on the receiving side), use short keys, reference qualities by ID instead of inlining the intervals array.
2. JSON.stringify to a string.
3. Base64-encode for URL safety. The browser's `btoa`/`atob` produce standard base64, which uses `+`, `/`, and `=` — all three need URL-escaping. Substitute `+→-`, `/→_`, strip trailing `=` padding to make it URL-safe out of the box.

The receiving side does the inverse: substitute back, decode, parse, validate, regenerate IDs, look up qualities by ID, hand off to the store.

The whole thing is maybe 30 lines of code. No backend. The URL itself is the share format. Send it via DM, post it on social media, screenshot the QR code — anyone who opens it gets the progression.

### Worked example

`src/lib/encoding.ts` (no runes; plain TypeScript):

```ts
import type { Chord } from './progression.svelte';

export function encode(chords: Chord[]): string {
  const compact = chords.map(c => ({ r: c.root, q: c.quality.id }));
  const json = JSON.stringify(compact);
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decode(encoded: string, qualities: { id: string }[]): Chord[] | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    const compact = JSON.parse(json) as { r: string; q: string }[];
    if (!Array.isArray(compact)) return null;
    return compact
      .map(({ r, q }) => {
        const quality = qualities.find(qu => qu.id === q);
        if (!quality) return null;
        return { id: crypto.randomUUID(), root: r, quality } as Chord;
      })
      .filter((c): c is Chord => c !== null);
  } catch {
    return null;
  }
}
```

A 4-chord progression in C major encodes to about 30 characters. A 16-chord progression: under 100. Easily fits in a URL well under the practical 2000-char URL limit.

### Variations

A more compact binary format:

```ts
// Each chord = 1 byte for root (0-11) + 1 byte for quality index
// 4 chords = 8 bytes = ~12 chars in base64
```

Probably overkill until your URLs are visibly long. The JSON approach is debuggable (you can decode-and-print in the console) and resilient to schema additions.

Including a version prefix:

```ts
return 'v1.' + base64;
```

Decode looks for the prefix, dispatches to the right decoder. Useful once you have more than one schema version in the wild.

A short hash for sharing instead of the full URL:

```ts
// Send the encoded string to a server that returns a short ID.
// Server stores the encoded string against the ID. Receiver fetches by ID.
```

This requires a backend. Worth it only when URLs grow long enough to break in chat apps. For chord progressions, you'll never need this.

### Common mistakes

- **Forgetting URL-safe substitutions.** Standard base64 contains `/`, which breaks paths. `+` in a URL gets parsed as space. Pad `=` is fine in most URLs but ugly. Substitute on encode, substitute back on decode.
- **Using `encodeURIComponent` AND base64.** Pick one. Base64 is sufficient and doesn't bloat the URL with percent-escapes.
- **Forgetting to validate after decode.** A malformed URL or an attacker-crafted payload can produce nonsense. The decoder above checks `Array.isArray` and falls back to `null`; the receiving route can show a 400 error.
- **Storing the IDs in the URL.** Wastes bytes and produces a stale UUID after decode. Strip on encode; regenerate on decode.

### TypeScript notes

The `(c): c is Chord => c !== null` is a type predicate. After filtering, TypeScript narrows the array to `Chord[]` (no `null`s). Without the predicate, the filtered array would still be typed as `(Chord | null)[]`.

## Concept 5: A SvelteKit dynamic route for receiving

### What it is

SvelteKit's routing is file-based. Folders inside `src/routes/` map to URL paths. A folder named `[param]` (square brackets) captures whatever URL segment is in that position and makes it available to the page.

For receiving share URLs like `/share/<encoded>`, the route folder is `src/routes/share/[encoded]/`. Inside, a `+page.ts` (the load function) and a `+page.svelte` (the rendered page). The load function receives `params.encoded` — the URL segment — and returns data that the page consumes.

This is the smallest SvelteKit-specific bit you've seen so far. Module 5 covers routing properly; this lesson just uses it.

### Worked example

`src/routes/share/[encoded]/+page.ts`:

```ts
import { error } from '@sveltejs/kit';
import { decode } from '$lib/encoding';
import { QUALITIES } from '$lib/progression.svelte';

export function load({ params }) {
  const chords = decode(params.encoded, QUALITIES);
  if (!chords) throw error(400, 'Invalid progression URL');
  return { chords };
}
```

The load function runs on both server and client (SvelteKit takes care of routing it). For this lesson it could be client-only (`+page.ts` with `export const ssr = false`) since the audio engine is browser-only — either way the URL decode itself works on both sides.

`src/routes/share/[encoded]/+page.svelte`:

```svelte
<script>
  import { progression } from '$lib/progression.svelte';

  let { data } = $props();

  $effect(() => {
    progression.chords = data.chords;
  });
</script>

<p>
  Loaded shared progression of {data.chords.length} chords.
  <a href="/">back to your progressions</a>
</p>
```

When someone visits `/share/eyJxIjoibWFqIn0`, the load function decodes the segment, the page mounts, and the `$effect` writes the decoded chords into the shared progression store. Navigating back to `/` shows the loaded progression in the main UI.

A share button on the main page:

```svelte
<script>
  import { encode } from '$lib/encoding';
  import { progression } from '$lib/progression.svelte';

  async function share() {
    const url = `${location.origin}/share/${encode(progression.chords)}`;
    try {
      await navigator.clipboard.writeText(url);
      // optional: show a toast saying "copied"
    } catch {
      prompt('copy this URL:', url);  // clipboard refused; fallback
    }
  }
</script>

<button onclick={share}>copy share link</button>
```

`navigator.clipboard.writeText` requires HTTPS or localhost (it's restricted to secure contexts), and the user has to have interacted with the page (the button click qualifies). The `prompt` fallback handles the rare refusal case.

### Variations

Loading without overwriting:

```svelte
<button onclick={() => { progression.chords = [...progression.chords, ...data.chords]; }}>
  append shared chords
</button>
```

Make the share page offer "load and replace" or "append to current."

A QR code generator for the URL:

```svelte
<!-- with a qrcode library -->
<QRCode value={url} />
```

For sharing in person without typing.

A short-link shortener: post to a service like is.gd or a self-hosted shlink instance, get back a short URL. Adds a backend dependency but produces share-friendly links.

### Common mistakes

- **Hardcoding the origin.** `'https://myapp.com/share/...'` breaks in dev (where origin is localhost) and in any non-prod deployment. Always use `location.origin` (browser) or read it from request headers (server).
- **Forgetting `throw` on `error()`.** `error(400, 'msg')` returns an error object; without `throw`, SvelteKit doesn't see it as an error and the page renders with garbage data. Always throw.
- **Calling `decode` on the server when it needs browser APIs.** `atob` is available in both modern Node and browsers, so this lesson's code works. Some libraries assume browser-only; check before importing into a load function.
- **Letting the share URL grow unbounded.** A 1000-chord progression encodes to thousands of characters. Test with realistic max sizes. If users can produce something that breaks the URL, switch to a server-side short-link scheme.

## Putting it together

The full flow:

1. User edits the progression. Every change auto-saves to `localStorage.chordPlayer_current` via the `$effect` in the store's constructor.
2. User clicks "save as," types a name, clicks save. The current chords are snapshotted and stored as a named slot.
3. User clicks "copy share link." The current chords are encoded to base64-URL and the resulting URL is copied to the clipboard.
4. User sends the URL to a friend.
5. Friend opens the URL. SvelteKit routes to `/share/[encoded]`, the load function decodes the chord array, the page writes it into the shared store, and the page redirects (or links) back to `/` where the friend now sees the same progression.

All client-side. No backend. The URL is the entire share protocol.

## Exercises

### Exercise 1: A clear-all button with confirmation

**Setup:** the store has a `clear()` method.

**What to do:** add a button to the page that calls `progression.clear()`. Before clearing, ask the user to confirm (`window.confirm`). After clearing, ensure the auto-save fires and localStorage now holds an empty array.

**Verify by:** clicking clear and confirming wipes the progression; refresh and it's still empty. Clicking clear and canceling leaves the progression untouched.

**Stretch:** instead of `window.confirm`, use a custom in-page confirm dialog (a modal with cancel/confirm buttons). Track its open state with `$state`.

<details>
<summary>Show solution</summary>

```svelte
<button onclick={() => {
  if (window.confirm('clear all chords?')) progression.clear();
}}>
  clear all
</button>
```

The auto-save `$effect` fires when `progression.chords` changes — clearing triggers it. The empty array gets persisted automatically.

For the stretch, a `$state` boolean drives a modal:

```svelte
<script>
  let showClearConfirm = $state(false);
</script>

<button onclick={() => showClearConfirm = true}>clear all</button>

&lbrace;#if showClearConfirm&rbrace;
  <div class="modal">
    <p>clear all chords?</p>
    <button onclick={() => { progression.clear(); showClearConfirm = false; }}>yes</button>
    <button onclick={() => showClearConfirm = false}>cancel</button>
  </div>
&lbrace;/if&rbrace;
```

</details>

### Exercise 2: Display "last saved" timestamp

**Setup:** the auto-save fires silently.

**What to do:** add a `lastSavedAt: string | null` field to the store. Update it inside the auto-save `$effect`. Display `saved {timestamp}` in the page header.

**Verify by:** editing the progression updates the timestamp. The displayed text uses a human-friendly format (e.g., `toLocaleTimeString`).

**Stretch:** show "saved just now" / "saved 5 seconds ago" / "saved 1 min ago" using a relative-time formatter. Update it every few seconds with `setInterval` and `$effect` cleanup.

<details>
<summary>Show solution</summary>

```ts
class ProgressionStore {
  chords = $state<Chord[]>(...);
  lastSavedAt = $state<string | null>(null);

  constructor() {
    if (browser) {
      $effect.root(() => {
        $effect(() => {
          const snapshot = $state.snapshot(this.chords);
          try {
            localStorage.setItem('chordPlayer_current', JSON.stringify(snapshot));
            this.lastSavedAt = new Date().toISOString();
          } catch { /* ignore */ }
        });
      });
    }
  }
}
```

```svelte
<p>saved {new Date(progression.lastSavedAt).toLocaleTimeString()}</p>
```

The relative-time stretch uses `Intl.RelativeTimeFormat` for the formatting; a `$effect` with `setInterval` for the periodic update.

</details>

### Exercise 3: Validate decoded share URLs

**Setup:** `decode` returns `null` on parse failure, but accepts any well-formed JSON regardless of content.

**What to do:** strengthen `decode` to reject chords whose root isn't in ROOTS or whose quality ID isn't in QUALITIES. The function should still return null on any validation failure.

**Verify by:** opening `/share/<garbage>` shows the 400 page. Opening a valid URL loads as before. Opening a URL with a tampered chord (e.g., `root: 'Q'`) shows the 400 page.

**Stretch:** add a count limit — reject URLs encoding more than 64 chords. Return a different error code (413?) when over the limit.

<details>
<summary>Show solution</summary>

```ts
const VALID_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function decode(encoded: string, qualities: { id: string }[]): Chord[] | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    const compact = JSON.parse(json) as { r: string; q: string }[];
    if (!Array.isArray(compact)) return null;
    if (compact.length > 64) return null;
    const result: Chord[] = [];
    for (const { r, q } of compact) {
      if (!VALID_ROOTS.includes(r)) return null;
      const quality = qualities.find(qu => qu.id === q);
      if (!quality) return null;
      result.push({ id: crypto.randomUUID(), root: r, quality });
    }
    return result;
  } catch {
    return null;
  }
}
```

Strict validation: any failure rejects the whole URL. The receiving route shows an error.

</details>

### Exercise 4 (stretch): Export and import JSON files

**Setup:** the only way to share is via URL.

**What to do:** add an "export" button that downloads the current progression as a `.json` file. Add an "import" button (an `<input type="file">`) that reads a `.json` file and loads it into the store.

**Verify by:** exporting, editing the progression, re-importing — the original chords are restored.

**Stretch:** allow drag-and-drop of a JSON file onto the page to import.

<details>
<summary>Show solution</summary>

```svelte
<script>
  function exportJson() {
    const blob = new Blob([JSON.stringify(progression.chords, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `progression-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const chords = JSON.parse(text);
      // basic validation
      if (!Array.isArray(chords)) return;
      progression.chords = chords;
    } catch { /* malformed */ }
  }
</script>

<button onclick={exportJson}>export JSON</button>
<input type="file" accept="application/json" onchange={importJson} />
```

The export uses a Blob + object URL + synthesized click — the standard "trigger a download from the browser" pattern. The import reads the File via the File API.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/lib/progression.svelte.ts` with auto-save, save slots, and load slot methods.
- `src/lib/encoding.ts` with `encode` and `decode` functions.
- `src/routes/share/[encoded]/+page.ts` + `+page.svelte` for receiving share URLs.
- A page UI that shows save slots, has a save form, and has a copy-share-link button.

### Verify it works

- Editing the progression persists across page refreshes.
- Saving a slot, editing, then loading the slot restores the saved state without bleeding into the live data.
- Clicking copy share link puts a URL in the clipboard. Pasting it into a new tab loads the same progression.
- Visiting `/share/garbage` shows an error page, not a crash.
- No console errors during any of the above.

### Compare against the reference

The full module 4 capstone lives in `learn-svelte/capstone-reference/chord-player/`. Compare your files to the reference if anything is off.

## Common questions

**Q: Why not use IndexedDB instead of localStorage?**
A: For a few hundred bytes of state, localStorage is dramatically simpler. IndexedDB pays off for large blobs, structured queries, and many concurrent writes. Chord progressions don't need any of that.

**Q: Is the share URL secure to send?**
A: It's not encrypted, and anyone who sees the URL can load the progression. For chord progressions that's fine — there's no privacy implication. For state that contains anything sensitive, don't use URL-encoded sharing at all.

**Q: What happens if two tabs of the app are open?**
A: Both tabs share localStorage. Tab A writes; tab B's in-memory state is unchanged until tab B reads from storage (e.g., on refresh). If you want live cross-tab sync, listen for the `storage` event and update the store when another tab writes.

**Q: Why `crypto.randomUUID()` instead of just incrementing a counter?**
A: Counters require a single source of truth. Across page refreshes, across share-URL imports, across tabs, you'd need coordination. UUIDs have effectively zero collision probability so you can mint them anywhere without coordination.

**Q: Can I serve the share URL as static HTML?**
A: Yes. SvelteKit's `prerender` option can pre-render specific routes. For dynamic share URLs you can't pre-render every possible encoded value, but you CAN run the decode on the server in the load function and serve the result. Module 5 covers this in detail.

## What's next

You've shipped a chord progression player. Five lessons:

- L1: PolySynth + `<select bind:value>` with objects + MIDI math.
- L2: Keyed lists, stable IDs, async sequences with cancellation.
- L3: `$bindable` props and when to use them.
- L4: Shared state in `.svelte.ts` modules.
- L5: localStorage persistence and URL sharing.

Module 5 leaves single-page-app territory and gets into SvelteKit proper — routing, layouts, load functions, form actions, and the differences between client-side and server-side rendering. You'll take one of these apps (probably this one) and turn it into a real multi-route deployable application.

<SourcesSection lessonKey="04-chord-player/05-save-and-share" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
