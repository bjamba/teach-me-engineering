<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Adapter, Action, Pages: Live · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-5);">

<LessonHeader
  moduleSlug="05-practice-journal"
  lessonSlug="05-deploy"
  title="Adapter, Action, Pages: Live"
  blurb="Static adapter, GitHub Action, your practice journal deployed to a real URL in under 30 minutes."
/>

## Why this lesson exists

The journal works on `localhost`. That's not shipping. Shipping is a public URL — something you can text to a friend, open on your phone, bookmark on your laptop. This lesson takes the app from "works in dev" to "lives at `https://yourname.github.io/practice-journal/`" in under thirty minutes, with no servers to maintain and no recurring cost. GitHub Pages hosts it. A GitHub Action builds it. The static adapter packages it. The same patterns deploy any SvelteKit app that doesn't need a runtime backend.

Two reasons GitHub Pages specifically: it's free, and it's the path of least resistance if your code is on GitHub already. The mechanics here generalize to Cloudflare Pages, Netlify, Vercel static, Surge, plain S3 + CloudFront — once you have a `build/` directory of static files, you can drop it anywhere. The static adapter is the boundary between "SvelteKit code" and "files a CDN serves." Everything past that point is host-specific configuration.

## Learning objectives

By the end of this lesson you'll be able to:

- Install and configure `@sveltejs/adapter-static` for a SvelteKit app.
- Test a production build locally with `npm run build` and `vite preview`.
- Set a build-time `BASE_PATH` for project-pages URLs (`/repo-name`) vs root URLs.
- Write a GitHub Actions workflow that builds on push and publishes to GitHub Pages.
- Enable Pages in the repo settings to use the GitHub Actions source.
- Diagnose the common deploy-time failures: 404s, missing assets, broken links from `BASE_PATH` mistakes.
- (Optional) Point a custom domain at the deployed site.

## Concept 1: The static adapter

### What it is

A SvelteKit *adapter* is the package that turns the SvelteKit build into something deployable for a specific target. There's `@sveltejs/adapter-node` for a Node server, `@sveltejs/adapter-vercel` for Vercel, `@sveltejs/adapter-cloudflare` for Cloudflare Workers, etc. `@sveltejs/adapter-static` is the one that produces pure HTML + JS + CSS, with no server runtime.

When you run `npm run build`, the SvelteKit CLI hands the build output to the configured adapter. The static adapter walks every route, prerenders the ones flagged for prerendering, generates a fallback HTML for SPA routes, copies static assets, and writes the result to a directory (default: `build/`). The output is suitable for any static host.

The adapter is configured in `svelte.config.js`. Key options:

- `pages`: where to write the HTML files (default: `'build'`).
- `assets`: where to write JS/CSS bundles (usually the same as `pages`).
- `fallback`: the filename of the SPA fallback HTML (e.g., `'index.html'`, `'404.html'`, or `'200.html'`).
- `strict`: if `true`, the build errors on non-prerenderable routes that aren't covered by a fallback. Default is `true` in recent versions, which is what you want.
- `precompress`: whether to write `.gz` and `.br` pre-compressed versions of files. Some hosts use them; GitHub Pages doesn't. Default `false` is fine.

### Worked example: install and configure

From the project root:

```sh
npm install -D @sveltejs/adapter-static
```

Replace `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.env.NODE_ENV !== 'production';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: '404.html',
      strict: true
    }),
    paths: {
      base: dev ? '' : process.env.BASE_PATH ?? ''
    }
  }
};
```

A few things:

1. The default scaffolded `svelte.config.js` uses `adapter-auto`, which guesses based on environment. For our deploy target (GitHub Pages), we replace it with the explicit static adapter.
2. `fallback: '404.html'` is the GitHub Pages trick — GitHub serves `404.html` for any URL that doesn't resolve to a file. We use that as the SPA fallback. When a user visits `/songs/anything` directly, GitHub serves `404.html`, the SPA boots, the client router renders the actual `/songs/[id]` page.
3. `paths.base` is the URL prefix for the deployed app. For a project page at `https://user.github.io/practice-journal/`, the base path is `/practice-journal`. For a user page at `https://user.github.io/` or a custom domain at `https://example.com/`, the base is empty. We read it from a `BASE_PATH` env var at build time so we can change it without code changes.
4. The `dev ? '' : ...` guard means `paths.base` is empty in dev (so `npm run dev` works at root), and only takes a non-empty value when building for production. Without this, your dev server would also be at `/practice-journal/` locally, which is annoying.

