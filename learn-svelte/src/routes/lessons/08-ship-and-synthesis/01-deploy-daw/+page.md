<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Deploy the DAW · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-8);">

<LessonHeader
  moduleSlug="08-ship-and-synthesis"
  lessonSlug="01-deploy-daw"
  title="Deploy the DAW"
  blurb="Static adapter, BASE_PATH, GitHub Action. From localhost to a public URL with a workflow you can re-use forever."
/>

## Why this lesson exists

The DAW runs on `localhost:5181`. That's an audience of one — you, in front of the laptop where you wrote it. Putting it on a public URL takes maybe thirty minutes the first time and about three minutes the next time. After that it's a habit: every Svelte project you build can be live, with HTTPS, on a custom domain if you want, for zero dollars.

The mechanics are simple but every step has a way it can quietly fail. The static adapter has to know the app is a SPA, not a multi-page prerender. The build has to know whether it's deploying to the domain root or under a `/repo-name/` subpath. The GitHub Action has to have the right permissions to push to Pages. The browser has to handle deep links — `/share/<encoded>/` and `/embed/` — as client-side navigation, not as files the server is supposed to find on disk. And the audio engine, which only ever started inside dev mode, has to behave when it meets a real mobile Safari and a `https://` origin.

This lesson walks the whole pipeline. By the end you'll have a live URL, a workflow that auto-deploys on every push to `main`, and an understanding of which knobs do what so you can debug when the first push fails (it usually does at least once).

## Learning objectives

By the end of this lesson you'll be able to:

- Configure `@sveltejs/adapter-static` with the right `fallback`, `paths.base`, and prerender settings so a SvelteKit SPA works on a static host.
- Explain what `BASE_PATH` does and when you do or don't need it.
- Write a GitHub Actions workflow that builds and deploys to GitHub Pages with the correct permissions.
- Test a production build locally so you catch SSR-incompatible code before the deploy fails.
- Pre-warm the Web Audio context on first user interaction so mobile users don't tap PLAY into silence.
- Choose between GitHub Pages, Cloudflare Pages, Netlify, and Vercel for static hosting, and know which to pick when.

## Concept 1: The static adapter and what it does

### What an adapter is

SvelteKit doesn't know how to deploy itself. It writes a generic build, then hands that build to an adapter, which arranges it into the shape a specific host expects. The three you'll encounter most are:

- **`@sveltejs/adapter-static`** — emits HTML, CSS, and JS into a `build/` folder. No server. Suitable for GitHub Pages, Cloudflare Pages, Netlify (static), Vercel (static), S3, any CDN.
- **`@sveltejs/adapter-node`** — emits a Node server. You run `node build`. Suitable for VPS, Fly.io, Railway, anywhere you can run a process.
- **Host-specific adapters** — `adapter-vercel`, `adapter-cloudflare`, `adapter-netlify`. Each emits the exact format that host's runtime wants (serverless functions, edge workers, etc.).

The DAW has no backend. Every byte of state lives in the browser — `localStorage`, IndexedDB, in-memory rune state. There's nothing for a server to do. The static adapter is the right choice and the cheapest one to host.

### Configuring it for the DAW

Here's the `svelte.config.js` you want, matching `capstone-reference/svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV !== 'production';

export default {
  preprocess: [vitePreprocess()],
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    }),
    paths: {
      base: dev ? '' : (process.env.BASE_PATH ?? '')
    },
    prerender: { handleHttpError: 'warn' }
  }
};
```

Line by line for the parts that matter:

- **`pages: 'build'`, `assets: 'build'`** — both HTML and asset output go into the `build/` directory. (You can split them, but for GitHub Pages there's no reason to.)
- **`fallback: 'index.html'`** — the critical line. This tells the adapter to emit an `index.html` that bootstraps the SvelteKit client even when the URL doesn't match a prerendered route. Without it, navigating directly to `/share/abc123/` on the live site gives a 404 — the file doesn't exist on disk. With it, the static host serves `index.html`, the client takes over, and `/share/abc123/` resolves as a client-side route.
- **`strict: true`** — fail the build if a route isn't prerenderable AND there's no fallback. Catches missing `ssr = false` or missing `prerender = true` flags early.
- **`paths.base`** — the URL prefix the app lives under. Empty string means the app sits at the domain root (`https://example.com/`). `/svelte-daw` means it lives at `https://example.com/svelte-daw/`. We'll come back to this.

