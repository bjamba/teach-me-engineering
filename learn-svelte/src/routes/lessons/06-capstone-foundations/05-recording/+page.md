<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Recording Output · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-6);">

<LessonHeader
  moduleSlug="06-capstone-foundations"
  lessonSlug="05-recording"
  title="Record Output to a Downloadable File"
  blurb="MediaRecorder taps the master gain. IndexedDB stores the blob. A download trick lands a .webm in the user's filesystem."
/>

## Why this lesson exists

A drum machine that loops in the browser is fun. A drum machine that lets you *export* what you made is shareable — you can drop the file in a chat, in a beat-making subreddit, in a portfolio. This lesson closes that loop. The user clicks REC, presses PLAY, lets the pattern run for a few bars, hits STOP REC, and a downloadable WebM file appears in a sidebar.

The architecture is interesting because it stitches four browser APIs together that rarely show up in the same paragraph: Web Audio's `MediaStreamAudioDestinationNode` (to expose the audio graph as a MediaStream), `MediaRecorder` (to record a stream into Blob chunks), IndexedDB (to persist the multi-megabyte blob across sessions — localStorage's 5MB cap is right at the edge of useful), and the programmatic-anchor-click download trick (because there's no `saveAs` API in browsers). Each is straightforward; combining them into a clean engine method is the work.

By the end of this lesson, M6 is complete. You have shipped a step sequencer that plays in real time, persists across refreshes, shares via URL, and exports to a file. That's a feature-complete capstone — M7 polishes it (effects, mixer, FFT visualizer) but the bones are here.

## Learning objectives

By the end of this lesson you'll be able to:

- Tap a Web Audio graph with `MediaStreamAudioDestinationNode` and connect the master output to it.
- Use `MediaRecorder` to capture a stream into time-sliced Blob chunks.
- Write a minimal IndexedDB wrapper for save/list/delete of objects keyed by `id`.
- Use `URL.createObjectURL` to play a Blob in an `<audio>` element and to download it.
- Use the "programmatic anchor click" trick to trigger a file download.
- Cache object URLs to avoid leaks and per-render regeneration.
- Reach the raw `AudioContext` underneath Tone.js for APIs Tone doesn't wrap.

## Concept 1: How browser-side audio recording works

### The pipeline

The user is hearing audio produced by Tone synths feeding a `Tone.Gain` (the master) that's `.toDestination()`'d to the audio output. To record, we need to insert a *tap* — a parallel node that doesn't change what the user hears but captures the same audio:

```
                       ┌──→ Tone destination (speakers)
master Gain ──────────┤
                       └──→ MediaStreamAudioDestinationNode → MediaRecorder → Blob chunks
```

A `MediaStreamAudioDestinationNode` is a Web Audio node that exposes its input as a `MediaStream` (the same object type the camera/microphone APIs hand you). `MediaRecorder` then accepts that stream and produces time-sliced `Blob` events. On stop, the chunks are concatenated into a final blob.

The connection from master to the media-dest is *additive* — Web Audio nodes can fan out to multiple downstream nodes, and connecting one doesn't disconnect the other. The user still hears the audio; the recorder also gets a copy. No mixing, no level changes, no signal loss.

### What WebM contains

`MediaRecorder` defaults to `audio/webm` in Chromium and Firefox (Safari historically wanted `audio/mp4`, though recent versions support webm). The codec inside the container is usually Opus, which is high-quality and small. A 30-second pattern recording is typically 200-400KB. You could request a specific codec via `mimeType: 'audio/webm; codecs=opus'` but the default works on every supported browser.

WebM doesn't play in QuickTime or Logic without conversion. That's a UX consideration — the user might expect WAV for direct DAW import. The stretch exercise at the end of the lesson covers OfflineAudioContext + WAV encoding if you need that path.

### Common mistakes with the recording pipeline

- **You forget to connect the master to the media-dest, and the recording is silent.** No errors, just an empty WebM. Always `master.connect(mediaDest)` after creating the destination.
- **You re-create the media-dest on every record.** Each create-and-connect adds another tap; after a few cycles, the audio graph has redundant nodes consuming CPU. Create the node once, reuse it.
- **You stop the recorder via `mediaRecorder.stop()` and try to read `recorder.state` synchronously expecting `'inactive'`.** The transition happens after the next `dataavailable` and `stop` events fire. Use the `onstop` callback to finalize.

## Concept 2: Reaching the raw `AudioContext` under Tone

### Why we need it

`MediaStreamAudioDestinationNode` is a Web Audio API class. To create one, you call `ctx.createMediaStreamDestination()` on an `AudioContext` instance. Tone wraps an AudioContext internally but doesn't expose the `createMediaStreamDestination` method on its `Tone.Context` wrapper.

The escape hatch is `Tone.getContext().rawContext`. The `rawContext` is the underlying `AudioContext` (or `BaseAudioContext`); Tone uses it for everything internally. We can grab it and call native Web Audio methods.

```ts
const ctx = (Tone.getContext() as any).rawContext as AudioContext;
this.mediaDest = ctx.createMediaStreamDestination();
this.master.connect(this.mediaDest);
```

The `as any` cast is because `Tone.Context` types `rawContext` as `BaseAudioContext`, which doesn't have `createMediaStreamDestination` in TypeScript's lib types (it's an `AudioContext`-only method). The cast asserts what we know: in practice the rawContext is a full AudioContext. If you're allergic to `as any`, write a typed accessor.

### `this.master.connect(this.mediaDest)`

Tone's `Tone.Gain` has a `.connect()` method that accepts either a Tone node or a raw Web Audio node. Connecting a Tone node to a Web Audio node is a one-way bridge — the audio flows, but you can't manipulate the downstream node via Tone APIs. That's fine; `MediaStreamAudioDestinationNode` is a sink, we never read from it on the audio side.

### Common mistakes with raw-context access

- **You create the destination on a different AudioContext than Tone's.** `ctx.createMediaStreamDestination()` creates a node tied to *that* ctx — connecting it to Tone's master (which is on Tone's ctx) throws "context mismatch." Always use the *same* context Tone is using.
- **You forget the cast and TypeScript complains about `rawContext.createMediaStreamDestination`.** The lib type for `BaseAudioContext` doesn't include it. Cast to `AudioContext`.
- **You access `rawContext` before Tone has started.** `Tone.start()` initializes the context; calling `rawContext` before that returns a stub. Always do recording setup after `ensureReady()` resolves.

## Concept 3: MediaRecorder lifecycle

### The full method

From the reference engine:

```ts
async startRecording() {
  if (this.isRecording) return;
  await this.ensureReady();
  if (!this.master) return;

  if (!this.mediaDest) {
    // MediaStreamAudioDestinationNode lives on the RAW Web Audio context,
    // not the Tone wrapper. Reach through `(context as any).rawContext` to
    // get the underlying AudioContext.
    const ctx = (Tone.getContext() as any).rawContext as AudioContext;
    this.mediaDest = ctx.createMediaStreamDestination();
    this.master.connect(this.mediaDest);
  }

  this.chunks = [];
  this.mediaRecorder = new MediaRecorder(this.mediaDest.stream, {
    mimeType: 'audio/webm'
  });
  this.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) this.chunks.push(e.data);
  };
  this.mediaRecorder.onstop = () => {
    void this.finalizeRecording();
  };
  this.mediaRecorder.start(100); // gather chunks every 100ms
  this.recordStartTime = Date.now();
  this.isRecording = true;
}
```

Step by step:

- **Idempotency guard.** Double-clicking REC shouldn't start a second recording.
- **`ensureReady`** unlocks the audio context if it hasn't been already. REC counts as a user gesture, so this works even if PLAY hasn't been pressed yet.
- **Lazy media-dest creation.** First recording creates the node and connects master. Subsequent recordings reuse. This is the "create the tap once" rule.
- **`this.chunks = []`** — start fresh. Each recording is independent.
- **`new MediaRecorder(stream, options)`** — the recorder owns the chunking logic. `mimeType: 'audio/webm'` is the explicit format; defaulting also works but explicit is honest.
- **`ondataavailable`** fires whenever a chunk is ready. We push non-empty chunks into the array. The `if (e.data.size > 0)` check guards against the occasional empty chunk MediaRecorder emits at start/stop.
- **`onstop`** fires after stopping. We finalize. The `void` is the same "I'm not awaiting this promise" marker as in `toggleTransport` from L3.
- **`start(100)`** — the integer arg is "emit a chunk every 100ms." Without it, you get one giant chunk on stop. Smaller chunks are slightly more overhead but give us flexibility (e.g., a live-streaming version would benefit). 100ms is a reasonable default.
- **`recordStartTime`** is a plain timestamp; we use it on finalize to compute duration.

### The stop method

```ts
stopRecording() {
  if (!this.isRecording || !this.mediaRecorder) return;
  this.mediaRecorder.stop();
  this.isRecording = false;
}
```

`stop()` triggers a final `dataavailable` and then `stop`. We flip `isRecording` immediately so the UI updates; `finalizeRecording` runs async via the `onstop` callback.

### The finalize

```ts
private async finalizeRecording() {
  const blob = new Blob(this.chunks, { type: 'audio/webm' });
  const recording: Recording = {
    id: crypto.randomUUID(),
    blob,
    durationSec: (Date.now() - this.recordStartTime) / 1000,
    recordedAt: new Date().toISOString()
  };
  this.recordings = [recording, ...this.recordings];
  try {
    await idbSave(recording);
  } catch (err) {
    console.warn('Failed to persist recording:', err);
  }
}
```

- **`new Blob(this.chunks, &lbrace; type: 'audio/webm' &rbrace;)`** — concatenate the chunks into one Blob. The type is metadata; it doesn't change the bytes.
- **`crypto.randomUUID()`** — same ID generation as named slots.
- **`durationSec`** — wall-clock duration. Close to (but not exactly) the audio duration; close enough for UI display.
- **`this.recordings = [recording, ...this.recordings]`** — prepend (newest first), replace the array to trigger reactivity. Same pattern as saved slots.
- **`await idbSave(recording)`** — persist to IndexedDB. Wrapped in try/catch because IndexedDB can fail (private browsing mode, storage pressure). On failure we still keep the in-memory entry; the user just loses persistence for that one recording.

### The toggle helper

```ts
toggleRecording() {
  if (this.isRecording) this.stopRecording();
  else void this.startRecording();
}
```

Same pattern as `toggleTransport`. The REC button calls this and doesn't need to know which direction it's going.

### Recording state on the engine

The reactive state added to the engine class for this lesson:

```ts
isRecording = $state(false);
recordings = $state<Recording[]>([]);
```

And the type that the engine exports:

```ts
export type Recording = {
  id: string;
  blob: Blob;
  durationSec: number;
  recordedAt: string;
};
```

Plus the non-reactive plumbing:

```ts
private mediaDest: MediaStreamAudioDestinationNode | null = null;
private mediaRecorder: MediaRecorder | null = null;
private chunks: Blob[] = [];
private recordStartTime = 0;
```

### Common mistakes with MediaRecorder

- **You forget to clear `chunks` between recordings.** The new recording includes all previous chunks. Result: a 10-minute file that plays the same pattern eleven times.
- **You omit `start(100)` and stop the recording before getting any `dataavailable`.** Most browsers emit at least one `dataavailable` on stop, but the timing is delicate. The interval arg makes the behavior predictable.
- **You assume `mediaRecorder.stop()` is synchronous.** It's not — the `onstop` fires after the next event-loop tick. If you want to do something after the file is ready, do it in `onstop` (or in `finalizeRecording`).
- **You forget to flip `isRecording = false` and the UI is stuck in REC state.** Make sure both stopRecording and the underlying error paths reset the flag.

## Concept 4: IndexedDB for blob persistence

### Why not localStorage

localStorage stores strings. To store a Blob you'd `FileReader.readAsDataURL`, get a base64 string, save that. Base64 inflates by 33%, and the 5MB total cap means you fit maybe 10 minutes of recordings. IndexedDB stores Blobs natively (no encoding) and has a multi-GB quota.

The trade-off: IndexedDB's API is famously verbose. We write a small wrapper that covers save/list/delete and ignore everything else IndexedDB supports.

### The wrapper

`src/lib/audio/idb.ts`:

```ts
// A small IndexedDB wrapper for storing recording Blobs.
//
// IndexedDB has a famously verbose API; this 70-line wrapper covers the three
// operations we need (save, list, delete). For more comprehensive use, the
// `idb` library on npm wraps the API in promises with less boilerplate.

import { browser } from '$app/environment';
import type { Recording } from './engine.svelte';

const DB_NAME = 'svelte-daw';
const STORE = 'recordings';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!browser) {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSave(recording: Recording): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbList(): Promise<Recording[]> {
  if (!browser) return [];
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const list = (req.result as Recording[]) ?? [];
      // Newest first.
      list.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

Reading through:

- **`DB_NAME`, `STORE`, `VERSION` constants.** Naming the database and object store. The version number is for schema migrations — bump it when the store shape changes.
- **`open()` returns a Promise.** Wraps the callback-based `indexedDB.open` in a promise interface. Resolves with the database handle.
- **`onupgradeneeded`** fires on first open or when `VERSION` bumps. We create the object store if it doesn't exist. `keyPath: 'id'` tells IndexedDB to use the `id` field of each object as the primary key — so `put(recording)` stores it under `recording.id` without us needing to pass a key separately.
- **`tx.oncomplete`** is the canonical "everything succeeded" signal. We could resolve in `req.onsuccess` (the request itself), but `oncomplete` is stricter — it also waits for the transaction's flush, so the data is durable.
- **`idbList`** sorts newest-first by `recordedAt`. This matches the in-memory `recordings = [newest, ...]` ordering, so reloading after a refresh shows the same order.
- **Browser guards in `open` and `idbList`.** Same SSR-safety story as localStorage — IndexedDB doesn't exist on the server.

### The capstone-reference acknowledges the verbosity

The header comment notes that the `idb` library on npm wraps all of this in less boilerplate. For 70 lines we don't need it; if you're using IndexedDB more heavily, drop the wrapper and use the library.

### Common mistakes with IndexedDB

- **You forget `onupgradeneeded` and the first call fails with "object store not found."** The store has to be created during the upgrade phase; you can't create it later.
- **You resolve on `req.onsuccess` instead of `tx.oncomplete` for writes.** Reads are fine to resolve on success. Writes need `oncomplete` to be durable — Chrome and Firefox might delay the actual flush briefly after success.
- **You open a fresh database connection on every call.** Slightly wasteful but works. A more efficient version caches the IDBDatabase handle in a module-level Promise. The DAW's recording rate is low enough that this doesn't matter.
- **You assume IndexedDB always works.** Private browsing in some configurations blocks it. Try/catch around every call site, fall back to in-memory-only gracefully.

## Concept 5: The loadRecordings + deleteRecording methods

Two more methods on the engine for completeness:

```ts
async loadRecordings() {
  try {
    this.recordings = await idbList();
  } catch (err) {
    console.warn('Failed to load recordings:', err);
  }
}

async deleteRecording(id: string) {
  try {
    await idbDelete(id);
  } catch (err) {
    console.warn('Failed to delete recording:', err);
  }
  this.recordings = this.recordings.filter((r) => r.id !== id);
}
```

`loadRecordings` is called once on first mount of the Recordings component (via `onMount`). It pulls everything from IndexedDB into the reactive array. After that the engine is the source of truth — the sidebar reads from `audio.recordings`, never directly from IndexedDB.

`deleteRecording` runs the IndexedDB delete first, then filters the in-memory list. Even if IndexedDB throws, the in-memory delete still happens — the user gets the immediate visual feedback, and the worst case is the recording reappears on next page load (which surfaces the persistence failure).

### Why not auto-load via `$effect`?

We could have an `$effect` in the constructor that calls `loadRecordings` on mount. We don't because (a) the engine has no notion of "mount," it's just instantiated once at module load, and we'd be triggering an async fetch in a synchronous constructor; (b) the Recordings component is the only consumer, so it makes sense to scope the load to its mount via `onMount`. If a future component also needed recordings, we'd lift it to the engine's constructor.

### Common mistakes with load/delete

- **You forget to filter the in-memory array after delete and the sidebar still shows the deleted entry.** The UI watches `recordings`, which is reactive; you must reassign or filter the array.
- **You await `idbDelete` and skip the filter on error.** Now the user clicks delete, sees nothing happen, gets confused. The filter should happen regardless of IndexedDB success.

## Concept 6: The Recordings sidebar component

### Object URL caching

`URL.createObjectURL(blob)` returns a string that the `<audio>` element can use as `src`. Each call creates a new URL bound to the same blob; the browser keeps the blob alive as long as any of those URLs exist. Without cleanup, you leak memory — the blob can't be GC'd until you revoke the URL.

For an `<audio>` element bound to `urlFor(r)` in markup, the URL gets called on every render. Without caching, you'd create a new URL every time the component re-evaluates the recording row. The reference caches:

```ts
// Cache object URLs per recording so we don't leak / regenerate every render.
const urlCache = new Map<string, string>();

function urlFor(r: Recording) {
  const cached = urlCache.get(r.id);
  if (cached) return cached;
  const url = URL.createObjectURL(r.blob);
  urlCache.set(r.id, url);
  return url;
}
```

One URL per recording, kept alive while the component is mounted. When a recording is deleted, we revoke the cached URL before forgetting it:

```ts
async function remove(r: Recording) {
  const cached = urlCache.get(r.id);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(r.id);
  }
  await audio.deleteRecording(r.id);
}
```

`URL.revokeObjectURL` releases the binding so the blob can be GC'd. Calling it on a URL still being used by an `<audio>` element is undefined behavior; we revoke only when we're about to delete the recording entirely.

### The download trick

There's no `saveAs(blob, filename)` API. To trigger a download, you create an `<a download>` element programmatically, click it, and remove it. The browser sees the `download` attribute on a click and routes the response to the filesystem instead of navigating.

```ts
function download(r: Recording) {
  const url = urlFor(r);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daw-${r.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

Things to notice:

- **`a.download = ...`** — the filename for the saved file. We slice and clean the ISO timestamp into a filesystem-safe string like `daw-2025-04-17-14-30-22.webm`.
- **`r.recordedAt.slice(0, 19)`** — first 19 chars of an ISO string like `2025-04-17T14:30:22.123Z` is `2025-04-17T14:30:22`. We then replace the `T` and `:` with `-` because colons are illegal on Windows filesystems.
- **`document.body.appendChild(a)`** — Firefox historically required the anchor to be in the DOM before clicking. Chrome's permissive but it doesn't hurt to add and remove.
- **`a.click()`** — programmatic activation. Triggers the download.
- **`document.body.removeChild(a)`** — clean up. The DOM doesn't need a stray anchor.
- **We reuse `urlFor(r)`** so we don't create a new object URL just for the download. The cache already has one; use it.

We don't revoke this URL after download because the cache will revoke when the recording is deleted (or when the component unmounts and the cache is GC'd). Leaving it around is fine; the blob stays alive until the user deletes the recording or refreshes.

### The full component

`src/lib/components/Recordings.svelte`:

```svelte
<!--
  Recordings sidebar. Lists captured WebM blobs from IndexedDB, with inline
  preview, download, and delete.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, type Recording } from '$lib/audio/engine.svelte';

  // Cache object URLs per recording so we don't leak / regenerate every render.
  const urlCache = new Map<string, string>();

  function urlFor(r: Recording) {
    const cached = urlCache.get(r.id);
    if (cached) return cached;
    const url = URL.createObjectURL(r.blob);
    urlCache.set(r.id, url);
    return url;
  }

  function download(r: Recording) {
    const url = urlFor(r);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daw-${r.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function remove(r: Recording) {
    const cached = urlCache.get(r.id);
    if (cached) {
      URL.revokeObjectURL(cached);
      urlCache.delete(r.id);
    }
    await audio.deleteRecording(r.id);
  }

  onMount(() => {
    void audio.loadRecordings();
  });
</script>

<aside class="recs">
  <h3>RECORDINGS</h3>

  {#if audio.recordings.length === 0}
    <p class="empty">click ● REC, play your pattern, click ■ to stop</p>
  {:else}
    <ul>
      {#each audio.recordings as r (r.id)}
        <li>
          <div class="rec-meta">
            <span class="when">{new Date(r.recordedAt).toLocaleString()}</span>
            <span class="dur lcd">{r.durationSec.toFixed(1)}s</span>
          </div>
          <audio controls src={urlFor(r)}></audio>
          <div class="rec-actions">
            <button type="button" onclick={() => download(r)}>download</button>
            <button type="button" class="del" onclick={() => remove(r)}>delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</aside>

<style>
  .recs {
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
  .empty {
    padding: var(--sp-3);
    text-align: center;
    color: var(--c-text-faint);
    font-size: var(--fs-sm);
    font-style: italic;
    margin: 0;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  li {
    background: var(--c-bg-code);
    border: 1px solid var(--c-border);
    border-radius: var(--r-md);
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .rec-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--fs-xs);
    color: var(--c-text-muted);
  }
  .when { font-family: var(--font-mono); }
  .dur { color: var(--c-accent); font-size: 0.72rem; }
  audio { width: 100%; height: 32px; }
  .rec-actions { display: flex; gap: 4px; }
  .rec-actions button {
    flex: 1;
    padding: 6px;
    background: var(--c-surface);
    color: var(--c-text);
    border: 1px solid var(--c-border);
    border-radius: var(--r-sm);
    font: inherit;
    font-size: var(--fs-xs);
    cursor: pointer;
  }
  .rec-actions button:hover { border-color: var(--c-border-strong); }
  .rec-actions .del { background: transparent; color: var(--c-text-faint); }
  .rec-actions .del:hover { color: var(--c-error); }
</style>
```

Quick read-through of the markup:

- **The `onMount` calls `loadRecordings`** — kicks off the IndexedDB fetch on first mount. Subsequent navigations reuse the in-memory list.
- **The empty state** is intentionally instructive: "click ● REC, play your pattern, click ■ to stop" tells the user what to do, not just that there's nothing here.
- **`<audio controls src=&lbrace;urlFor(r)&rbrace;>`** — the browser's native audio player. Play, pause, scrub, volume — all free.
- **`new Date(r.recordedAt).toLocaleString()`** — humans want "Apr 17, 2025, 2:30 PM," not "2025-04-17T14:30:22.123Z."
- **`&lbrace;r.durationSec.toFixed(1)&rbrace;s`** — one decimal place. "3.2s" reads cleanly; "3.231s" looks too engineering.

### Common mistakes with the Recordings sidebar

- **You don't cache URLs and the `<audio>` element re-creates its src on every render.** Most browsers handle this gracefully (the audio resets to time 0), but it's wasteful and on slow devices visibly stutters.
- **You revoke the URL while the `<audio>` element is still using it.** The audio playback breaks silently. Only revoke when you're deleting the recording.
- **You skip `onMount` and the sidebar shows empty until the first new recording.** The IndexedDB load only happens when something calls it; onMount is the right hook.

## Concept 7: The REC button on the TransportBar

The TransportBar from L3 grows a REC button. From the reference:

```svelte
<button
  class="rec"
  class:recording={audio.isRecording}
  type="button"
  onclick={() => audio.toggleRecording()}
  disabled={audio.isLoading}
>
  <span class="icon">{audio.isRecording ? '■' : '●'}</span> REC
</button>
```

And the styles:

```css
.rec {
  padding: 10px 18px;
  background: var(--c-surface);
  color: var(--c-error);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  font-weight: 700;
  letter-spacing: 0.1em;
  font-size: var(--fs-xs);
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.rec.recording {
  background: var(--c-error);
  color: white;
  border-color: var(--c-error);
  animation: rec-blink 0.8s ease-in-out infinite;
}
@keyframes rec-blink {
  0%, 100% { box-shadow: 0 0 24px var(--c-error); }
  50% { box-shadow: 0 0 6px var(--c-error); }
}
```

The idle state is "red text on neutral surface" — calm. The active state is "white on red, glowing" — unmistakable. The blink animation is fast (800ms cycle) to feel urgent. The same `c-error` color is used for both the idle text and the active background, so the visual identity is consistent.

The REC button doesn't depend on PLAY — you can record without playing (silence), or start REC and then PLAY, or start PLAY and then REC. The recording captures whatever audio is being produced by the master gain during the REC window. The user-friendly recipe is REC, then PLAY, then a few loops, then STOP REC.

## Putting it together

### Update the page

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import SavedPatterns from '$lib/components/SavedPatterns.svelte';
  import Recordings from '$lib/components/Recordings.svelte';
</script>

<svelte:head><title>SVELTE DAW</title></svelte:head>

<h1>SVELTE <span class="accent">DAW</span></h1>

<TransportBar />
<Sequencer />

<div class="sidebars">
  <SavedPatterns />
  <Recordings />
</div>

<style>
  .sidebars {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-3);
    margin-top: var(--sp-3);
  }
  @media (max-width: 720px) {
    .sidebars { grid-template-columns: 1fr; }
  }
</style>
```

Two sidebars side-by-side on desktop, stacked on mobile. The `.sidebars` grid is the page's secondary layout — the transport+sequencer take the top, sidebars take the bottom.

### The full flow

Open the DAW. Click ● REC. The button turns red and starts blinking. Click PLAY. The pattern starts looping. Listen for two or three bars. Click ■ REC (the button changed shape and label when recording started). The recording finalizes. A new entry appears at the top of the Recordings sidebar with a timestamp and duration. Press play on the embedded `<audio>` — you hear your recording. Click download — a `.webm` file lands in your downloads folder. Refresh the page — the recording is still there (IndexedDB persisted).

That's the end-to-end test. No server, no upload, no infrastructure.

## What M6 has built

Recap of the capstone foundations module:

- **L1: Audio engine and a four-button drum pad.** SvelteKit project setup, Tone.js initialization, four synth definitions (kick/snare/hat/perc), `Tone.start()` on user gesture.
- **L2: The 4×16 step grid.** Pattern data shape (`Record<string, number[]>`), per-cell mutation, per-track color via CSS custom properties, downbeat dots, the ruler.
- **L3: Tone.Sequence and sample-accurate playback.** `Tone.Sequence` for the loop, `Tone.Draw.schedule` for the playhead, the unconditional-read pattern for `$effect`, `$effect.root` for the module singleton, the TransportBar with PLAY/STOP/BPM.
- **L4: Save and share patterns.** localStorage auto-save via `$effect`, named slots with `$state.snapshot` + `structuredClone`, URL-safe base64 encoding, `/share/[encoded]/` dynamic route with `+page.ts` load.
- **L5 (this lesson): Recording output.** `MediaStreamAudioDestinationNode` tap on the master gain, `MediaRecorder` for chunked Blob capture, IndexedDB wrapper for blob persistence, the Recordings sidebar with object-URL caching, the programmatic-anchor download trick.

You have a working drum machine. It plays sample-accurate beats. It persists across refreshes. It travels in URLs. It exports to downloadable files. That's a complete feature set.

M7 adds polish on top: a global effects chain (filter → delay → reverb) with sliders, a per-channel mixer with gain/pan/mute/solo, an FFT visualizer that taps the analyser node we built into the engine, and performance profiling on the grid. None of that changes the architecture — it extends it. The reactive patterns, the engine-as-singleton, the component-views-onto-engine-state model — all stay the same.

## Exercises

### Exercise 1: A "record one bar" mode

**Setup:** the current REC button is open-ended — record until the user stops. Sometimes you want a fixed-length recording (one bar = 16 steps = 2 seconds at 120 BPM).

**What to do:** add an `recordOneBar()` method to the engine. It starts recording, waits for the next playhead-step-0 (so the recording starts on a downbeat), records for exactly 16 steps, then stops. Hook it to a small "1bar" button next to REC.

**Verify by:** click "1bar" while playing. The recording starts on the next bar's first step, captures exactly one bar, stops. The Recordings sidebar shows an entry with duration ≈ 2.0s (at 120 BPM).

**Stretch:** make it configurable — `recordBars(n: number)` with a number input next to the button.

<details>
<summary>Show solution</summary>

```ts
async recordOneBar() {
  if (!this.isPlaying) await this.play();
  await this.ensureReady();

  // Wait for the next step-0, then record for 16 steps.
  await new Promise<void>((resolve) => {
    const check = () => {
      if (this.currentStep === 0) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });

  await this.startRecording();
  const stepDurationMs = (60 / this.bpm) * 250; // 60 seconds / bpm / 4 = quarter; / 4 = 16th
  setTimeout(() => this.stopRecording(), stepDurationMs * 16);
}
```

The polling rAF loop waits for the playhead to reach step 0. The setTimeout uses BPM math to know how long 16 steps will take (`(60/bpm)*1000 / 4` ms per 16th note). At 120 BPM that's 125ms × 16 = 2000ms.

A cleaner version would use `Tone.Transport.scheduleOnce` to align both the start and stop to the audio clock instead of wall-clock setTimeout, but the visible result is the same within a few ms.

</details>

### Exercise 2: Filename templating

**Setup:** the download filename is `daw-2025-04-17-14-30-22.webm`. Useful but generic. If the user has loaded a named slot, the filename could include the slot's name.

**What to do:** if the active recording came from a session where a named slot was last loaded, include the slot's name in the filename: `daw-mybeat-2025-04-17-14-30-22.webm`.

**Verify by:** load a slot named "test pattern", record, download. Filename is `daw-test-pattern-2025-04-17-14-30-22.webm` (spaces replaced with hyphens).

**Stretch:** allow the user to set a custom filename prefix in a settings panel.

<details>
<summary>Show solution</summary>

```ts
// engine.svelte.ts — track the last-loaded slot
lastLoadedSlotName = $state<string | null>(null);

loadSlot(id: string) {
  const entry = this.savedPatterns.find((p) => p.id === id);
  if (!entry) return;
  this.pattern = structuredClone(entry.pattern);
  this.bpm = entry.bpm;
  this.lastLoadedSlotName = entry.name;
}

// Reset on any cell edit
toggleCell(trackId: string, step: number) {
  this.pattern[trackId][step] = this.pattern[trackId][step] ? 0 : 1;
  this.lastLoadedSlotName = null;  // pattern diverged
}
```

```ts
// Recordings.svelte
function download(r: Recording) {
  const url = urlFor(r);
  const a = document.createElement('a');
  const slug = audio.lastLoadedSlotName?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? '';
  const prefix = slug ? `daw-${slug}` : 'daw';
  a.href = url;
  a.download = `${prefix}-${r.recordedAt.slice(0, 19).replace(/[:T]/g, '-')}.webm`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

The slug-ification (`[^a-z0-9]+/g → '-'`) keeps the filename filesystem-safe. The nullish coalescing means "use just 'daw' if there's no slot name."

</details>

### Exercise 3: Display a running timer during recording

**Setup:** the REC button blinks but the user doesn't know how long they've been recording.

**What to do:** show a live timer next to the REC button: "0:03.2", updating ~10× per second. When not recording, show nothing or a static "00:00".

**Verify by:** click REC. The timer counts up while recording. Click STOP. The timer freezes briefly then resets when REC is clicked next.

**Stretch:** also show the timer in the page title so it's visible when the tab is in the background.

<details>
<summary>Show solution</summary>

```svelte
<!-- in TransportBar.svelte -->
<script lang="ts">
  // ... existing
  let now = $state(Date.now());

  $effect(() => {
    if (!audio.isRecording) return;
    const interval = setInterval(() => { now = Date.now(); }, 100);
    return () => clearInterval(interval);
  });

  let elapsed = $derived(audio.isRecording ? ((now - audio.recordStartTime) / 1000) : 0);
  let display = $derived(() => {
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed) % 60;
    const t = Math.floor((elapsed * 10) % 10);
    return `${m}:${s.toString().padStart(2, '0')}.${t}`;
  });
</script>

{#if audio.isRecording}
  <span class="rec-timer lcd">{display}</span>
{/if}
```

You'd also need to expose `recordStartTime` as `$state` (currently private). Refactor it. The `$effect` returns a cleanup function (the `clearInterval`); Svelte runs the cleanup when deps change or the component unmounts.

</details>

### Exercise 4 (stretch): Export to WAV instead of WebM

**Setup:** WebM doesn't import directly into Logic, GarageBand, or older DAWs. WAV does.

**What to do:** add a `recordToWav()` flow that uses `OfflineAudioContext` instead of MediaRecorder. Render the pattern to an AudioBuffer offline (faster than real-time), encode the buffer to WAV with the `audiobuffer-to-wav` npm package, and offer as download.

**Verify by:** click "export WAV" — a file lands. Open it in Audacity or Logic. The pattern plays correctly.

**Stretch:** add a "render to MP3" using `lamejs`. (Larger lib, but MP3 is the most universally playable format.)

<details>
<summary>Show solution</summary>

Sketch (full implementation is a lesson in itself):

```ts
import * as Tone from 'tone';
import toWav from 'audiobuffer-to-wav';

async function exportWav(bars: number = 1) {
  const stepsPerBar = 16;
  const totalSteps = bars * stepsPerBar;
  const stepDurationSec = 60 / audio.bpm / 4;
  const totalDurationSec = totalSteps * stepDurationSec;

  // Render at 44.1kHz stereo
  const offlineCtx = new OfflineAudioContext(2, 44100 * totalDurationSec, 44100);
  // Re-build the synth graph inside the offline context...
  // (this requires Tone.Offline or manual graph reconstruction)

  const buffer = await offlineCtx.startRendering();
  const wav = toWav(buffer);
  const blob = new Blob([wav], { type: 'audio/wav' });
  // download via the same anchor trick
}
```

The hard part is recreating the engine's signal graph inside the offline context. `Tone.Offline` provides a helper but you have to thread the pattern data through. Skip this exercise unless you specifically need WAV.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- + src/lib/audio/idb.ts
- + recorder methods in engine.svelte.ts
- + src/lib/components/Recordings.svelte

### Verify it works

- Clicking ● REC starts recording; the button shows ■ REC with a red blink
- Pressing STOP REC adds a new entry to the Recordings sidebar
- The recorded audio element plays back what you just recorded
- Clicking 'download' saves a .webm file to your downloads folder
- Reloading the page keeps the previous recordings (IndexedDB persistence)

### Compare against the reference

If your version doesn't match: capstone-reference/src/lib/audio/idb.ts, src/lib/components/Recordings.svelte, and the recorder section of engine.svelte.ts

The reference project lives at `learn-svelte/capstone-reference/` in this repo. Run it locally — `cd capstone-reference && npm install && npm run dev` — to see a verified working version. If your DAW doesn't match the reference behaviorally, the bug is in your code, not the framework.

## Common questions

**Q: Why WebM specifically? Could I record to WAV directly?**
A: `MediaRecorder` produces compressed audio (typically Opus inside WebM). It doesn't expose a WAV mode. To get WAV, you bypass `MediaRecorder` entirely and use `OfflineAudioContext` to render the audio graph faster-than-real-time into an `AudioBuffer`, then encode the buffer to WAV with a library. That's an order of magnitude more code; this lesson uses `MediaRecorder` because it works in 30 lines.

**Q: What's the maximum recording length?**
A: Practically, IndexedDB's quota (multi-GB on desktop, hundreds of MB on mobile) limits the total stored recordings. Per-recording, `MediaRecorder` is fine for hours. The bottleneck is usually the user — they want short loops, not multi-minute renders.

**Q: Does the recording capture effects (when M7 adds them)?**
A: Yes. The `master` Gain is the very end of the chain (after filter/delay/reverb). The media-dest is connected to master. Whatever the user hears, the recording captures.

**Q: Can I record from the microphone instead of the synths?**
A: Yes — replace `master.connect(mediaDest)` with a `Tone.UserMedia()` source. The rest of the pipeline is identical. You'd then have a separate "input meter" component for level monitoring.

**Q: Why isn't `mediaRecorder.start(100)` documented prominently in MDN's MediaRecorder examples?**
A: It's documented but easy to miss because the function works without arguments (the default is "emit one chunk on stop"). The argument is the *timeslice* — millisecond interval between `dataavailable` events. Smaller numbers give more chunks (slightly more overhead, more responsive flush); larger numbers give fewer chunks (less overhead, single chunk on stop is the limit). 100ms is a reasonable middle ground.

**Q: Are object URLs the same as `data:` URLs?**
A: No. `data:` URLs encode the entire blob in the URL string (base64-inflated), which makes them huge for audio. `URL.createObjectURL(blob)` returns a small `blob:` URL that's a pointer to the in-memory blob. The browser resolves it on access. Object URLs are the right tool for binary data.

## What's next

M7 is the polish module. You'll add a global effects chain (low-pass filter, feedback delay, reverb) with sliders that ramp the parameter changes to avoid zipper noise. A per-channel mixer with gain, pan, mute, and solo. An FFT visualizer that taps the analyser node and renders the spectrum as animated bars. Performance profiling to confirm the per-cell reactivity holds up at 60fps with a busy pattern. The architecture from M6 — engine-as-singleton with reactive state, components as views — extends naturally. You're not refactoring; you're building on.

<SourcesSection lessonKey="06-capstone-foundations/05-recording" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
