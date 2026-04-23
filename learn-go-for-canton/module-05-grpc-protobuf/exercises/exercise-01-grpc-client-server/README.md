# Exercise — gRPC Client &amp; Server

Build the full Submitter service end to end: a proto schema, generated stubs, a server implementing two RPCs (one unary, one streaming), and a client driving both.

This is the closest analog in the curriculum to what you'll do in the Module 7 capstone — except the capstone targets a real Canton sandbox and these stubs are your own.

## Setup (one-time)

```sh
# 1. Install buf
brew install bufbuild/buf/buf

# 2. Install Go protoc plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# 3. Make sure $GOBIN (typically ~/go/bin) is on your PATH
export PATH=$PATH:$(go env GOBIN):$(go env GOPATH)/bin

# 4. From this exercise directory, generate stubs from proto/example/v1/submitter.proto:
buf generate

# 5. Pull in dependency versions (grpc, protobuf)
go mod tidy
```

After step 4, you should see:
- `proto/example/v1/submitter.pb.go` — generated message types
- `proto/example/v1/submitter_grpc.pb.go` — generated client/server stubs

## Build the implementation

1. Open `server.go`.
2. Uncomment the `examplev1` import.
3. Add `examplev1.UnimplementedSubmitterServer` as an embedded field in `SubmitterServer`.
4. Move the `Submit` and `StreamUpdates` methods out of the comment block into the package — they're already written; you mostly just paste them in.
5. Open `client_test.go` and **remove the `//go:build ignore` line** so tests will compile and run.

## Run

```sh
go test -v -race ./...
```

Five tests:
- `TestSubmit_HappyPath` — basic unary call
- `TestSubmit_EmptyCommandID_Rejected` — validation
- `TestSubmit_Idempotent` — same command_id returns same submission_id
- `TestStreamUpdates_ReceivesAll` — server streams 5 updates
- `TestStreamUpdates_RespectsCancel` — cancel propagates and server stops sending

The tests use `bufconn` — an in-memory `net.Conn` substitute, so no TCP ports are bound. Same shape as a production integration test against a local Canton sandbox.

## What you learn

- The full proto → buf generate → Go workflow
- Server registration with grpc.NewServer + Register...Server
- Client connection and unary call
- Server-side streaming (Send in loop) and client-side consumption (Recv until io.EOF)
- Context cancellation propagating through a gRPC stream
- Idempotency at the application layer
- bufconn for unit-testing gRPC services without binding sockets

## Stretch

Add a unary client interceptor that injects an `authorization` header. Add a server interceptor that logs every call's method and duration. Verify via the test logs.
