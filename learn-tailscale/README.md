# Learn Tailscale

A clear, kind walkthrough of Tailscale — from "what even is a VPN" to running your own AI gateway, hosting your media library, and connecting every device you own. No prior networking expected.

**Open `dashboard.html` in a browser to start.**

## What's inside

- **Foundations** (5 modules + optional terminal primer): just-enough networking, what Tailscale is, onboarding every OS you own, the toolbox (Serve, Funnel, ACLs, exit nodes, subnet routers), and ops/security.
- **Project gallery** (20 projects): five Core projects walked end-to-end, eight Featured deep-dives (including a 3-part Local AI sequence: private API → chat UI → multi-user proxy), seven Gallery projects covering everything from Pi-hole to private game servers to self-hosting the control plane with Headscale.
- **Tools** (7 interactive utilities): ACL sandbox, topology visualizer, "is it safe to expose?" decision tree, networking playground, onboarding checklist, searchable glossary, CLI cheatsheet.
- **Capstone**: a Home Network Planner — design your own setup, export plan + auto-generated Tailscale ACL.

## Three paths through it

- **Quickstart** (~3–5 hours, one weekend): minimum networking + Tailscale basics + onboard 2 devices + one Core project.
- **Comprehensive** (~6–8 weeks at 5hr/wk): full foundations + every project.
- **Project-driven**: pick a project from the gallery; prerequisites pull you through the foundations as needed.

## Format

Every lesson is one HTML page with:
- A two-pane narrative + scroll-driven diagram (or single-pane for shorter lessons)
- Inline glossary chips — hover any underlined term for a one-line definition
- Quick path / Deep path toggle at the top, sticky as you scroll
- "Natural break point" markers so you can stop and come back
- 3 multiple-choice knowledge checks at the bottom (no grading, just confidence)

Module index pages show progress; the dashboard shows everything across the whole course.

## Time and cost

| | |
|--|--|
| **Time** | ~5 hr/wk · 6–8 weeks for comprehensive · 3–5 hours for quickstart |
| **Cost** | **Free.** Tailscale's free tier (100 devices, 3 users) covers everything in this course. |
| **Optional** | A $5/mo cloud VM if you want a public exit node (Project: GL.iNet travel router). All other projects use hardware you already own. |

## Running it

Everything is plain HTML/CSS/JS. CDN-loaded libraries (canvas-confetti, etc.) work after first load even offline.

- **Locally**: double-click `dashboard.html`. Done.
- **Hosted**: this folder is part of [teach-me-engineering](https://bjamba.github.io/teach-me-engineering/), live at `bjamba.github.io/teach-me-engineering/learn-tailscale/dashboard.html`.

Progress is saved in `localStorage` (namespace `ts_`). It persists per browser, per device. There's no account.

## Credits

Some lessons embed images or videos from external sources. Every external work is attributed in [`credits.html`](credits.html) with author, source URL, and license.

## License

The course content (text, lesson HTML, diagrams) is original to this repo. Linked third-party works retain their original licenses, listed in `credits.html`.
