class_name CardData
extends Resource

## A letter tile / card definition. Create as .tres in data/cards/.

enum Rarity { COMMON, UNCOMMON, RARE, SPECIAL }

@export var letter: String = "A"
@export var point_value: int = 1
@export var rarity: Rarity = Rarity.COMMON
@export var texture: Texture2D
@export var effects: Array[CardEffect] = []

func is_wildcard() -> bool:
	return letter == "*"
