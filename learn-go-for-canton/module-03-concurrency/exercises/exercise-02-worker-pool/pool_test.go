package workerpool

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestRun_AllSucceed(t *testing.T) {
	var done atomic.Int32
	tasks := make([]Task, 50)
	for i := range tasks {
		tasks[i] = func(ctx context.Context) error {
			done.Add(1)
			return nil
		}
	}
	if err := Run(context.Background(), 4, tasks); err != nil {
		t.Errorf("expected nil, got %v", err)
	}
	if done.Load() != 50 {
		t.Errorf("expected 50 done, got %d", done.Load())
	}
}

func TestRun_FirstErrorWins(t *testing.T) {
	tasks := []Task{
		func(ctx context.Context) error { time.Sleep(20 * time.Millisecond); return errors.New("first") },
		func(ctx context.Context) error { time.Sleep(50 * time.Millisecond); return errors.New("second") },
		func(ctx context.Context) error { time.Sleep(80 * time.Millisecond); return errors.New("third") },
	}
	err := Run(context.Background(), 3, tasks)
	if err == nil || err.Error() != "first" {
		t.Errorf("expected 'first', got %v", err)
	}
}

func TestRun_RespectsContextCancel(t *testing.T) {
	var started atomic.Int32

	ctx, cancel := context.WithCancel(context.Background())
	tasks := make([]Task, 100)
	for i := range tasks {
		tasks[i] = func(ctx context.Context) error {
			started.Add(1)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(50 * time.Millisecond):
				return nil
			}
		}
	}

	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	err := Run(ctx, 8, tasks)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
	if started.Load() >= 100 {
		t.Errorf("cancellation should prevent late starts; started=%d", started.Load())
	}
}

func TestRun_BoundedConcurrency(t *testing.T) {
	var inFlight, peak atomic.Int32
	tasks := make([]Task, 30)
	for i := range tasks {
		tasks[i] = func(ctx context.Context) error {
			cur := inFlight.Add(1)
			for {
				p := peak.Load()
				if cur <= p || peak.CompareAndSwap(p, cur) {
					break
				}
			}
			time.Sleep(10 * time.Millisecond)
			inFlight.Add(-1)
			return nil
		}
	}

	if err := Run(context.Background(), 5, tasks); err != nil {
		t.Fatal(err)
	}
	if peak.Load() > 5 {
		t.Errorf("peak concurrency %d exceeds limit 5", peak.Load())
	}
}
