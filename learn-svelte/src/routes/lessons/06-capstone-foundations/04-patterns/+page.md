<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Save and Share Patterns · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-6);">

<LessonHeader
  moduleSlug="06-capstone-foundations"
  lessonSlug="04-patterns"
  title="Save and Share Patterns"
  blurb="localStorage auto-save, named slots, and URL-encoded sharing — your DAW survives refresh and travels in a link."
/>

## Why this lesson exists

The DAW from L3 works but loses everything on refresh. The user spends ten minutes crafting a pattern, accidentally hits Cmd-R, and starts over. That's table-stakes broken. This lesson fixes it three ways: automatic background save of the current pattern (so a refresh restores your work), named slots (so you can stash multiple patterns and load any of them), and URL-encoded sharing (so you can send a pattern to a friend in a link, no backend required).

The interesting part isn't the storage. localStorage is six API calls. The interesting parts are the *patterns* — a literal `$effect` that auto-runs on every reactive change is the cleanest way to express auto-save, but it has to be set up carefully (unconditional-read again, browser guard for SSR). `structuredClone($state.snapshot(...))` is the canonical way to snapshot reactive state to non-reactive plain data — used both for named slots and for the share URL. And the share route is the first time we touch SvelteKit's dynamic-segment routing with a `+page.ts` load function in this curriculum, which is a small piece of architecture worth understanding before we ship the DAW.

By the end the DAW remembers what you were doing, lets you stash named versions, and travels in a link. None of it requires a server.

## Learning objectives

By the end of this lesson you'll be able to:

- Write an `$effect` inside `$effect.root` that auto-saves reactive state to localStorage.
- Explain why `$state.snapshot()` is necessary before `structuredClone` for saving reactive state.
- Implement save/load/delete for named slots using `crypto.randomUUID()` keys.
- Build a `SavedPatterns` sidebar with a save form, list of saved entries, and per-entry delete.
- URL-encode arbitrary JSON via `btoa` + base64-URL-safe character substitution, and decode it back.
- Build a SvelteKit dynamic route `/share/[encoded]` with a `+page.ts` load function and a `+page.svelte` page.
- Use `$app/environment`'s `browser` flag to guard browser-only code from SSR.

## Concept 1: Auto-save with `$effect`

### The pattern

The cleanest way to express "whenever this state changes, persist it" is an `$effect` that reads the state and writes it. The effect's dependency tracker handles the rest — change `pattern` or `bpm`, the effect fires, the new value lands in localStorage.

The constructor from `engine.svelte.ts` opens an `$effect.root` (as covered in L3) and adds the auto-save effect alongside the BPM sync:

```ts
$effect(() => {
  // Read both deps unconditionally. The body is then conditional on
  // browser, but the reads already registered with the tracker.
  const p = this.pattern;
  const b = this.bpm;
  try {
    // $state.snapshot turns the live proxy into a plain object before
    // serialization. Without it, JSON.stringify still works but you'd
    // hit issues if you ever did structuredClone.
    const snapshot = {
      pattern: $state.snapshot(p),
      bpm: b
    };
    localStorage.setItem(LS_CURRENT, JSON.stringify(snapshot));
  } catch {
    /* quota exceeded — ignore */
  }
});
```

Where `LS_CURRENT` is a module-level constant:

```ts
const LS_CURRENT = 'daw_current_v1';
```

The `_v1` suffix is forward-thinking: if you change the shape later (add per-cell velocity, say), you bump to `daw_current_v2` and write a migration. Without the version, you'd be stuck reading whatever shape happened to be in storage from prior sessions.

### The unconditional-read pattern, applied

We covered this in L3 in the BPM-sync effect, and it's load-bearing here too. The reads of `this.pattern` and `this.bpm` happen *first*, before any `try` or branch. The body that does the actual save can fail in any way (storage quota, JSON encoding error) without dropping the subscription. Every change to pattern or bpm re-fires the effect.

The dependency-graph trap if you wrote it inline:

```ts
// BROKEN — pattern only read on browser-truthy runs
$effect(() => {
  if (browser) {
    localStorage.setItem(LS_CURRENT, JSON.stringify({
      pattern: this.pattern,
      bpm: this.bpm
    }));
  }
});
```

`browser` is a constant from `$app/environment`. It doesn't change. So in practice this works (the constant is always true on the client). But the pattern is brittle — replace `browser` with a runtime check, and you've got an unconditional bug. Make the read unconditional and the brittleness goes away. Read first, branch second.

The reference includes the `browser` import at the module top:

```ts
import { browser } from '$app/environment';
```

And the constructor's first line is the SSR guard from L3:

```ts
constructor() {
  if (!browser) return;
  // ...
}
```

With the constructor bailing on the server, the body of the auto-save effect doesn't need its own `browser` check — but the `try &lbrace; localStorage.setItem(...) &rbrace;` is still defensive against storage quota (private mode in Safari, for instance, can throw `QuotaExceededError` even with empty storage).

