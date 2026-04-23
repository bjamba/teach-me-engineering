# Exercise — Idempotent Signed Submitter

The Module 6 capstone: a Submitter that signs every command (Lesson 1), dedups by command_id (Lesson 3), retries transient failures with exponential backoff (Lesson 3), and is safe under concurrent use (Module 3 + this).

## Run

```sh
go test -v -race ./...
```

## What you implement

`Submitter.Submit(ctx, cmd)` — see the contract in `submitter.go`. Six tests cover:

- Happy path with signature verification on the backend side.
- Empty ID → permanent error.
- Idempotency — two submits with same command_id → one backend call.
- Transient retry — backend fails twice then succeeds; expect 3 attempts.
- Max attempts honored — exhaust retries → ErrTransient wrapped.
- Permanent errors not retried — exactly 1 backend call.
- Context cancellation interrupts the wait between retries.
- Concurrent-safe — 50 goroutines with 5 unique IDs → exactly 5 backend calls.

## The shape

```go
func (s *Submitter) Submit(ctx context.Context, cmd Command) (*Receipt, error) {
    if cmd.ID == "" { return nil, fmt.Errorf("...: %w", ErrPermanent) }

    // dedup check (briefly hold mutex; release before I/O)
    s.mu.Lock()
    if rec, ok := s.dedup[cmd.ID]; ok {
        s.mu.Unlock()
        return rec, nil
    }
    s.mu.Unlock()

    canonical := canonicalize(cmd)
    sig := sign(s.priv, canonical)
    payload := wirePayload(canonical, sig)

    var lastErr error
    for attempt := 0; attempt < s.maxAttempts; attempt++ {
        subID, err := s.backend.Submit(ctx, payload)
        if err == nil {
            rec := &Receipt{CommandID: cmd.ID, SubmissionID: subID, SignatureHex: hex.EncodeToString(sig)}
            s.mu.Lock(); s.dedup[cmd.ID] = rec; s.mu.Unlock()
            return rec, nil
        }
        if errors.Is(err, ErrPermanent) {
            return nil, fmt.Errorf("submit: %w", err)
        }
        if !errors.Is(err, ErrTransient) {
            return nil, fmt.Errorf("submit: unknown error: %w", err)
        }
        lastErr = err

        select {
        case <-time.After(s.Backoff(attempt)):
        case <-ctx.Done():
            return nil, fmt.Errorf("submit: ctx done: %w", ctx.Err())
        }
    }
    return nil, fmt.Errorf("submit exhausted retries: %w", lastErr)
}
```

(The structure is in the comments — try writing it before peeking at this README.)

## Why this matters

Real Canton command submission is exactly this shape: sign with your party's key, dedup by command_id, retry on UNAVAILABLE/DEADLINE_EXCEEDED, observe and propagate everything else. The capstone (Module 7) wraps a real Canton gRPC call in this same pattern.