### Variations

**`fallback: 'index.html'` for hosts that auto-serve `index.html` on unknown paths.** Netlify, Cloudflare Pages, and most "SPA-friendly" hosts do this. GitHub Pages doesn't — it uses `404.html`.

**`fallback: '200.html'` if you want both behaviors.** Some setups use `200.html` to indicate "this is the SPA bootstrap, status 200" in hosts that recognize the filename. Rare.

**No fallback, fully prerendered.** If every route can be prerendered (a docs site, a portfolio with static content), drop `fallback`. The build will require `prerender = true` on every route or error out.

### Common mistakes

- **Forgetting to install the adapter.** `npm run build` will fail with a confusing error about `adapter-auto` not finding a target. Install `adapter-static` and reference it.
- **Forgetting to import the adapter in the config.** Symptom: the build runs but produces nothing useful, or errors about the adapter being undefined.
- **Using `fallback: 'index.html'` on GitHub Pages.** GitHub serves `index.html` only for the root URL, not for unknown paths. Use `'404.html'` instead.
- **Conflicting `paths.base` in dev.** Setting `paths.base` to a non-empty string in dev breaks the dev server URLs. Always gate with the `dev` check.

### TS notes

If your `svelte.config.js` is `.js`, no TS. If you've renamed it to `.ts` (uncommon), the adapter's options are typed via the `Config` type from `'@sveltejs/kit'`.

## Concept 2: Testing the production build locally

### What it is

You should never push a build to production without seeing it work locally first. The `npm run build` command produces the deployable output. `npx vite preview` serves it from a local URL, simulating a static host. Things that work in `npm run dev` but break in production tend to surface here, before you've burnt a deploy cycle finding out.

What can break only in production:

