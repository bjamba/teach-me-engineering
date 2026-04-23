# Exercise 1 — Fan-out / Fan-in Pipeline

Build the canonical Go parallel pipeline: a source feeding multiple workers, results merging into a single stream. Same shape as a real Canton-adjacent indexer or a parallel command submitter.

## Run

```sh
go test -v -race ./...
```

The `-race` flag is required. Without it you can pass the tests with broken synchronization.

## What to implement

| Function | What it does |
|---|---|
| `SourceFromSlice` | Publish a slice to a channel, close. |
| `FanOut` | Read from input, distribute to N workers, return merged output channel. |
| `Merge` | Combine many `<-chan Result` into one. |

## The shape — internalize this

```go
out := make(chan T)
var wg sync.WaitGroup
for i := 0; i < workers; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        for v := range in {
            out <- transform(v)
        }
    }()
}
go func() { wg.Wait(); close(out) }()
return out
```

The `wg.Wait(); close(out)` in a separate goroutine is the pattern for "close the output channel after all writers finish." Stare at it until it's automatic.

## Pitfalls

- **Forgetting to close** the merged channel — readers hang forever.
- **Closing too early** — sending to closed = panic.
- **Closing twice** — also panic.
- **Returning before goroutines spawn** — they never run.

`-race` won't catch all of those, but `go test` will hang if you mess up close. If your test suite hangs, it's almost certainly an unclosed channel.
