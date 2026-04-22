# teach-me-engineering

A workspace of self-directed engineering curricula, each in its own subfolder. Every course is scaffolded by the `/teach-me` skill in [Claude Code](https://claude.com/claude-code) and walked through module by module — lessons, exercises, progress, a capstone.

Served as a static site via GitHub Pages: **https://bjamba.github.io/teach-me-engineering/**

## Courses

| # | Course | Folder | Tagline |
|---|---|---|---|
| I | ML / AI Engineering Foundations | [`ml-ai-engineering/`](ml-ai-engineering/) | From fundamentals to production models — the math, the models, the deployments. |
| II | Front-End Engineering | [`frontend-engineering/`](frontend-engineering/) | React fundamentals to front-end fluency — layout, rendering, accessibility, theming, data-viz. |
| III | Godot 4 — Mobile Game Development | [`learn-godot/`](learn-godot/) | Zero to shipping a turn-based word/card roguelike on Android. |

## How to use

Each subfolder is an independent teach-me curriculum with its own `curriculum.json`, dashboard, modules, and progress. To work on a course:

```bash
cd ml-ai-engineering
# then in Claude Code:
/teach-me
```

Claude detects the curriculum in the current folder and picks up where the last session left off.

To start a new course on a different topic, run `/teach-me` from the root `teach-me-engineering/` directory (with no existing curriculum) and Claude will scaffold a new subfolder.