### Restoring on construction

The save side is half the story. The load side runs in the constructor, *before* the `$effect.root` opens, so the first run of any subsequent effect sees the loaded values rather than the defaults:

```ts
constructor() {
  if (!browser) return;

  // Restore last session state (pattern + bpm) before any effects run, so
  // their first read picks up the loaded values rather than the defaults.
  const saved = this.loadCurrent();
  if (saved) {
    this.pattern = saved.pattern;
    this.bpm = saved.bpm;
  }
  this.savedPatterns = this.loadSlots();

  this.effectScopeDispose = $effect.root(() => {
    // ... BPM sync, auto-save, etc.
  });
}
```

With the `loadCurrent` method defined as:

```ts
private loadCurrent(): { pattern: Record<string, number[]>; bpm: number } | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(LS_CURRENT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.pattern || typeof parsed.bpm !== 'number') return null;
    return { pattern: parsed.pattern, bpm: parsed.bpm };
  } catch {
    return null;
  }
}
```

Four defensive checks: storage may not exist, may not parse as JSON, may not be an object, may not have the right shape. Old data from a v0 schema or hand-edited storage would fail one of these and we fall back to the default pattern. The user's worst case is "my custom pattern got wiped" — which is mild compared to "my DAW threw an uncaught error on page load."

### Common mistakes with auto-save

- **You forget the SSR guard and `localStorage is not defined` breaks the build.** During SSR the engine module imports and the constructor runs. localStorage is browser-only. Always guard.
- **You read state inside `try`, expecting the throw to skip the read.** It doesn't — the throw can happen mid-statement, and Svelte may or may not have registered the read by then. Read into a local *before* any try.
- **You auto-save on every keystroke of a text input.** Fine in this app (cells toggle on click, BPM is a slider with infrequent stops). For text inputs you'd want to debounce — wrap the save in `setTimeout(..., 200)` and clear-and-reschedule on each change. The DAW doesn't need debouncing because the cost is one `localStorage.setItem` per cell-click.
- **You auto-save the entire engine state (channels, effects, etc.) and the storage entry balloons.** Pick the minimum that needs to persist. Pattern and BPM are the user's actual work; channels and effect levels are more like preferences and could live in their own key.

### TypeScript notes

`$state.snapshot()` returns `Snapshot<T>`, which for an array or object is a deep-readonly version of the input type. JSON.stringify accepts it without coercion. The reason to snapshot before stringify is mostly forward-looking — if you later change `JSON.stringify` to `structuredClone`, the live proxy can fail or produce unexpected results because proxies are weird to deep-copy.

## Concept 2: `$state.snapshot` + `structuredClone` for save/load

### The reactive-state copy problem

`this.pattern` is a live Svelte proxy. If you grab a reference to it and stash that reference in a saved-pattern entry, you're stashing the proxy — every future edit to the pattern mutates your "saved" copy. That's the bug. You want a *snapshot at this moment*, frozen, decoupled from future edits.

Two operations to do it right:

1. `$state.snapshot(value)` strips the reactive proxy, returning the plain underlying data. The result is a new object/array — assignments to the original proxy no longer affect it.
2. `structuredClone(value)` deep-copies the plain data, recursively. Nested arrays and objects each become new instances.

Without (1), the snapshot may still contain proxy-wrapped sub-values. Without (2), the top-level is decoupled but nested arrays still alias. Combined, you get a clean deep copy with no proxy leakage and no shared sub-references.

The canonical "save a snapshot of reactive state" line is:

```ts
const frozen = structuredClone($state.snapshot(this.pattern)) as Record<string, number[]>;
```

The `as Record<string, number[]>` cast is because `$state.snapshot`'s return type is `Snapshot<T>`, which is deep-readonly. Once structuredClone deep-copies, the values are writable again — but TypeScript's inference doesn't follow through, so the cast asserts what's actually true.

### Common mistakes with snapshotting

- **You skip `$state.snapshot` and just `structuredClone(this.pattern)`.** Throws in some browsers because cloning a proxy with internal slot magic isn't fully spec'd. In other browsers it works but returns weird half-proxy objects. Always snapshot first.
- **You `JSON.parse(JSON.stringify(this.pattern))` as a shortcut.** Works for pattern (numbers and strings only). Doesn't work if you ever add a `Date` or `Map` or `Blob`. structuredClone is the modern answer that handles all of those.
- **You snapshot but don't clone, and the saved entry's pattern is itself another `$state` object you're sharing.** This is the subtle one — `$state.snapshot` returns *non-reactive* plain values, so the proxy issue is gone, but you're still holding the same underlying object. Edit the saved entry's pattern (e.g., via a "duplicate" feature), and the original gets edited too. structuredClone breaks the alias.

## Concept 3: Named saved slots

### The shape

A saved pattern needs more than just the pattern data — it needs an ID, a user-supplied name, and metadata. The type:

