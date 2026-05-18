<script>
  import LessonNav from '$lib/components/LessonNav.svelte';
  import LessonHeader from '$lib/components/LessonHeader.svelte';
  import SourcesSection from '$lib/components/SourcesSection.svelte';
  import TryThis from '$lib/components/TryThis.svelte';
</script>

<svelte:head><title>Polish for Sharing · Make / Svelte</title></svelte:head>

<article class="lesson prose" style="--c-track: var(--c-track-8);">

<LessonHeader
  moduleSlug="08-ship-and-synthesis"
  lessonSlug="02-polish-share"
  title="Polish for Sharing: OG, PWA, Embed"
  blurb="Open Graph for link previews. PWA manifest for install. An embed widget. A README that does its job."
/>

## Why this lesson exists

A deployed URL is necessary. It's not sufficient. The gap between "I pushed it" and "people actually try it" is filled by a handful of unglamorous polish features that, individually, are small — and collectively are the difference between a project that gets traffic and one that doesn't.

Six pieces of polish matter for a side project that runs in a browser:

1. **Open Graph metadata** so the URL looks like a real product when someone pastes it in Slack, Discord, iMessage, or a tweet.
2. **A PWA manifest plus a service worker** so the app installs to a home screen, opens without browser chrome, and survives offline.
3. **An embed route** so other people can drop your sequencer into their own pages.
4. **A privacy-respecting analytics signal** so you know if anyone actually tried it.
5. **A README** that sells the project in 30 seconds of reading.
6. **A list of places to share it** that aren't going to waste your time.

None of these are technically hard. They're checkboxes. The lesson walks each one with code that copy-pastes into the DAW.

## Learning objectives

By the end of this lesson you'll be able to:

- Add Open Graph + Twitter Card metadata to a SvelteKit app, including dynamic per-route titles and images.
- Build a 1200x630 OG image and host it correctly under `BASE_PATH`.
- Write a web app manifest that makes the DAW installable on iOS, Android, and desktop browsers.
- Add a service worker via `@vite-pwa/sveltekit` so the app caches its own assets and works offline.
- Build an `/embed/` route that renders the sequencer in iframe-friendly form.
- Support URL parameters to make the embed configurable (preload a pattern, set a theme).
- Pick a privacy-friendly analytics provider that doesn't require a cookie banner.
- Write a README that gets clicks and stars.

## Concept 1: Open Graph and Twitter Cards

### What link unfurling is

When you paste a URL into Slack, Discord, iMessage, Bluesky, Twitter, Facebook, LinkedIn, or essentially any modern app that handles links, the receiving app fetches the URL and looks for metadata to build a preview card. That card shows a title, a description, and an image. If the metadata isn't there, the card is bland or absent — the URL just renders as text.

Two metadata standards cover almost everything:

- **Open Graph** (`og:*` meta tags) — the standard pioneered by Facebook, now used by basically every platform except Twitter.
- **Twitter Cards** (`twitter:*` meta tags) — Twitter (now X) uses its own tags as a fallback when Open Graph isn't enough. Most platforms read both.

You write both. They overlap heavily. The fields that matter:

- `og:title` / `twitter:title` — the headline of the card.
- `og:description` / `twitter:description` — the subhead.
- `og:image` / `twitter:image` — the preview image. Spec is 1200x630 pixels for both.
- `og:type` — usually `website` for an app, `article` for a blog post.
- `twitter:card` — `summary_large_image` for the big-image format, `summary` for the small.

### Adding the tags to the layout

In `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  let { children } = $props();

  const SITE = 'https://you.github.io/svelte-daw';
  const ogImage = `${SITE}${base}/og-image.png`;
</script>

<svelte:head>
  <title>Svelte DAW — a browser drum machine</title>
  <meta name="description" content="A 4-track step sequencer that runs in your browser. Save and share patterns via URL. Built with Svelte 5." />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Svelte DAW" />
  <meta property="og:title" content="Svelte DAW" />
  <meta property="og:description" content="A 4-track step sequencer in your browser. Share patterns via URL." />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content={`${SITE}${$page.url.pathname}`} />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Svelte DAW" />
  <meta name="twitter:description" content="A 4-track step sequencer in your browser." />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>

{@render children()}
```

