# Exercise 2 — Context-Aware Worker Pool

Build the worker-pool primitive you'll reach for in every concurrent Canton-adjacent service. Bounded concurrency. Context cancellation. First-error-wins propagation.

## Run

```sh
go test -v -race ./...
```

## What you're building

```go
err := workerpool.Run(ctx, 8, tasks) // 8 concurrent workers, all tasks
```

If any task returns an error, the rest are canceled. If ctx is canceled externally, in-flight tasks see the cancellation through *their* ctx and Run returns `ctx.Err()`. Bounded concurrency means at most N tasks run simultaneously.

## What gets tested

- All-success path returns nil and runs every task.
- First error stops the world; subsequent errors are dropped (deliberately — first error is the most actionable).
- External context cancel takes the pool down — both running tasks see the cancel, and not-yet-started tasks don't get to start.
- At most N tasks ever run in parallel, observed by an atomic peak counter.

## Tips

- Derive a child context with WithCancel inside Run. Cancel it on first error.
- A buffered channel of tasks is the simplest dispatcher.
- Use a buffered errors channel of size 1 with select-default to capture the first error and drop the rest.
- Always sync.WaitGroup the workers; close down cleanly.

## Stretch

Make Run take `tasks ...Task` instead of `[]Task` (variadic). Make it work for an unbounded sequence — accept `<-chan Task` instead. The same shape, slightly different feeding mechanism.
