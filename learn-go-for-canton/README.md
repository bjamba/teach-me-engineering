# Go for Canton

A self-directed, two-month path from "can read Go" to "can contribute Go tooling/CLI and infrastructure to the Canton network" — plus a standalone orientation on Canton, Daml, and Scala so the broader system doesn't feel like a black box.

**[→ Open `dashboard.html`](dashboard.html)** — that's where you should start.

## What's in here

- `dashboard.html` — home base. Tracks progress in browser `localStorage` (prefix `gc_`).
- `module-00-canton-orientation/` — **start here if you want the "what even is Canton" tour.** Protocol overview, Daml primer, Scala primer, codebase tour. Four lessons + two interactive exercises.
- `module-01-go-mental-model/` → `module-06-canton-patterns/` — the Go track. Each module has HTML lessons and `exercises/` with real `.go` files.
- `module-07-capstone/` — a Canton ledger client in Go, built in four phases.
- `tools/` — standalone visualizers (memory layout, goroutine/channel simulator, gRPC lifecycle).
- `progress/` — your journal and notes (local only, gitignored).
- `TUTOR_CONTEXT.md` — notes for Claude in Tutor Mode (local only, gitignored).

## How to work through it

1. **Open `dashboard.html`** in a browser. Double-click from Finder works — this course is built to run under `file://` or hosted.
2. **Work through Module 0 first.** It's the map. The Go modules will make more sense once you know what Canton actually is.
3. **Then Module 1 onwards, in order.** Each module builds on the last.
4. **Run the Go exercises on your machine.** Each exercise directory has a `README.md` and a `go.mod` — from the exercise folder, `go test ./...` or `go run .`.
5. **Come back and run `/teach-me`** any time you want a tutoring session. Claude will detect `curriculum.json`, read your progress, and pick up where you left off.

## What you need installed

- **Go 1.22+** — `brew install go` on macOS, or see [go.dev/dl](https://go.dev/dl/).
- **A terminal and a Go-aware editor.** VS Code + the Go extension is a solid default.
- **Docker** — only for Module 7 (running a Canton sandbox). You can skip it earlier.
- Nothing else. No accounts, no API keys, no cloud services.

## A note on tone

This course assumes you're a senior engineer who can read a codebase. It won't explain what a function is. It will explain why Go's `error` is a value and not an exception, why method sets on `T` vs `*T` trip up newcomers, and what a goroutine actually *is* underneath.

It also won't pad. When a concept is five sentences, it's five sentences.

## Progress namespacing

All browser state uses the `gc_` prefix. If you ever want to reset progress, open DevTools → Application → Local Storage and delete keys starting with `gc_`. Or run `localStorage.clear()` in the console (only do that if you don't have state from other courses you care about).

## License

Course content is yours. External sources (if any) are credited in [`credits.html`](credits.html).
