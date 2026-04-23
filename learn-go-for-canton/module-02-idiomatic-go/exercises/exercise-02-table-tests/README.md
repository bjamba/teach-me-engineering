# Exercise 2 — Build a Table-Driven Test Suite

Write your own table-driven test from scratch. The function under test is partially implemented — you'll bounce between completing the function and writing test cases.

## Run

```sh
go test -v ./...
```

## What to do

1. Read `offset.go` and the spec for `ParseOffset`.
2. Complete the two TODOs in `offset.go`.
3. Write `TestParseOffset` in `offset_test.go` covering all 12 listed cases.
4. Use the table-driven pattern with `t.Run(c.name, ...)`.
5. Delete the `TestSmoke_PleaseDelete` test once you've written the real one.

## What good looks like

- One test function. One slice of test-case structs. One loop with `t.Run`.
- Each case has a descriptive name (the name shows in `go test -v` output).
- Compare values with `==`. Compare errors with `errors.Is(err, want)`.
- Run individual cases: `go test -run TestParseOffset/decimal_prefix -v`.

## Stretch

Add a `FuzzParseOffset` target with a few seed inputs. Run it for 30 seconds (`go test -fuzz=FuzzParseOffset -fuzztime=30s`) and see if the fuzzer finds an input that panics. If it does — fix it.
