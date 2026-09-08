package main

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"
)

func TestPresence(t *testing.T) {
	p := NewPresence(filepath.Join(t.TempDir(), "s.json"))
	now := time.Unix(1_800_000_000, 0)

	if st := p.Touch(1013, "tab-a", "person-1", now); st.Listeners != 1 || len(st.People) != 1 || st.People[0] != Name("person-1") {
		t.Fatalf("first heartbeat: %+v", st)
	}
	// a second tab of the same person on the same station is still one listener
	if st := p.Touch(1013, "tab-b", "person-1", now.Add(time.Second)); st.Listeners != 1 {
		t.Fatalf("same person twice: %+v", st)
	}
	// and a tab on another station puts them on both
	p.Touch(885, "tab-c", "person-1", now.Add(2*time.Second))
	p.Touch(885, "tab-d", "person-2", now.Add(3*time.Second))
	stations, total := p.Stations(now.Add(4 * time.Second))
	if total != 2 || len(stations) != 2 || stations[0].Id != 885 || stations[0].Listeners != 2 || stations[0].People[0] != Name("person-1") || stations[1].Listeners != 1 {
		t.Fatalf("stations: total %d %+v", total, stations)
	}

	// heartbeats expire, the station lingers for the day
	stations, total = p.Stations(now.Add(ttl + 5*time.Second))
	if total != 0 || len(stations) != 2 || stations[0].Listeners != 0 || len(stations[0].People) != 0 {
		t.Fatalf("after ttl: total %d %+v", total, stations)
	}
	stations, _ = p.Stations(now.Add(recent + time.Minute))
	if len(stations) != 0 {
		t.Fatalf("after a day: %+v", stations)
	}

	p.Touch(1013, "tab-e", "person-3", now.Add(recent+2*time.Minute))
	p.Leave("tab-e")
	if _, total := p.Stations(now.Add(recent + 2*time.Minute)); total != 0 {
		t.Fatalf("leave: %d", total)
	}

	if err := p.Save(); err != nil {
		t.Fatal(err)
	}
	q := NewPresence(p.path)
	if err := q.Load(); err != nil {
		t.Fatal(err)
	}
}

func TestPresenceCap(t *testing.T) {
	p := NewPresence("")
	now := time.Now()
	for i := 0; i < maxListeners+50; i++ {
		p.Touch(900, fmt.Sprintf("tab-%d", i), fmt.Sprintf("person-%d", i), now)
	}
	if _, total := p.Stations(now); total != maxListeners {
		t.Fatalf("cap: %d", total)
	}
}

func TestName(t *testing.T) {
	a := Name("6f1c2a3b-example")
	if a != Name("6f1c2a3b-example") || a.Name == "" || a.Emoji == "" {
		t.Fatalf("name: %+v", a)
	}
}
