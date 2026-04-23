// This test file is intentionally NOT-YET-COMPILABLE.
// You'll uncomment it after running `buf generate` and after writing your
// Submit/StreamUpdates implementations. See README.md.
//
//go:build ignore

package grpcexample

import (
	"context"
	"net"
	"testing"
	"time"

	examplev1 "example.com/grpcexample/proto/example/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

// dialBufNet starts an in-process gRPC server backed by bufconn (no real TCP).
// Useful for integration tests that need a live server without binding ports.
func dialBufNet(t *testing.T) (examplev1.SubmitterClient, func()) {
	t.Helper()
	lis := bufconn.Listen(1024 * 1024)

	srv := grpc.NewServer()
	examplev1.RegisterSubmitterServer(srv, NewSubmitterServer())
	go srv.Serve(lis)

	conn, err := grpc.NewClient(
		"passthrough://bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	cleanup := func() {
		conn.Close()
		srv.Stop()
	}
	return examplev1.NewSubmitterClient(conn), cleanup
}

func TestSubmit_HappyPath(t *testing.T) {
	client, cleanup := dialBufNet(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	resp, err := client.Submit(ctx, &examplev1.SubmitRequest{
		CommandId: "c1",
		Party:     "Alice",
		Payload:   []byte("hello"),
	})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if resp.Status != examplev1.SubmitResponse_ACCEPTED {
		t.Errorf("status: want ACCEPTED, got %v", resp.Status)
	}
	if resp.SubmissionId == "" {
		t.Errorf("submission_id should be non-empty")
	}
}

func TestSubmit_EmptyCommandID_Rejected(t *testing.T) {
	client, cleanup := dialBufNet(t)
	defer cleanup()
	resp, _ := client.Submit(context.Background(), &examplev1.SubmitRequest{Party: "Alice"})
	if resp.Status != examplev1.SubmitResponse_REJECTED {
		t.Errorf("expected REJECTED, got %v", resp.Status)
	}
}

func TestSubmit_Idempotent(t *testing.T) {
	client, cleanup := dialBufNet(t)
	defer cleanup()
	a, _ := client.Submit(context.Background(), &examplev1.SubmitRequest{CommandId: "x", Party: "Alice"})
	b, _ := client.Submit(context.Background(), &examplev1.SubmitRequest{CommandId: "x", Party: "Alice"})
	if a.SubmissionId != b.SubmissionId {
		t.Errorf("idempotency violated: got two different submission_ids: %s vs %s", a.SubmissionId, b.SubmissionId)
	}
}

func TestStreamUpdates_ReceivesAll(t *testing.T) {
	client, cleanup := dialBufNet(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	stream, err := client.StreamUpdates(ctx, &examplev1.StreamRequest{Party: "Alice", Offset: 100})
	if err != nil {
		t.Fatalf("open stream: %v", err)
	}

	var got []int64
	for {
		upd, err := stream.Recv()
		if err != nil {
			break
		}
		got = append(got, upd.Offset)
	}
	if len(got) != 5 {
		t.Errorf("expected 5 updates, got %d (%v)", len(got), got)
	}
	for i, off := range got {
		if off != int64(100+i) {
			t.Errorf("offset[%d]: want %d, got %d", i, 100+i, off)
		}
	}
}

func TestStreamUpdates_RespectsCancel(t *testing.T) {
	client, cleanup := dialBufNet(t)
	defer cleanup()

	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancel()

	stream, err := client.StreamUpdates(ctx, &examplev1.StreamRequest{Party: "Alice"})
	if err != nil {
		t.Fatalf("open stream: %v", err)
	}

	var got int
	for {
		_, err := stream.Recv()
		if err != nil {
			break
		}
		got++
	}
	// Server sends every 10ms, ctx times out at 25ms — expect 1-3 updates, not 5.
	if got >= 5 {
		t.Errorf("ctx-cancel didn't propagate; received all %d updates", got)
	}
}