- **Module-level browser API access.** Dev sometimes papers over `window`/`localStorage` references that the production build trips on.
- **Hardcoded URLs without the base path.** A link like `<a href="/songs">` works in dev (base path is empty) but breaks when deployed to `/practice-journal/songs/` (the link goes to `/songs`, which doesn't exist on the deployed origin).
- **Missing or misconfigured adapters.** Errors that only manifest during the adapter's prerender phase.
- **Asset references that the bundler missed.** Particularly for fonts or images imported in unusual ways.

The preview server is closer to production behavior than the dev server. It serves the actual built files, with no HMR, no source-on-demand transformation. If your built site works in preview, it'll work on GitHub Pages.

### Worked example: build and preview

```sh
BASE_PATH= npm run build
```

The leading `BASE_PATH=` sets the env var to empty for this command (so the local build uses the root path). Without it, the build uses whatever's in your shell, which might be unset (becomes `''`) or might be a stale value from a previous experiment.

You'll see SvelteKit walk the routes:

```
vite v5.x.x building SSR bundle for production...
✓ built in 4.21s
✓ done

Wrote site to "build"
  routes:
  ├ /about      [prerendered] → about/index.html
  └ /           [SPA fallback] → 404.html

Bundle size: ...
```

(The exact output varies by version. The takeaway: About is prerendered, the SPA fallback is `404.html`, everything else routes to the fallback.)

Now preview:

```sh
npx vite preview
```

Open the URL it prints (usually `http://localhost:4173/`). Click around. Add a song, log a session — the localStorage data from your dev work probably won't be visible here because the *port* is different (localStorage is per-origin including port), but you can seed new data and confirm the flows work.

Visit `/about` — should be instant (it's a prerendered static file). Visit `/songs/anything` — brief blank, then content (SPA fallback boots and runs the load). Visit `/garbage` — the SPA fallback boots, the client router doesn't find a match, the `+error.svelte` renders. All correct.

If everything works in preview, you're ready to deploy.

### Variations

**`BASE_PATH=/practice-journal npm run build`** to test the deployed configuration locally. The preview won't quite work this way (vite preview doesn't host under a subpath cleanly), but you can inspect `build/` and verify the bundles and HTML reference `/practice-journal/...` paths. Confirms the env var is wired through.

**`npm run preview` if the scaffold added the script.** Some templates ship a `preview` npm script as a shortcut for `vite preview`.

### Common mistakes

- **Module-load `localStorage` access slipping through dev.** Build crashes with `localStorage is not defined`. Fix: add `if (!browser)` guards to any module-top-level browser API access.
- **Forgetting `BASE_PATH=` and building with a stale env var.** Build produces a site with internal links like `/old-name/songs`, which break locally. Always be explicit about the env at build time.
- **Skipping the preview step.** Pushing the build directly without verifying. Sometimes works, often surfaces a subtle issue in a place that's annoying to debug remotely (the GitHub Actions log).
- **Hard-coded URLs in your own code.** `<a href="/songs">` works in dev but breaks at `/practice-journal/songs/` on the deployed site. Either use the `base` from `$app/paths` (`<a href="&lbrace;base&rbrace;/songs">`) or rely on relative links. SvelteKit's docs cover this in detail.

### TS notes

No TS implications. `process.env.BASE_PATH` is `string | undefined`. The `?? ''` ensures it's always a string.

## Concept 3: BASE_PATH and asset paths

### What it is

GitHub Pages has two URL patterns:

- **User/org pages:** `https://username.github.io/` — at the root. Base path is empty.
- **Project pages:** `https://username.github.io/repo-name/` — under a subpath. Base path is `/repo-name`.

If your app assumes it lives at the root but is actually deployed at `/practice-journal/`, every internal link (`/songs`) goes to `https://username.github.io/songs`, which is some *other* repo (probably a 404). The browser doesn't know about `practice-journal` as a prefix unless you tell it.

SvelteKit handles this with `paths.base` in the config. When set, every link generated by SvelteKit (and the assets bundle paths) get the prefix automatically. Your code can use the `base` constant from `$app/paths` to prefix any links you write by hand.

The `BASE_PATH` env var pattern lets you set the base at build time without hardcoding it. You can deploy the same code to different paths (test deploy at `/practice-journal-staging/`, production at `/practice-journal/`, custom domain at `/`) by just changing the env var.

### Worked example: BASE_PATH in code and at build

In `svelte.config.js` (already shown above):

```js
paths: {
  base: dev ? '' : process.env.BASE_PATH ?? ''
}
```

In any component where you have hardcoded internal links, prefix them with `base`:

```svelte
<script>
  import { base } from '$app/paths';
</script>

<a href={`${base}/songs`}>Songs</a>
```

You don't have to do this everywhere — SvelteKit's `<a href="/songs">` in a route should be picked up by the link interceptor and rewritten. But for safety, especially for things like image sources (`<img src={` + "`${base}/logo.png`" + `}>`), being explicit is worth it.

At build time:

```sh
BASE_PATH=/practice-journal npm run build
```

The built output references `/practice-journal/_app/...` for assets and respects the prefix in generated links. Deploy this to `https://username.github.io/practice-journal/` and everything resolves.

For a custom domain deploy, build with `BASE_PATH=` (empty):

```sh
BASE_PATH= npm run build
```

Same code, different output.

### Variations

**Hard-code `paths.base` if you'll never change deploy targets.** `paths: &lbrace; base: '/practice-journal' &rbrace;` works fine. But you'd have to remember to remove it for local dev, which is annoying. The env-var pattern handles both.

**`paths.assets` for absolute CDN URLs.** If you host static assets on a CDN at a different domain (e.g., `https://cdn.example.com/`), set `paths.assets` to that URL. The bundle references will use the full URL. We don't need this for GitHub Pages — assets are co-located with the HTML.

**Using `$app/paths` for assets.** The `assets` import gives you the assets base URL. Use it for any image, font, or asset you reference in your code: `<img src="&lbrace;assets&rbrace;/logo.png">`.

### Common mistakes

- **Links break on the deployed site but work in dev.** Almost always a base-path issue. Use `base` from `$app/paths` for any hardcoded internal link. Use relative paths (`<a href="./other">`) where possible.
- **Setting `BASE_PATH` with a trailing slash.** `BASE_PATH=/practice-journal/` — SvelteKit's docs recommend no trailing slash on `paths.base`. If you do include one, weird URL doublings can happen.
- **Forgetting to update `BASE_PATH` when renaming the repo.** Rename `practice-journal` to `journal`, push, deploy — the build still uses the old base. Update the workflow's env, push again.
- **Mixing `BASE_PATH` and a custom domain.** Custom domains live at the root (`https://yourname.com/`). The base path needs to be empty when using a custom domain, even if the repo is named something else.

### TS notes

`base` and `assets` from `$app/paths` are both `string`. The `paths` config in `svelte.config.js` is typed via the `Kit.Paths` type if you want, but the structure is small enough that inference is fine.

## Concept 4: The GitHub Actions workflow

### What it is

GitHub Actions is GitHub's built-in CI/CD. You write a YAML workflow file in `.github/workflows/`, and GitHub runs it on the events you specify — push to a branch, PR opened, scheduled cron, manual trigger. For deploying a static site to GitHub Pages, the workflow has two jobs: *build* and *deploy*.

The build job checks out the code, installs dependencies, runs `npm run build` with `BASE_PATH` set, and uploads the `build/` directory as an artifact (a special "Pages artifact" that the deploy step knows about). The deploy job picks up the artifact and publishes it to GitHub Pages using the `actions/deploy-pages` action. The two jobs are sequenced — deploy depends on build's artifact.

The workflow uses GitHub's "Pages with GitHub Actions" source, which is now the recommended way (replacing the older "deploy from branch" approach). It requires the right permissions on the workflow (`contents: read`, `pages: write`, `id-token: write`) and the Pages source set to "GitHub Actions" in the repo settings.

### Worked example: the deploy workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Pages

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
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Build
        env:
          BASE_PATH: '/practice-journal'
        run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build/

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

Reading top to bottom:

- **`name`** is what shows up in the GitHub Actions UI.
- **`on:`** — runs on push to main, and manually via the "Run workflow" button (`workflow_dispatch`).
- **`permissions:`** — the minimal set the workflow needs. Without `pages: write`, the deploy fails with a permissions error.
- **`concurrency:`** — if a new push happens while a deploy is running, the new one queues (`cancel-in-progress: false`). For deploys you usually want them to all run rather than canceling intermediate ones.
- **`jobs.build`** — runs on a fresh Ubuntu VM. Checks out the repo, installs Node 20 with npm cache, runs `npm ci` (clean install from lockfile), runs the build with `BASE_PATH=/practice-journal`. Uploads `build/` as the Pages artifact.
- **`jobs.deploy`** — runs after build. Uses the `deploy-pages` action which knows how to find the artifact and publish it. The `environment` block surfaces the deployed URL in the GitHub UI.

Change `BASE_PATH: '/practice-journal'` to match your repo name. If your repo is named `journal`, set it to `'/journal'`. For a custom domain or user-page deploy, set it to `''`.

### Variations

**Triggering on other branches.** Change `branches: [main]` to `branches: [main, staging]` to deploy from both. You'd want a separate Pages environment per branch to keep them separate (or just one branch deploys to Pages and others run different checks).

**PR previews.** Add a `pull_request:` trigger and use a different target — GitHub Pages doesn't natively support per-PR previews, but services like Surge, Vercel preview, or Cloudflare Pages do. Out of scope here.

**A test job before deploy.** Add a `test` job that runs `npm run check` and `npm test`. Make `deploy` depend on both `build` and `test`. Prevents broken builds from deploying.

**Caching `node_modules`.** The `cache: 'npm'` option on `setup-node` caches the npm download cache (not `node_modules` itself), which speeds up `npm ci` significantly on subsequent runs.

### Common mistakes

- **Wrong `BASE_PATH`.** The most common deploy error. Site loads but all internal links and assets 404. Fix the env var, push again.
- **Forgetting `permissions:`.** Deploy step fails with "permission denied" or similar. Add the three permissions listed.
- **Repo name has uppercase.** GitHub Pages URLs are lowercased: `MyRepo` becomes `https://user.github.io/myrepo/`. `BASE_PATH` must match the URL, so use `/myrepo`. (Or just don't use uppercase in repo names.)
- **Building on a stale Node version.** Default `setup-node` Node might be older than what your code uses. Pin to `'20'` (or whatever you used locally) explicitly.
- **The workflow runs but Pages isn't enabled.** Build succeeds, deploy step errors with "Pages site doesn't exist." Enable Pages in repo Settings (next concept) and re-run.

### TS notes

YAML, not TS. No types involved. There are language servers that understand the GitHub Actions schema and offer autocomplete — useful if you write workflows often.

## Concept 5: Enabling Pages and pushing

### What it is

The workflow is in place but Pages itself needs to be enabled in the repo, set to use GitHub Actions as the source. Once enabled, every push to main triggers the workflow, the build runs, the deploy publishes, and the URL goes live (or updates).

The first deploy takes 2-4 minutes — the workflow runner has to spin up, install dependencies, build, upload, and GitHub has to provision the Pages site. Subsequent deploys are faster (1-2 minutes typically, dominated by `npm ci` and the build itself).

### Worked example: from `git init` to live URL

If you started fresh with `npm create svelte@latest`, the project is already a git repo. If not:

```sh
git init
git add .
git commit -m "Initial commit: practice journal"
```

Create a new repo on GitHub (via the web UI or `gh repo create`). Name it `practice-journal` (or whatever you set `BASE_PATH` to). Add the remote and push:

```sh
git remote add origin git@github.com:YOUR_USERNAME/practice-journal.git
git branch -M main
git push -u origin main
```

In the GitHub web UI for the repo:

1. Settings → Pages.
2. Source: select **GitHub Actions** (not "Deploy from a branch").
3. Save.

Go to the Actions tab. You should see the "Deploy to Pages" workflow running (it triggered on your push). Wait for both jobs to go green. The deploy job's summary will include a URL like `https://YOUR_USERNAME.github.io/practice-journal/`.

Visit it. The journal loads. The About page is fast (prerendered). The other pages have a brief blank moment as the JS boots, then render. Add a song (you'll need to add one from the deployed URL — localStorage on `github.io` is separate from your local dev). Log a session. Refresh. Your data persists. The app is live.

### Variations

**Push from a non-main branch first to test the workflow.** Push to a branch like `deploy-test`, then change the workflow's `branches: [main]` to `[deploy-test]` to verify before adding main. Reset when you're confident.

**Manually trigger via `workflow_dispatch`.** The "Run workflow" button in the Actions tab lets you trigger a deploy without pushing. Useful for re-deploying after fixing a config-only issue.

**The `gh` CLI.** `gh pr checks`, `gh run watch`, `gh run view --log` give you the workflow status from the terminal. Saves a trip to the web UI.

### Common mistakes

- **Push fails because the remote already has commits.** GitHub may have auto-created a README or LICENSE. `git pull --rebase origin main` to merge them in first.
- **Workflow runs but Pages still shows "the site is being deployed."** First-time provisioning takes a few minutes. Refresh after 2-3 minutes.
- **Pages source set to "Deploy from a branch" instead of "GitHub Actions."** The workflow's deploy step errors. Switch to "GitHub Actions" in Settings → Pages.
- **Old data lingers in the published site.** The build artifact replaces the previous one entirely — there's no "leftover state" across deploys. If you see stale content, it's the browser cache. Hard-refresh.

### TS notes

None.

## Concept 6: localStorage, custom domains, and the long tail

### What it is

A few finishing details worth knowing.

**localStorage is per-origin, per-browser.** This means your phone's data is separate from your laptop's data, which is separate from your friend's data. For the journal as a personal tool, this is the right behavior — your practice log is your own. For multi-device sync, you'd need a backend; that's not this lesson and not this project.

**Custom domains are easy if you want one.** Buy a domain. Set a DNS record pointing to GitHub's servers. Add the domain in repo Settings → Pages. GitHub provisions an HTTPS cert automatically. When using a custom domain, set `BASE_PATH=` (empty) — the site lives at the root of the domain, not under a subpath.

**Cache headers and CDN.** GitHub Pages serves files through a CDN with sensible cache headers. You don't usually have to touch this. The hashed asset filenames SvelteKit generates (`_app/immutable/...`) are long-cacheable; the HTML files are short-cacheable. If you push a bad deploy and want to force users to see the new version, the hashed assets will load fresh on next navigation.

### Worked example: switching to a custom domain

If you've bought, say, `practice-journal.cool`:

1. At your domain registrar, add an `A` record (or four, for redundancy) pointing to GitHub's Pages IPs:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
   Or a `CNAME` record pointing to `YOUR_USERNAME.github.io.` (with the trailing dot). Use one or the other, not both.
2. In the repo, Settings → Pages → Custom domain → enter `practice-journal.cool`, save.
3. GitHub creates a file called `CNAME` in your repo with the domain in it. (Or you can pre-create it yourself.) This file is what makes Pages associate the build with the custom domain.
4. Wait for DNS to propagate (a few minutes to an hour). GitHub's "Enforce HTTPS" checkbox becomes available once DNS resolves; check it.
5. Update the workflow: change `BASE_PATH: '/practice-journal'` to `BASE_PATH: ''`. Push. The new build will deploy with no base prefix.

Visit `https://practice-journal.cool`. The journal lives there now.

### Variations

**Keep both the github.io URL and the custom domain.** Once a custom domain is set, GitHub redirects the github.io URL to the custom domain. You get both URLs, with the custom one as canonical.

**Per-environment configs.** A more grown-up setup uses separate workflows for staging and production, each with different `BASE_PATH` and different Pages environments. Out of scope for now.

### Common mistakes

- **Forgetting to change `BASE_PATH` when adding a custom domain.** Site loads at the custom domain root but all links go to `/practice-journal/something` and 404. Set `BASE_PATH: ''` and re-deploy.
- **Not waiting for DNS.** Custom domain shows "domain's DNS record could not be retrieved." DNS takes minutes to hours to propagate; come back later.
- **Mixed http/https.** Until HTTPS is provisioned, the site is http-only. Don't share the URL until the cert is in place.

### TS notes

None.

## Putting it together

The full deploy chain, end to end:

1. Install adapter: `npm install -D @sveltejs/adapter-static`.
2. Configure `svelte.config.js` with the static adapter, `fallback: '404.html'`, and `paths.base` from `BASE_PATH`.
3. Test locally: `BASE_PATH= npm run build && npx vite preview`.
4. Write `.github/workflows/deploy.yml` with build and deploy jobs.
5. Commit, push to GitHub.
6. Enable Pages in repo Settings → Pages → Source: GitHub Actions.
7. Wait for the workflow to complete; visit the deployed URL.

After this, every push to main re-deploys automatically. The journal is live. Your friend can use it on their phone. You can bookmark it on your laptop.

You've now shipped five SvelteKit apps over the course of this curriculum — a counter, a tap-tempo tool, a metronome, a chord progression player, and the practice journal. The first four were single-page; this one is multi-route, persistent, and deployed. The patterns you've used (filesystem routing, load functions, render-mode flags, the static adapter, the GitHub Actions deploy) are the same ones any production SvelteKit app uses. The only thing missing from "a real production app" is a backend — and that's a project for another module.

## Exercises

### Exercise 1: Deploy the journal

**Setup:** Your project works locally; the static adapter is installed; the workflow file is in place.

**What to do:** create a new GitHub repo named `practice-journal`. Push your code. Enable Pages with "GitHub Actions" as the source. Wait for the first deploy to complete. Visit the deployed URL.

**Verify by:** the URL `https://YOUR_USERNAME.github.io/practice-journal/` loads the journal. About is fast. Other pages have a brief blank moment then work. You can add a song (separate from your dev localStorage) and log sessions on the deployed site.

<details>
<summary>Show solution</summary>

Sequence:

```sh
# (assuming you're in the project directory and git is initialized)
gh repo create practice-journal --public --source=. --remote=origin --push
# or via the GitHub web UI: create the repo, then:
git remote add origin git@github.com:YOUR_USERNAME/practice-journal.git
git push -u origin main
```

In the web UI: Settings → Pages → Source → GitHub Actions → Save.

Watch the Actions tab. After both jobs go green (about 2-4 minutes), the deploy job's summary will show the URL. Click it.

If the URL 404s or you see "404 — file not found": the build succeeded but the assets are at the wrong path. Check that `BASE_PATH` in the workflow matches the repo name exactly.

</details>

### Exercise 2: Audit your hardcoded links

**Setup:** Your deployed site might have a link that breaks due to base-path issues.

**What to do:** click every link in the deployed app. Find any that 404 (the browser navigates to a URL that doesn't exist on the deployed origin). Fix by either (a) using SvelteKit's `<a href="...">` which auto-prefixes, or (b) explicitly using `base` from `$app/paths` for any hand-coded link. Re-deploy and verify.

**Verify by:** every nav link, every "back to ..." link, every link in the rendered HTML resolves to a real page on the deployed origin.

<details>
<summary>Show solution</summary>

In a well-structured SvelteKit project, almost all internal links are `<a href="/something">` and the framework's link interceptor handles base-path prefixing for in-app nav. Where this commonly breaks:

- **Hand-coded `<img src="/logo.png">`.** Becomes `https://user.github.io/logo.png`, 404. Use `<img src="&lbrace;base&rbrace;/logo.png">` with `import &lbrace; base &rbrace; from '$app/paths'`.
- **Hand-coded `<a href="/about">` outside SvelteKit's interceptor (e.g., in an HTML attribute string built from JS).** Same fix — prefix with `base`.
- **`fetch('/api/...')` calls.** If you eventually add API endpoints, they too need the base path. Use ``fetch(`${base}/api/...`)``.

Most of our journal's links are template-literal-built within `<a>` tags, like `<a href="/songs/&lbrace;song.id&rbrace;">`. These work through the link interceptor.

</details>

### Exercise 3: A README that documents the deploy

**Setup:** The repo has no README beyond what `npm create svelte@latest` scaffolded.

**What to do:** write a `README.md` for the repo that documents (a) what the app is, (b) how to run it locally (`npm install`, `npm run dev`), (c) how to deploy (it auto-deploys on push to main, or trigger manually via the Actions tab), (d) the URL of the deployed site. Treat this as a real README — someone (including future-you, six months from now) should be able to figure out the project from it.

**Verify by:** the README explains everything someone needs to know to use and contribute to the repo, without consulting any other source.

<details>
<summary>Show solution</summary>

Markdown content for `README.md`:

```md
# Practice Journal

A small SvelteKit app for tracking songs you're learning and the practice sessions you log against them. Data lives in localStorage — per-device, no backend.

Live: https://YOUR_USERNAME.github.io/practice-journal/

## Run locally

    npm install
    npm run dev

Opens at http://localhost:5173.

## Build for production

    BASE_PATH= npm run build
    npx vite preview

For the GitHub Pages deploy:

    BASE_PATH=/practice-journal npm run build

## Deploy

Every push to `main` triggers `.github/workflows/deploy.yml` and publishes to GitHub Pages. To trigger a deploy manually, use the "Run workflow" button on the Actions tab.

## Stack

- SvelteKit 2 + Svelte 5 runes
- `@sveltejs/adapter-static` (deploys as static files to GitHub Pages)
- localStorage for persistence
- GitHub Actions for CI/CD
```

A README at this level is enough for a hobby project. For a team project you'd add license, contributing guidelines, architecture notes, etc.

</details>

### Exercise 4: Force a re-deploy after a config change

**Setup:** You changed something in `svelte.config.js` or the workflow YAML but didn't change any app code. The Actions tab is empty until a push.

**What to do:** trigger a manual workflow run via the "Run workflow" button on the Actions tab (`workflow_dispatch` is in the workflow's `on:` block, so this is enabled). Watch the deploy complete. Verify the change took effect.

**Verify by:** the workflow runs without a code push; the deploy completes; the deployed site reflects the config change.

<details>
<summary>Show solution</summary>

The "Run workflow" button is in the GitHub Actions UI: Actions tab → Deploy to Pages workflow (left sidebar) → "Run workflow" dropdown → select branch `main` → "Run workflow" button.

The workflow runs identically to a push-triggered run. You'd use this for: re-deploying after fixing a server-side config (Pages source, base URL change), forcing a re-build after an upstream dependency update, or just wanting to verify the deploy still works without committing a no-op change.

</details>

### Exercise 5 (stretch): Add a deploy status badge to the README

**Setup:** The workflow has a status, queriable via GitHub's badge API.

**What to do:** add a badge to the top of the README that shows the latest deploy status. The badge URL format is `https://github.com/USERNAME/REPO/actions/workflows/WORKFLOW_FILE.yml/badge.svg`. Make it a link that goes to the Actions tab for that workflow.

**Verify by:** the badge renders as "passing" (green) or "failing" (red) based on the most recent run; clicking it goes to the Actions runs for that workflow.

<details>
<summary>Show solution</summary>

At the top of `README.md`, add:

```md
[![Deploy](https://github.com/YOUR_USERNAME/practice-journal/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/practice-journal/actions/workflows/deploy.yml)
```

Reload the repo's main page. The badge appears under the title. It auto-updates when workflow runs complete.

A small touch, but a good signal that a project is alive and shipping. Public-facing projects with broken badges look abandoned.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- `@sveltejs/adapter-static` installed.
- `svelte.config.js` configured with the static adapter and `paths.base`.
- `.github/workflows/deploy.yml` with build and deploy jobs.
- A GitHub repo with Pages enabled (source: GitHub Actions).
- A working deploy at `https://YOUR_USERNAME.github.io/practice-journal/`.

### Verify it works

- The deploy URL loads the journal.
- The About page is fast (prerendered).
- The other pages render after a brief JS boot.
- Adding a song and logging a session both persist across page refreshes.
- Pushing a change to main triggers a new deploy; the change goes live within a few minutes.

### Compare against the reference

No M5 reference repo. Your deploy should be your own URL.

## Common questions

**Q: My deploy URL shows a 404 even after the workflow succeeded.**
A: First, wait a couple of minutes — GitHub takes a moment to provision the Pages site on first deploy. If still 404 after 5 minutes: check the Pages section of Settings — does it show a green check and the URL? If not, the Pages source might be set to "deploy from a branch" instead of "GitHub Actions." Switch it.

**Q: Assets (CSS, JS) 404 but the HTML loads.**
A: Base-path mismatch. The HTML references `/practice-journal/_app/...` but the assets are at `/something-else/_app/...`. Check that `BASE_PATH` in your workflow matches your repo name exactly (case-sensitive on GitHub Pages URLs — usually all-lowercase regardless of repo case).

**Q: The first deploy works, but pushing a code change doesn't trigger a re-deploy.**
A: The workflow only runs on push to `main` (per the `on:` block). If your default branch is `master` or something else, change the workflow to match. You can also check the Actions tab for the workflow status — if there's no entry for your recent push, the workflow didn't trigger.

**Q: localStorage data isn't persisting on the deployed site.**
A: Open dev tools → Application tab → Storage → Local Storage. Confirm your keys (`pj_songs_v1`, `pj_sessions_v1`) are there. If they're empty, the save isn't happening — open the Console tab for errors. If they're populated but the UI doesn't show them, the load function isn't reading correctly — check the `browser` guard in the helpers.

**Q: Can I deploy to a non-GitHub host?**
A: Yes. The static adapter produces `build/` — drop that directory onto any static host. Netlify: drag-and-drop the folder, or connect the repo. Cloudflare Pages: connect the repo and set build command/output. Vercel: connect the repo and select the static adapter. The build artifact is the same; only the host configuration differs.

**Q: Do I need to worry about cold starts / serverless costs?**
A: No. Static files have no cold start — they're served directly from a CDN. GitHub Pages is free for public repos with reasonable bandwidth limits. The economic model of a static site is closer to free hosting than serverless billing.

## What's next

The journal is shipped. You've now seen the entire arc of a small SvelteKit app: scaffolding, routing, data flow, forms, rendering modes, and deploy. The patterns scale up — the same `+page.ts`/`+page.server.ts` distinction handles a Postgres-backed app, the same form-actions pattern handles auth and authorization, the same render-mode flags handle a high-traffic content site with carefully-tuned per-route caching.

The next module is the capstone — the digital audio workstation you've been working toward since Module 1. It combines everything: the audio work from the tap-tempo and metronome lessons, the shared state from the chord progression player, the multi-route structure and persistence patterns from this module, the rune system from the start. The DAW has a much bigger surface area than anything you've built so far. The good news: you have all the building blocks. The DAW lessons assemble them.

<SourcesSection lessonKey="05-practice-journal/05-deploy" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
