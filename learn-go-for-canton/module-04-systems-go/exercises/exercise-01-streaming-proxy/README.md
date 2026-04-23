# Exercise — Streaming Proxy Server

Build a minimal HTTP streaming proxy that respects context cancellation, doesn't buffer the body, and counts bytes transferred. Same shape as a Canton transaction-stream proxy or any HTTP-based fan-out service.

## Run

```sh
go test -v -race ./...
```

## What `Proxy.ServeHTTP` must do

1. Build an outbound request to `p.upstream + r.URL.Path` using `r.Context()` so the outbound request inherits the inbound's cancellation.
2. Send via `http.DefaultClient`. Defer-close the response body.
3. Copy `Content-Type` to the outbound writer.
4. Write the upstream status code with `w.WriteHeader(...)`.
5. Stream the body to `w` using `io.Copy` (or a tee'd version that increments `p.BytesOut`).

## What gets tested

- Body forwards exactly (`TestProxy_ForwardsBody`).
- `Content-Type` propagates (`TestProxy_PropagatesContentType`).
- `BytesOut` counts bytes accurately (`TestProxy_CountsBytes`).
- Context cancellation propagates — partial transfer when ctx times out mid-stream (`TestProxy_RespectsContextCancel`).

## The streaming-with-counter trick

```go
n, err := io.Copy(io.MultiWriter(w, &counterWriter{&p.BytesOut}), resp.Body)
```

Or simpler, since you don't transform:

```go
n, err := io.Copy(w, resp.Body)
p.BytesOut.Add(n)
```

Both work. The MultiWriter form generalizes when you also need to mirror to a logger or auditor.
