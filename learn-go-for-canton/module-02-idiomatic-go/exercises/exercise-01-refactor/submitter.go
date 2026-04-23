// This file is intentionally non-idiomatic Go. Read the issues below,
// then refactor the file in place. Tests are in submitter_test.go and
// must keep passing throughout — they only call the EXPORTED API.
//
// The exported API SHOULD be (after refactor):
//   - Submitter type (probably struct, with NewSubmitter constructor)
//   - Submit(ctx context.Context, cmd Command) error
//   - ErrTimeout sentinel
//
// Things to fix (counted in submitter_test.go's commentary):
//
//   1. Package name "submitter_utils" is wrong — should be one short
//      lowercase word, no underscore, no "_utils" suffix.
//   2. Type name "SubmitterClass" stutters with the package — fix.
//   3. Method "DoSubmit" has a redundant prefix — fix.
//   4. `(this *SubmitterClass)` receiver convention is non-Go — use
//      single-letter receiver consistent with other methods.
//   5. The error returned from doSubmit uses errors.New with formatted
//      content via "+" concatenation — should use fmt.Errorf with %w.
//   6. doSubmit returns a typed nil *MySubmitErr in the success path —
//      this is the nil-interface trap. Fix.
//   7. ErrorTimeout is exported and would be referenced as
//      submitter_utils.ErrorTimeout — wrong prefix convention; should be
//      ErrTimeout (just "Err" + clear name).
//   8. No doc comments on exported identifiers.
//   9. Public field NumberOfRetries should not be public — there's no
//      reason for callers to mutate it after construction.
//
// You can edit anything in this file (and rename it). Make the tests
// pass and the file readable. The package-name change requires a
// matching change to the test file's package declaration.
package submitter_utils

import (
	"context"
	"errors"
)

var ErrorTimeout = errors.New("ErrorTimeout: context timed out before submission")

type SubmitterClass struct {
	Endpoint        string
	NumberOfRetries int
}

func NewSubmitterClass(endpoint string) *SubmitterClass {
	return &SubmitterClass{Endpoint: endpoint, NumberOfRetries: 3}
}

type MySubmitErr struct{ msg string }

func (e *MySubmitErr) Error() string { return e.msg }

func (this *SubmitterClass) DoSubmit(ctx context.Context, cmd Command) error {
	for attempt := 0; attempt < this.NumberOfRetries; attempt++ {
		err := this.doSubmitOnce(ctx, cmd)
		if err == nil {
			return nil
		}
		if errors.Is(err, ErrorTimeout) {
			return errors.New("DoSubmit: " + err.Error())
		}
	}
	return errors.New("DoSubmit: gave up after retries")
}

func (this *SubmitterClass) doSubmitOnce(ctx context.Context, cmd Command) error {
	select {
	case <-ctx.Done():
		return ErrorTimeout
	default:
		// pretend we submitted
	}
	var problem *MySubmitErr = nil
	return problem
}

type Command struct {
	ID      string
	Payload string
}
