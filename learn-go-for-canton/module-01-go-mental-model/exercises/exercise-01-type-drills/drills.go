// Package typedrills — fill in each TODO so the tests pass.
// Run from this directory:
//
//   go test -v ./...
//
// You should see failures for unimplemented drills. Get them all green.
package typedrills

import (
	"errors"
	"fmt"
)

// ============================================================================
// Drill 1 — Zero values
// ----------------------------------------------------------------------------
// Return the zero values for the listed types. No allocations needed —
// the zero value of each type IS the answer. The point is to internalize
// that Go zero-initializes everything for you.
// ============================================================================

func Drill1_Zeros() (int, string, bool, []int, map[string]int, *int) {
	// TODO: return the zero value of each declared type.
	// Hint: you can declare with `var` or use the type's literal zero form.
	panic("Drill1_Zeros: not implemented")
}

// ============================================================================
// Drill 2 — Nil map vs nil slice
// ----------------------------------------------------------------------------
// Both functions take a nil-valued container. One should return safely;
// one panics in real code. Implement them faithfully — return whatever the
// runtime would return.
// ============================================================================

// AppendToNilSlice appends `n` to a nil slice and returns the result's length.
// This should NOT panic — Go allows appending to a nil slice.
func AppendToNilSlice(n int) int {
	// TODO: declare a nil []int, append n, return len.
	panic("AppendToNilSlice: not implemented")
}

// SafeMapWrite writes a key to a map. If the map is nil, return an error
// rather than panicking. This is a common defensive pattern.
func SafeMapWrite(m map[string]int, key string, value int) error {
	// TODO: if m == nil, return an error explaining the issue.
	// Otherwise, write and return nil.
	panic("SafeMapWrite: not implemented")
}

// ============================================================================
// Drill 3 — Named types and conversion
// ----------------------------------------------------------------------------
// PartyID and CommandID are both named types over string. They are NOT
// interchangeable — the type system treats them as distinct.
// ============================================================================

type PartyID string
type CommandID string

// PartyToCommand converts a PartyID into a CommandID by prefixing with "cmd-".
// You'll need an explicit conversion: the compiler won't let you string-concat
// two named string types and assign to a third without ceremony.
func PartyToCommand(p PartyID) CommandID {
	// TODO: produce a CommandID whose underlying string is "cmd-" + string(p).
	panic("PartyToCommand: not implemented")
}

// ============================================================================
// Drill 4 — The nil interface trap
// ----------------------------------------------------------------------------
// MyError implements error. Below, GoodSignal and BadSignal both intend to
// return "no error". Only one actually does. Make GoodSignal return a true
// nil error interface; leave BadSignal alone — its job is to be the trap.
// ============================================================================

type MyError struct{ msg string }

func (e *MyError) Error() string { return e.msg }

// BadSignal returns a typed nil pointer. Callers checking err != nil will
// see the interface as NON-nil (because its type descriptor is set), then
// panic when they call Error(). Don't change this — it's the trap.
func BadSignal() error {
	var e *MyError = nil
	return e
}

// GoodSignal should return an actual nil error interface — both type and
// data words zero. The fix is one line.
func GoodSignal() error {
	// TODO: return a value such that the result == nil.
	panic("GoodSignal: not implemented")
}

// ============================================================================
// Drill 5 — Struct zero value as a constructor
// ----------------------------------------------------------------------------
// Counter has no constructor. The zero value of Counter is a usable Counter
// with count == 0. Implement Inc and Read as METHODS on Counter such that
// using `var c Counter; c.Inc(); c.Inc(); c.Read()` returns 2.
//
// You'll need to think about value receiver vs pointer receiver here.
// ============================================================================

type Counter struct {
	count int
}

// TODO: implement Inc that adds 1 to the counter (mutation must stick).
// TODO: implement Read that returns the current count.

// (No package-level helper — implement the methods above this line.)

// ============================================================================
// Drill 6 — Constants and iota
// ----------------------------------------------------------------------------
// Below is a started ContractStatus enum. Add the missing variants and
// implement String() so the test gets the expected names.
// ============================================================================

type ContractStatus int

const (
	StatusPending ContractStatus = iota
	StatusActive
	// TODO: add StatusArchived
	// TODO: add StatusRejected
)

// String returns the human-readable name for a ContractStatus.
// "pending", "active", "archived", "rejected", or "unknown" for anything else.
func (s ContractStatus) String() string {
	// TODO: implement using switch.
	panic("ContractStatus.String: not implemented")
}

// ============================================================================
// (Helpers — leave alone.)
// ============================================================================

// ErrNilMap is a sentinel error you can use in SafeMapWrite if you want.
var ErrNilMap = errors.New("attempted write to nil map")

// Sprint is a tiny helper used by some tests. Don't change.
func Sprint(v any) string { return fmt.Sprintf("%v", v) }
