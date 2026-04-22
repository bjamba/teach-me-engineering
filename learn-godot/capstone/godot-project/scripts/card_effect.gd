class_name CardEffect
extends Resource

## Base class for data-driven card effects. Subclass for each effect type
## (BleedApply, DamageMultiplier, Heal, etc.). Stored inside CardData.effects.

func apply(context: Dictionary) -> void:
	## context: { "source": Combatant, "target": Combatant, "word": String, "damage": int }
	pass
