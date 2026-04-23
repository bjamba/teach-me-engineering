# cantonctl-starter

Capstone starter project. Each capstone phase grows this same module — `cd` here once, then iterate.

## What's here

```
cantonctl-starter/
├── go.mod                       module declaration
├── buf.yaml, buf.gen.yaml       protobuf codegen config
├── proto/                       (empty — you'll populate this in phase 1)
├── internal/ledger/client.go    connection wrapper, grows over the phases
└── cmd/cantonctl/main.go        CLI entrypoint, grows over the phases
```

## Workflow per phase

1. Read the corresponding phase HTML page first.
2. Make the code changes it describes.
3. Run `go vet ./...` and `go build ./...` and `go run ./cmd/cantonctl ping --endpoint localhost:5011`.
4. When the phase's success criterion is met, mark complete and proceed to the next.

## You will need

- The Canton sandbox running locally (Docker; see Module 7 Lesson 1).
- The Canton/daml protos checked out and copied into `proto/` (Phase 1 walks through this).
- `buf` and the Go protoc plugins installed (Module 5 Lesson 2).