Key details:

- The image URL is **absolute**, not relative. Unfurl scrapers don't share your origin context — they hit the URL exactly as you give it. `$&lbrace;SITE&rbrace;$&lbrace;base&rbrace;/og-image.png` builds the full `https://...` URL.
- `og:image:width` / `og:image:height` help some scrapers pick the right format without downloading the image.
- `og:url` should be the canonical URL of the page being shared. `$page.url.pathname` gives you the current route; combine with `SITE`.

### Per-route overrides for shared patterns

The `/share/[encoded]/` route should set its own title and description so a shared pattern doesn't look generic. In `src/routes/share/[encoded]/+page.svelte`:

```svelte
<script lang="ts">
  let { data } = $props();
  const patternName = data.patternName ?? 'Untitled pattern';
  const title = `${patternName} — Svelte DAW`;
  const desc = `A pattern at ${data.bpm} BPM. Open in Svelte DAW to play, edit, and remix.`;
</script>

<svelte:head>
  <title>{title}</title>
  <meta property="og:title" content={title} />
  <meta property="og:description" content={desc} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={desc} />
</svelte:head>
```

The root layout already wrote `<title>` and the meta tags. The child page writes them again — and SvelteKit's `<svelte:head>` deduplicates by treating later tags as overrides of earlier ones for `<title>` and meta tags with the same `name`/`property`. The most-specific (deepest-nested) value wins.

### Making the OG image

Take a screenshot of the DAW with the FFT visualizer running and some pattern playing. Crop or pad to 1200x630. Save as `static/og-image.png`. It'll be served at `$&lbrace;base&rbrace;/og-image.png` after build.

A few tips:

- Use a tool that exports exactly 1200x630. Figma, Sketch, Photoshop, or `convert` from ImageMagick (`convert input.png -resize 1200x630^ -gravity center -extent 1200x630 og-image.png`).
- Keep the most important visual centered. Some platforms crop to a square or 16:9 for thumbnails.
- Avoid text smaller than ~36px. Some platforms downscale the preview, small text becomes unreadable.
- Test by pasting your URL into Discord, Slack, and the iMessage app. Each renders slightly differently.

### Dynamic OG images (optional)

For real polish, the OG image for a shared pattern could be a rendering of the actual pattern grid. There are services that generate this on demand:

- **`@vercel/og`** — works without Vercel hosting if you deploy a small Edge/Worker endpoint that serves the image. The package renders JSX (or Svelte via a wrapper) to PNG at request time.
- **Cloudflare Workers + a canvas-rendering library** — DIY, more code, lives at the edge.
- **Just don't.** A single static OG image is plenty for a personal project. Dynamic OG is polish-on-polish.

### Common mistakes with Open Graph

- **Relative image URLs.** Symptom: image doesn't show in the unfurl card. Fix: use absolute `https://` URLs.
- **Image hosted under the wrong path.** Forgot `$&lbrace;base&rbrace;` so the image is at `/og-image.png` instead of `/svelte-daw/og-image.png`. Symptom: card shows the title but no image. Fix: build the URL with `$&lbrace;base&rbrace;`.
- **HTTP, not HTTPS.** Some scrapers (notably iMessage on iOS) won't show images served over plain HTTP. GitHub Pages and the alternatives all give you HTTPS for free; use it.
- **Cached unfurls.** You fix the metadata, paste the URL in Slack, and still see the old card. The scrapers cache aggressively. Facebook's Sharing Debugger and Twitter's Card Validator let you force a re-scrape. For Slack and Discord, time and a force-refresh are usually enough.
- **Multiple `<title>` tags conflicting.** `<svelte:head>` deduplicates, but only when the tags match exactly. If your layout has `<title>` and your page also has `<title>`, the page wins. If you used `<meta name="title">` somewhere by accident, both render.

## Concept 2: The PWA manifest

### What a PWA actually is

PWA stands for Progressive Web App, which is a loaded term that means: a web app that meets certain checkboxes — installable, offline-capable, served over HTTPS, has a manifest — and as a result, browsers treat it like a quasi-native app. On iOS, that means "Add to Home Screen" produces an icon that launches the app without browser chrome. On Android, that means the browser offers an Install banner and the app gets its own icon, splash screen, and process. On desktop, Chrome and Edge offer an Install button and run the app in its own window.

