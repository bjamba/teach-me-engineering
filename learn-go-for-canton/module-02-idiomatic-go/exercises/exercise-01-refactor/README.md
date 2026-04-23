# Exercise 1 — Refactor to Idiomatic Go

The starter file is deliberately bad. Refactor it in place until the tests pass and the code looks like something you'd be willing to put your name on.

## Run

```sh
go test -v ./...
```

The tests use a target API shape that doesn't exist yet — they reference `NewSubmitter`, `Submit`, `ErrTimeout`. Your job: rename and reshape the existing code until the tests find what they expect.

## Issues to fix (in source comments)

1. Package name (no `_utils`).
2. Type name (no `Class` suffix; no stutter).
3. Method name (no redundant prefix).
4. Receiver convention (no `this`).
5. Error wrapping (use `fmt.Errorf` with `%w`).
6. The nil-interface trap in `doSubmitOnce`.
7. Sentinel naming (`Err` prefix, no `Error` prefix).
8. Doc comments on every exported identifier.
9. Make `NumberOfRetries` package-private; expose via constructor option.

## Stretch

Implement functional options:
```go
s := NewSubmitter("localhost:5011", WithRetries(5), WithBaseDelay(50*time.Millisecond))
```

No test for this — exercise for muscle memory.
