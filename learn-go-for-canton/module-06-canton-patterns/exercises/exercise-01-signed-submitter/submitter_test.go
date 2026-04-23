package signedsubmitter

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeBackend is a controllable Backend for tests.
type fakeBackend struct {
	mu          sync.Mutex
	calls       int
	failsLeft   int        // number of transient failures to inject
	permanent   bool       // if true, always fail with ErrPermanent
	verifier    ed25519.PublicKey
	verifyCalls int
}

func (f *fakeBackend) Submit(ctx context.Context, payload []byte) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++

	// If we have a verifier key, check the signature on the wire.
	if f.verifier != nil {
		canonical, sig, ok := splitWire(payload)
		if !ok {
			return "", fmt.Errorf("%w: malformed wire", ErrPermanent)
		}
		if !verify(f.verifier, canonical, sig) {
			return "", fmt.Errorf("%w: bad signature", ErrPermanent)
		}
		f.verifyCalls++
	}

	if f.permanent {
		return "", fmt.Errorf("%w: forced permanent", ErrPermanent)
	}
	if f.failsLeft > 0 {
		f.failsLeft--
		return "", fmt.Errorf("%w: forced transient", ErrTransient)
	}
	return fmt.Sprintf("sub-%d", f.calls), nil
}

func newPair(t *testing.T) (ed25519.PrivateKey, ed25519.PublicKey) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	return priv, pub
}

func TestSubmit_HappyPath(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{verifier: pub}
	s := New(be, priv, pub, 3, 1*time.Millisecond)

	rec, err := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice", Payload: []byte("hi")})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if rec.SubmissionID == "" {
		t.Errorf("SubmissionID empty")
	}
	if be.verifyCalls != 1 {
		t.Errorf("expected exactly 1 signature verification, got %d", be.verifyCalls)
	}
}

func TestSubmit_EmptyID_Permanent(t *testing.T) {
	priv, pub := newPair(t)
	s := New(&fakeBackend{}, priv, pub, 3, time.Millisecond)
	_, err := s.Submit(context.Background(), Command{Party: "Alice"})
	if !errors.Is(err, ErrPermanent) {
		t.Errorf("want ErrPermanent, got %v", err)
	}
}

func TestSubmit_Idempotent(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{}
	s := New(be, priv, pub, 3, time.Millisecond)

	r1, err1 := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice"})
	r2, err2 := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice"})
	if err1 != nil || err2 != nil {
		t.Fatalf("submits failed: %v / %v", err1, err2)
	}
	if r1.SubmissionID != r2.SubmissionID {
		t.Errorf("idempotency violated: %q vs %q", r1.SubmissionID, r2.SubmissionID)
	}
	if be.calls != 1 {
		t.Errorf("backend should be hit once for two same-id submits; got %d", be.calls)
	}
}

func TestSubmit_RetriesTransient(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{failsLeft: 2} // succeed on attempt 3
	s := New(be, priv, pub, 5, 1*time.Millisecond)

	rec, err := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice"})
	if err != nil {
		t.Fatalf("expected eventual success, got %v", err)
	}
	if be.calls != 3 {
		t.Errorf("expected 3 backend calls (2 fail + 1 success), got %d", be.calls)
	}
	_ = rec
}

func TestSubmit_GivesUpAfterMaxAttempts(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{failsLeft: 99}
	s := New(be, priv, pub, 3, 1*time.Millisecond)

	_, err := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice"})
	if !errors.Is(err, ErrTransient) {
		t.Errorf("expected ErrTransient after exhausting retries, got %v", err)
	}
	if be.calls != 3 {
		t.Errorf("expected 3 backend calls, got %d", be.calls)
	}
}

func TestSubmit_DoesNotRetryPermanent(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{permanent: true}
	s := New(be, priv, pub, 5, 1*time.Millisecond)

	_, err := s.Submit(context.Background(), Command{ID: "c1", Party: "Alice"})
	if !errors.Is(err, ErrPermanent) {
		t.Errorf("expected ErrPermanent, got %v", err)
	}
	if be.calls != 1 {
		t.Errorf("expected exactly 1 backend call (no retry on permanent), got %d", be.calls)
	}
}

func TestSubmit_RespectsContextCancel(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{failsLeft: 99}
	s := New(be, priv, pub, 10, 50*time.Millisecond) // long backoff

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := s.Submit(ctx, Command{ID: "c1", Party: "Alice"})
	elapsed := time.Since(start)
	if err == nil {
		t.Errorf("expected context error, got nil")
	}
	if elapsed > 200*time.Millisecond {
		t.Errorf("Submit took %v — should have returned quickly on ctx cancel", elapsed)
	}
}

func TestSubmit_ConcurrentSafe(t *testing.T) {
	priv, pub := newPair(t)
	be := &fakeBackend{}
	s := New(be, priv, pub, 3, time.Millisecond)

	var wg sync.WaitGroup
	var success atomic.Int32
	for i := 0; i < 50; i++ {
		i := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Submit(context.Background(), Command{ID: fmt.Sprintf("c%d", i%5), Party: "Alice"})
			if err == nil {
				success.Add(1)
			}
		}()
	}
	wg.Wait()
	if success.Load() != 50 {
		t.Errorf("expected 50 successes, got %d", success.Load())
	}
	// Only 5 unique command IDs → only 5 backend calls if dedup is correct.
	if be.calls != 5 {
		t.Errorf("dedup under concurrency: expected 5 backend calls, got %d", be.calls)
	}
}
