extends CanvasLayer

## SceneTransition autoload — fade-through-black scene switcher. Prevents the
## "jump cut" that makes cheap games feel cheap.

@onready var rect: ColorRect = $Fader if has_node("Fader") else null

func _ready() -> void:
	if rect == null:
		rect = ColorRect.new()
		rect.name = "Fader"
		rect.color = Color.BLACK
		rect.anchor_right = 1.0
		rect.anchor_bottom = 1.0
		rect.modulate.a = 0.0
		rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(rect)
	layer = 128

func fade_to_scene(path: String, duration: float = 0.3) -> void:
	var t := create_tween()
	t.tween_property(rect, "modulate:a", 1.0, duration)
	t.tween_callback(func() -> void: get_tree().change_scene_to_file(path))
	t.tween_property(rect, "modulate:a", 0.0, duration)