```ts
export type SavedPattern = {
  id: string;
  name: string;
  pattern: Record<string, number[]>;
  bpm: number;
  savedAt: string;
};
```

`id` is a UUID generated at save time. `name` is the user's input. `pattern` and `bpm` are the snapshot of what was active. `savedAt` is an ISO timestamp string — handy for sorting and for showing "saved 2 minutes ago" labels later.

### Save / load / delete

Three methods on the engine class:

```ts
saveAs(name: string) {
  const entry: SavedPattern = {
    id: crypto.randomUUID(),
    name,
    // structuredClone($state.snapshot(...)) — snapshot strips reactivity,
    // structuredClone deep-copies so future edits don't mutate the saved
    // entry.
    pattern: structuredClone($state.snapshot(this.pattern)) as Record<string, number[]>,
    bpm: this.bpm,
    savedAt: new Date().toISOString()
  };
  this.savedPatterns = [entry, ...this.savedPatterns];
  this.persistSlots();
}

loadSlot(id: string) {
  const entry = this.savedPatterns.find((p) => p.id === id);
  if (!entry) return;
  this.pattern = structuredClone(entry.pattern);
  this.bpm = entry.bpm;
}

deleteSlot(id: string) {
  this.savedPatterns = this.savedPatterns.filter((p) => p.id !== id);
  this.persistSlots();
}
```

Things to notice:

- **`crypto.randomUUID()`** — browser-native UUID generation. No external library, no collision worries. Available in all modern browsers.
- **`this.savedPatterns = [entry, ...this.savedPatterns]`** — prepend, not append. Newest at the top. Replacing the array (rather than `unshift`-ing into it) triggers reactivity for the whole list, which is what we want — the sidebar should re-render.
- **`structuredClone(entry.pattern)` on load.** Same reasoning as save — the saved entry is the canonical record, and we want the live pattern to be a separate copy so edits don't mutate the saved entry.
- **`this.persistSlots()` after save and delete.** The auto-save effect only watches `pattern` and `bpm`, not `savedPatterns`. We could extend it, but per-method persist calls make the intent clearer — "this method changes saved slots; persist now."

### Persisting the slots list

`persistSlots` is the lower-level write, `loadSlots` is the read on construction:

```ts
private loadSlots(): SavedPattern[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    return raw ? (JSON.parse(raw) as SavedPattern[]) : [];
  } catch {
    return [];
  }
}

private persistSlots() {
  if (!browser) return;
  try {
    localStorage.setItem(LS_SLOTS, JSON.stringify(this.savedPatterns));
  } catch {
    /* quota — ignore */
  }
}
```

With the constant at the module top:

```ts
const LS_SLOTS = 'daw_slots_v1';
```

Same `_v1` suffix logic as `LS_CURRENT`. Storage version migration is a problem for future-you when you change the schema.

The persistence is synchronous (localStorage is). On a slow disk this can take a few milliseconds per write — usually invisible, occasionally a hitch. If it becomes a problem (it won't for the DAW's scale), wrap the write in `setTimeout(..., 0)` to defer it out of the user's interaction.

### An `applyPattern` helper for the share route

We also add a small method that the share route (Concept 5) will call:

```ts
applyPattern(pattern: Record<string, number[]>, bpm: number) {
  this.pattern = structuredClone(pattern);
  this.bpm = bpm;
}
```

Same shape as `loadSlot`'s body, but takes the data directly instead of looking it up. The structuredClone is again to break aliasing — the incoming `pattern` comes from a `decodePattern` result, and we don't want the share-route component's data binding to share references with the engine.

### Common mistakes with named slots

- **You use the user-supplied name as the ID and hit collisions.** Two patterns named "test" overwrite each other. Always use UUID-based IDs and let the name be display-only.
- **You forget `e.preventDefault()` on the save form's submit handler.** The form posts to the current URL, triggers a navigation, and the saved pattern silently disappears in the page reload. The Svelte event handler runs *before* the default, so preventDefault stops the navigation.
- **You filter on `===` for ID comparison and your IDs are strings vs. numbers.** Use UUID strings throughout and the bug never appears.
- **You store the saved-slot list inside the auto-save key.** Now every cell click rewrites the whole slot list. Splitting `LS_CURRENT` (frequent writes, small payload) from `LS_SLOTS` (infrequent writes, larger payload) keeps each write cheap.

## Concept 4: The SavedPatterns sidebar component

### The script

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';

  let saveName = $state('');

  function handleSave(e: Event) {
    e.preventDefault();
    const name = saveName.trim();
    if (!name) return;
    audio.saveAs(name);
    saveName = '';
  }
