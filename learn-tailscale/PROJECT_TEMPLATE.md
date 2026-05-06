# Project page template

The standardized structure for every project page in this course. Use this as the blueprint when adding a new project, and as a reference when editing an existing one.

## Header bar (already standardized — keep as-is)

Every project page opens with:

- **Crumb**: `⭐ Core project · #N` / `Featured project` / `Gallery project`
- **H1**: emoji + concise title
- **Deck**: single-paragraph hook (the most compelling sentence about why someone would build this)
- **Badge row**: tier · topic · difficulty · time estimate · prereq chip

## Required sections (in order)

Every project must have all 7 of these. Any missing → it's not done.

### 1. Why this project

The problem this solves and the motivation. 1–3 short paragraphs. Names the pain that the without-Tailscale alternative creates. Avoid jargon dumps; reach for the human story (e.g. "Cloud LLM APIs cost money and see your prompts" rather than a feature list).

### 2. Who this helps

Concrete audience. Format as a bulleted list of "If you ... this is for you" statements, or a single short paragraph naming the persona. Two to four bullets is the sweet spot.

### 3. What you get

The concrete outcome after completing the project — the "after picture." Bulleted list of capabilities or experiences the reader will have. Each bullet should be specific (not "secure access" but "SSH from any device using just the hostname").

### 4. Prerequisites

What's needed before starting:

- Foundation modules (e.g. "M3 onboarding", "M4L4 Funnel")
- Other projects (e.g. "Local AI gateway")
- Hardware (e.g. "always-on home server with 16GB+ RAM")
- Software (e.g. "Docker installed on host")
- Accounts (e.g. "GitHub account if exposing webhook")

Format as a bulleted list. Reference module/project links where relevant.

### 5. Steps

The walkthrough itself. Use the existing `<div class="steps">` / `<div class="step">` HTML structure with auto-numbered headings. Each step has:

- Verb-led `<h3>` describing the action ("Pull the model", "Wire up the sidecar")
- Estimated time in `<span class="est">~N min</span>` aligned right
- Body content with code blocks, inline comments, and OS tabs where relevant

Aim for 4–10 steps. If a step would be more than 4 minutes of reading, split it.

### 6. Verify

Checklist of how to confirm the project worked. Bulleted list, each line testable on its own:

- "From any tailnet device, `curl /api/tags` returns your model list"
- "Open WebUI loads from your phone over the tailnet"
- "Generation responses come from your machine (CPU/GPU usage spikes on the host)"

### 7. Where this leads

Pointer to 2–4 natural next projects with a one-line "why follow this one." Use anchor links to other project pages.

## Optional sections (use when they add value, in this fixed order if used)

### Mental model *(placement: after "What you get")*

For projects where a single named pattern is the real takeaway (Docker sidecar, RAG, family-support's "two patterns"). One paragraph naming the pattern + a sentence on why it matters. Skip when the project is just step-following.

### Hardware notes *(placement: after "Prerequisites")*

For projects with non-trivial hardware needs (Jellyfin transcoding, Local AI rig, game server, Immich). Three-tier bulleted spectrum:

- **Minimum** — what barely works
- **Comfortable** — what's reasonable for most people
- **Excellent** — what feels great if you have it

Skip when the project's needs are "any computer."

### Common issues *(placement: after "Verify")*

Troubleshooting bullets for problems that break **during** setup. Format: `**Symptom** — fix.`

Example: `**Cert provisioning fails** — make sure HTTPS Certificates is enabled in admin → DNS.`

Skip when the setup is genuinely uncomplicated (a few projects need this; most do).

### Variations *(placement: after "Common issues")*

Alternate forms of the same project, or adjacent services that follow the same recipe. Bulleted list. Each variation is one sentence.

Example: `**Plex**: same Docker pattern, image plexinc/pms-docker, port 32400 instead of 8096.`

### Caveats *(placement: before "Where this leads")*

Known limitations of the approach **even when it works correctly**. Distinct from "Common issues" — these are "things to know going in," not "things to fix." Bulleted list.

Example: `Latency: every packet detours through home and back. For chat/email, fine. For online games, no.`

## Things that are NOT top-level sections

Use callout blocks (`.callout`, `.warn`, `.aha`) within other sections, not their own H2:

- "Why this is better than X" → callout in "Why this project"
- "Don't do this without auth" → `.warn` callout in "Steps" or "Caveats"
- "Critical: backups" → step or callout in "Steps"

## Length guidance

A typical Core project: 350–500 lines of HTML.
A typical Featured project: 250–400 lines.
A typical Gallery project: 150–250 lines (still all 7 required sections, just terser content).

If a project is longer than 600 lines, it's probably trying to teach two things — split it.

## Voice and tone

- Match the rest of the course: clear, kind, not gatekept.
- Plain language. Glossary chips for new terms only when introducing them.
- "You" not "the user."
- No emoji except the H1, the section icons (📋 etc. used in callouts), and any natural punctuation.
- Code blocks are command-line accurate. No placeholder commands like `<your-thing>` — use real example values like `your-server.tail-abc.ts.net`.

## Quick checklist before considering a project page done

- [ ] All 7 required sections present in the right order
- [ ] Header has tier/topic/difficulty/time/prereq badges
- [ ] Steps use the `<div class="steps">` / `<div class="step">` structure with `<span class="est">` time estimates
- [ ] Verify section has 3+ testable bullets
- [ ] Where this leads has 2–4 onward links
- [ ] Optional sections (if any) are in the right place in the order
- [ ] No "Chris" or other identifying personal info
- [ ] Reads as 250–500 lines depending on tier
