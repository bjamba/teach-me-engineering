<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Logging a Session · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-5);">

<LessonHeader
  moduleSlug="05-practice-journal"
  lessonSlug="03-form-actions"
  title="Logging a Practice Session"
  blurb="Forms that work without JavaScript. Smoother with it. SvelteKit's actions pattern."
/>

## Why this lesson exists

The journal can read data but not write it. To get a song in, you've been opening the browser console. That's not an app — that's a debug tool. This lesson adds a real form: pick a song, log how many minutes you practiced, add notes, save it, see it appear.

Two paths here, and the choice matters. The "right" SvelteKit way is *form actions* — server-handled form submissions that work without JavaScript and get progressively enhanced when JavaScript is available. That's a legitimately great pattern when you have a backend. But our journal is fully client-side: data lives in localStorage, there is no server to submit to. The server pattern doesn't make sense here.

So we use a regular Svelte form with an `onsubmit` handler. We get the data into localStorage, we invalidate the loads so the rest of the app sees fresh state, we navigate back to where the user came from. Then we look at what the server-action pattern *would* look like, because the next backend you build will use it, and you should be able to spot the difference. By the end of the lesson you know both, and you know when each fits.

## Learning objectives

By the end of this lesson you'll be able to:

- Build a Svelte 5 form with `bind:value` on inputs, `onsubmit` on the form, and validated submission.
- Persist data to localStorage via the helpers from L2 and trigger a load re-run with `invalidateAll()`.
- Navigate after submit using `goto()`, with a disabled-during-submit pattern.
- Describe the SvelteKit server-action pattern (`+page.server.ts` exports `actions`, `use:enhance`, `fail` and `redirect`) and when to reach for it.
- Choose between client `onsubmit` and server form actions based on where your data lives.

## Concept 1: Forms in Svelte 5 — the basics

### What it is

A form in Svelte is, mechanically, a `<form>` element with input children. The inputs are bound to component state with `bind:value`. Submission is handled by an `onsubmit` event handler on the form. There's no Formik, no react-hook-form, no schema-resolver-adapter wrapper layer. You wire inputs to state, you handle submit, you save.

The interesting Svelte 5 details are small. `bind:value` works for text inputs, textareas, selects, and number inputs (where it auto-coerces to a number if you initialize state with a number). `bind:checked` for checkboxes. `bind:group` for radio groups and multi-checkbox groups. `onsubmit` is just an event handler — call `e.preventDefault()` to stop the browser's default submit, then do your custom logic.

Forms get HTML-level validation for free. `<input required>`, `<input type="email">`, `<input min="1">` — the browser refuses to submit if validation fails and shows its native validation UI. You can override or augment this in JS, but for simple forms you don't have to.

### Worked example: the session-log form

`src/routes/sessions/new/+page.svelte`:

