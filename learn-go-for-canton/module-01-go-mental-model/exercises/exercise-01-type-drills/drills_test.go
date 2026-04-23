package typedrills

import (
	"testing"
)

func TestDrill1_Zeros(t *testing.T) {
	i, s, b, sl, m, p := Drill1_Zeros()
	if i != 0 {
		t.Errorf("int zero: want 0, got %d", i)
	}
	if s != "" {
		t.Errorf("string zero: want \"\", got %q", s)
	}
	if b != false {
		t.Errorf("bool zero: want false, got %v", b)
	}
	if sl != nil {
		t.Errorf("slice zero: want nil, got %v", sl)
	}
	if m != nil {
		t.Errorf("map zero: want nil, got %v", m)
	}
	if p != nil {
		t.Errorf("pointer zero: want nil, got %v", p)
	}
}

func TestAppendToNilSlice(t *testing.T) {
	if got := AppendToNilSlice(7); got != 1 {
		t.Errorf("AppendToNilSlice(7): want len 1, got %d", got)
	}
}

func TestSafeMapWrite_NilMap(t *testing.T) {
	if err := SafeMapWrite(nil, "k", 1); err == nil {
		t.Errorf("SafeMapWrite(nil, ...): want error, got nil")
	}
}

func TestSafeMapWrite_OK(t *testing.T) {
	m := map[string]int{}
	if err := SafeMapWrite(m, "k", 5); err != nil {
		t.Errorf("SafeMapWrite(m, ...): want nil, got %v", err)
	}
	if m["k"] != 5 {
		t.Errorf("SafeMapWrite: write missed; m[k]=%d, want 5", m["k"])
	}
}

func TestPartyToCommand(t *testing.T) {
	cmd := PartyToCommand("alice")
	if cmd != "cmd-alice" {
		t.Errorf("PartyToCommand(alice): want cmd-alice, got %q", cmd)
	}
}

func TestGoodSignal(t *testing.T) {
	err := GoodSignal()
	if err != nil {
		t.Errorf("GoodSignal: want nil, got %v (this is the nil-interface trap)", err)
	}
}

// And here's why the trap matters — BadSignal should look broken:
func TestBadSignal_Trap(t *testing.T) {
	err := BadSignal()
	if err == nil {
		t.Errorf("BadSignal: expected the typed-nil trap to make this NON-nil")
	}
	// And calling Error() on the typed nil panics:
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("BadSignal: expected calling .Error() on typed nil to panic")
		}
	}()
	_ = err.Error()
}

func TestCounter(t *testing.T) {
	var c Counter
	c.Inc()
	c.Inc()
	c.Inc()
	if got := c.Read(); got != 3 {
		t.Errorf("Counter after 3 Inc: want 3, got %d (hint: pointer receiver?)", got)
	}
}

func TestContractStatusString(t *testing.T) {
	cases := []struct {
		s    ContractStatus
		want string
	}{
		{StatusPending, "pending"},
		{StatusActive, "active"},
		{StatusArchived, "archived"},
		{StatusRejected, "rejected"},
		{ContractStatus(99), "unknown"},
	}
	for _, c := range cases {
		if got := c.s.String(); got != c.want {
			t.Errorf("ContractStatus(%d).String(): want %q, got %q", int(c.s), c.want, got)
		}
	}
}
