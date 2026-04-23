// Package ledger wraps the generated Canton Ledger API stubs in a friendly
// Go API. Phases 1–3 grow this file.
//
// After running `buf generate` from the repo root with the Canton protos in
// place, the generated packages will live at, e.g.:
//
//   example.com/cantonctl/proto/com/daml/ledger/api/v2
//
// Adjust import paths to match.
package ledger

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"os"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
)

// Config carries everything needed to dial a Canton participant's Ledger API.
type Config struct {
	Endpoint string // host:port, e.g. "localhost:5011"

	TLS bool // if true, use TLS
	CACertFile  string // optional: PEM CA bundle
	ClientCert  string // optional: client cert PEM (mTLS)
	ClientKey   string // optional: client key PEM (mTLS)
	ServerName  string // optional: SNI override

	Token string // optional: JWT to send as `authorization: Bearer ...`

	DialTimeout time.Duration // defaults to 10s
}

// Client is a long-lived handle to a participant. Construct once, reuse.
type Client struct {
	conn *grpc.ClientConn
	cfg  Config

	// Phase 2+: client stubs go here, e.g.:
	//   commands example.com/cantonctl/proto/.../v2.CommandServiceClient
	//   updates  example.com/cantonctl/proto/.../v2.UpdateServiceClient
}

// Dial opens a connection. Caller must call Close.
func Dial(ctx context.Context, cfg Config) (*Client, error) {
	if cfg.Endpoint == "" {
		return nil, errors.New("ledger.Dial: Endpoint required")
	}

	dialOpts := []grpc.DialOption{
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                30 * time.Second,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}),
	}

	if cfg.TLS {
		creds, err := buildTLSCreds(cfg)
		if err != nil {
			return nil, err
		}
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(creds))
	} else {
		dialOpts = append(dialOpts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	// Phase 2+: append a unary interceptor that injects the bearer token.

	conn, err := grpc.NewClient(cfg.Endpoint, dialOpts...)
	if err != nil {
		return nil, err
	}

	c := &Client{conn: conn, cfg: cfg}
	// Phase 2+: c.commands = pb.NewCommandServiceClient(conn) etc.
	return c, nil
}

// Close releases the underlying connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

// Ping is a placeholder for "is this alive?" — phase 1's deliverable.
// Implement against grpc.health.v1 or against VersionService once stubs exist.
//
// The simplest version: just verify the conn isn't nil and the connectivity
// state is Ready or Idle. The real version: call a no-side-effect RPC like
// Version or HealthCheck.
func (c *Client) Ping(ctx context.Context) error {
	if c == nil || c.conn == nil {
		return errors.New("ledger.Ping: nil client")
	}
	// TODO (phase 1): call something. Suggested: grpc.health.v1 with the
	// generated health stub, OR version.VersionServiceClient.GetLedgerApiVersion.
	return errors.New("ledger.Ping: not implemented yet")
}

// buildTLSCreds composes credentials.TransportCredentials from the config.
func buildTLSCreds(cfg Config) (credentials.TransportCredentials, error) {
	tlsCfg := &tls.Config{ServerName: cfg.ServerName}

	if cfg.CACertFile != "" {
		pem, err := os.ReadFile(cfg.CACertFile)
		if err != nil {
			return nil, err
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, errors.New("ledger: bad CA bundle")
		}
		tlsCfg.RootCAs = pool
	}
	if cfg.ClientCert != "" && cfg.ClientKey != "" {
		cert, err := tls.LoadX509KeyPair(cfg.ClientCert, cfg.ClientKey)
		if err != nil {
			return nil, err
		}
		tlsCfg.Certificates = []tls.Certificate{cert}
	}
	return credentials.NewTLS(tlsCfg), nil
}
