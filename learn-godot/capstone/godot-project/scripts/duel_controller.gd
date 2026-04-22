class_name DuelController
extends Node

## Top-level duel state machine. The scene tree holds Player, Enemy, Hand;
## this controller sequences them through the turn states.

enum State { SETUP, PLAYER_DRAW, PLAYER_PLAY, RESOLVING, ENEMY_TURN, VICTORY, DEFEAT }

@export var player: Combatant
@export var enemy: Combatant

var state: State = State.SETUP

func _ready() -> void:
	transition_to(State.SETUP)

func transition_to(new_state: State) -> void:
	if new_state == state and state != State.SETUP:
		return
	print("[Duel] %s -> %s" % [State.keys()[state], State.keys()[new_state]])
	state = new_state
	_on_state_entered(new_state)

func _on_state_entered(s: State) -> void:
	match s:
		State.SETUP:
			_enter_setup()
		State.PLAYER_DRAW:
			_enter_player_draw()
		State.PLAYER_PLAY:
			Events.turn_started.emit("player")
		State.RESOLVING:
			pass ## handled when the word is submitted
		State.ENEMY_TURN:
			_enter_enemy_turn()
		State.VICTORY:
			Events.duel_won.emit()
			Global.record_win()
		State.DEFEAT:
			Events.duel_lost.emit()
			Global.record_loss()

func _enter_setup() -> void:
	player.start_turn()
	enemy.start_turn()
	transition_to(State.PLAYER_DRAW)

func _enter_player_draw() -> void:
	## Drawing is handled by the Hand node — this transitions when ready.
	transition_to(State.PLAYER_PLAY)

func _enter_enemy_turn() -> void:
	enemy.start_turn()
	## Enemy strategy picks actions; for now, simple attack.
	var dmg := enemy.deal_word_damage(player, 4)
	print("[Duel] Enemy attacks for %d" % dmg)
	enemy.end_turn()
	if player.hp <= 0:
		transition_to(State.DEFEAT)
	elif enemy.hp <= 0:
		transition_to(State.VICTORY)
	else:
		transition_to(State.PLAYER_DRAW)

func on_word_submitted(word: String, base_damage: int) -> void:
	## Called by the Hand node after the player hits Submit.
	if state != State.PLAYER_PLAY:
		push_warning("word submitted outside PLAYER_PLAY")
		return
	transition_to(State.RESOLVING)
	var dmg := player.deal_word_damage(enemy, base_damage)
	Events.word_submitted.emit(word, dmg)
	if enemy.hp <= 0:
		transition_to(State.VICTORY)
	else:
		transition_to(State.ENEMY_TURN)
