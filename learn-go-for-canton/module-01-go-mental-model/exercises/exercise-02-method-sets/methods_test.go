package methodsets

import (
	"errors"
	"testing"
)

// failingSubmitter is a test-only Submitter that fails the first N attempts
// then succeeds. Used to test RetryingSubmitter.
type failingSubmitter struct {
	failsLeft int
	calls     int
}

func (f *failingSubmitter) Submit(cmd Command) error {
	f.calls++
	if f.failsLeft > 0 {
		f.failsLeft--
		return errors.New("transient")
	}
	return nil
}

func TestRecordingSubmitter(t *testing.T) {
	r := &RecordingSubmitter{}
	if err := r.Submit(Command{ID: "a", Payload: "p1"}); err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	r.Submit(Command{ID: "b", Payload: "p2"})
	if len(r.Recorded) != 2 {
		t.Errorf("Recorded len: want 2, got %d (hint: pointer receiver?)", len(r.Recorded))
	}
}

func TestPrefixingSubmitter(t *testing.T) {
	rec := &RecordingSubmitter{}
	pre := &PrefixingSubmitter{Inner: rec, Prefix: "P:"}
	if err := pre.Submit(Command{ID: "a", Payload: "hello"}); err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	if len(rec.Recorded) != 1 {
		t.Fatalf("inner recorded len: want 1, got %d", len(rec.Recorded))
	}
	if rec.Recorded[0].Payload != "P:hello" {
		t.Errorf("payload: want P:hello, got %q", rec.Recorded[0].Payload)
	}
}

func TestRetryingSubmitter_EventualSuccess(t *testing.T) {
	inner := &failingSubmitter{failsLeft: 2}
	r := &RetryingSubmitter{Inner: inner, MaxAttempts: 5}
	if err := r.Submit(Command{ID: "x"}); err != nil {
		t.Errorf("expected eventual success, got %v", err)
	}
	if inner.calls != 3 {
		t.Errorf("expected 3 attempts (2 fails + 1 success), got %d", inner.calls)
	}
}

func TestRetryingSubmitter_AllFailures(t *testing.T) {
	inner := &failingSubmitter{failsLeft: 99}
	r := &RetryingSubmitter{Inner: inner, MaxAttempts: 3}
	if err := r.Submit(Command{ID: "x"}); err == nil {
		t.Errorf("expected error after exhausting retries, got nil")
	}
	if inner.calls != 3 {
		t.Errorf("expected 3 attempts, got %d", inner.calls)
	}
}

func TestOkSubmitter_NotNil(t *testing.T) {
	var s Submitter = NewOkSubmitter()
	if s == nil {
		t.Errorf("Submitter from NewOkSubmitter should be non-nil interface")
	}
	if err := s.Submit(Command{ID: "x"}); err != nil {
		t.Errorf("OkSubmitter.Submit: want nil, got %v", err)
	}
}

func TestWrapNilSafe(t *testing.T) {
	w := WrapNilSafe(nil)
	if err := w.Submit(Command{ID: "x"}); !errors.Is(err, ErrNoInner) {
		t.Errorf("WrapNilSafe(nil).Submit: want ErrNoInner, got %v", err)
	}

	rec := &RecordingSubmitter{}
	w2 := WrapNilSafe(rec)
	if err := w2.Submit(Command{ID: "y"}); err != nil {
		t.Errorf("WrapNilSafe(rec).Submit: want nil, got %v", err)
	}
	if len(rec.Recorded) != 1 {
		t.Errorf("WrapNilSafe should pass through to inner; recorded=%d", len(rec.Recorded))
	}
}

func TestAuditedClient(t *testing.T) {
	a := &AuditedClient{RecordingSubmitter: &RecordingSubmitter{}}
	a.Submit(Command{ID: "c1"})
	a.Submit(Command{ID: "c2"})
	a.Submit(Command{ID: "c3"})
	if got := a.Audit(); got != "c1,c2,c3" {
		t.Errorf("Audit: want c1,c2,c3, got %q", got)
	}
}

func TestAuditedClient_SatisfiesSubmitter(t *testing.T) {
	// Compile-time check: AuditedClient must satisfy Submitter via embedding.
	var _ Submitter = &AuditedClient{RecordingSubmitter: &RecordingSubmitter{}}
}
