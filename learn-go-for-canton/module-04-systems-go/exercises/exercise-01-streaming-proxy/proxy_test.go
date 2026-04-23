package streamingproxy

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// upstreamServer returns a test server that streams a known body slowly.
func upstreamServer(t *testing.T, body string, delayPerChunk time.Duration) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/jsonlines")
		w.WriteHeader(200)
		flusher, _ := w.(http.Flusher)
		for _, chunk := range strings.Split(body, "\n") {
			io.WriteString(w, chunk+"\n")
			if flusher != nil {
				flusher.Flush()
			}
			time.Sleep(delayPerChunk)
		}
	}))
}

func TestProxy_ForwardsBody(t *testing.T) {
	body := "alpha\nbeta\ngamma\ndelta"
	up := upstreamServer(t, body, 0)
	defer up.Close()

	p := New(up.URL)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/anything", nil)
	p.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("status: want 200, got %d", rec.Code)
	}
	got := rec.Body.String()
	want := body + "\n" // upstream adds a newline after the last chunk
	if got != want {
		t.Errorf("body mismatch:\nwant=%q\ngot =%q", want, got)
	}
}

func TestProxy_PropagatesContentType(t *testing.T) {
	up := upstreamServer(t, "x", 0)
	defer up.Close()

	p := New(up.URL)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))

	if ct := rec.Header().Get("Content-Type"); ct != "application/jsonlines" {
		t.Errorf("Content-Type: want application/jsonlines, got %q", ct)
	}
}

func TestProxy_CountsBytes(t *testing.T) {
	body := "hello\nworld"
	up := upstreamServer(t, body, 0)
	defer up.Close()

	p := New(up.URL)
	rec := httptest.NewRecorder()
	p.ServeHTTP(rec, httptest.NewRequest("GET", "/x", nil))

	wantBytes := int64(len(body) + 1) // upstream adds a newline
	if got := p.BytesOut.Load(); got != wantBytes {
		t.Errorf("BytesOut: want %d, got %d", wantBytes, got)
	}
}

func TestProxy_RespectsContextCancel(t *testing.T) {
	// Slow upstream that streams chunks 100ms apart.
	body := "chunk1\nchunk2\nchunk3\nchunk4\nchunk5"
	up := upstreamServer(t, body, 100*time.Millisecond)
	defer up.Close()

	p := New(up.URL)
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/x", nil).WithContext(ctx)
	p.ServeHTTP(rec, req)

	// We expect to have received SOME bytes but not all of them, because
	// the context cancels mid-stream. Without context propagation, the
	// proxy would buffer everything and the test would receive all 5 chunks.
	if got := p.BytesOut.Load(); got >= int64(len(body)+1) {
		t.Errorf("BytesOut: expected partial transfer due to ctx cancel, got %d (full=%d)", got, len(body)+1)
	}
}
