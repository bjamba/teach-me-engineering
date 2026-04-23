// Package workerpool — a context-aware worker pool that respects cancellation,
// propagates errors, and never leaks goroutines.
//
//   go test -v -race ./...
//
// The shape of a real Canton submission worker pool: bounded concurrency,
// context cancellation, errgroup-style error propagation.
package workerpool

import (
	"context"
	"errors"
)

// Task is a unit of work. Returns nil on success, or an error.
type Task func(ctx context.Context) error

// =============================================================================
// Run executes tasks across `workers` concurrent goroutines, respecting ctx.
//
// Behavior:
//   - At most `workers` tasks run concurrently.
//   - If ctx is canceled, in-flight tasks see the cancellation via their
//     context, not-yet-started tasks are skipped, and Run returns ctx.Err().
//   - If any task returns a non-nil error, Run cancels remaining work and
//     returns the FIRST error received.
//   - On full success (no error, no cancel), Run returns nil after all tasks
//     finish.
//
// Hint: the standard library's golang.org/x/sync/errgroup does this. You can
// look at its source for inspiration, but DO NOT import it. Build it yourself.
// =============================================================================

func Run(ctx context.Context, workers int, tasks []Task) error {
	if workers < 1 {
		return errors.New("workerpool: workers must be >= 1")
	}

	// TODO: implement.
	//
	// Sketch:
	//   - Derive a cancel-able ctx from the parent so you can stop everything
	//     on first error.
	//   - Make a buffered channel of tasks (or use a slice + atomic counter).
	//   - Spawn `workers` goroutines, each reading tasks and calling them
	//     with the derived ctx.
	//   - Collect errors via a channel; capture the first one (drop the rest).
	//   - Wait for workers to finish; return the first error or nil.

	_ = tasks
	return nil
}
