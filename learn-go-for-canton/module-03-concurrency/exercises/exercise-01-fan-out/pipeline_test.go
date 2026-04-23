package fanout

import (
	"sort"
	"testing"
)

func collect(ch <-chan Result) []Result {
	var rs []Result
	for r := range ch {
		rs = append(rs, r)
	}
	sort.Slice(rs, func(i, j int) bool { return rs[i].JobID < rs[j].JobID })
	return rs
}

func TestSourceFromSlice(t *testing.T) {
	src := SourceFromSlice([]Job{{ID: 1}, {ID: 2}, {ID: 3}})
	var got []int
	for j := range src {
		got = append(got, j.ID)
	}
	if len(got) != 3 {
		t.Errorf("source len: want 3, got %d", len(got))
	}
}

func TestFanOut_ProcessesAllInputs(t *testing.T) {
	jobs := make([]Job, 100)
	for i := range jobs {
		jobs[i] = Job{ID: i, Value: i}
	}
	src := SourceFromSlice(jobs)
	out := FanOut(src, 8)
	results := collect(out)
	if len(results) != 100 {
		t.Errorf("got %d results, want 100", len(results))
	}
	for i, r := range results {
		if r.JobID != i || r.Out != i*2 {
			t.Errorf("result %d: got JobID=%d Out=%d; want JobID=%d Out=%d",
				i, r.JobID, r.Out, i, i*2)
		}
	}
}

func TestMerge(t *testing.T) {
	a := make(chan Result, 3)
	b := make(chan Result, 3)
	a <- Result{JobID: 1, Out: 1}
	a <- Result{JobID: 2, Out: 4}
	close(a)
	b <- Result{JobID: 3, Out: 9}
	b <- Result{JobID: 4, Out: 16}
	close(b)

	merged := Merge(a, b)
	got := collect(merged)
	if len(got) != 4 {
		t.Errorf("merged len: want 4, got %d", len(got))
	}
}

func TestFanOutMerge_Combined(t *testing.T) {
	jobs := make([]Job, 50)
	for i := range jobs {
		jobs[i] = Job{ID: i, Value: i}
	}
	src1 := SourceFromSlice(jobs[:25])
	src2 := SourceFromSlice(jobs[25:])

	out1 := FanOut(src1, 4)
	out2 := FanOut(src2, 4)

	merged := Merge(out1, out2)
	results := collect(merged)
	if len(results) != 50 {
		t.Errorf("combined len: want 50, got %d", len(results))
	}
}
