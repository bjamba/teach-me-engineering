class_name StatusEffect
extends Resource

## Base class for status effects (Bleed, Weakness, Strength, etc.).
## Subclasses override the hooks they care about.

@export var duration: int = -1 ## -1 = permanent until cleared
@export var stacks: int = 1

func on_turn_start(_owner: Combatant) -> void: pass
func on_turn_end(_owner: Combatant) -> void: pass
func on_damage_taken(_owner: Combatant, amount: int) -> int: return amount
func on_damage_dealt(_owner: Combatant, amount: int) -> int: return amount
