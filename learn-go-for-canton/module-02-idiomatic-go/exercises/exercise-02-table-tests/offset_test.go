package tabletests

import (
	"errors"
	"testing"
)

// EXERCISE: write TestParseOffset as a table-driven test.
// Required structure:
//
//   - One test function: TestParseOffset
//   - A slice of structs holding {name, input, want, wantErr (a sentinel or nil)}
//   - For each case, t.Run(c.name, func(t *testing.T) { ... })
//   - Compare value with == ; compare error with errors.Is(err, c.wantErr).
//
// Coverage required (one case per bullet, minimum):
//
//   ✓ Empty string                      → ErrEmpty
//   ✓ Single hex char "0"               → 0, no error
//   ✓ Single hex char "f"               → 15, no error
//   ✓ Multi-char hex "ff"               → 255, no error
//   ✓ Uppercase hex "FF"                → 255, no error (case-insensitive)
//   ✓ With 0x prefix "0xff"             → 255, no error
//   ✓ With 0X prefix "0Xff"             → 255, no error
//   ✓ Decimal prefix "d:255"            → 255, no error
//   ✓ Decimal prefix "d:0"              → 0, no error
//   ✓ Too long "12345678901234567"      → ErrTooLong
//   ✓ Garbage "ghj"                     → ErrFormat
//   ✓ Just "0x" with nothing after      → ErrFormat
//
// You'll first fail tests because ParseOffset's TODOs aren't done.
// Implement those in offset.go too. Ping-pong between the two until green.

// Smoke test so the package compiles even before you write the table:
func TestSmoke_PleaseDelete(t *testing.T) {
	_, _ = ParseOffset("0")
	if !errors.Is(errors.New("anything"), errors.New("anything")) {
		// just exercising errors.Is for the import
	}
}