```svelte
<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { getSongs, saveSession } from '$lib/data.svelte';

  let songs = $state(getSongs());
  let songId = $state(songs[0]?.id ?? '');
  let date = $state(new Date().toISOString().slice(0, 10));
  let minutes = $state(15);
  let notes = $state('');
  let submitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!songId) return;
    submitting = true;
    saveSession({
      id: crypto.randomUUID(),
      songId,
      date: new Date(date).toISOString(),
      minutes,
      notes
    });
    await invalidateAll();
    goto('/');
  }
</script>

<h1>Log a Session</h1>

{#if songs.length === 0}
  <p>You need to add a song before you can log sessions. <a href="/songs/new">Add one</a></p>
{:else}
  <form onsubmit={handleSubmit}>
    <label>
      Song
      <select bind:value={songId} required>
        {#each songs as s (s.id)}
          <option value={s.id}>{s.title} — {s.artist}</option>
        {/each}
      </select>
    </label>

    <label>
      Date
      <input type="date" bind:value={date} required />
    </label>

    <label>
      Minutes
      <input type="number" min="1" max="600" bind:value={minutes} required />
    </label>

    <label>
      Notes <span class="optional">(optional)</span>
      <textarea bind:value={notes} placeholder="what you worked on"></textarea>
    </label>

    <button type="submit" disabled={submitting}>
      {submitting ? 'saving...' : 'log session'}
    </button>
  </form>
{/if}

<style>
  form { display: flex; flex-direction: column; gap: 16px; max-width: 500px; }
  label { display: flex; flex-direction: column; gap: 6px; color: #9ea3b8; font-size: 14px; }
  .optional { color: #5e6378; font-size: 12px; }
  input, select, textarea {
    padding: 10px; background: #11131a; color: #ecedf3;
    border: 1px solid #262a3a; border-radius: 8px; font: inherit;
  }
  textarea { min-height: 80px; resize: vertical; }
  button {
    padding: 12px 24px; background: #f5b100; color: #14151c;
    border: 0; border-radius: 8px; font: inherit; font-weight: 700;
    cursor: pointer; align-self: flex-start;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

Walking through it:

1. **`let songs = $state(getSongs())`** reads the song list at mount and stores it in component state. We need this for the `<select>` options. We could equivalently read it from a `+page.ts` load — that'd be more conventional — but reading directly here keeps the example focused on form handling.
2. **`let songId = $state(songs[0]?.id ?? '')`** seeds the select with the first song (or empty). `bind:value` on the `<select>` keeps state and DOM in sync.
3. **`let date = $state(new Date().toISOString().slice(0, 10))`** prepopulates the date input with today, formatted as `YYYY-MM-DD` (the format `<input type="date">` expects).
4. **`let minutes = $state(15)`** — a number, not a string. `bind:value` on `type="number"` will coerce automatically.
5. **`let submitting = $state(false)`** is the in-flight flag. The button is disabled and shows "saving..." while it's true.
6. **`handleSubmit`** prevents the default form submit, sanity-checks `songId`, sets the flag, calls `saveSession` with a UUID, awaits `invalidateAll()` so any loads that read sessions re-run, then `goto('/')` to the dashboard.

Try it. Click "+ Log Session" in the nav. Fill in the form. Hit "log session". You return to the dashboard, and (if you did Exercise 1 from L2) you see the new session in the recent list. The total count in the layout header has gone up by one.

### Variations

**Without `bind:value`, the controlled-input pattern.** You can manage inputs without `bind:value` by listening for `oninput` and writing to state explicitly. `bind:value` is just sugar for the common case. The verbose version:

```svelte
<input value={minutes} oninput={(e) => (minutes = +e.target.value)} />
```

99% of the time `bind:value` is what you want. The verbose version is useful when you need to *transform* the value during input (e.g., uppercase a code, strip non-digits).

**Multiple submit handlers.** A `<form>` can have multiple `<button type="submit">` elements with different `name`/`value`. In a non-JS context, the button that triggers submit reports its name to the form-data. In a JS handler, you can read `e.submitter.name` to branch. Useful for "Save" vs "Save and continue" patterns.

**Using a native form action instead of a JS handler.** `<form action="/api/sessions" method="POST">` makes the browser send the form data as a real POST without JS. The server handles it, redirects, the user lands wherever. This is the no-JS path we'll discuss in Concept 3.

### Common mistakes

- **Forgetting `e.preventDefault()`.** Without it, the browser does its default submit (a navigation to the form's action URL). The page reloads, your handler half-runs, the user sees a broken state. Always preventDefault in JS-handled forms.
- **Forgetting to disable the button while submitting.** A second click while the first save is still running creates duplicate data. Disable the button (`disabled=&lbrace;submitting&rbrace;`) the moment the handler starts.
- **Reading from `e.target.elements`.** Works, but tedious — you have to know each input's `name` and parse types. With `bind:value`, the values are already in your reactive state. Use the bindings.
- **Bind to a string for `type="number"`.** `let minutes = $state('15')` (string) then `<input type="number" bind:value=&lbrace;minutes&rbrace; />` — the bind works but values stay strings, and `15 + 5` becomes `'155'`. Initialize as a number.
- **Re-reading `getSongs()` after save without invalidation.** The local `songs` state in the form component is a snapshot from mount. If you save a new song from another tab, this component still shows the old list until it remounts. For most apps that's fine — the form is short-lived.

### TS notes

The submit handler's event is `SubmitEvent`. With Svelte 5's new event syntax, the type isn't auto-inferred on `onsubmit` props (yet — varies by version), so you may want to annotate: `(e: SubmitEvent) => ...`. For `e.target` and `e.submitter`, cast to `HTMLFormElement` and `HTMLButtonElement` if you need typed access.

## Concept 2: After submit — invalidation and navigation

### What it is

A save isn't complete just because the data is written. Other parts of the UI might be showing stale views of that data — the songs count in the layout, the recent sessions on the dashboard, the song detail page's sessions list. If you don't tell SvelteKit to re-fetch, those views stay stale until the next full navigation.

`invalidateAll()` from `$app/navigation` reruns every active load function on the current page and layout. After calling it, the next render sees fresh data. It returns a promise; if you `await` it before navigating, the destination page renders with the new data already in place — no flash of stale content.

`goto(url)` then navigates. The route changes, the new page's load runs (with already-fresh data thanks to the invalidation), and the user lands on the new page.

Order matters slightly. `saveSession()` first (writes the data). `invalidateAll()` second (re-runs loads). `goto()` third (navigates). The user experience is: button click, brief "saving" state, instant navigation to the dashboard with the new session visible.

### Worked example: the save-and-navigate flow

This is what `handleSubmit` is doing:

```js
async function handleSubmit(e) {
  e.preventDefault();
  if (!songId) return;
  submitting = true;
  saveSession({ /* ... */ });   // 1. persist
  await invalidateAll();         // 2. refresh loads (await so the next page is fresh)
  goto('/');                     // 3. navigate
}
```

A subtle thing: we don't `await goto`. The function returns. `submitting` stays true until the component unmounts. That's intentional — once we've navigated, this component is gone, the state doesn't matter. If for some reason `goto` fails (rare, but possible if the destination throws from its load), you might want to set `submitting = false` in a `try/finally`. For a small app, the simpler version is fine.

The `await invalidateAll()` is important. Without `await`, the call fires but doesn't block — `goto` runs immediately, the dashboard tries to render with the old (now-invalidated) loads, and you get a brief flicker as the loads complete and re-render. With `await`, the loads complete first, then we navigate, and the dashboard renders correctly on first paint.

### Variations

**Stay on the page, just refresh the view.** Replace `goto('/')` with nothing — invalidate, let the user keep filling in another session. Useful for batch-entry workflows ("I practiced four songs today, log them all without leaving").

**Optimistic update.** Mutate local state before the save returns. For network-backed saves this hides latency; for localStorage saves it's not needed (writes are synchronous). The pattern: update local state immediately, kick off the save in the background, if it fails roll back.

**`invalidate('app:sessions')` instead of `invalidateAll()`.** If you've tagged your loads with `depends('app:sessions')`, you can re-run just the loads that care about sessions, leaving unrelated loads alone. Saves some work in apps with many independent data sources.

### Common mistakes

- **Skipping invalidation.** Save, navigate, the destination page renders with cached pre-save data. User sees the new session "missing" until they refresh. Add the `invalidateAll()` call.
- **`invalidateAll()` without `await`.** The dashboard renders before the loads finish, flickers, then settles. Hard to debug because it's a timing issue, not a logic error. Always `await`.
- **Navigating before saving.** If you `goto('/')` before `saveSession()` returns, the form component unmounts while the save is pending. For synchronous localStorage saves this is fine; for async saves you'd lose the result if you don't await first.
- **Calling `invalidateAll()` on every keystroke.** It's not free — every load re-runs. Only call after the *outcome* is permanent. (You'd probably only do this by accident anyway, but worth flagging.)

### TS notes

`invalidateAll: () => Promise<void>`. `goto: (url: string | URL, opts?: GotoOptions) => Promise<void>`. Both from `'$app/navigation'`.

## Concept 3: The SvelteKit server-action pattern

### What it is

When you have a backend, the SvelteKit-idiomatic way to handle a form is *form actions*. The route has a `+page.server.ts` that exports an `actions` object. Each named action is an async function that receives `&lbrace; request, locals, cookies &rbrace;` and returns a result. The form points back to the same route with `method="POST"` and SvelteKit routes the submission to the action.

This is markedly different from a SPA's "fetch from JS" pattern. Two big properties fall out of it:

1. **Works without JavaScript.** If JS hasn't loaded (slow network), or it crashed, or the user has it disabled, the browser does the default submit — a real HTTP POST. The server runs the action, returns a redirect, the browser follows. The user sees a working form. This is the "progressive enhancement" part.
2. **Upgrades to AJAX with `use:enhance`.** When JS *is* available, the `use:enhance` action from `'$app/forms'` intercepts the submission and turns it into a `fetch`. The result updates the page in place, no reload. Same backend action, smoother user experience.

For an app with a real backend — even just a hobby project with a SQLite database — this is genuinely the best form pattern available in any framework. It collapses two normally-separate concerns (the no-JS path and the AJAX path) into one declaration.

### Worked example: what the journal would look like with a backend

Hypothetical. If our journal had a database, `src/routes/sessions/new/+page.server.ts` might look like:

```ts
import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const songId = data.get('songId')?.toString();
    const date = data.get('date')?.toString();
    const minutes = parseInt(data.get('minutes')?.toString() ?? '');
    const notes = data.get('notes')?.toString() ?? '';

    if (!songId || !date || !minutes || minutes < 1) {
      return fail(400, {
        error: 'All fields required',
        values: { songId, date, minutes, notes }
      });
    }

    await db.sessions.create({
      songId,
      date,
      minutes,
      notes,
      userId: locals.user.id
    });

    throw redirect(303, '/');
  }
};
```

And the form:

```svelte
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="songId" value={form?.values?.songId ?? ''} />
  <input name="date" type="date" value={form?.values?.date ?? ''} />
  <input name="minutes" type="number" value={form?.values?.minutes ?? 15} />
  <textarea name="notes">{form?.values?.notes ?? ''}</textarea>
  <button type="submit">log</button>

  {#if form?.error}
    <p class="error">{form.error}</p>
  {/if}
</form>
```

Things to notice:

- **`method="POST"` and no JS handler.** The browser will POST to the current URL (`/sessions/new`) by default. SvelteKit's router matches that to the `default` action and runs it.
- **`use:enhance`.** The Svelte action that upgrades the submission to AJAX. Without it, the form still works — it just causes a full page nav for the redirect. With it, the submission is a `fetch` and the result populates the `form` prop without leaving the page.
- **`fail(400, ...)` for validation errors.** This returns a "this didn't work, here's why" response. The `form` prop on the page gets the data, the page re-renders with the error displayed and the user's values preserved.
- **`redirect(303, '/')` for success.** Server-side redirect — the browser (or enhanced fetch) follows it to the destination.
- **The `form` prop.** SvelteKit passes the most recent action result as a prop. After a successful submit it's the redirect (you've navigated away; doesn't matter). After a failed submit it's the `fail` payload — pre-filled values, error message.

This is more code than the localStorage version. The payoff is real: no-JS users still log sessions, the server can validate authoritatively (clients can lie), the data is on a real backend you control.

### Variations

**Named actions for multiple submit types.** Instead of `default`, name your actions:

```ts
export const actions = {
  create: async ({ request }) => { /* ... */ },
  delete: async ({ request }) => { /* ... */ }
};
```

And in the form: `<form method="POST" action="?/create">` or `<form method="POST" action="?/delete">`. SvelteKit routes based on the `?/name` query.

**`use:enhance` with a custom callback.** You can pass a function to `enhance` that runs before submission and returns a function that runs after, giving you hooks for showing optimistic UI or running side effects:

```svelte
<form method="POST" use:enhance={({ formData }) => {
  // pre-submit: e.g., disable button manually
  return async ({ result, update }) => {
    // post-submit: result is the action's return value
    await update();
  };
}}>
```

**Direct `applyAction(result)`.** For complete control, you can call `fetch` yourself, get the result, and call `applyAction` to manually update the form prop. Almost never needed — the default `use:enhance` is usually what you want.

### Common mistakes

- **Putting actions in `+page.ts` instead of `+page.server.ts`.** Actions only live in `+page.server.ts`. Putting them elsewhere does nothing.
- **Forgetting `method="POST"`.** Without it, the browser does a GET, which doesn't match the action. Symptom: no action runs; the URL changes to `?songId=...&minutes=...`.
- **Throwing a non-redirect error and expecting it to be `form`.** `throw error(500, 'oops')` triggers the error page. `return fail(400, ...)` populates the `form` prop. They're different mechanisms; use `fail` for recoverable validation errors.
- **Trying to access localStorage in a server action.** Server actions run on the server. Browser APIs are not available. (This is exactly why we're using a client handler for our journal.)
- **Re-rendering causes input focus loss in non-enhanced forms.** Without `use:enhance`, every submit is a full page nav. Inputs lose focus, scroll position resets. With `use:enhance`, the page updates in place. This is one of the reasons to always use `enhance` for interactive forms.

### TS notes

Action types live in `'./$types'`: `Actions` and `PageServerLoad`. `fail` and `redirect` are typed properly — `fail(400, data)` returns an `ActionFailure<typeof data>` and the `form` prop's type unions all possible failures plus undefined.

## Concept 4: Picking a pattern

### What it is

Two patterns: client `onsubmit`, and server form actions. The choice is structural — it follows from where your data lives and how the user gets to it.

| Situation | Pattern | Why |
|---|---|---|
| Data in localStorage, no backend | Client `onsubmit` | Server has nothing to do; localStorage requires JS anyway. |
| Data in a database the server owns | Server actions + `use:enhance` | No-JS fallback, server-side validation, secure secrets. |
| Data in a third-party API hit from the browser with a public key | Client `onsubmit` (or server proxy) | Either works; server proxy lets you hide the key. |
| Data in a third-party API with a secret key | Server actions | Secret can't go in the client bundle. |
| Hybrid: optimistic UI, persist to server | Client handler that triggers a server action | Get instant feedback and eventual consistency. |

Our journal is the first row — fully client-side, localStorage-backed. The client handler is the right tool. When you eventually graduate to a backend (or build the DAW capstone with a real persistence layer), you'll switch to server actions, and the muscle memory from this lesson (forms with `bind:value`, validating on submit, post-save invalidation) transfers cleanly.

### Variations

**Per-form choice within the same app.** Nothing forces you to commit one or the other for an entire app. A login form might use server actions (you really want server-side validation). A "save draft" autosave might use a client handler hitting a JSON endpoint (you want very low overhead per save). Pick per form.

**Endpoints (`+server.ts`) as a middle ground.** A server endpoint at `src/routes/api/sessions/+server.ts` exports `POST` (or other methods) and returns JSON. You hit it with `fetch` from a client handler. This is the "REST API" pattern. It's more code than form actions but works for non-form clients (mobile apps, scripts). Use when you need the API to be consumable by things other than your own forms.

### Common mistakes

- **Reaching for server actions when there's no server.** Don't. The localStorage app doesn't need them. Adding a `+page.server.ts` to a fully static app just means more code that does nothing.
- **Reaching for client handlers when you have a server.** Means you're writing fetch calls and re-implementing the no-JS fallback. Use the framework feature; the cost is low and the benefit is real.
- **Mixing patterns inconsistently across the app.** Half your forms are server actions with `use:enhance` and half are bespoke `onsubmit` handlers. The codebase gets harder to navigate. Pick a default and only deviate when there's a clear reason.

### TS notes

For the client `onsubmit` pattern, no SvelteKit-specific types are involved beyond the `goto`/`invalidateAll` signatures. For server actions, lean on `Actions` from `'./$types'`.

## Putting it together

Run the dev server. From the dashboard, click "+ Log Session". You're at `/sessions/new`. The form shows the songs you've added (or the "you need a song first" empty state if none). Fill it in, hit "log session". You're back at the dashboard, with the new session in the recent list (if you wired up that exercise from L2) and the count in the layout incremented.

The whole flow took one component, one form, one helper, and four lines of submit handler. No framework gymnastics — `bind:value` for state, `onsubmit` for save, `invalidateAll` to refresh, `goto` to navigate.

If you also build an "Add Song" form (Exercise 1 below), the journal becomes fully usable — every operation has a UI, no console required.

## Exercises

### Exercise 1: Add a "New Song" form

**Setup:** The journal can log sessions but has no UI for adding songs. The songs list links to `/songs/new` but that route doesn't exist.

**What to do:** create `src/routes/songs/new/+page.svelte` with a form for `title` and `artist`. On submit, call `saveSong(&lbrace; id: crypto.randomUUID(), title, artist, addedAt: new Date().toISOString() &rbrace;)`, `await invalidateAll()`, then `goto('/songs')`. Disable the button while saving. Add a "+ add song" link to the empty state on the songs list page.

**Verify by:** visiting `/songs/new` shows the form. Submitting creates the song; you land on `/songs` and see it in the list; the layout count goes up.

<details>
<summary>Show solution</summary>

```svelte
<!-- src/routes/songs/new/+page.svelte -->
<script>
  import { goto, invalidateAll } from '$app/navigation';
  import { saveSong } from '$lib/data.svelte';

  let title = $state('');
  let artist = $state('');
  let submitting = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) return;
    submitting = true;
    saveSong({
      id: crypto.randomUUID(),
      title: title.trim(),
      artist: artist.trim(),
      addedAt: new Date().toISOString()
    });
    await invalidateAll();
    goto('/songs');
  }