The minimum requirement is a web app manifest at a discoverable URL. Add a service worker on top and the app becomes installable + offline.

### The manifest

`static/manifest.json`:

```json
{
  "name": "Svelte DAW",
  "short_name": "DAW",
  "description": "A 4-track step sequencer in your browser.",
  "start_url": "/svelte-daw/",
  "scope": "/svelte-daw/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0a0b10",
  "theme_color": "#ff6b4a",
  "icons": [
    { "src": "/svelte-daw/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/svelte-daw/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/svelte-daw/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Field by field:

- **`name`** — the full name. Shown under the icon on first install, in app stores (if you ever publish via TWA), in OS-level settings.
- **`short_name`** — the name on the home screen if `name` is too long. Aim for under 12 characters.
- **`start_url`** — what URL to open when the user launches from their home screen. For a project-Pages deploy, this is `$&lbrace;base&rbrace;/`. The full URL, including the base path.
- **`scope`** — the URL prefix the PWA "owns." Navigations within the scope stay in the PWA; navigations outside open in a real browser. Set it to your base path.
- **`display: "standalone"`** — no browser chrome. The other useful value is `"fullscreen"` (also hides system UI on Android). `"minimal-ui"` keeps a thin bar.
- **`background_color`** — the splash-screen color while the app is loading on first launch.
- **`theme_color`** — the OS-level chrome color (the tab bar on Android, the status bar tint).
- **`icons`** — at minimum a 192 and a 512. Add a 512 with `"purpose": "maskable"` so Android can crop it inside whatever shape the launcher uses without losing important parts of the design.

### Wiring the manifest to the page

In `src/app.html`:

```html
<link rel="manifest" href="%sveltekit.assets%/manifest.json" />
<link rel="icon" type="image/png" sizes="192x192" href="%sveltekit.assets%/icon-192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="%sveltekit.assets%/icon-512.png" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/icon-192.png" />
<meta name="theme-color" content="#ff6b4a" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

