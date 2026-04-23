// Package streamingproxy — a minimal HTTP streaming proxy that:
//   - forwards GET requests to an upstream URL
//   - streams the response body chunk-by-chunk (no full buffering)
//   - counts bytes transferred
//   - respects request cancellation (context propagation)
//
//   go test -v -race ./...
//
// Why this matters: it's the same shape as a Canton transaction-stream
// proxy or a webhook fan-out. Stream in, transform/observe, stream out.
package streamingproxy

import (
	"context"
	"io"
	"net/http"
	"sync/atomic"
)

// Proxy is the streaming proxy. Construct with New.
type Proxy struct {
	upstream string

	// BytesIn/BytesOut are exposed for tests and metrics. Use atomic
	// operations because the handler runs concurrently.
	BytesIn  atomic.Int64
	BytesOut atomic.Int64
}

// New returns a Proxy that forwards to the given upstream URL.
func New(upstream string) *Proxy {
	return &Proxy{upstream: upstream}
}

// ServeHTTP implements http.Handler. It:
//   1. Builds an outbound request to p.upstream + r.URL.Path, propagating
//      r.Context() so the outbound request cancels if the inbound request does.
//   2. Sends the outbound request via http.DefaultClient (or a configured one).
//   3. Copies the upstream Status code and selected headers (Content-Type,
//      Content-Length if present) onto w.
//   4. Streams the upstream body to w using a TeeReader so byte counts
//      are tracked.
//   5. On any error, returns an appropriate HTTP status to the inbound caller.
//
// The whole point is that the response body is NOT fully buffered — bytes
// move from upstream to client as they arrive.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// TODO: implement.
	//
	// Hints:
	//   - Use http.NewRequestWithContext(r.Context(), "GET", url, nil).
	//   - http.DefaultClient.Do(req) returns *http.Response and error.
	//   - DEFER resp.Body.Close() — once you have a response, you must close it.
	//   - Copy Content-Type via w.Header().Set(...).
	//   - w.WriteHeader(resp.StatusCode) BEFORE writing the body.
	//   - For streaming with byte counting, wrap p.BytesOut increment in a
	//     custom Writer or use io.Copy and add the result to BytesOut.
	//   - For BytesIn (from upstream): wrap resp.Body in an io.TeeReader
	//     that copies through a counter, OR sum the n returned by io.Copy
	//     (since they're equal in this no-transform case).

	http.Error(w, "not implemented", http.StatusNotImplemented)
}

// counterWriter is a tiny io.Writer that adds to an atomic counter.
// You may find this useful in your implementation.
type counterWriter struct {
	c *atomic.Int64
}

func (cw *counterWriter) Write(p []byte) (int, error) {
	cw.c.Add(int64(len(p)))
	return len(p), nil
}

// helper: build the outbound URL. Strips trailing slash from upstream.
func (p *Proxy) target(path string) string {
	up := p.upstream
	if len(up) > 0 && up[len(up)-1] == '/' {
		up = up[:len(up)-1]
	}
	return up + path
}

// Compile-time check that Proxy satisfies http.Handler.
var _ http.Handler = (*Proxy)(nil)

// Make sure unused import doesn't break the skeleton.
var _ context.Context = context.Background()
var _ = io.Discard