### The `+layout.ts` render flags

The adapter can't deploy a SPA unless every page agrees to be one. The DAW is client-only — Tone.js needs a browser, the rune state machinery initializes on mount, IndexedDB is browser-only. So we turn off server rendering everywhere with a root layout:

```ts
// src/routes/+layout.ts
export const ssr = false;
export const prerender = true;
export const trailingSlash = 'always';
```

- **`ssr = false`** — don't try to render this page on the server. The HTML shell ships empty; the client hydrates and builds the page.
- **`prerender = true`** — at build time, write the empty shell as a static `index.html`. This is what gets served on the first request.
- **`trailingSlash = 'always'`** — append a slash to every URL. `/share/abc/` instead of `/share/abc`. GitHub Pages treats `/share/abc` as a request for a file named `abc`, returns 404; `/share/abc/` is treated as a directory request and falls through to the SPA shell. The slash matters.

### Common mistakes with the static adapter

- **`fallback: undefined`.** Direct navigation to deep links 404s. Symptom: `https://you.github.io/svelte-daw/share/abc/` returns "404 — File not found." Fix: set `fallback: 'index.html'` and rebuild.
- **`paths.base` set in dev too.** The dev server tries to serve from `/svelte-daw/` but Vite still binds to `/`. Symptom: blank dev server. Fix: the `dev ? '' : process.env.BASE_PATH ?? ''` pattern keeps base empty in dev.
- **`ssr = true` somewhere.** A page or layout deeper in the tree forgot to disable SSR, the build tries to render Tone.js on the server, crashes with "AudioContext is not defined." Fix: ensure the root layout exports `ssr = false` and no child overrides it.
- **`strict: true` plus a non-prerenderable route.** Build fails with "The following routes were marked as prerenderable, but were not prerendered: [...]". With `fallback: 'index.html'` set, the SPA shell handles them — but the route still has to opt out of prerendering explicitly or the strict check trips. For dynamic routes like `/share/[encoded]/`, this is what `prerender = false` (per-route) plus the SPA fallback resolves.

## Concept 2: BASE_PATH and where your app lives

### Domain root vs. project subpath

GitHub Pages gives you two URL shapes for free:

- **User/organization Pages**: `https://YOUR_USERNAME.github.io/`. Served from a special repo named `YOUR_USERNAME.github.io`. The app lives at the domain root.
- **Project Pages**: `https://YOUR_USERNAME.github.io/REPO_NAME/`. Served from any repo with Pages enabled. The app lives under a subpath named after the repo.

Most DAWs ship under project Pages — you don't want to spend your one user-Pages slot on a side project. So your DAW probably lives at `https://you.github.io/svelte-daw/`.

When the browser loads `https://you.github.io/svelte-daw/`, SvelteKit's client expects every internal URL to be relative to `/svelte-daw/`, not `/`. If you hardcode `<a href="/embed">` and the client interprets it as `https://you.github.io/embed`, the navigation breaks. Same for asset URLs — the bundler emits paths like `/_app/immutable/chunks/abc.js`, and if those don't get rewritten to `/svelte-daw/_app/...`, every script tag 404s.

### What `BASE_PATH` does

The `paths.base` config tells SvelteKit "every URL I generate, prefix it with this string." It rewrites asset URLs, route URLs, anchor `href`s built with `$app/paths`, and the prerendered HTML's `<base>` tag.

The convention in the reference repo is to read it from `process.env.BASE_PATH` at build time so the same code can deploy to:

- A project Pages site: `BASE_PATH=/svelte-daw npm run build`.
- A user Pages site or a custom domain at root: `BASE_PATH= npm run build` (or just omit it).
- A local production preview: `BASE_PATH= npm run build && npx vite preview`.

### Using the base path in your own links

Anywhere you build a URL by hand, route it through `$app/paths`:

