// Package tabletests defines an Offset parser, the kind of thing you'll
// write a thousand times in Canton-adjacent code (transaction stream offsets,
// participant offsets, etc).
//
// Implement TWO things:
//   1. Make ParseOffset complete (it has TODOs).
//   2. Write a table-driven TestParseOffset in offset_test.go covering ALL
//      the listed behaviors. There's no skeleton — write it from scratch.
package tabletests

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// Offset is a uint64 wrapped in a named type so it's distinct from a raw integer.
type Offset uint64

// Sentinel errors.
var (
	ErrEmpty   = errors.New("offset: empty input")
	ErrTooLong = errors.New("offset: too long (max 16 hex chars)")
	ErrFormat  = errors.New("offset: bad format")
)

// ParseOffset accepts the Canton-ish offset syntax and returns an Offset.
//
// Accepted forms (case-insensitive):
//   - hex string up to 16 chars, no prefix:        "0", "0a", "00ffff"
//   - hex string with "0x" prefix:                  "0xff"
//   - decimal with "d:" prefix:                     "d:255"
//
// Errors:
//   - empty string                  → wrapped ErrEmpty
//   - longer than 16 hex chars       → wrapped ErrTooLong
//   - any other parse failure        → wrapped ErrFormat with %w
//
// All errors include the offending input in their message.
func ParseOffset(raw string) (Offset, error) {
	if raw == "" {
		return 0, fmt.Errorf("ParseOffset: %w", ErrEmpty)
	}
	s := strings.ToLower(raw)

	// TODO: handle "d:" decimal prefix.
	// Hint: strconv.ParseUint(rest, 10, 64) — wrap any error with ErrFormat.

	// Strip "0x" prefix if present.
	if strings.HasPrefix(s, "0x") {
		s = s[2:]
	}

	if len(s) == 0 {
		return 0, fmt.Errorf("ParseOffset(%q): %w", raw, ErrFormat)
	}

	// TODO: enforce ErrTooLong if len(s) > 16. Wrap with the offending input.

	n, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return 0, fmt.Errorf("ParseOffset(%q): %w", raw, ErrFormat)
	}
	return Offset(n), nil
}
