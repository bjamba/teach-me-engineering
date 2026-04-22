# Hosting notes

This repo is served as a static site via GitHub Pages at **https://bjamba.github.io/teach-me-engineering/**. Each course is a self-contained subfolder. Courses must work identically whether opened locally via `file://` or loaded through Pages.

This file is a short checklist of things that can silently break between those two environments — and the house rules for avoiding them.

## Path prefixes differ

- `file://` → path is your absolute filesystem path (`/Users/you/code/...`).
- GitHub Pages → path is prefixed by the repo name (`/teach-me-engineering/...`).
- A custom domain would strip that prefix again.

**Rule: never compute paths from `window.location.pathname`.** It's different in every environment. If you need to derive a prefix from JS, read it from `document.currentScript.src` — whatever prefix was used to load your script is the same prefix you need for sibling assets. See `utility-data-engineer/assets/notepad.js` for the pattern.

Every `href`, `src`, and `<link>` should be a **pure relative path** (`../assets/foo.css`, `index.html`, `../module-02/lesson-01.html`) — never absolute (`/assets/foo.css`), never root-relative.

## localStorage is shared across all courses

All courses served from `bjamba.github.io` share a single origin, so they share one `localStorage`. Unprefixed keys like `"notes"` or `"progress"` collide between courses.

**Rule: every localStorage key gets a per-course prefix.** Pick a short namespace in `curriculum.json` (e.g. `ude_`, `godot_`, `mlai_`, `fe_`) and use it on every key that course writes. When reviewing a course, grep for `localStorage.setItem` and verify every key is prefixed.

## Case sensitivity

macOS filesystems are usually case-insensitive; Pages (Linux) is case-sensitive. A link to `Module-01/Lesson.html` may work locally and 404 when hosted.

**Rule: folder and file names are always lowercase-kebab-case** (`module-01-orientation`, `lesson-01-foo.html`). Grep-check before shipping.

## CDN-loaded libraries

We use CDNs (Tone.js, p5.js, CodeMirror, etc.) loaded from `https://`. Those work fine under `file://` (browsers allow cross-origin scripts) and under Pages. But:

- ES module imports (`<script type="module">`) fail under `file://` in Chromium-family browsers. Use classic scripts only.
- Subresource integrity (`integrity="sha..."`) is optional but welcome on CDN URLs.

## Offline after first load

Courses should keep working offline once the CDN libraries have been cached by the browser. **Don't add runtime API calls** (to OpenAI, Anthropic, weather APIs, etc.) that the course depends on — they'll break for a learner on a plane.

## Verifying a course before promoting it

Before removing a course from `.gitignore` and shipping it to Pages, walk this checklist:

1. **Open the dashboard from `file://`.** Click every top-level link. No 404s.
2. **Open a module index, a lesson, an exercise.** Click every link. No 404s.
3. **Grep for the four hazards:**
   - `window.location.pathname` → if present, verify the code works with arbitrary URL prefixes (see Rule 1).
   - `localStorage.setItem\|getItem` → verify every key is course-prefixed.
   - Absolute paths in `href=` or `src=` (e.g. `href="/assets`) → remove.
   - Uppercase letters in file names (`find . -name '*[A-Z]*.html'`) → rename.
4. **After push**, hit the live URL. Load a deep page (exercise inside an exercises/ folder). Open the browser console. No 404s, no CORS, no cache errors.

## When a course is genuinely local-only

Keep it in `.gitignore`. Reasons a course should stay local:
- Contains or is built around any third-party PII that shouldn't be published.
- Uses experiments, drafts, or personal notes the learner hasn't cleaned up.
- Relies on private data the learner loaded into the course folder.

`TUTOR_CONTEXT.md` is gitignored globally (via `**/TUTOR_CONTEXT.md`) regardless of whether the course as a whole is published. It's for future-Claude, not the public.