The `%sveltekit.assets%` placeholder is replaced at build time with the asset prefix, which respects `BASE_PATH`. The `apple-touch-icon` is for the iOS home-screen icon (Apple ignores the manifest's icons array for that). The two `apple-mobile-web-app-*` tags configure iOS standalone behavior — without them, iOS treats your app like any other web page even after install.

### Making the icons

You need at minimum:

- `icon-192.png` — 192x192, your logo with some padding.
- `icon-512.png` — 512x512, same.
- `icon-512-maskable.png` — 512x512, with your logo in the central 80% (Android may crop the outer 20%).

Tools:

- **Realfavicongenerator.net** — upload one big PNG, get every size and format you need plus a snippet to drop in your `<head>`. Free, fast, no signup.
- **Manual export from Figma/Sketch** — if you want pixel-perfect control.

### Common mistakes with the manifest

- **`start_url` missing `BASE_PATH`.** App installs but launches to a 404. Fix: `start_url` and `scope` both need the base path.
- **Icons referenced with relative paths.** Same fix — use the full path under `BASE_PATH`.
- **No maskable icon.** Android crops your icon awkwardly. Symptom: the icon on the home screen has missing chunks. Fix: add a 512x512 maskable icon with your logo in the central 80%.
- **`theme_color` doesn't match your CSS.** Looks fine in the browser, looks wrong in standalone mode where the OS uses `theme_color` for the status bar. Fix: pick one color and use it both in CSS and in the manifest.
- **Manifest doesn't validate.** Open Chrome dev tools → Application tab → Manifest. It shows parse errors and warnings. Fix anything red.

## Concept 3: The service worker

### What it gives you

A service worker is JavaScript that runs in the background, intercepts network requests, and can return cached responses without hitting the network. For a static app like the DAW, this means:

- **Instant repeat loads.** Second visit hits the cache, not GitHub Pages. Loads in maybe 50ms.
- **Offline operation.** The app works on a plane, on the subway, anywhere there's no network. Since the DAW has no backend, "works offline" is "works exactly the same."
- **Background updates.** When you ship a new version, the service worker fetches it in the background; on the next visit, it activates the new version.

### Using `@vite-pwa/sveltekit`

Writing a service worker by hand is unpleasant. The `@vite-pwa/sveltekit` plugin handles it with reasonable defaults.

```sh
npm install -D @vite-pwa/sveltekit
```

In `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/svelte-daw/',
        navigateFallbackAllowlist: [/^\/svelte-daw\//]
      }
    })
  ]
});
```

The settings that matter:

- **`registerType: 'autoUpdate'`** — when a new service worker is detected, install it and activate immediately on the next page load. The alternative `'prompt'` requires user confirmation; for a personal DAW that's overkill.
- **`manifest: false`** — we have our own `static/manifest.json` already; tell the plugin not to generate one.
- **`workbox.globPatterns`** — which files to precache. Anything in the build output matching these patterns gets stored in the service worker's cache on install.
- **`navigateFallback`** — for SPA routes that aren't precached files, fall through to this URL (which is the SPA shell). Combine with `navigateFallbackAllowlist` to scope the fallback to your base path.

### Verifying it works

Open the deployed app. Open dev tools → Application tab → Service Workers. You should see one registered, with state "activated and is running." Below it, under Cache Storage, you'll see one or more caches with all your app's assets.

Disconnect from the network (dev tools → Network tab → "Offline" checkbox). Reload. The app loads normally. Play a pattern. Save it. Everything works.

### Update behavior

When you push a new version:

1. Action builds, deploys to Pages.
2. Existing users have the old service worker cached. On their next visit, the old SW serves the old shell from cache; in the background, the browser fetches the new SW.
3. The new SW installs, waits for all tabs to close (with `autoUpdate`, the plugin forces activation on next navigation instead of waiting).
4. Next page load, the new version is active.

This is usually fine. If you ship a breaking change to client-side state (e.g., a new schema for saved patterns), the user might run new code against old localStorage. Either version your schema and migrate on load, or accept that the first few minutes after a deploy might have a stale-cache user or two.

### Common mistakes with the service worker

- **No `navigateFallback`.** Direct navigation to `/share/abc/` doesn't match any precached file, the SW returns the network response (or fails offline), the user sees a 404 page. Fix: set `navigateFallback` to the SPA shell.
- **Wrong `globPatterns`.** Missing a file extension means that asset isn't precached, isn't available offline. Symptom: works online, breaks offline. Fix: extend the glob.
- **Service worker scope mismatch.** The SW is registered at `/svelte-daw/sw.js` but tries to control URLs at `/`. Fix: the plugin handles this automatically when `BASE_PATH` is set correctly, but if you wrote a custom registration, make sure the scope matches.
- **Stuck on old version.** Dev tools → Application → Service Workers → "Update on reload" while debugging. For users, "Unregister" the SW and hard reload to nuke the cache.

## Concept 4: The embed route

### Why an embed exists

If you want someone to drop your sequencer into their blog post, you don't want them to iframe the full DAW — it has menus, save buttons, a recordings list, things that don't make sense in someone else's page. You want a stripped-down view: just the sequencer grid and the transport. Maybe a small visualizer.

An embed route is the same Svelte components, composed differently, with no chrome.

### The route

`src/routes/embed/+page.svelte`:

```svelte
<script lang="ts">
  import Sequencer from '$lib/components/Sequencer.svelte';
  import TransportBar from '$lib/components/TransportBar.svelte';
  import FftVisualizer from '$lib/components/FftVisualizer.svelte';
  import { audio } from '$lib/audio/engine.svelte';

  let { data } = $props();

  $effect(() => {
    if (data.pattern) {
      audio.pattern = structuredClone(data.pattern);
      audio.bpm = data.bpm;
    }
  });
</script>

<div class="embed">
  <TransportBar compact />
  <Sequencer />
  <FftVisualizer />
</div>

<style>
  :global(body) {
    margin: 0;
    background: transparent;
    font-family: system-ui;
  }
  .embed {
    display: grid;
    gap: 8px;
    padding: 8px;
  }
</style>
```

Note `:global(body) &lbrace; background: transparent &rbrace;` — when iframed, the host page's background shows through. The embedding page picks the color. That makes the embed look correct in a light blog post, a dark documentation site, anywhere.

### Configuring the embed via URL params

`src/routes/embed/+page.ts`:

```ts
import { decodePattern } from '$lib/audio/encoding';

export const ssr = false;
export const prerender = true;

export function load({ url }) {
  const encoded = url.searchParams.get('pattern');
  if (!encoded) return {};
  try {
    const decoded = decodePattern(encoded);
    return { pattern: decoded.pattern, bpm: decoded.bpm };
  } catch {
    return {};
  }
}
```

Now `<iframe src="https://you.github.io/svelte-daw/embed/?pattern=abc123">` embeds with that pattern preloaded.

Other useful params:

- `?theme=light` — render with a light background. Toggle a class on the embed div based on the param.
- `?autoplay=false` — start with transport stopped (default true). For embedders who don't want sound on page load.
- `?tracks=kick,snare` — show only these tracks. Filter the Sequencer's render.
- `?hideTransport=true` — useful for "preview" embeds where the host page controls playback.

### A snippet to copy

In the main DAW, add a "Get embed code" dialog that shows:

```html
<iframe
  src="https://you.github.io/svelte-daw/embed/?pattern=<encoded>"
  width="600"
  height="400"
  frameborder="0"
  allow="autoplay"
  title="Svelte DAW pattern"
></iframe>
```

The `allow="autoplay"` lets the iframe start its own audio without the parent page needing to grant permission. Without it, browsers block autoplay in iframes.

### Common mistakes with the embed

- **No SSR/prerender flags.** The build fails because the embed route doesn't declare its render mode. Fix: export `ssr = false` and `prerender = true` from `+page.ts`.
- **Solid background that doesn't match the host.** Fix: `:global(body) &lbrace; background: transparent &rbrace;`.
- **Default-on audio without the `allow="autoplay"` attribute.** Iframed audio doesn't play. Fix: tell embedders to include the attribute, or default to autoplay=false in the embed.
- **Forgetting trailing slash.** `/embed` 404s, `/embed/` works (because of `trailingSlash: 'always'`). Snippet should always include the trailing slash.

## Concept 5: Privacy-friendly analytics

### When to bother

If you care whether anyone uses the DAW, add analytics. If you don't, skip this section and save yourself the complexity.

Google Analytics is the default because it's free, but it's heavy, requires a cookie banner in most jurisdictions, and shares data with Google. For a personal project, the alternatives are better.

### Options

- **Plausible** — paid, ~$9/month for low traffic, free self-hosted. Lightweight (`&lt;1KB`), no cookies, no banner required.
- **Umami** — free, open source, self-host on Cloudflare Pages or a small VPS. Same shape as Plausible.
- **Cloudflare Web Analytics** — free if your DNS is on Cloudflare. Aggregate, privacy-respecting, lives in your Cloudflare dashboard.
- **GoatCounter** — free for personal use, hosted or self-hosted. Minimalist.

All four work the same way: add a small script to your `<head>`, see aggregated stats in their dashboard.

### Adding Plausible

In `src/app.html`:

```html
<script defer data-domain="your-domain.com" src="https://plausible.io/js/script.js"></script>
```

The `defer` attribute makes it load without blocking the page. The script weighs about 1KB. Plausible's dashboard shows page views, unique visitors, top pages, top referrers, top countries — and that's deliberately the entire feature set.

For custom events (e.g., "pattern shared," "recording downloaded"):

```ts
// declare the global plausible function for TypeScript
declare global {
  function plausible(event: string, options?: { props?: Record<string, string> }): void;
}

function onShareClick() {
  plausible('Pattern shared', { props: { bpm: String(audio.bpm) } });
}
```

The dashboard groups by event name and shows the props as filters.

### Common mistakes with analytics

- **Adding it before you ship.** You don't need analytics for a side project that nobody knows about. Wait until you've shared the URL somewhere; the data won't be interesting until then.
- **Custom events that fire too often.** "Pattern changed" firing on every cell toggle floods the dashboard. Throttle, or fire only on meaningful events (shared, saved with a name, downloaded).
- **Forgetting to add the domain to the analytics provider's allowlist.** Stats don't appear, no error in the console. Fix: configure the provider's project to accept your domain.

## Concept 6: A README that does its job

### What people actually read

When someone finds your GitHub repo, they scan. Maybe ten seconds. They look at the top of the README and decide whether to keep reading or close the tab. So the top of the README has to convey: what is this, is it for me, what does it look like, can I try it.

A good structure:

1. **Project name + one-line description.** Bold, at the top. "A 4-track browser DAW with shareable patterns."
2. **Screenshot.** A clean one. The first thing under the description. Drag-and-drop into a GitHub issue, copy the markdown URL.
3. **A live demo link.** "Try it: https://...". Single bullet, top of the page.
4. **What's in it.** A short bulleted list of features. Not a feature dump — the headline features.
5. **Run it locally.** Three commands max. `git clone`, `npm install`, `npm run dev`.
6. **The interesting bits.** A "Notes on a few non-obvious bits" or similar — the architectural choices that distinguish your project. This is what makes the README read like the work of someone who thinks about what they ship, not someone who just shipped.
7. **Credits.** Tone.js, SvelteKit, anything you depend on.
8. **License.** Usually MIT.

The reference repo's README (`capstone-reference/README.md`) is a good template. It's short, scannable, opinionated about which details matter, and signals competence without bragging.

### What to leave out

- Long installation troubleshooting sections. If your install requires troubleshooting, fix the install instead.
- Roadmap items that don't exist. People want to know what is, not what might be.
- Walls of badges. One for the deploy status if you want, none if you don't. Nobody is impressed by a row of seven badges.
- Inflated marketing copy. "Revolutionary," "next-generation," "redefining" — these are spam signals.

### Common mistakes with READMEs

- **No screenshot.** Fix this first. Doubles or triples the chance someone clicks "try it."
- **The screenshot is from before the last visual change.** Re-screenshot after any UI change that affects what the project looks like at first glance.
- **No demo link.** People aren't going to `git clone` a project to evaluate it. Make sure there's a live URL near the top.
- **Setup section before the screenshot.** The screenshot is the sell. Setup is the after-action. Order matters.

## Concept 7: Where to share

Sharing a side project takes 20 minutes and reaches more people than you'd guess. The places that are worth the time:

- **Bluesky / Mastodon / Twitter** — a screenshot, a one-line description, the URL. Tag with `#svelte` and `#webaudio` if it fits.
- **Reddit** — r/svelte (small but engaged), r/webdev (larger), r/audioengineering (audio-specific). Each subreddit has different rules about self-promotion; read them.
- **Hacker News (Show HN)** — works if you have a real angle. "I built a DAW with Svelte 5" is not a story. "How I implemented sample-accurate scheduling with rune state" is. Lead with the technical observation.
- **The Svelte Discord's `#showcase` channel** — small audience, friendly, you'll get useful early feedback.
- **The Web Audio API community** — `#web-audio` on Tonejs Slack, the Web Audio Slack workspace, r/webaudio. People here will spot audio-engine bugs you didn't notice.

Where not to bother:

- LinkedIn, unless you're hiring or being hired. The audience isn't users.
- Tiktok / Instagram / Threads, for a tool-with-no-visual-spectacle.
- Spammy aggregator sites that ask you to pay to be listed.

### Calibrating expectations

A side project getting a few hundred visits on launch day is normal-good. Twenty visits is also fine. The metric that matters is whether the people who try it come back, give you feedback, or tell other people. Quality of attention beats quantity.

## Putting it together

The full polish pass, in order:

1. Add Open Graph + Twitter Card meta tags to the root layout. Make a 1200x630 screenshot and drop it in `static/og-image.png`.
2. Override the title and description on the share route per pattern.
3. Write `static/manifest.json` with the right `start_url` and `scope` for your base path. Generate 192/512/maskable icons. Reference them in `src/app.html`.
4. Add `@vite-pwa/sveltekit` to `vite.config.ts` with `navigateFallback` pointing at your SPA shell.
5. Create `/embed/` with the sequencer, transport, and FFT — transparent body, optional URL params.
6. Add a privacy-friendly analytics script to `app.html` if you want stats.
7. Rewrite the README with a screenshot at the top, a live demo link, and the interesting-bits section.
8. Push, wait for the deploy, then paste the URL into Slack, Discord, and iMessage to verify the unfurl card looks right.
9. Share the URL on one or two platforms where the audience makes sense.

Each step is small. The cumulative effect is the difference between a deployed project and a shareable one.

## Exercises

### Exercise 1: Ship the OG metadata

**Setup:** the deployed DAW from L1.

**What to do:** add the Open Graph and Twitter Card meta tags to `src/routes/+layout.svelte`. Make a 1200x630 screenshot, drop it at `static/og-image.png`. Build, deploy. Paste the live URL into Slack or Discord.

**Verify by:** the unfurl card shows your title, description, and screenshot. The screenshot isn't broken or cropped weirdly.

**Stretch:** add per-pattern OG title and description on the `/share/[encoded]/` route. Paste a shared-pattern URL into Slack; the card should show the pattern name (or "Untitled pattern") in the title.

<details>
<summary>Show solution</summary>

See Concept 1. The trick is the absolute URL for the image and the use of `$page.url.pathname` for the canonical `og:url`. The per-pattern override works because `<svelte:head>` deduplicates meta tags by `name`/`property` and the deeper-nested page wins.

</details>

### Exercise 2: Make it installable

**Setup:** the deployed DAW with OG already done.

**What to do:** create `static/manifest.json` and the three icon PNGs. Reference them from `src/app.html`. Build, deploy. On a phone, visit the URL and use "Add to Home Screen" (iOS) or the Install prompt (Android). On desktop Chrome, click the install icon in the address bar.

**Verify by:** the app icon appears on your home screen with the icon you specified. Tapping it opens the DAW without browser chrome. The status bar (mobile) or window chrome (desktop) shows your `theme_color`.

**Stretch:** add the maskable icon and verify on Android that the launcher's crop doesn't cut off important parts of your logo.

<details>
<summary>Show solution</summary>

See Concept 2. The most common stumble is forgetting to include `BASE_PATH` in `start_url` and `scope` — without that, the installed app launches into a 404. Use the actual deployed path, including the trailing slash.

</details>

### Exercise 3: Make it work offline

**Setup:** an installable DAW from Exercise 2.

**What to do:** install `@vite-pwa/sveltekit`. Add the plugin to `vite.config.ts` with the config from Concept 3. Build, deploy. Open the live URL. Open dev tools → Application → Service Workers; verify one is registered. Toggle "Offline" in the Network tab. Reload the page.

**Verify by:** the DAW loads and works offline. The console shows no network errors. Playback works (Tone.js doesn't need network for synth voices).

**Stretch:** ship a small change (any visible UI tweak). Wait a minute, then reload. The change should appear within 1-2 reloads (the SW updates in the background, activates on next navigation with `autoUpdate`).

<details>
<summary>Show solution</summary>

See Concept 3. The most common offline-broken case is `navigateFallback` not being set, so direct navigation to deep links fails offline. Verifying the SW state in dev tools is essential — if the SW isn't activated, none of the caching is happening.

</details>

### Exercise 4: Build the embed route

**Setup:** the deployed DAW.

**What to do:** create `src/routes/embed/+page.svelte` with the Sequencer + TransportBar + FftVisualizer composed for an iframe. Add `src/routes/embed/+page.ts` that reads `?pattern=` from the URL. Build, deploy. Create a tiny HTML file locally with an iframe pointing at `https://you.github.io/svelte-daw/embed/`. Open it in a browser.

**Verify by:** the iframe renders the sequencer + transport + FFT. Pressing PLAY (inside the iframe) plays sound. The host page's background shows through.

**Stretch:** add `?theme=light` support. The embed reads the param, applies a class, light-themed CSS kicks in. Verify by adding the param to the iframe src.

<details>
<summary>Show solution</summary>

See Concept 4. The transparent body and the `allow="autoplay"` attribute on the iframe are the two non-obvious bits. Without `allow="autoplay"`, modern browsers block iframed audio entirely.

</details>

### Exercise 5 (stretch): Write the README

**Setup:** a deployed and installable DAW.

**What to do:** rewrite the README following Concept 6. Screenshot at the top. Live demo link near the top. Five or six sections, scannable. A "Notes on a few non-obvious bits" with two or three architectural choices that show you thought about them. Push.

**Verify by:** read the README yourself, top to bottom, in two minutes. Does it answer "what is this," "should I try it," "how do I run it," "what's interesting about it"? If yes, ship.

**Stretch:** put the same project up on Cloudflare Pages or Netlify (from L1 Exercise 5) and link both deploys from the README so people can pick.

<details>
<summary>Show solution</summary>

The model is `capstone-reference/README.md`. Short. Opinionated about details. Doesn't oversell. The "Notes on a few non-obvious bits" section is what separates a README written by someone who cares from one that just lists features.

</details>

## Checkpoint

By the end of this lesson, your project should have:

- Open Graph + Twitter Card meta tags in `src/routes/+layout.svelte`.
- Per-route OG overrides on `/share/[encoded]/`.
- A 1200x630 `static/og-image.png`.
- `static/manifest.json` with correct `start_url` and `scope` under your base path.
- Three icon PNGs (192, 512, 512-maskable) in `static/`.
- Manifest and icon links in `src/app.html`.
- `@vite-pwa/sveltekit` configured in `vite.config.ts`.
- `src/routes/embed/+page.svelte` and `+page.ts` with optional URL params.
- (Optional) A privacy-friendly analytics script in `src/app.html`.
- A README with a screenshot, a live demo link, and an interesting-bits section.

### Verify it works

- Paste the live URL into Slack, Discord, and iMessage — each shows a proper unfurl card.
- "Add to Home Screen" on iOS and Install on Android both work; the installed app opens without browser chrome.
- Dev tools → Application → Service Workers shows an activated SW; offline mode reloads successfully.
- The embed route renders in an iframe with transparent background and working audio.
- (If analytics added) Visiting the live URL produces a visit in your analytics dashboard.
- The README, read top to bottom, answers the four questions in under two minutes.

### Compare against the reference

- `capstone-reference/README.md` — the README structure.
- `capstone-reference/src/routes/embed/` — the embed pattern.
- `capstone-reference/svelte.config.js` — the prerender + fallback config that makes all of this work.

## Common questions

**Q: My PWA installs but launches to a blank screen on first open. Why?**
A: Almost always `start_url` doesn't include the base path. Open the installed app, the browser launches to `/` instead of `/svelte-daw/`, the SPA shell isn't there. Fix: `start_url: "/svelte-daw/"` (matching your `BASE_PATH`).

**Q: The OG image works on Facebook and Slack but not iMessage. Why?**
A: iMessage caches aggressively and is picky about image format and size. Make sure the image is exactly 1200x630, PNG, under 1MB, served over HTTPS. If it still doesn't show, sometimes you need to ship the URL from a new domain (or wait — iMessage's cache eventually invalidates).

**Q: Should I version the service worker so users get updates fast?**
A: `@vite-pwa/sveltekit` with `registerType: 'autoUpdate'` handles this — the plugin hashes content and detects new versions automatically. Manual versioning is mostly noise unless you have a specific reason.

**Q: How do I support both light and dark themes in the embed?**
A: Use CSS custom properties for color values, then either toggle a class based on a URL param or use `prefers-color-scheme` media query. The embed will follow the host page's preferred color scheme automatically if you do the latter.

**Q: Do I need a privacy policy if I add Plausible?**
A: Most jurisdictions don't require one for genuinely cookieless, aggregate-only analytics. The EU's ePrivacy directive specifically exempts non-tracking, non-identifying analytics from cookie-banner requirements. Plausible publishes a sample policy you can use; most personal projects skip it.

**Q: What about a CMS for blog posts about the project?**
A: Out of scope for the DAW. If you want a blog alongside, MDsveX in another SvelteKit project (or this one with an extra route) is fine. Don't add a CMS.

## What's next

The DAW is shipped, polished, installable, embeddable. The plumbing is done. The last lesson steps back from the code and asks the question the whole course has been preparing you to answer: now that you've actually used Svelte to ship something substantial, where does it sit among the alternatives? When should you reach for it? When shouldn't you? And what's the working answer when someone asks?

<SourcesSection lessonKey="08-ship-and-synthesis/02-polish-share" />

<LessonNav />

</article>

<style>
  .lesson {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 var(--sp-6) var(--sp-7);
  }
</style>
