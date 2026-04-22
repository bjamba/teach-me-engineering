extends Node

## SFX autoload — pooled AudioStreamPlayer. Avoids node-per-sound churn and
## handles overlapping plays gracefully. Music is handled separately; this is
## only for short effects.

const POOL_SIZE := 8
var _players: Array[AudioStreamPlayer] = []

func _ready() -> void:
	for i in POOL_SIZE:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_players.append(p)

func play(stream: AudioStream, volume_db: float = 0.0, pitch: float = 1.0) -> void:
	if stream == null:
		return
	for p in _players:
		if not p.playing:
			p.stream = stream
			p.volume_db = volume_db
			p.pitch_scale = pitch
			p.play()
			return
	push_warning("SFX pool exhausted — dropping play request")

func play_varied(stream: AudioStream, volume_db: float = 0.0) -> void:
	play(stream, volume_db, randf_range(0.92, 1.08))
