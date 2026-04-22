extends Node

## Global autoload — accessible anywhere as `Global.x`.
##
## Holds cross-scene state: RNG seed, run stats, tuning data.
## Keep this small — prefer per-feature autoloads (SFX, SceneTransition) for
## specific subsystems.

var rng := RandomNumberGenerator.new()
var tuning: TuningData
var total_wins: int = 0
var total_runs: int = 0

func _ready() -> void:
	rng.randomize()
	tuning = load("res://data/tuning.tres") if ResourceLoader.exists("res://data/tuning.tres") else TuningData.new()
	_load_stats()

func record_win() -> void:
	total_wins += 1
	total_runs += 1
	_save_stats()

func record_loss() -> void:
	total_runs += 1
	_save_stats()

func _save_stats() -> void:
	var data := {"total_wins": total_wins, "total_runs": total_runs}
	var f := FileAccess.open("user://stats.json", FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))

func _load_stats() -> void:
	if not FileAccess.file_exists("user://stats.json"):
		return
	var f := FileAccess.open("user://stats.json", FileAccess.READ)
	if not f:
		return
	var parsed = JSON.parse_string(f.get_as_text())
	if parsed is Dictionary:
		total_wins = parsed.get("total_wins", 0)
		total_runs = parsed.get("total_runs", 0)
