extends Node2D

## Stub entry point. Replace with TitleScreen → MapScreen → Duel flow.
## For now, prints project status so the MCP can verify the scaffold loads.

func _ready() -> void:
	print("Lexicon Duel scaffold loaded.")
	print("  viewport:   ", get_viewport().get_visible_rect().size)
	print("  tuning:     starting_hp=", Global.tuning.starting_hp)
	print("  total wins: ", Global.total_wins)
	print("  rng seed:   ", Global.rng.seed)
