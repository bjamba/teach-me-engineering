// Package signedsubmitter — combines the three patterns from Module 6:
//   - Crypto: Ed25519 signatures over commands
//   - Idempotency: dedup by command_id
//   - Retry: exponential backoff with jitter, ctx-aware
//
//   go test -v -race ./...
//
// The shape mirrors what a production Canton command submitter does.
package signedsubmitter

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Command is what we submit. Think Canton command, simplified.
type Command struct {
	ID      string
	Party   string
	Payload []byte
}

// Receipt is what we get back on success.
type Receipt struct {
	CommandID    string
	SubmissionID string
	SignatureHex string
}

// Backend is the thing we submit to. In real life this is a gRPC client.
// We abstract it as an interface so we can test against fakes.
type Backend interface {
	Submit(ctx context.Context, payload []byte) (string, error)
}

// Sentinel errors.
var (
	ErrTransient = errors.New("submitter: transient")
	ErrPermanent = errors.New("submitter: permanent")
)

// Submitter wraps a Backend with signing, dedup, and retry.
type Submitter struct {
	backend     Backend
	priv        ed25519.PrivateKey
	pub         ed25519.PublicKey
	maxAttempts int
	baseDelay   time.Duration

	mu      sync.Mutex
	dedup   map[string]*Receipt // command_id → receipt of first successful submit
}

// New returns a fresh Submitter. priv and pub must be a matching pair.
func New(backend Backend, priv ed25519.PrivateKey, pub ed25519.PublicKey, maxAttempts int, baseDelay time.Duration) *Submitter {
	return &Submitter{
		backend:     backend,
		priv:        priv,
		pub:         pub,
		maxAttempts: maxAttempts,
		baseDelay:   baseDelay,
		dedup:       map[string]*Receipt{},
	}
}

// Submit signs and submits cmd, retrying transient errors with exponential
// backoff. If the command_id has already been successfully submitted,
// returns the cached receipt without calling the backend again.
//
// Behavior contract:
//
//   - cmd.ID empty → return ErrPermanent.
//   - Already-submitted command_id → return cached Receipt, no backend call.
//   - Transient backend error → retry with exponential backoff, capped at
//     maxAttempts. Use ctx for cancellation while waiting.
//   - Permanent backend error → return wrapped ErrPermanent immediately.
//   - Successful submit → cache the Receipt by command_id and return.
//
// Hint: use canonicalize() and sign() helpers below. The signature goes
// over the canonical bytes; the backend gets {canonical_bytes, signature}
// concatenated (helper provided as wirePayload()).
func (s *Submitter) Submit(ctx context.Context, cmd Command) (*Receipt, error) {
	// TODO: implement.
	//
	// Sketch:
	//   1. Validate cmd.ID non-empty (else return wrapped ErrPermanent).
	//   2. Lock the dedup map; check for existing receipt; return if found.
	//      (Unlock before doing the I/O — never hold a mutex across an RPC.)
	//   3. Build canonical bytes; sign; compose wire payload.
	//   4. Loop up to maxAttempts:
	//        - call backend.Submit
	//        - on success: cache and return Receipt
	//        - on ErrTransient: sleep with backoff (select on ctx.Done())
	//        - on ErrPermanent or other: return wrapped error
	//   5. After loop exhaustion: return wrapped ErrTransient.
	return nil, errors.New("not implemented")
}

// canonicalize returns a deterministic byte representation of cmd.
// SAME command → SAME bytes. Order matters; use a fixed field order.
func canonicalize(cmd Command) []byte {
	// Format: "ID|Party|hex(payload)"  (for the exercise — real code would
	// use protobuf or another deterministic codec)
	return []byte(fmt.Sprintf("%s|%s|%x", cmd.ID, cmd.Party, cmd.Payload))
}

func sign(priv ed25519.PrivateKey, canonical []byte) []byte {
	return ed25519.Sign(priv, canonical)
}

func verify(pub ed25519.PublicKey, canonical, sig []byte) bool {
	return ed25519.Verify(pub, canonical, sig)
}

// wirePayload composes what we send to the backend. Bytes only — backend
// doesn't know how the signature was made.
func wirePayload(canonical, sig []byte) []byte {
	out := make([]byte, 0, len(canonical)+1+len(sig))
	out = append(out, canonical...)
	out = append(out, '|')
	out = append(out, sig...)
	return out
}

func splitWire(p []byte) (canonical, sig []byte, ok bool) {
	for i := len(p) - 1; i >= 0; i-- {
		if p[i] == '|' {
			return p[:i], p[i+1:], true
		}
	}
	return nil, nil, false
}

// Backoff returns the delay for the given attempt with full jitter.
// Exposed so tests can verify the policy.
func (s *Submitter) Backoff(attempt int) time.Duration {
	d := s.baseDelay << attempt
	if d > 5*time.Second {
		d = 5 * time.Second
	}
	// Full jitter: random in [0, d]
	jitter := time.Duration(int64(sha256Sum(int64(attempt))) % int64(d+1))
	return jitter
}

// sha256Sum is a deterministic pseudo-random for tests — using crypto/sha256
// over the integer keeps Backoff testable while still varying per attempt.
func sha256Sum(x int64) uint32 {
	b := []byte(fmt.Sprintf("%d", x))
	h := sha256.Sum256(b)
	return uint32(h[0])<<24 | uint32(h[1])<<16 | uint32(h[2])<<8 | uint32(h[3])
}