</script>

<h1>Add a Song</h1>

<form onsubmit={handleSubmit}>
  <label>
    Title
    <input bind:value={title} required />
  </label>
  <label>
    Artist
    <input bind:value={artist} required />
  </label>
  <button type="submit" disabled={submitting}>
    {submitting ? 'saving...' : 'add song'}
  </button>
</form>

<style>
  form { display: flex; flex-direction: column; gap: 16px; max-width: 500px; }
  label { display: flex; flex-direction: column; gap: 6px; color: #9ea3b8; font-size: 14px; }
  input {
    padding: 10px; background: #11131a; color: #ecedf3;
    border: 1px solid #262a3a; border-radius: 8px; font: inherit;
  }
  button {
    padding: 12px 24px; background: #f5b100; color: #14151c;
    border: 0; border-radius: 8px; font: inherit; font-weight: 700;
    cursor: pointer; align-self: flex-start;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

The pattern is identical to the sessions form: bind inputs, handle submit, save, invalidate, navigate. Now there's symmetry across the whole app — every entity has a list, a detail (for songs), and a create form.

</details>

### Exercise 2: Inline validation message

**Setup:** The sessions form does basic validation (`required`, `min`, `max` attributes). The browser shows native messages.

**What to do:** add a custom validation check — if `minutes < 1` OR `minutes > 600` at submit time, show an inline error message above the button instead of saving. Keep the form state intact (the user shouldn't lose their entries). Use a `$state` for the error message; clear it when the user changes any input.

**Verify by:** typing 0 in minutes and submitting shows "Minutes must be between 1 and 600" without saving. Typing a valid number clears the error.

<details>
<summary>Show solution</summary>

```svelte
<!-- inside the existing sessions/new/+page.svelte -->
<script>
  // ... existing imports and state ...
  let errorMsg = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    errorMsg = '';
    if (!songId) return;
    if (minutes < 1 || minutes > 600) {
      errorMsg = 'Minutes must be between 1 and 600.';
      return;
    }
    submitting = true;
    saveSession({ /* ... */ });
    await invalidateAll();
    goto('/');
  }
</script>

<!-- in the markup, before the submit button: -->
{#if errorMsg}<p class="error">{errorMsg}</p>{/if}

<!-- in <style>: -->
.error { color: #ff6b6b; font-size: 14px; margin: 0; }
```

To clear the error when an input changes, you could add `oninput=&lbrace;() => errorMsg = ''&rbrace;` to the relevant inputs, or use a `$derived` that recomputes validity. The simple version above resets `errorMsg = ''` at the start of every submit, which covers most cases.

</details>

### Exercise 3: Reset the form after submit (and stay on the page)

**Setup:** After save, the form navigates to `/`.

**What to do:** add a "Save and add another" button next to "log session". When that's clicked, save the session, invalidate loads, but DON'T navigate — instead, reset `notes` to `''` and `minutes` to `15` (keep `songId` and `date` so batch entry is fast), and re-fetch `songs` from `getSongs()` so any newly-added songs appear in the dropdown.

**Verify by:** clicking "Save and add another" saves the entry; the form clears notes; the song count in the layout goes up; you can log a second session without leaving the page.

<details>
<summary>Show solution</summary>

```svelte
<!-- inside the existing sessions/new/+page.svelte -->
<script>
  // ... existing state ...
  let stayAfterSave = $state(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!songId) return;
    submitting = true;
    saveSession({ /* ... */ });
    await invalidateAll();
    if (stayAfterSave) {
      // reset partial state
      notes = '';
      minutes = 15;
      songs = getSongs();
      submitting = false;
      stayAfterSave = false;
    } else {
      goto('/');
    }
  }
</script>

<!-- replace single button with two: -->
<div class="button-row">
  <button type="submit" disabled={submitting} onclick={() => stayAfterSave = false}>
    {submitting ? 'saving...' : 'log session'}
  </button>
  <button type="submit" disabled={submitting} onclick={() => stayAfterSave = true} class="secondary">
    save and add another
  </button>
</div>
```

Two submit buttons in the same form, distinguished by which one was clicked. The `onclick` sets the `stayAfterSave` flag, then the form's own `onsubmit` reads it to decide whether to navigate. Both buttons are `type="submit"` so they trigger the form's submit handler (with HTML validation intact).

</details>

### Exercise 4: Delete a session from the song detail page

**Setup:** The song detail page (`/songs/[id]`) lists the song's sessions. There's no way to delete one.

**What to do:** add a `deleteSession(sessionId)` helper to `src/lib/data.svelte.ts`. On the detail page, add a small "delete" button next to each session that calls the helper, awaits `invalidateAll()`, and the list updates. Confirm with `if (!confirm('Delete this session?')) return;` so misclicks don't destroy data.

**Verify by:** clicking delete (and confirming) removes the session; the page updates without a full refresh; the layout's session count decreases by 1.

<details>
<summary>Show solution</summary>

```ts
// add to src/lib/data.svelte.ts
export function deleteSession(id: string) {
  if (!browser) return;
  const remaining = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(remaining));
}
```

```svelte
<!-- in src/routes/songs/[id]/+page.svelte -->
<script>
  import { invalidateAll } from '$app/navigation';
  import { deleteSession } from '$lib/data.svelte';
  let { data } = $props();

  async function handleDelete(id) {
    if (!confirm('Delete this session?')) return;
    deleteSession(id);
    await invalidateAll();
  }
</script>

<!-- in the existing each loop: -->
<li>
  {new Date(s.date).toLocaleDateString()} — {s.minutes} minutes
  {#if s.notes}— {s.notes}{/if}
  <button onclick={() => handleDelete(s.id)} class="delete">delete</button>
</li>

<style>
  .delete { background: none; color: #ff6b6b; border: 0; cursor: pointer; padding: 2px 6px; }
</style>
```

The `invalidateAll()` re-runs the song-detail page's load, which calls `getSessionsForSong(params.id)` again, which now reflects the deletion. The session disappears from the list.

</details>

### Exercise 5 (stretch): Sketch the server-action version of the sessions form

**Setup:** You've built the localStorage version. The journal will eventually have a backend.

**What to do:** write a `src/routes/sessions/new/+page.server.ts` (don't actually use it — just draft it as a thought experiment) with a `default` action that takes the same form fields, validates them with `fail` for missing fields, and returns a `redirect(303, '/')` on success. The "database call" can be a `console.log` placeholder. Also sketch the form with `<form method="POST" use:enhance>` and `name="..."` on the inputs instead of `bind:value`. Compare line counts and reasoning.

**Verify by:** the written code compiles (no actual server needed); you can articulate the trade-off: more code, but no-JS fallback and server-side validation.

<details>
<summary>Show solution</summary>

```ts
// src/routes/sessions/new/+page.server.ts (sketch — not wired up)
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const songId = data.get('songId')?.toString();
    const date = data.get('date')?.toString();
    const minutesRaw = data.get('minutes')?.toString();
    const minutes = minutesRaw ? parseInt(minutesRaw) : NaN;
    const notes = data.get('notes')?.toString() ?? '';

    if (!songId || !date || !Number.isFinite(minutes) || minutes < 1) {
      return fail(400, {
        error: 'Fill in song, date, and a positive minutes value.',
        values: { songId, date, minutes: minutesRaw, notes }
      });
    }

    console.log('would save:', { songId, date, minutes, notes });
    throw redirect(303, '/');
  }
};
```

```svelte
<!-- partial: src/routes/sessions/new/+page.svelte server-action version -->
<script>
  import { enhance } from '$app/forms';
  let { data, form } = $props();
  let songs = data.songs; // from a +page.ts load
</script>

<form method="POST" use:enhance>
  <select name="songId" value={form?.values?.songId ?? songs[0]?.id} required>
    {#each songs as s (s.id)}<option value={s.id}>{s.title}</option>{/each}
  </select>
  <input type="date" name="date" value={form?.values?.date ?? ''} required />
  <input type="number" name="minutes" min="1" max="600" value={form?.values?.minutes ?? 15} required />
  <textarea name="notes">{form?.values?.notes ?? ''}</textarea>
  <button type="submit">log session</button>
  {#if form?.error}<p class="error">{form.error}</p>{/if}
</form>
```

The line count is comparable for the happy path. The differences pay off elsewhere:
- The server action runs even if JS is broken — the user submits, the server validates, redirects, the browser follows.
- Validation is authoritative on the server; the client can't lie about minutes.
- No `e.preventDefault`, no `invalidateAll`, no `goto` — `use:enhance` handles the lifecycle, and the server's `redirect` takes the user where they should go.

For a real backend-backed app, this is the version to use. For our localStorage journal, it can't run (no server, no DB).

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `src/routes/sessions/new/+page.svelte` — working form, saves a session, navigates to `/`.
- `src/routes/songs/new/+page.svelte` — working form, saves a song, navigates to `/songs`.
- `src/lib/data.svelte.ts` with `saveSession` and `saveSong` helpers (already there from L2).
- The layout's count badge updates after each save (because of `invalidateAll()`).

### Verify it works

- Log a session; the dashboard's recent list shows it; the count in the layout increments.
- Add a song; the songs list shows it; the dropdown in the sessions form includes it after refreshing or remounting the form.
- Submit the form with no songs and see the empty-state message gracefully.
- (If you did Exercise 4) Delete a session; the list updates without a manual refresh.

### Compare against the reference

No M5 reference repo — your code should match the patterns in this lesson.

## Common questions

**Q: Why doesn't `<form method="POST">` work without a `+page.server.ts`?**
A: SvelteKit only routes POST submissions to a route if that route has actions. Without them, the POST falls through to the default browser behavior, which navigates to the form's `action` URL (or the current URL) with no meaningful handling. For our SPA pattern with `onsubmit`, we always `preventDefault` so the browser's default never runs.

**Q: Can I use the server-action pattern for *some* forms and the client pattern for others in the same app?**
A: Yes. They don't interact — one route can have an `onsubmit` handler, the next route can have `+page.server.ts` with actions. Use whichever fits each form's needs. Just be consistent within a flow so the codebase stays legible.

**Q: What if I want to upload a file?**
A: For server actions, `FormData` includes files directly — `data.get('avatar')` returns a `File`. For client handlers, you'd use `new FormData(formElement)` or read from `<input type="file">` directly and POST to an endpoint. The journal doesn't need file upload, but the form patterns extend to it naturally.

**Q: Is `bind:value` on a `<select>` with object values weird?**
A: A little. `bind:value` on `<select>` sets the value to whatever was on the chosen `<option value=&lbrace;...&rbrace;>`. If those values are primitives (strings, numbers), it's straightforward. If they're objects, Svelte uses referential equality to match — fine if you're listing existing objects, surprising if you compute new objects on every render.

**Q: Why do I have to manually `invalidateAll()`? Shouldn't SvelteKit notice I wrote data?**
A: SvelteKit has no way to know. localStorage writes aren't observable from the framework's perspective — there's no event, no signal. For server actions, SvelteKit *does* automatically invalidate after the action returns (that's part of what `use:enhance` does). For our client-write pattern, the invalidation is explicit.

## What's next

The journal now has full CRUD-ish behavior — create, read, update via delete-then-recreate. Every interaction has a UI. What we haven't done yet is think about how the app *renders*. Some pages don't need server-side rendering (the dashboard reads from localStorage, which doesn't exist on the server anyway). Some pages should be prerendered to static HTML (the About page never changes). The next lesson is render modes: how to opt each route into the right rendering strategy, and the fallback mechanism that lets a mixed app deploy as static files.

<SourcesSection lessonKey="05-practice-journal/03-form-actions" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
