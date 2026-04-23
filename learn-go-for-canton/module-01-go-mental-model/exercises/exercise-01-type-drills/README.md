# Exercise 1 — Type Drills

Six drills that exercise zero values, nil semantics, named types, the nil-interface trap, methods, and constants.

## Run

From this directory:

```sh
go test -v ./...
```

You'll see failures for every drill that's not implemented yet. Implement them in `drills.go` until everything passes.

## Drill index

| # | What it teaches |
|---|---|
| 1 | Every Go type has a zero value — return them. |
| 2 | Nil slice accepts append; nil map panics on write. |
| 3 | Named types are distinct; explicit conversion required. |
| 4 | Returning typed nil pointers as interface values is the classic trap. |
| 5 | Pointer receivers are required for mutation. |
| 6 | iota for enum-like constants; method on a named primitive type. |

## Tips

- For Drill 4, the fix is literally one line. Read your test output carefully.
- For Drill 5, if your test fails with "want 3, got 0," your receiver type is wrong.
- For Drill 6, follow the convention of lowercase enum strings.

When everything passes, head back to the exercise HTML and mark complete.
