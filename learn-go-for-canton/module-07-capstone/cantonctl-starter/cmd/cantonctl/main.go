// cantonctl — a CLI to talk to a Canton participant's Ledger API.
//
// Phase 1: a single subcommand `ping` that opens a connection and exits cleanly.
// Phases 2–4 grow this file (or split it into pkg/cmd/...) into a proper
// cobra-based CLI.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"example.com/cantonctl/internal/ledger"
)

func main() {
	endpoint := flag.String("endpoint", "localhost:5011", "Canton Ledger API endpoint")
	useTLS := flag.Bool("tls", false, "use TLS")
	caFile := flag.String("ca", "", "PEM CA bundle (with -tls)")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	slog.SetDefault(logger)

	if flag.NArg() < 1 {
		fmt.Fprintln(os.Stderr, "usage: cantonctl <command> [flags]")
		fmt.Fprintln(os.Stderr, "commands: ping (more in later phases)")
		os.Exit(2)
	}

	// Wire ctx for graceful Ctrl-C
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := ledger.Config{
		Endpoint:   *endpoint,
		TLS:        *useTLS,
		CACertFile: *caFile,
	}

	switch flag.Arg(0) {
	case "ping":
		if err := runPing(ctx, cfg); err != nil {
			logger.Error("ping failed", "err", err)
			os.Exit(1)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n", flag.Arg(0))
		os.Exit(2)
	}
}

func runPing(ctx context.Context, cfg ledger.Config) error {
	c, err := ledger.Dial(ctx, cfg)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer c.Close()

	if err := c.Ping(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}
	slog.Info("ping ok", "endpoint", cfg.Endpoint)
	return nil
}
