# Utility Data Engineer — Contract Prep Course

A job-aligned curriculum for a Data Engineer role in the utility industry. Every module maps to a line of the target role's required-skills list. Designed for a senior DevOps/SRE engineer transitioning into DE.

## Quick start

Open `dashboard.html` in any browser. That's it. No build, no server, no accounts.

The course works entirely from `file://` — double-click `dashboard.html` and you're in.

## What's inside

- **`dashboard.html`** — home base. Shows the full skills list, your background-vs-skills alignment, progress, cost transparency, module list. Toggle between **Crash Course** and **Deep Dive** mode at the top.
- **9 modules** covering Snowflake, AWS, Python, Matillion, Git/Jenkins, Governance, Streaming, and a utility-capstone.
- **`notepad.html`** — persistent notes, tagged by module, exportable to TSV/CSV for Google Sheets.
- **`flashcards.html`** — Leitner spaced repetition per module, keyboard and touch-friendly.
- **`glossary.html`** — every term used in the course, searchable.
- **`credits.html`** — external resources, deep-dive pointers per module, full cost transparency table.

## Study modes

- **🔥 Crash Course** — interview-ready across every required skill. ~30 hrs. Skips depth, hits every topic, gets you speaking with specificity.
- **🏗️ Deep Dive** — on-the-job hardening once in the role. ~80+ hrs. Extra lessons, optional labs, full capstone.

Toggle switches every view. Both modes share the same module structure; crash-only lessons are filtered out when you're in crash mode.

## Hands-on accounts

To really learn, you need to touch real services. Account setup is the first exercise in each module that requires one. All free-tier. Cost-guardrail instructions are inline.

- **Snowflake** — 30-day trial, $400 credits, no card. Walk through in `module-02-snowflake/exercises/exercise-01-free-tier-setup.html`.
- **AWS** — 12-month free tier. Walk through in `module-04-aws/exercises/exercise-01-free-tier-setup.html`.
- **Matillion Hub** — 14-day trial + ongoing free tier. Walk through in `module-05-matillion/exercises/exercise-01-first-job.html`.
- **Kafka** — local Docker. Zero cost.
- **Jenkins** — local Docker or your existing work access.

Total realistic cost if you follow the guardrails: **$0–$3**.

## Mobile use

Every page is mobile-responsive. Tested at 375px width. Works great on a phone for flashcards + glossary during downtime. Code-heavy lessons and exercises are easier on a laptop, but readable on mobile.

## Progress tracking

Every lesson and exercise has a "Mark as complete" button. Progress is stored in browser localStorage — don't clear site data on this folder unless you want to reset.

Your notepad (local storage), exercise drafts (local storage), and flashcard boxes (local storage) all persist between sessions.

## Structure

```
utility-data-engineer/
├── dashboard.html              ← start here
├── notepad.html
├── flashcards.html
├── glossary.html
├── credits.html
├── curriculum.json             ← source of truth for curriculum state
├── README.md
├── TUTOR_CONTEXT.md            ← context for AI tutor sessions
│
├── assets/
│   ├── style.css               ← shared design system
│   ├── progress.js             ← localStorage progress tracker
│   ├── notepad.js              ← floating notepad widget (on every page)
│   ├── flashcards.js           ← Leitner engine
│   ├── flashcard-data.js       ← deck content
│   └── glossary-data.js        ← glossary terms
│
└── module-01-orientation/      ← each module: index + lessons + exercises/
    ├── index.html              ← module overview, skill-mapping, lesson list
    ├── lesson-01-...html       ← substantive first lesson
    ├── lesson-02-...html       ← stub (expand in tutor mode)
    └── exercises/
        └── exercise-01-...html ← hands-on lab
```

## Design notes

- Everything is self-contained HTML with CDN-free JS. Works offline.
- Code-block formatting is by hand (not a JS syntax highlighter) to keep the page lightweight on phones.
- No analytics, no tracking, no external JS dependencies at all.

## Continuing with a tutor

This course is designed to be picked up by an AI tutor — open a conversation in this folder and ask to "continue the course" or "expand lesson X.Y". The tutor reads `curriculum.json` and `TUTOR_CONTEXT.md` to know where you left off and what tone to use.