</script>
```

`saveName` is local component state for the input. `handleSave` is the form submit handler — preventDefault, validate, save, clear the input. The component owns the input state; the engine owns the saved-pattern list.

### The markup

```svelte
<aside class="saved">
  <h3>SAVED PATTERNS</h3>

  <form onsubmit={handleSave}>
    <input
      type="text"
      bind:value={saveName}
      placeholder="name this pattern..."
      maxlength="40"
    />
    <button type="submit" disabled={!saveName.trim()}>save</button>
  </form>

  {#if audio.savedPatterns.length === 0}
    <p class="empty">no saved patterns yet</p>
  {:else}
    <ul>
      {#each audio.savedPatterns as p (p.id)}
        <li>
          <button class="load" type="button" onclick={() => audio.loadSlot(p.id)}>
            <span class="name">{p.name}</span>
            <span class="meta lcd">{p.bpm}bpm</span>
          </button>
          <button class="del" type="button" onclick={() => audio.deleteSlot(p.id)} aria-label="Delete {p.name}">×</button>
        </li>
      {/each}
    </ul>
  </aside>
{/if}
```

Quick read-through:

- **`onsubmit=&lbrace;handleSave&rbrace;`** — Svelte 5's property-style event handler. The function gets the submit event, including the preventDefault method.
- **`bind:value=&lbrace;saveName&rbrace;`** — two-way binding. Typing into the input mutates `saveName`, which re-evaluates the disabled state of the submit button.
- **`disabled=&lbrace;!saveName.trim()&rbrace;`** — empty-or-whitespace names disable save. The check is reactive because `saveName` is reactive.
- **`&lbrace;#if audio.savedPatterns.length === 0&rbrace;` empty state.** When there are no slots, show a hint instead of an empty list. This is the kind of detail that makes a sidebar feel finished rather than under-construction.
- **The `(p.id)` key on the each block.** UUIDs are stable across re-renders. Deleting an item correctly removes that one `<li>` without re-mounting siblings.
- **Two buttons per row: the big "load" one and the small "×".** The load button takes the whole row width minus the delete button. Clicking the load button is the primary action; the × is the destructive secondary action.

### The styles

```svelte
<style>
  .saved {
    padding: var(--sp-3);
    background: var(--c-chrome);
    border: 1px solid var(--c-border);
    border-radius: var(--r-lg);
  }
  h3 {
    margin: 0 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.14em;
    color: var(--c-text-muted);
  }
  form { display: flex; gap: 6px; margin-bottom: var(--sp-3); }
  input {
    flex: 1;
    padding: 7px 10px;
    background: var(--c-bg-code);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font: inherit;
    font-size: var(--fs-sm);
  }
  input:focus { outline: 1px solid var(--c-accent); }
  button { cursor: pointer; font: inherit; }
  form button {
    padding: 7px 14px;
    background: var(--c-accent);
    color: white;
    border: 0;
    border-radius: var(--r-sm);
    font-weight: 600;
    font-size: var(--fs-xs);
    letter-spacing: 0.04em;
  }
  form button:disabled { opacity: 0.4; cursor: not-allowed; }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
  }
  .load {
    flex: 1;
    background: transparent;
    color: var(--c-text);
    text-align: left;
    border: 0;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-sm);
  }
  .load:hover { background: var(--c-surface); }
  .meta { font-size: 0.7rem; color: var(--c-text-faint); }
  .del {
    background: transparent;
    color: var(--c-text-faint);
    border: 0;
    padding: 4px 10px;
    font-size: 18px;
    line-height: 1;
  }
  .del:hover { color: var(--c-error); }

  .empty {
    padding: var(--sp-3);
    text-align: center;
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    font-style: italic;
    margin: 0;
  }
</style>
```

Standard sidebar styling. The interesting bit is `.del:hover &lbrace; color: var(--c-error); &rbrace;` — the delete icon stays muted by default and turns red on hover, so it's not visually shouting "DELETE" until the user is about to click it.

### Common mistakes with the sidebar

- **You forget `type="button"` on the load and delete buttons.** Inside a `<form>`, the default button type is `submit`. Clicking load would submit the form, which would call `handleSave` with an empty name and refresh nothing. Always type your non-submit buttons.
- **You use an `index` key on the each block instead of `p.id`.** Deleting an item at index 2 shifts all later items down — Svelte sees "the item at index 3 is now different" and re-renders that DOM. With UUIDs, only the deleted item's `<li>` un-mounts. The bug shows up if you have transitions or input focus on items — they survive correctly with stable keys.
- **You re-fetch saved patterns from localStorage on every render.** Don't. The engine already holds them in `$state` and the auto-save effect persists changes. Reading from the engine is reactive; reading from localStorage is not.

## Concept 5: URL-encoded pattern sharing

### The encoding module

We want a URL like `/share/N4IgdghgtgpiBcICc...` that decodes to the pattern. The approach: JSON-stringify the data, base64-encode the string, replace the three base64 characters that aren't URL-safe (`+`, `/`, `=`) with their URL-safe equivalents.

`src/lib/audio/encoding.ts`:

```ts
// URL-safe base64 encoding for pattern sharing. The encoded string ends up in
// the URL, so we replace the three base64 characters that are not URL-safe
// (`+`, `/`, `=`) with their URL-safe counterparts.

export type EncodedPayload = {
  pattern: Record<string, number[]>;
  bpm: number;
};

export function encodePattern(pattern: Record<string, number[]>, bpm: number): string {
  const data = { p: pattern, b: bpm };
  return btoa(JSON.stringify(data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodePattern(encoded: string): EncodedPayload | null {
  try {
    // Restore standard base64 chars before atob.
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad to a multiple of 4 — atob requires it.
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    const obj = JSON.parse(atob(b64));
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.p || typeof obj.b !== 'number') return null;
    return { pattern: obj.p, bpm: obj.b };
  } catch {
    return null;
  }
}
```

A bunch of small choices:

- **`&lbrace; p: pattern, b: bpm &rbrace;`** — single-letter keys to shorten the encoded string. For a 64-cell pattern with `0`/`1` values, this saves about 12 bytes after base64. Marginal but free.
- **`btoa(JSON.stringify(...))`** — `btoa` is browser-native base64 encoder. The "binary to ASCII" name is historical and confusing; it does what you expect for strings.
- **Three `.replace` calls.** `+` → `-`, `/` → `_`, `=+` → empty. The first two are documented base64-URL substitutions (RFC 4648 §5). The trailing `=` padding is optional in base64 and ugly in URLs; we strip and re-add on decode.
- **`.replace(/=+$/, '')`** — strip ONE OR MORE `=` characters at the end. The regex anchors on `$` (end of string) and matches greedily.
- **`atob` is the inverse of `btoa`** — base64 string back to original. It requires padding to a multiple of 4 chars, which we re-add in `decodePattern`.
- **`pad = b64.length % 4`** is 0, 2, or 3 (never 1, because base64 lengths are constrained). When non-zero, pad with `'='.repeat(4 - pad)`.
- **The defensive checks at the end of `decodePattern`** — `obj` exists, is an object, has the right shape. Garbage URLs return `null` instead of throwing, and the share-route load function turns null into a 400 error.

### Things this encoding does NOT do

- **No compression.** A 64-cell pattern with `0`/`1` values base64-encodes to roughly 200 characters. Could be 30-50 with proper bit-packing (16 cells × 4 tracks = 64 bits = 8 bytes = 11 chars base64). The DAW doesn't need the compactness; the readability of "still JSON underneath" wins.
- **No versioning.** If we later add per-cell velocity, the share URL format breaks. A `v: 1` field in the payload would let us migrate. Not present in the reference because the DAW shipped without it; an obvious follow-up.
- **No signing.** Anyone can craft any URL. Fine for a DAW pattern (no security model); not fine if you were sharing user-private data.

### Common mistakes with URL-safe base64

- **You forget the `+` → `-` and `/` → `_` substitution, and your URLs sometimes break depending on the pattern data.** The breakage is data-dependent because not every JSON happens to produce `+` or `/` in its base64. Test with patterns that include UUIDs or large numbers (more random byte distributions).
- **You strip `=` on encode but don't re-add on decode.** `atob` throws on un-padded input. Always re-pad.
- **You URL-encode the whole base64 string with `encodeURIComponent` instead of doing the substitutions.** Works but you end up with `%2B` and `%2F` everywhere, doubling the URL length. The substitution approach is cleaner.

## Concept 6: The share route

### The directory

SvelteKit dynamic segments are folder names in square brackets. `/share/[encoded]/` means "any URL like `/share/foo`, where `foo` is captured as `params.encoded`." Two files in that folder:

- `+page.ts` — runs on navigation, decodes the URL.
- `+page.svelte` — renders the page.

### The load function

```ts
// src/routes/share/[encoded]/+page.ts
import { error } from '@sveltejs/kit';
import { decodePattern } from '$lib/audio/encoding';

// Dynamic encoded segment — can't enumerate at build time. The static
// adapter's SPA fallback (index.html) catches these on the live host and
// lets the client router run this load function in the browser.
export const prerender = false;

export function load({ params }) {
  const decoded = decodePattern(params.encoded);
  if (!decoded) throw error(400, 'Invalid pattern URL');
  return decoded;
}
```

Three things:

- **`export const prerender = false`.** The encoded segment is arbitrary user data — SvelteKit can't crawl it at build time. If you're deploying with `adapter-static` (which this DAW does, because it has no backend), you'd hit a build error trying to prerender every possible URL. Marking the route non-prerenderable tells SvelteKit to skip it; the static adapter's SPA fallback (`index.html` for unmatched paths) catches the request at runtime and the load function runs in the browser.
- **`load(&lbrace; params &rbrace;)`** destructures the route params. `params.encoded` is the captured segment.
- **`throw error(400, 'Invalid pattern URL')`.** SvelteKit's error helper. The thrown error short-circuits the load and renders the error page with the given status code. Malformed URLs get a 400 instead of crashing the page.

The returned object becomes the `data` prop on the page component.

### The page

```svelte
<!--
  /share/[encoded] — decode a base64url pattern from the URL, copy it into the
  engine, then offer the user a button to navigate back to the main DAW.
-->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { TRACKS } from '$lib/audio/tracks';

  let { data } = $props();
  let applied = $state(false);

  function apply() {
    audio.applyPattern(data.pattern, data.bpm);
    applied = true;
  }

  function openInDaw() {
    apply();
    goto(`${base}/`);
  }
</script>

<svelte:head><title>Shared pattern · Svelte DAW</title></svelte:head>

<main class="page">
  <h1>Shared <span class="accent">Pattern</span></h1>
  <p class="sub">BPM {data.bpm} · {Object.keys(data.pattern).length} tracks</p>

  <div class="preview">
    {#each TRACKS as t (t.id)}
      {@const row = data.pattern[t.id] ?? []}
      <div class="row" style="--c-track: {t.color}">
        <span class="name">{t.name}</span>
        <div class="cells">
          {#each row as on, i (i)}
            <span class="cell" class:on class:downbeat={i % 4 === 0}></span>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="actions">
    <button type="button" class="primary" onclick={openInDaw}>
      load into DAW
    </button>
    <button type="button" class="ghost" onclick={apply} disabled={applied}>
      {applied ? 'applied!' : 'apply (stay here)'}
    </button>
  </div>
</main>
```

The reference page does more than the thin earlier version of this lesson described — it shows a *preview* of the shared pattern before loading it. The preview is a read-only render of the same 4×16 grid, but using `<span class="cell">` instead of `<button class="cell">` so it's not interactive. The user can see what they'd be loading before they commit.

Notable bits:

- **`let &lbrace; data &rbrace; = $props();`** — the standard Svelte 5 props rune. `data` is the object returned by the load function.
- **`apply()` vs `openInDaw()`.** Two buttons, two flows. "load into DAW" applies and navigates back. "apply (stay here)" just applies — useful if the user wants to keep the preview open while the engine adopts the pattern.
- **``goto(`${base}/`)``** — SvelteKit's programmatic navigation. The `base` import handles the case where the app is deployed under a sub-path (e.g., `/learn-svelte/`).
- **`&lbrace;@const row = data.pattern[t.id] ?? []&rbrace;`** — `@const` defines a local within an each block. The `?? []` defensively handles a pattern that's missing a track (forward-compatible with future track changes).

### Wiring the share button

The TransportBar gets a "share" button. From the reference:

```svelte
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { encodePattern } from '$lib/audio/encoding';
  import { base } from '$app/paths';

  let copied = $state(false);

  async function share() {
    const encoded = encodePattern($state.snapshot(audio.pattern) as Record<string, number[]>, audio.bpm);
    const url = `${location.origin}${base}/share/${encoded}/`;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard failed — fall back to a prompt the user can copy manually.
      window.prompt('Copy this share URL:', url);
    }
  }
</script>

<button class="ghost" type="button" onclick={share}>
  {copied ? 'copied!' : 'share'}
</button>
```

Things to notice:

- **`$state.snapshot(audio.pattern)` before passing to `encodePattern`.** The function signature takes `Record<string, number[]>`, but `audio.pattern` is a proxy. JSON.stringify handles proxies, but snapshotting first is the consistent pattern and avoids any future surprises.
- **The `$&lbrace;base&rbrace;/share/$&lbrace;encoded&rbrace;/` URL** matches the route folder structure. Trailing slash for SvelteKit's default config.
- **`navigator.clipboard.writeText`** is the modern clipboard API — async, returns a promise, requires HTTPS or localhost.
- **`copied = true; setTimeout(() => (copied = false), 1500)`** — show "copied!" for 1.5 seconds, revert to "share". A small UX touch that confirms the action without a modal.
- **The `try &lbrace; ... &rbrace; catch &lbrace; window.prompt(...) &rbrace;` fallback.** Clipboard API can fail (HTTP context, iframe, permissions). When it does, fall back to a prompt the user can manually copy from.

### Common mistakes with the share route

- **You forget `export const prerender = false` and the build fails.** With the static adapter, every page tries to prerender at build time. Dynamic segments need explicit opt-out.
- **You wire the page's `apply` to run in `$effect` on mount and the engine adopts the pattern without user consent.** Some users want to see what they're loading before they commit. The two-button design lets them preview first.
- **You forget `goto(...)` and the back button doesn't return the user to the DAW.** `goto` pushes the navigation; without it, the user has to manually edit the URL.
- **You construct the share URL with `$&lbrace;location.href&rbrace;` and end up sharing the share URL of the share URL.** Always start from `location.origin` + `base`, never the current `location.href`.

## Putting it together

After this lesson:

- The constructor of `AudioEngine` restores pattern + bpm + saved-slot list from localStorage before any effects open.
- An `$effect` inside the root scope auto-saves pattern + bpm on every change.
- Three methods (`saveAs`, `loadSlot`, `deleteSlot`) manage named slots, persisting via `persistSlots`.
- An `applyPattern` helper supports the share route adopting an external pattern.
- The `encoding.ts` module provides URL-safe base64 encode/decode.
- The `SavedPatterns.svelte` sidebar lets the user save, browse, and delete named slots.
- The `/share/[encoded]/` route decodes URLs into a preview-and-apply page.
- The TransportBar's share button copies a `/share/[encoded]` URL to the clipboard.

Open two browser windows. Build a pattern in one. Click share. Paste the URL in the other window. You see the preview, click load, you're in the DAW with that pattern loaded.

## Exercises

### Exercise 1: A "duplicate" button on saved slots

**Setup:** the sidebar has load and delete buttons per slot. Sometimes you want to fork a saved pattern — load it as a *new* slot with a slightly different name.

**What to do:** add a `duplicateSlot(id: string)` method to the engine. It finds the slot, creates a new entry with a fresh UUID and the name suffixed with " (copy)", and prepends it to the list. Wire a tiny "⎘" button on each row in the sidebar.

**Verify by:** duplicate a saved slot. The list now has two entries — the original and the copy. Edit the copy (load, change cells, save again as a different name) — the original is unaffected.

**Stretch:** when duplicating, also auto-increment if "(copy)" already exists — "test (copy)", "test (copy 2)", "test (copy 3)".

<details>
<summary>Show solution</summary>

```ts
duplicateSlot(id: string) {
  const entry = this.savedPatterns.find((p) => p.id === id);
  if (!entry) return;
  const copy: SavedPattern = {
    id: crypto.randomUUID(),
    name: `${entry.name} (copy)`,
    pattern: structuredClone(entry.pattern),
    bpm: entry.bpm,
    savedAt: new Date().toISOString()
  };
  this.savedPatterns = [copy, ...this.savedPatterns];
  this.persistSlots();
}
```

```svelte
<button type="button" onclick={() => audio.duplicateSlot(p.id)} aria-label="Duplicate {p.name}">⎘</button>
```

The structuredClone breaks the alias so future edits to the original or the copy stay independent.

</details>

### Exercise 2: Read a pattern from a `?pattern=...` query string

**Setup:** the share route uses path segments (`/share/[encoded]`). Some integrations prefer query strings (`/?pattern=...`) — easier to compose with other params.

**What to do:** in the root `+page.svelte`'s `$effect`, check `URLSearchParams` for a `pattern` value. If present, decode it and apply to the engine.

**Verify by:** visiting `/?pattern=<encoded>` loads the pattern. Visiting `/` without the param does nothing.

**Stretch:** clean up the URL after applying (remove the param), using `history.replaceState`, so the user doesn't see the encoded blob.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { audio } from '$lib/audio/engine.svelte';
  import { decodePattern } from '$lib/audio/encoding';
  import { browser } from '$app/environment';

  $effect(() => {
    if (!browser) return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('pattern');
    if (!encoded) return;
    const decoded = decodePattern(encoded);
    if (decoded) {
      audio.applyPattern(decoded.pattern, decoded.bpm);
      // Stretch: clean the URL
      params.delete('pattern');
      const newSearch = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`);
    }
  });
</script>
```

The effect runs once on mount (no reactive deps). `replaceState` updates the URL without triggering navigation, keeping the back button clean.

</details>

### Exercise 3: Pattern name in the page title

**Setup:** when a saved slot is loaded, the user can't easily tell which one is "active." The page title says "SVELTE DAW" regardless.

**What to do:** track the currently-loaded slot's name in the engine (or in a derived). When a slot is loaded, set the page title to "[name] · SVELTE DAW". When the pattern is edited (any cell click), revert to "SVELTE DAW (unsaved)" to indicate divergence.

**Verify by:** load a saved slot — title updates. Edit a cell — title becomes "(unsaved)". Save again — title shows the new name.

**Stretch:** add a small "modified" dot next to the saved-pattern in the sidebar when the current state has diverged.

<details>
<summary>Show solution</summary>

```ts
// engine.svelte.ts
currentSlotId = $state<string | null>(null);
currentSlotDirty = $state(false);

// in loadSlot:
loadSlot(id: string) {
  const entry = this.savedPatterns.find((p) => p.id === id);
  if (!entry) return;
  this.pattern = structuredClone(entry.pattern);
  this.bpm = entry.bpm;
  this.currentSlotId = id;
  this.currentSlotDirty = false;
}

// in the constructor's $effect.root:
$effect(() => {
  const _ = this.pattern;  // unconditional read
  if (this.currentSlotId) this.currentSlotDirty = true;
});
```

```svelte
<!-- src/routes/+page.svelte -->
<svelte:head>
  {#if audio.currentSlotId}
    {@const slot = audio.savedPatterns.find(s => s.id === audio.currentSlotId)}
    <title>{slot?.name}{audio.currentSlotDirty ? ' (unsaved)' : ''} · SVELTE DAW</title>
  {:else}
    <title>SVELTE DAW</title>
  {/if}
</svelte:head>
```

The dirty flag is tracked via an effect that subscribes to pattern changes. Setting `currentSlotDirty = false` only inside `loadSlot` and `saveAs` (a new exercise — adding it) means any edit after either of those flips it true.

</details>

### Exercise 4 (stretch): Compress the share URL

**Setup:** the share URL is ~200 chars for a default pattern. A more compact encoding (one bit per cell, packed) gives ~30-50 chars.

**What to do:** write `encodePatternCompact(pattern, bpm)` that packs each track's 16 cells into a single 2-byte integer (16 bits), then base64-URL-encodes the resulting `&lbrace; k, s, h, p, b &rbrace;` object where `k`/`s`/`h`/`p` are integers.

**Verify by:** the share URL for the default pattern is shorter than the current implementation. Decode round-trips correctly.

**Stretch:** auto-detect format on decode — if the parsed payload has `k`/`s`/`h`/`p`, use the compact decoder; otherwise fall back to the verbose one. Backward-compatible URLs.

<details>
<summary>Show solution</summary>

```ts
function packRow(row: number[]): number {
  let n = 0;
  for (let i = 0; i < 16; i++) if (row[i]) n |= (1 << i);
  return n;
}

function unpackRow(n: number): number[] {
  return Array.from({ length: 16 }, (_, i) => (n & (1 << i)) ? 1 : 0);
}

export function encodePatternCompact(p: Record<string, number[]>, bpm: number): string {
  const data = {
    k: packRow(p.kick), s: packRow(p.snare),
    h: packRow(p.hat), p: packRow(p.perc),
    b: bpm
  };
  return btoa(JSON.stringify(data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

Each row goes from 16 numbers (~32 chars JSON) to one integer (~5 chars JSON). Total payload drops from ~200 chars to ~50 chars after base64.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + src/lib/audio/encoding.ts
- + src/lib/components/SavedPatterns.svelte
- + auto-save effect in engine.svelte.ts
- + src/routes/share/[encoded]/+page.ts and +page.svelte

### Verify it works

- After editing the pattern and refreshing the page, your edits persist
- Saving a named slot adds it to the SavedPatterns sidebar
- Loading a slot replaces the current pattern with the saved one
- Clicking 'share pattern' copies a URL to clipboard; opening that URL loads the pattern

### Compare against the reference

If your version doesn't match: `capstone-reference/src/lib/audio/encoding.ts`, `capstone-reference/src/lib/components/SavedPatterns.svelte`, and the two files in `capstone-reference/src/routes/share/[encoded]/` (one `+page.ts` and one `+page.svelte`).

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why localStorage instead of IndexedDB for pattern storage?**
A: Patterns are tiny (a few hundred bytes) and there are at most a few dozen of them. localStorage's 5MB limit is more than enough; its synchronous API is fine for sub-millisecond operations. IndexedDB is the right choice for *recordings* (L5) — multi-megabyte blobs need the larger capacity and async API.

**Q: What happens if I save 100 slots and hit the storage quota?**
A: The `try/catch` in `persistSlots` swallows the QuotaExceededError silently. The slot is added to `savedPatterns` (in memory) but not persisted; next refresh, it's gone. A more user-friendly version would surface the error ("storage full — delete some patterns before saving more"). The DAW doesn't because the limit is far beyond realistic usage.

**Q: Why a separate `applyPattern` method instead of `loadSlot` for the share route?**
A: `loadSlot` looks up by ID — the share route doesn't have an ID, it has raw data. The two methods do the same thing semantically (replace the current pattern with new data) but take different inputs. Keeping them separate is honest about that.

**Q: Can the share URL accidentally leak something private?**
A: The URL encodes pattern + BPM. Nothing else. No user ID, no auth token, no slot name. If you ever extend the payload to include the user's saved slot name or local preferences, you'd want to be deliberate about not leaking them in shares.

**Q: Why does the share-route preview re-implement the cell grid instead of reusing the Sequencer component?**
A: The Sequencer is interactive (cells are buttons, clicks toggle the engine's pattern). The share preview is read-only and shows the *URL's* pattern, not the engine's. Sharing the component would require a "read-only mode" prop and a "use this pattern, not the engine's" prop — at which point it's almost a different component anyway. The reference keeps them separate; if you wanted to refactor, the shared pieces are the row layout and the cell styling, which a `SequencerView` headless component could own.

## What's next

L5 adds recording. The user clicks REC, hits PLAY, lets the loop run a few bars, hits STOP — and they have a downloadable WebM file of their pattern. The architecture: a `MediaStreamAudioDestinationNode` taps the master gain, `MediaRecorder` collects the chunks, IndexedDB stores the resulting blob (because blobs are too big for localStorage), and a Recordings sidebar lists them with inline playback and download. It's the last L of M6 — after that, you have shipped a working drum machine that's persistent, shareable, and recordable.

<SourcesSection lessonKey="06-capstone-foundations/04-patterns" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
