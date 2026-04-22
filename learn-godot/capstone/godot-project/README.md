# Lexicon Duel — Starter Project

Minimal but runnable Godot 4.3 scaffold for the capstone. Open `project.godot` in Godot and hit Play — you should see "Lexicon Duel scaffold loaded" with some debug output in the bottom panel.

## What's here

- `scripts/` — autoloads (Global, Events, SFX, SceneTransition), base classes (Combatant, CardData, CardEffect, StatusEffect), DuelController
- `scenes/Main.tscn` — the starter scene (points at `scripts/main.gd`)
- `data/` — where your CardData and EnemyData `.tres` resources live
- `assets/` — audio and art
- `CLAUDE.md` — project context for Claude Code sessions (reads automatically)

## What's NOT here yet

Everything that makes it a game. The scaffold is scaffolding — the curriculum's module exercises turn it into Lexicon Duel. Expect to:

1. Add a `Hand` scene (Module 2 exercise) — tap tiles to select
2. Wire `WordValidator` with ENABLE dictionary (Module 4 exercise)
3. Hook the DuelController to a real Main scene with Player + Enemy nodes
4. Add enemies via EnemyData resources (Module 5 exercise)
5. Polish pass (Module 6)
6. Export to phone (Module 7)
7. Add PixelLab-generated art (Module 8)

## Running the project

```
# From this directory (after installing Godot 4.3)
godot --path . --headless  # runs once, prints output, exits
```

Or open `project.godot` in the Godot editor.

## Exporting to Android

See `learn-godot/module-07-mobile-export/lesson-01-android-setup.html`. Once configured, the one-liner is:

```
godot --headless --export-debug "Android Debug" build/lexicon-duel-debug.apk
```

Or use the `deploy.sh` script from Module 7 Exercise 1.
