// After refactor, this file's package declaration should match the renamed
// package. The tests call only the EXPORTED API the README specifies.
package submitter_utils

import (
	"context"
	"errors"
	"testing"
	"time"
)

// (When you rename the package, also rename it here. The simplest path is
// to use the same name everywhere — e.g. "submitter".)

func TestSubmit_HappyPath(t *testing.T) {
	s := NewSubmitter("localhost:5011")
	err := s.Submit(context.Background(), Command{ID: "x", Payload: "hi"})
	if err != nil {
		t.Errorf("Submit: want nil, got %v (hint: nil-interface trap)", err)
	}
}

func TestSubmit_TimeoutWraps(t *testing.T) {
	s := NewSubmitter("localhost:5011")
	ctx, cancel := context.WithTimeout(context.Background(), 0)
	defer cancel()
	time.Sleep(time.Millisecond)
	err := s.Submit(ctx, Command{ID: "x"})
	if err == nil {
		t.Fatal("expected timeout error, got nil")
	}
	if !errors.Is(err, ErrTimeout) {
		t.Errorf("expected wrapped ErrTimeout, got %v (hint: use fmt.Errorf with %%w)", err)
	}
}
