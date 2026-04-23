// Package methodsets — implement the types so the tests pass.
//
//   go test -v ./...
//
// Focus: method sets, interface satisfaction, decorator pattern via embedding.
package methodsets

import (
	"fmt"
	"strings"
)

// ============================================================================
// Part 1 — Build a Submitter pipeline
// ----------------------------------------------------------------------------
// Submitter is the interface our pipeline consumes. Several concrete types
// satisfy it, each adding behavior on top of the underlying submission.
// This is the standard Go decorator/middleware pattern.
// ============================================================================

// Command is a tiny stand-in for the kind of payload a Canton client submits.
type Command struct {
	ID      string
	Payload string
}

// Submitter is the minimal interface for "submitting a command somewhere."
// Define it small. Test code will write fakes against this.
type Submitter interface {
	Submit(cmd Command) error
}

// ----------------------------------------------------------------------------
// 1a. RecordingSubmitter
// ----------------------------------------------------------------------------
// A trivial in-memory Submitter that records every command it received.
// Implement Submit such that the command is appended to Recorded, and
// Submit always succeeds with nil.
//
// Pick the receiver type carefully: this method must mutate the receiver.
// ----------------------------------------------------------------------------

type RecordingSubmitter struct {
	Recorded []Command
}

// TODO: implement Submit on the appropriate receiver.

// ----------------------------------------------------------------------------
// 1b. PrefixingSubmitter — a decorator
// ----------------------------------------------------------------------------
// PrefixingSubmitter wraps another Submitter and prefixes every command's
// Payload before forwarding. Demonstrates: wrapping concrete types behind
// an interface boundary.
// ----------------------------------------------------------------------------

type PrefixingSubmitter struct {
	Inner  Submitter
	Prefix string
}

// TODO: implement Submit such that it forwards to Inner.Submit, but with
// cmd.Payload replaced by Prefix + cmd.Payload first.

// ----------------------------------------------------------------------------
// 1c. RetryingSubmitter — another decorator
// ----------------------------------------------------------------------------
// RetryingSubmitter wraps another Submitter and retries up to MaxAttempts
// times if Submit returns an error. If all attempts fail, it returns the
// last error received.
// ----------------------------------------------------------------------------

type RetryingSubmitter struct {
	Inner       Submitter
	MaxAttempts int
}

// TODO: implement Submit. Loop up to MaxAttempts; success short-circuits;
// only the last error is returned on total failure.

// ============================================================================
// Part 2 — The interface-nil trap
// ----------------------------------------------------------------------------
// Implement OkSubmitter such that NewOkSubmitter() returns a Submitter
// interface whose value `s == nil` evaluates to FALSE (because s holds a
// concrete type), but where calling s.Submit returns nil error always.
//
// And implement WrapNilSafe(inner Submitter) Submitter such that:
//   - if inner is the zero (nil interface), the returned Submitter still
//     handles Submit gracefully without panic — return a sentinel error.
//   - if inner is non-nil, behave like a passthrough.
// ============================================================================

type OkSubmitter struct{}

// TODO: implement Submit on OkSubmitter. Always succeed.

// NewOkSubmitter returns a Submitter that always succeeds.
func NewOkSubmitter() Submitter {
	// TODO: return an OkSubmitter (value or pointer — test will accept either).
	panic("NewOkSubmitter: not implemented")
}

// ErrNoInner is returned by a wrapper that was given a nil inner Submitter.
var ErrNoInner = fmt.Errorf("methodsets: wrapped Submitter is nil")

// WrapNilSafe returns a Submitter that delegates to inner, except it does
// not panic when inner is nil — it returns ErrNoInner instead.
func WrapNilSafe(inner Submitter) Submitter {
	// TODO: implement. Return a value that satisfies Submitter.
	panic("WrapNilSafe: not implemented")
}

// ============================================================================
// Part 3 — Embedding to gain methods
// ----------------------------------------------------------------------------
// AuditedClient embeds *RecordingSubmitter. Because embedding promotes the
// inner type's methods, AuditedClient should automatically satisfy the
// Submitter interface (assuming RecordingSubmitter does).
//
// Add ONE additional method to AuditedClient: Audit() string, which returns
// a comma-separated list of recorded command IDs ("cmd1,cmd2,cmd3" — empty
// string if none).
// ============================================================================

type AuditedClient struct {
	*RecordingSubmitter
}

// TODO: implement Audit() on AuditedClient.

// ============================================================================
// Helper used by tests — leave alone.
// ============================================================================

func joinIDs(cmds []Command) string {
	parts := make([]string, 0, len(cmds))
	for _, c := range cmds {
		parts = append(parts, c.ID)
	}
	return strings.Join(parts, ",")
}
