# learn-godot

A self-paced curriculum for learning Godot 4 and shipping mobile games.

**Start here:** open `dashboard.html` in your browser.

## What this is

A working learning environment — not a tutorial you read, a workspace you use. Eight modules, one capstone (**Lexicon Duel** — a turn-based word/card roguelike), a pile of GDScript source files to paste into a real Godot project, and a few browser tools to sanity-check mechanics before writing engine code.

## Timeline

At ~5 hours/week:
- Module 1–2: ~2 weeks (foundations)
- Module 3–5: ~6 weeks (architecture, card/word systems, turn logic)
- Module 6: ~1 week (polish)
- Module 7: ~2 weeks (ship to Android)
- Module 8: ~1 week (MCPs / vibe coding workflow)
- **Total: ~3–4 months to first shippable prototype**

## Cost

Free. Everything in this repo runs locally. Godot is free. Android export is free. iOS export requires an Apple Developer account (~$99/year) if you want to actually submit to the App Store — we'll cross that bridge in Module 7. PixelLab (Module 8) has a free tier plus paid generation credits if you want AI-generated pixel art.

## How to use it

1. **Install Godot 4**: https://godotengine.org/download
2. Open `dashboard.html` in your browser — it tracks your progress in `localStorage` and links to every lesson.
3. Work through Module 1 → Module 8 roughly in order. Architecture modules (3, 5) unlock a lot.
4. The `capstone/godot-project/` folder has starter GDScript files. Paste these into a real Godot project as you progress.
5. When you return, re-open `dashboard.html`. Your progress is preserved.

## Repo layout

```
learn-godot/
├── dashboard.html             # progress tracker — your home base
├── curriculum.json            # machine-readable state
├── credits.html               # external sources and attributions
├── TUTOR_CONTEXT.md           # for Claude, not you
├── module-01-foundations/     # …through module-08
├── capstone/                  # Lexicon Duel design + starter Godot files
├── tools/                     # browser utilities (deck sim, word sandbox, etc.)
└── progress/                  # your notes and journal
```

## Working with Claude as your tutor

When you open this repo in a Claude Code session, Claude will read `curriculum.json` and `TUTOR_CONTEXT.md` and pick up where the last session left off. Tell it what was worked on, what's confusing, or just say "continue" and it will take it from there.
