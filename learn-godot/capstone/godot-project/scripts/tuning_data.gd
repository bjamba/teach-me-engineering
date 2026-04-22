class_name TuningData
extends Resource

## All magic numbers live here. Save as `res://data/tuning.tres` and edit in
## the inspector — no code changes for balance iterations.

@export var starting_hp: int = 30
@export var starting_hand_size: int = 7
@export var min_word_length: int = 3
@export var length_bonus_exponent: float = 1.2
@export var weakness_multiplier: float = 0.75
@export var enemy_hp_scaling: float = 1.15 ## per floor
@export var max_shake_strength: float = 25.0
