// Package grpcexample — a tiny gRPC server implementing the Submitter service.
//
// To run this, you must FIRST generate the protobuf/gRPC stubs:
//
//   1. Install buf:        brew install bufbuild/buf/buf
//      (or follow https://buf.build/docs/installation)
//   2. Install protoc plugins:
//        go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
//        go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
//   3. Generate:           buf generate
//   4. Tidy modules:       go mod tidy
//   5. Run tests:          go test -v ./...
//
// You'll also need to UNCOMMENT the imports below once stubs exist.
//
// What you implement:
//   - Submit: validate the command_id is non-empty; reject empty parties;
//     return SubmitResponse with a generated submission_id (any unique string).
//   - StreamUpdates: send 5 fake Update messages with sequential offsets,
//     one every ~10ms, then return nil to close the stream cleanly.
//   - Both must respect ctx cancellation (return early if ctx.Err() != nil).
package grpcexample

import (
	"context"
	"fmt"
	"time"
	// Uncomment after `buf generate`:
	// examplev1 "example.com/grpcexample/proto/example/v1"
)

// SubmitterServer is your handler. After generating stubs, embed
// examplev1.UnimplementedSubmitterServer here and implement Submit and StreamUpdates.
type SubmitterServer struct {
	// TODO (after stubs exist):
	// examplev1.UnimplementedSubmitterServer

	// Idempotency: map command_id -> submission_id so retries return the same submission.
	// Real Canton clients rely on this kind of behavior.
	idempotency map[string]string
}

// NewSubmitterServer constructs a fresh server.
func NewSubmitterServer() *SubmitterServer {
	return &SubmitterServer{idempotency: map[string]string{}}
}

// genSubmissionID is a non-cryptographic ID generator. Good enough for tests.
func genSubmissionID(commandID string) string {
	return fmt.Sprintf("sub-%s-%d", commandID, time.Now().UnixNano())
}

/*
After running `buf generate`, replace the placeholder code below with real
implementations. The shape:

func (s *SubmitterServer) Submit(ctx context.Context, req *examplev1.SubmitRequest) (*examplev1.SubmitResponse, error) {
    if req.CommandId == "" {
        return &examplev1.SubmitResponse{
            Status:       examplev1.SubmitResponse_REJECTED,
            ErrorMessage: "command_id is required",
        }, nil
    }
    if req.Party == "" {
        return &examplev1.SubmitResponse{
            Status:       examplev1.SubmitResponse_REJECTED,
            ErrorMessage: "party is required",
        }, nil
    }
    // Idempotent submit: same command_id → same submission_id
    if id, ok := s.idempotency[req.CommandId]; ok {
        return &examplev1.SubmitResponse{
            SubmissionId: id,
            Status:       examplev1.SubmitResponse_ACCEPTED,
        }, nil
    }
    id := genSubmissionID(req.CommandId)
    s.idempotency[req.CommandId] = id
    return &examplev1.SubmitResponse{
        SubmissionId: id,
        Status:       examplev1.SubmitResponse_ACCEPTED,
    }, nil
}

func (s *SubmitterServer) StreamUpdates(req *examplev1.StreamRequest, stream examplev1.Submitter_StreamUpdatesServer) error {
    for i := int64(0); i < 5; i++ {
        select {
        case <-stream.Context().Done():
            return stream.Context().Err()
        default:
        }
        upd := &examplev1.Update{
            Offset:     req.Offset + i,
            ContractId: fmt.Sprintf("c-%d", i),
            Payload:    []byte(fmt.Sprintf("hello-%d", i)),
        }
        if err := stream.Send(upd); err != nil {
            return err
        }
        time.Sleep(10 * time.Millisecond)
    }
    return nil
}
*/

// Until you generate stubs, compile this package by exposing nothing real.
// Tests will fail to find Submit/StreamUpdates — that's the trigger to follow
// the steps in the README.
var _ = context.Background
