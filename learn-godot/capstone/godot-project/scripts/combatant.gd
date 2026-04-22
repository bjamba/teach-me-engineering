class_name Combatant
extends Node2D

## Base class for Player and Enemy. Handles HP, block, strength, weakness,
## status effects, and the damage pipeline.

@export var max_hp: int = 30
var hp: int
var block: int = 0
var strength: int = 0
var weakness_stacks: int = 0
var status_effects: Array[StatusEffect] = []

signal hp_changed(new_hp: int, delta: int)
signal damaged(amount: int)
signal died()

func _ready() -> void:
	hp = max_hp

func take_damage(amount: int) -> void:
	var dmg := amount

	for effect in status_effects:
		dmg = effect.on_damage_taken(self, dmg)

	if weakness_stacks > 0:
		dmg = int(dmg * Global.tuning.weakness_multiplier)

	if block > 0:
		var absorbed := min(block, dmg)
		block -= absorbed
		dmg -= absorbed

	if dmg <= 0:
		return

	hp = max(0, hp - dmg)
	damaged.emit(dmg)
	hp_changed.emit(hp, -dmg)
	Events.combatant_damaged.emit(self, dmg)
	if hp == 0:
		died.emit()
		Events.combatant_died.emit(self)

func deal_word_damage(target: Combatant, base: int) -> int:
	var dmg := base + strength
	for effect in status_effects:
		dmg = effect.on_damage_dealt(self, dmg)
	target.take_damage(dmg)
	return dmg

func heal(amount: int) -> void:
	var delta := min(amount, max_hp - hp)
	if delta <= 0:
		return
	hp += delta
	hp_changed.emit(hp, delta)

func gain_block(amount: int) -> void:
	block += amount

func start_turn() -> void:
	for effect in status_effects:
		effect.on_turn_start(self)
	_tick_durations()

func end_turn() -> void:
	for effect in status_effects:
		effect.on_turn_end(self)

func _tick_durations() -> void:
	var survivors: Array[StatusEffect] = []
	for effect in status_effects:
		if effect.duration > 0:
			effect.duration -= 1
		if effect.duration != 0:
			survivors.append(effect)
	status_effects = survivors
