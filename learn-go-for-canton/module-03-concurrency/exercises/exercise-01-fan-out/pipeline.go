// Package fanout — implement a parallel pipeline with proper channel hygiene.
//
//   go test -v -race ./...
//
// The -race flag is REQUIRED for this exercise. It catches synchronization
// bugs that would otherwise slip through deterministic test runs.
package fanout

import (
	"sync"
)

// Job is the unit of work the pipeline processes.
type Job struct {
	ID    int
	Value int
}

// Result is what comes out the other end.
type Result struct {
	JobID int
	Out   int
}

// Process is the per-job transformation. Pretend it's a real RPC call —
// it's a few CPU cycles for the test but the pattern is what matters.
func Process(j Job) Result {
	return Result{JobID: j.ID, Out: j.Value * 2}
}

// =============================================================================
// Part 1 — Fan-out
// =============================================================================
//
// Implement FanOut: read jobs from `in`, dispatch them to `workers` parallel
// goroutines, each calling Process, send results to a single returned channel.
//
// Rules:
//   - Exactly `workers` goroutines run concurrently.
//   - The returned channel is closed when ALL input has been processed.
//   - Don't leak goroutines if `in` closes mid-stream — workers should exit.
//   - All synchronization must be correct under -race.
//
// Hint: pattern is workers → for-range over `in` → write to a single shared
// out channel → use a WaitGroup to know when to close out.

func FanOut(in <-chan Job, workers int) <-chan Result {
	out := make(chan Result)

	// TODO: spawn `workers` goroutines, each doing for-range over `in`,
	// each writing to `out`. Use a WaitGroup to track them, and a separate
	// goroutine that waits for the group then closes `out`.
	_ = sync.WaitGroup{} // remove once implemented
	close(out)
	return out
}

// =============================================================================
// Part 2 — Fan-in
// =============================================================================
//
// Implement Merge: take any number of <-chan Result and merge them into a
// single <-chan Result. The merged channel closes when ALL inputs close.
//
// Rules:
//   - Order is not preserved (it's a merge, not a sort).
//   - One goroutine per input channel is fine.
//   - The output channel is closed exactly once, after all inputs close.

func Merge(cs ...<-chan Result) <-chan Result {
	out := make(chan Result)
	// TODO: implement.
	close(out)
	return out
}

// =============================================================================
// Part 3 — Generator
// =============================================================================
//
// SourceFromSlice publishes the slice items to a channel and closes it.
// Used by tests as the input to FanOut. Keep simple — one goroutine.

func SourceFromSlice(jobs []Job) <-chan Job {
	out := make(chan Job)
	// TODO: spawn a goroutine that iterates `jobs`, sends each to `out`,
	// then closes `out`.
	close(out)
	return out
}
