# Lexicon Duel — Claude Context

You are helping build **Lexicon Duel**, a turn-based word/card roguelike for Android (primarily) and iOS. Godot 4.3, GL Compatibility renderer, portrait orientation.

## Stack

- Godot 4.3 stable (GL Compatibility renderer for mobile)
- Target: Android first, then iOS
- Orientation: portrait, 1080x1920 reference viewport
- GDScript only (no C#/.NET)

## File layout

- `scenes/` — `.tscn` scene files
- `scripts/` — `.gd` scripts (one script per class, generally)
- `data/cards/` — `.tres` CardData resources
- `data/enemies/` — `.tres` EnemyData + strategy resources
- `assets/art/` — PNG art (generated via PixelLab MCP typically)
- `assets/audio/` — SFX + music
- `build/` — exported APK/AAB/IPA (gitignored)

## Conventions

- **Always typed GDScript.** `var x: int = 5`, not `var x = 5`. `func f(a: int) -> void:`, always.
- **snake_case** for files, vars, functions. **PascalCase** for classes, Resources, nodes in the inspector.
- **`@onready`** for child-node references; **`@export`** for inspector-editable values.
- **Signals over polling.** If you need to react to something else's state change, declare + emit a signal.
- **Resources over dictionaries** for any structured data. CardData extends Resource, not `var card = {"letter": "A"}`.

## Architecture

- **Autoloads:** `Global` (rng, save data, tuning), `Events` (signal bus), `SFX` (audio pool), `SceneTransition` (fade between scenes). Don't add new autoloads without asking.
- **DuelController**: enum-based state machine (SETUP → PLAYER_DRAW → PLAYER_PLAY → RESOLVING → ENEMY_TURN → VICTORY/DEFEAT).
- **ActionQueue**: sequences turn actions (damage, draw, effect application) with awaitable animations.
- **Combatant base class**: extended by Player and Enemy. Handles HP, block, strength, statuses, damage pipeline.
- **Damage pipeline (canonical order):** base damage → +strength → ×weakness_mult → −block → clamp(0, ∞) → apply.
- **Status effects** are Resources with `on_turn_start`, `on_turn_end`, `on_damage_taken`, `on_damage_dealt` hooks.

## What to prefer

- Delete code over adding code.
- Typed `Array[T]` over untyped `Array`.
- `await signal_name` over Timer nodes for short delays.
- `queue_free()` over `free()`.
- Event bus (Events autoload) over `get_node("../../other")`.

## What to avoid

- New autoloads without discussing.
- Hardcoded magic numbers — put them in `data/tuning.tres` (TuningData Resource).
- Untyped Dictionaries for game data.
- Long absolute node paths (`get_node("../../UI/HBox/...")`) — use `@export` or signals.
- Touch-unfriendly UI: every tap target ≥ 48×48 dp.

## Testing & running

- `godot --headless --export-debug "Android Debug" build/lexicon-duel-debug.apk` to build for phone
- `adb install -r build/lexicon-duel-debug.apk && adb logcat -s godot` to deploy and tail logs
- Or use the `deploy.sh` script at the project root

## MCP usage

- **Godot MCP** is wired up — use it to run the project and read debug output, not to guess.
- **PixelLab MCP** is wired up — use it for new art assets. Match the style at `assets/STYLE.md`.
- When you make non-trivial changes, plan first, then code. For tiny changes, just do them.

## When in doubt

- Ask before making architectural changes.
- Small, reviewable diffs over sweeping refactors.
- If deleting works, prefer it.
- Commit every working state. We'd rather have 50 small commits than 3 big ones.