```svelte
<script>
  import { base } from '$app/paths';
</script>

<a href={`${base}/`}>Home</a>
<a href={`${base}/embed/`}>Embed</a>
<img src={`${base}/og-image.png`} alt="" />
```

The compiler can't help you here — there's no way for it to know that a string literal `"/embed/"` is supposed to be a URL versus an arbitrary string. Use `base` from `$app/paths` whenever you write a path that gets rendered into the DOM, and the build will produce the right URL in both dev (where `base` is `''`) and prod (where it's `/svelte-daw`).

### Common mistakes with BASE_PATH

- **Hardcoded `/` in `href`.** Works in dev, breaks in prod. Symptom: navigation to "home" sends you to `you.github.io/` instead of `you.github.io/svelte-daw/`. Fix: `$&lbrace;base&rbrace;/` everywhere.
- **`BASE_PATH` set in the wrong direction.** Common typo: `BASE_PATH=svelte-daw` (no leading slash) or `BASE_PATH=/svelte-daw/` (trailing slash). Use exactly `/svelte-daw` — leading slash, no trailing. The framework adds slashes where needed.
- **Forgetting BASE_PATH for assets in `static/`.** A file at `static/og-image.png` is served at `$&lbrace;base&rbrace;/og-image.png`, not `/og-image.png`. Open Graph metadata in particular is a common source of broken images on the live site.
- **Cached old base path.** After changing `BASE_PATH`, you push, the Action runs, Pages serves the new version, but your browser still has the old `_app/start.js` cached at the old URL. Symptom: blank page after deploy. Fix: hard reload (Cmd-Shift-R).

## Concept 3: A production build that actually runs

### Build, preview, click everything

Before pushing to GitHub, build the same artifact the CI will build and preview it locally:

```sh
BASE_PATH= npm run build
npx vite preview
```

`vite preview` serves the `build/` directory on a local port. This isn't dev mode — there's no HMR, no dev-only shims, no source maps to lean on. It's the actual production output running against your local browser. Whatever breaks here will break on the live site.

Click through the entire app:

- Open `/` — main DAW UI loads.
- Click PLAY — audio starts, the playhead moves.
- Toggle some cells — pattern updates.
- Adjust the mixer — gain changes audibly.
- Save a pattern — appears in the saved list.
- Click "share" on a saved pattern, copy the URL.
- Paste the URL into a new tab — pattern loads with the right BPM.
- Visit `/embed/` directly — sequencer and transport render, no chrome.
- Record for a few seconds, stop, download the `.webm` — file plays in another tab.

If any of these break in preview, they'll break in production. Fix them now.

### The classes of bug that only show up in production

There are five common shapes:

**1. Browser-only code at module scope.** A module reads `window.localStorage` at the top level. In dev with `ssr = false`, this still works because the dev server bypasses SSR. In a strict production build it may trip because the prerender step tries to evaluate the module while serializing the shell.

Fix:

```ts
import { browser } from '$app/environment';

const saved = browser ? localStorage.getItem('pattern') : null;
```

The `browser` constant is statically replaced by Vite — `true` in client bundles, `false` in server bundles — so the dead branch gets tree-shaken.

**2. `AudioContext` created without a gesture.** Tone.js will let you construct an `AudioContext` outside a click handler. Some browsers (looking at you, mobile Safari) silently put it in "suspended" state and never resume. The PLAY button does nothing, no error, no log.

Fix: only create or resume the context inside an event handler. The DAW engine's `ensureReady()` already does this — make sure it's actually called from a click and nowhere else.

**3. IndexedDB access during prerender.** Same as case 1 but for IndexedDB. The fix is the same — guard with `browser`.

**4. Imports from `$app/*` outside a component.** SvelteKit's `$app/stores`, `$app/navigation`, `$app/forms` rely on the runtime context being set up. Calling them from a module-level script (e.g., a `.svelte.ts` file that runs once) breaks. Call them from component scope or from a `load` function.

**5. Dynamic imports with `import.meta.glob` that depend on dev-server behavior.** Rare for the DAW, but worth knowing — globbed imports work in prod but only resolve the files that match at build time. If you add files after the build, they're not in the bundle.

### Common mistakes during the preview check

- **Skipping preview entirely.** "It worked in dev." Half the production bugs only surface in `vite preview` or on the live site. Build, preview, click everything. Every time.
- **Forgetting `BASE_PATH=` in front of build.** If your shell has a leftover `BASE_PATH=/svelte-daw` from earlier, the preview serves the app under `/svelte-daw/` locally too. Confusing. Always prefix the empty value when previewing locally.
- **Hot-reloaded state between dev and preview.** If you killed `npm run dev` mid-state, some localStorage values may be stale. Open dev tools, Application tab, clear storage for the origin, then preview from a clean slate.

## Concept 4: The GitHub Action

### What the workflow does

The deploy workflow is in `.github/workflows/deploy.yml`. The reference version, lifted from `capstone-reference/`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Build
        env:
          BASE_PATH: ${{ vars.BASE_PATH }}
        run: npm run build
      - name: Add SPA fallback (404.html copy of index.html)
        run: cp build/index.html build/404.html || true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Line by line for the non-obvious parts:

- **`on: push: branches: [main]`** — deploy whenever `main` updates. `workflow_dispatch` adds a "Run workflow" button so you can re-run manually without a commit.
- **`permissions: pages: write, id-token: write`** — GitHub Pages deploys require these scopes. Without them the deploy step fails with "Resource not accessible by integration."
- **`concurrency: group: pages, cancel-in-progress: true`** — only one deploy runs at a time. A second push cancels an in-flight build. Prevents two simultaneous Actions from clobbering each other's Pages artifact.
- **`BASE_PATH: $&lbrace;&lbrace; vars.BASE_PATH &rbrace;&rbrace;`** — pulls the base path from a repository variable. You set this once in GitHub Settings → Secrets and variables → Actions → Variables: name `BASE_PATH`, value `/svelte-daw` (or empty if you're on a user/org Pages site).
- **The SPA fallback copy.** GitHub Pages doesn't natively support SPA fallbacks. Its 404 page IS `404.html`. So we copy `index.html` to `404.html` — when someone deep-links to a route that doesn't exist as a file, Pages serves our SPA shell instead of a "page not found." The `|| true` swallows the error if `index.html` somehow isn't there, which would mean the build had other problems worth surfacing.
- **`actions/upload-pages-artifact@v3` then `actions/deploy-pages@v4`** — two-step deploy. The build job produces an artifact; the deploy job consumes it and pushes to the Pages CDN. Splitting them means a build can succeed while a deploy fails (e.g., Pages temporarily unavailable) and you can re-run just the deploy.

### Enabling Pages

The first time, you have to flip a switch in the repo settings:

1. Push the workflow file to `main`.
2. GitHub → Settings → Pages.
3. Source: **GitHub Actions** (not "Deploy from a branch").
4. Save.

Now the next push triggers the workflow, the workflow builds, the deploy step publishes. The Pages URL appears in the Actions run output and on the Settings → Pages page.

### Common mistakes with the workflow

- **Source set to "Deploy from a branch".** The workflow runs but Pages serves an empty `main` branch. Symptom: Action succeeds, site is blank or shows the repo's README. Fix: switch source to GitHub Actions.
- **`BASE_PATH` variable not set.** Build runs, app deploys, but every asset URL is missing the `/svelte-daw` prefix. Symptom: blank page, dev tools show 404s for every script. Fix: set the variable in repo Settings.
- **First run fails with "deployment was rejected because the environment was not found".** GitHub Pages creates the `github-pages` environment automatically on first deploy, but if the workflow runs before Pages is enabled, the environment doesn't exist yet. Fix: enable Pages first (source = GitHub Actions), then re-run the workflow.
- **`npm ci` fails because `package-lock.json` is out of sync.** Symptom: "Missing: some-package@x.y.z". Fix: run `npm install` locally, commit the updated `package-lock.json`, push.

## Concept 5: The audio gesture pre-warm

### The problem

The Web Audio API requires a user gesture (click, tap, keypress) to start an `AudioContext`. The DAW's engine calls `Tone.start()` the first time PLAY is pressed. That works — the click on PLAY IS a gesture — but it adds latency. The user clicks PLAY, the context resolves, then the transport starts. On a fast desktop that's milliseconds. On mobile Safari with a cold context, it can be 100-300ms of silence between click and sound. People interpret that as "the button didn't work" and tap again, which now does nothing useful because the context is starting.

The fix is to start the context on the very first user interaction with the page — any click, any tap, any keypress — before they even reach the PLAY button. By the time they click PLAY, the context is already warm and the sound is instantaneous.

### Pre-warming on first interaction

In the root layout:

```svelte
<script>
  import { onMount } from 'svelte';
  import { audio } from '$lib/audio/engine.svelte';

  onMount(() => {
    function preWarm() {
      audio.ensureReady();
      window.removeEventListener('click', preWarm);
      window.removeEventListener('keydown', preWarm);
      window.removeEventListener('touchstart', preWarm);
    }
    window.addEventListener('click', preWarm, { once: true, passive: true });
    window.addEventListener('keydown', preWarm, { once: true });
    window.addEventListener('touchstart', preWarm, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', preWarm);
      window.removeEventListener('keydown', preWarm);
      window.removeEventListener('touchstart', preWarm);
    };
  });
</script>
```

The `&lbrace; once: true &rbrace;` flag tells the browser to auto-remove the listener after it fires. The manual `removeEventListener` calls inside `preWarm` are belt-and-suspenders — if one event fires first, we tear down the others so they don't fire redundantly. The cleanup return removes anything still attached if the layout unmounts.

`&lbrace; passive: true &rbrace;` on `click` and `touchstart` tells the browser "this handler won't call `preventDefault`", which lets the browser scroll smoothly without waiting for the handler to return. Always pass it when you're not preventing default.

### A clearer transport button

The other half is making the button itself honest about state. The DAW's transport already has `isLoading`, `isReady`, and `isPlaying` flags on the engine — surface them:

```svelte
<button onclick={() => audio.toggleTransport()} disabled={audio.isLoading}>
  {#if audio.isLoading}
    LOADING…
  {:else if !audio.isReady}
    ▶ START
  {:else if audio.isPlaying}
    ■ STOP
  {:else}
    ▶ PLAY
  {/if}
</button>
```

When the audio is loading (the first call to `ensureReady()` is in flight), the button reads LOADING and is disabled. When the context is ready but transport hasn't started yet, the button reads START — making the first-click semantics visible. After that, it's the normal PLAY/STOP toggle.

### Common mistakes with the pre-warm

- **Calling `ensureReady()` at module scope.** No gesture, context never starts, button never works. Fix: only call from event handlers or `onMount`-installed listeners.
- **Forgetting to clean up the listener.** Layout unmounts (e.g., during HMR in dev), listener stays attached, second mount installs a second listener. In dev it's a leak; in prod it's harmless but sloppy. Use `&lbrace; once: true &rbrace;` plus the cleanup return.
- **Pre-warm runs before user interaction (e.g., from `onMount` directly).** The pre-warm function calls `Tone.start()` and the browser rejects it. Symptom: console warning about "AudioContext was not allowed to start." Fix: install the listener in `onMount`, don't call `ensureReady()` directly.
- **iOS Safari ignores `keydown`.** Some older iOS versions don't treat `keydown` as a valid gesture. `click` and `touchstart` both work; rely on those for mobile.

## Concept 6: Alternatives to GitHub Pages

GitHub Pages is fine. It's free, it's HTTPS, it's fast enough. But it has a few quirks: the SPA fallback hack (`404.html`), the public-repo requirement on the free tier, the slow first-deploy propagation. If any of those bite you, here are the alternatives that work with the same static-adapter output.

### Cloudflare Pages

The recommendation if GitHub Pages doesn't fit. Connect a GitHub repo, set the build command (`npm run build`) and output directory (`build`), and it deploys on every push. Works with private repos on the free tier. Native SPA fallback (no `404.html` hack). Builds are typically faster than GitHub's. The free tier is genuinely generous — 500 builds/month, unlimited bandwidth, unlimited requests.

Setup:

1. Cloudflare Dashboard → Workers & Pages → Create application → Pages → Connect to Git.
2. Pick the repo, branch `main`.
3. Build command: `npm run build`. Output directory: `build`. Environment variable: `BASE_PATH=` (empty — Cloudflare serves from the apex of `*.pages.dev`).
4. Save and deploy.

You get a `<project>.pages.dev` URL automatically. Add a custom domain in the project settings.

### Netlify

Similar setup, similar feel. Free tier with 100GB bandwidth/month, which is plenty for a side project. Native SPA fallback (drop a `_redirects` file with `/* /index.html 200` if you want it explicit, but it works without). Build minutes are tighter than Cloudflare's on the free tier (300/month), which can matter if you push a lot.

Setup is nearly identical: connect repo, set build command and output directory, deploy.

### Vercel

Best-in-class developer experience, particularly for Next.js — but works fine for SvelteKit too. Free tier is generous but their pricing changes are unpredictable, so it's not where I'd default for a long-lived project. Connect the repo, Vercel auto-detects SvelteKit, sets the build command, deploys.

If your DAW eventually grows server-side features (an API endpoint for shared patterns, a user account), Vercel's serverless functions are easy to add via `@sveltejs/adapter-vercel`. Same project, different adapter.

### When to pick which

- **GitHub Pages**: side project, public repo, fine with the `404.html` hack. Default for "I just pushed something to GitHub."
- **Cloudflare Pages**: private repo, want a real SPA fallback, want the best free tier. Default for "I want this to be my project's permanent home."
- **Netlify**: you already use Netlify for other things, or you want their drag-and-drop deploy as a backup.
- **Vercel**: you're planning to grow into serverless functions, or you genuinely prefer their UI.

All four take the same `build/` directory output. Switching between them is a one-day project.

## Putting it together

The full deploy pipeline, end to end:

1. **Edit `svelte.config.js`** to use `adapter-static` with `fallback: 'index.html'`, `strict: true`, and the `paths.base` reading from `BASE_PATH`.
2. **Edit `src/routes/+layout.ts`** to export `ssr = false`, `prerender = true`, `trailingSlash = 'always'`.
3. **Add the pre-warm and transport-state UI** to the root layout and transport bar.
4. **Build and preview locally**: `BASE_PATH= npm run build && npx vite preview`. Click everything. Fix anything that breaks.
5. **Write `.github/workflows/deploy.yml`** matching the reference.
6. **Push to GitHub.** Enable Pages with source = GitHub Actions. Set the `BASE_PATH` repository variable.
7. **Push to `main` again** (or click "Run workflow" in the Actions tab) to trigger the deploy.
8. **Visit `https://YOU.github.io/svelte-daw/`.** Verify the same end-to-end flow works on the live site.

The first deploy takes 30 minutes if you've never done it. Every subsequent deploy is `git push` and three minutes of Action runtime.

## Exercises

### Exercise 1: Build and preview locally

**Setup:** the DAW from M7 with a working `svelte.config.js` and `+layout.ts`.

**What to do:** run `BASE_PATH= npm run build`. Watch for warnings. Then `npx vite preview`. Open the URL printed. Click PLAY. Toggle cells. Save a pattern. Click "share." Open the shared URL in a new tab. Visit `/embed/` directly.

**Verify by:** every step works without errors in the browser console or terminal.

**Stretch:** simulate a production-only bug. Edit your engine to read `localStorage` at module scope (outside any function). Run `npm run build` again. The build either fails or the preview crashes on load. Fix it by guarding with `browser` from `$app/environment`. Watch the build pass again.

<details>
<summary>Show solution</summary>

```ts
// src/lib/audio/engine.svelte.ts (excerpt)
import { browser } from '$app/environment';

const savedPattern = browser
  ? JSON.parse(localStorage.getItem('current-pattern') ?? 'null')
  : null;
```

The `browser` constant is statically replaced. In server bundles it's `false`, so the ternary short-circuits and `localStorage` is never referenced. In client bundles it's `true` and the lookup runs normally. The dead code gets tree-shaken either way.

</details>

### Exercise 2: Wire up the GitHub Action

**Setup:** the DAW pushed to a GitHub repo named `svelte-daw` under your account.

**What to do:** add `.github/workflows/deploy.yml` matching the reference. Push. Enable Pages (Settings → Pages → Source: GitHub Actions). Set repository variable `BASE_PATH` to `/svelte-daw` (Settings → Secrets and variables → Actions → Variables). Push a trivial commit (e.g., update the README) and watch the Actions tab.

**Verify by:** the workflow finishes green within 5 minutes. The Pages URL appears in the deploy job output. Visiting it loads the DAW. The audio plays after one click.

**Stretch:** intentionally break the build (introduce a TypeScript error or a missing import). Push. Watch the Action fail. Read the logs. Fix the error. Push again. The Action goes green.

<details>
<summary>Show solution</summary>

The workflow file is exactly the one in `capstone-reference/.github/workflows/deploy.yml`. The trick is that all the configuration that varies per-deploy (the `BASE_PATH`, the Pages source setting) lives in repo settings, not in the YAML. So the same workflow file works for any SvelteKit static-adapter project — copy, push, configure.

</details>

### Exercise 3: Add the pre-warm

**Setup:** the deployed DAW.

**What to do:** in `src/routes/+layout.svelte`, add the pre-warm script that calls `audio.ensureReady()` on the first `click` or `touchstart` or `keydown`. Update the transport button to show LOADING / START / PLAY / STOP based on engine state.

**Verify by:** after a fresh page load, click anywhere on the page (not on PLAY) — wait a beat — then click PLAY. The sound starts instantaneously, no LOADING delay.

**Stretch:** open the DAW in mobile Safari (or Chrome dev tools' device emulation with iPhone selected, then a real device for the audio test). Without the pre-warm, time the gap between "tap PLAY" and "first kick hits." With the pre-warm, time it again. The difference should be visible — usually 100-300ms vs effectively zero.

<details>
<summary>Show solution</summary>

See the code in Concept 5. The key is `&lbrace; once: true &rbrace;` plus manual `removeEventListener` for the other event types so the pre-warm fires exactly once regardless of which input modality the user reaches for first.

</details>

### Exercise 4: Add a custom domain

**Setup:** the DAW deployed to GitHub Pages under `https://YOU.github.io/svelte-daw/`. A domain you control (or are willing to buy — Cloudflare and Namecheap are both cheap).

**What to do:**

1. In your DNS provider, add a CNAME record: `daw.YOURDOMAIN.com` → `YOU.github.io`.
2. In the GitHub repo: Settings → Pages → Custom domain → enter `daw.YOURDOMAIN.com` → Save.
3. Check "Enforce HTTPS" once GitHub has provisioned the certificate (5-10 minutes).
4. Change the `BASE_PATH` repository variable to empty (the app now lives at the domain root).
5. Push a trivial commit to re-trigger the build.

**Verify by:** `https://daw.YOURDOMAIN.com/` loads the DAW. The lock icon is green. All assets load (no 404s in the console).

**Stretch:** also set up an apex domain (`daw.YOURDOMAIN.com` AND `YOURDOMAIN.com`) by adding A records pointing at GitHub's Pages IPs. Document the four IPs in your README.

<details>
<summary>Show solution</summary>

GitHub Pages publishes its current Pages IPs in the Pages docs. The four A records (typically `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` — verify against current docs) point the apex at GitHub. The CNAME for `www` or any subdomain points at `YOU.github.io`. After DNS propagates and Pages provisions the cert, both URLs work.

</details>

### Exercise 5 (stretch): Deploy the same build to Cloudflare Pages

**Setup:** a Cloudflare account (free).

**What to do:** connect the same `svelte-daw` repo to Cloudflare Pages. Build command `npm run build`, output `build`, env var `BASE_PATH=` (empty). Trigger a deploy.

**Verify by:** `https://svelte-daw.pages.dev/` loads the DAW identically. Compare cold-load speed against the GitHub Pages version using your browser's Network tab.

**Stretch:** put the same custom domain on Cloudflare instead, A/B test for a week, decide which you prefer.

<details>
<summary>Show solution</summary>

The reason the same build works on both is that `adapter-static` doesn't care who hosts the `build/` directory. Cloudflare Pages auto-detects SvelteKit and applies its own SPA fallback (no `404.html` hack needed). The one variable that differs between hosts is `BASE_PATH` — Cloudflare serves at the project subdomain root, so `BASE_PATH` is empty; GitHub Pages serves under `/svelte-daw`, so `BASE_PATH=/svelte-daw`.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `svelte.config.js` configured with `adapter-static`, `fallback: 'index.html'`, and `paths.base` reading from `BASE_PATH`.
- `src/routes/+layout.ts` exporting `ssr = false`, `prerender = true`, `trailingSlash = 'always'`.
- `src/routes/+layout.svelte` installing a one-time pre-warm listener that calls `audio.ensureReady()`.
- A transport button that distinguishes LOADING, START, PLAY, STOP.
- `.github/workflows/deploy.yml` matching the reference.
- GitHub Pages enabled with source = GitHub Actions.
- `BASE_PATH` repository variable set correctly for your URL shape.
- A live URL where the DAW works end-to-end.

### Verify it works

- `BASE_PATH= npm run build && npx vite preview` runs cleanly with no errors.
- The Actions tab shows a green deploy.
- The live URL loads the DAW. Tapping anywhere then tapping PLAY produces sound instantly.
- Direct navigation to `/share/<encoded>/` loads the pattern correctly.
- Direct navigation to `/embed/` shows the embed view.
- Refreshing on any deep link works (no 404).

### Compare against the reference

- `capstone-reference/svelte.config.js` — adapter config.
- `capstone-reference/.github/workflows/deploy.yml` — the workflow.
- `capstone-reference/README.md` — the deploy section.

## Common questions

**Q: My deploy works but the audio is silent on iPhone Safari. Why?**
A: Two likely causes. First, the gesture pre-warm isn't firing — check that you installed the listener on `touchstart` (iOS Safari treats `click` slightly differently). Second, the master gain in your engine might be ramping from 0 in a way that's audibly silent for the first half-second; check the initial values. Open Safari's remote inspector (Mac required) to see console errors from the phone.

**Q: I get "Permission denied" on the deploy step.**
A: The workflow needs `permissions: pages: write, id-token: write` at the top level (not inside a specific job). Also verify the Pages source is set to "GitHub Actions" in repo Settings. If both look right, check that the repo isn't blocking Actions in the org-level settings (rare but possible).

**Q: Can I deploy to a subpath of a custom domain (e.g., `mydomain.com/daw/`)?**
A: Yes. Set `BASE_PATH=/daw`. Configure your host to serve the `build/` directory under that subpath. The DAW will work the same as the GitHub Pages project URL setup.

**Q: How do I roll back a bad deploy?**
A: GitHub Pages doesn't have a native rollback button. The fastest path is `git revert <bad-commit>` and push — the Action redeploys the previous version within a few minutes. For projects where you need real rollback, Cloudflare Pages keeps deploy history and offers one-click rollback in its UI.

**Q: My `_app/` chunks are huge. Should I worry?**
A: Most of it is Tone.js — it's a substantial library. Open `build/_app/immutable/chunks/` and check sizes. If it's mostly one big Tone.js chunk, that's expected. If you see large vendor chunks for libraries you don't think you imported, run `npm run build -- --analyze` (or use `rollup-plugin-visualizer`) to find what's pulling them in.

**Q: Should I use `adapter-cloudflare` instead of `adapter-static` for Cloudflare Pages?**
A: No, for the DAW. `adapter-cloudflare` is for apps that need serverless functions running on Cloudflare's edge. The DAW has no server-side anything, so the simpler `adapter-static` output works fine. Switch to `adapter-cloudflare` only if you add a backend later.

## What's next

Deploying is a plumbing problem. Polish is a different one — how a URL looks when pasted in Slack, how the app feels when installed to a home screen, how someone embeds your sequencer in their blog post. The next lesson turns the live URL into a sharable one: Open Graph metadata, a PWA manifest, an embed route, analytics if you want them, and a README that makes the project legible to anyone who finds it.

<SourcesSection lessonKey="08-ship-and-synthesis/01-deploy-daw" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
