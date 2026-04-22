# Front-End Engineering

A curriculum for going from React fundamentals to front-end fluency. Covers React deeply, React Native, CSS, component patterns, design taste, accessibility, theming, and data visualization — anchored by a real analytics dashboard built end-to-end.

## How to use

1. **Open `dashboard.html`** in your browser (double-click the file). That's your home base.
2. **Work through modules in order.** Each lesson is a single HTML file with embedded interactive playgrounds.
3. **Check items off on the dashboard** as you complete them. Progress saves in your browser's localStorage.
4. **Come back to `/teach-me`** in this folder whenever you want to continue with Claude — it reads `curriculum.json` and picks up where you left off.

## What's built now vs later

Modules 1–3 are built in full depth and ready to work through immediately.

Modules 4–8 are scaffolded with objectives but the lessons are built by Claude on arrival. This keeps the content fresh and lets it adapt to what has already been covered.

| # | Module | Status |
|---|---|---|
| 1 | CSS & Layout Fundamentals | ✅ Built |
| 2 | React Deeply — Hooks, State, Rendering | ✅ Built |
| 3 | Component Patterns & Architecture | ✅ Built |
| 4 | Design Taste & UI/UX Patterns | 🔜 Built on arrival |
| 5 | Accessibility as a First-Class Concern | 🔜 Built on arrival |
| 6 | Theming & Component Libraries | 🔜 Built on arrival |
| 7 | Data Visualization | 🔜 Built on arrival |
| 8 | React Native for Mobile | 🔜 Built on arrival |

## Timeline

- **Suggested pace:** weekends + 1–2 hrs on weekdays
- **First milestone:** significant improvement within ~1 month (modules 1–2 done)
- **Full curriculum:** ~3 months at that pace
- **Cost:** $0 — everything runs in your browser, no accounts needed

## The capstone

By the end, you'll have built a production-quality **analytics dashboard**:
- Upload or connect datasets (CSVs to start)
- A chart library with standard + non-standard visualizations (sankey, radial, bump, calendar heatmaps)
- Clean design system with light/dark themes
- Fully accessible (keyboard nav, screen readers, WCAG AA)
- React Native companion app

Each module contributes a piece. By Module 3 you'll have primitives; by Module 7 the full chart gallery; by Module 8, mobile support.

## File layout

```
frontend-engineering/
├── dashboard.html               # Home base — start here
├── curriculum.json              # Source of truth for progress
├── credits.html                 # External source attributions
├── shared/styles.css            # Shared design system
├── module-01-css-layout/
│   ├── lesson-01-*.html
│   └── exercises/
├── module-02-react-deeply/
├── module-03-component-patterns/
├── module-04-08 ...             # Built on arrival
├── capstone/                    # The dashboard app (added in later modules)
└── progress/
    ├── journal.md               # Your notes — write freely
    └── notes/                   # Anything you want to keep
```

## Working with Claude

Inside this folder:

```
/teach-me
```

Claude detects `curriculum.json` and enters tutor mode — picks up where you left off, answers questions, creates extra exercises when something isn't clicking, and updates `curriculum.json` as progress is made.

For out-of-band questions (not strictly front-end): open a new conversation outside this folder so tutor mode stays focused.
