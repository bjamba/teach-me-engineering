# Exercise 2 — Method Sets, Interfaces, and Embedding

Build a tiny submitter pipeline using interfaces, decorators, and embedding. Same shape as the kind of middleware you'll write for real Canton clients.

## Run

```sh
go test -v ./...
```

## What's exercised

- **Pointer receivers for mutation** — RecordingSubmitter must record commands.
- **Decorator pattern via interface composition** — PrefixingSubmitter wraps any Submitter.
- **Retry logic** — RetryingSubmitter loops up to MaxAttempts.
- **Nil interfaces in practice** — WrapNilSafe handles the case where the inner Submitter is the zero interface value.
- **Method promotion via embedding** — AuditedClient embeds *RecordingSubmitter, gets Submit "for free," adds Audit() of its own.

## Tips

- Run a specific test: `go test -run TestRetryingSubmitter -v`
- For Part 2 (`WrapNilSafe`): you need to return a struct that holds the inner and checks it inside its own Submit method.
- For Part 3, you do NOT need to redeclare Submit on AuditedClient. The compile-time check `var _ Submitter = &AuditedClient{...}` should pass automatically once embedding works.

When green: end of Module 1. Module 2 next — idiomatic Go and what the broader Go ecosystem (which Canton tooling will eventually live in) expects of code style and structure.
