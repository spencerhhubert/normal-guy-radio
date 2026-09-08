package main

import (
	"path/filepath"
	"testing"
	"time"
)

func TestPresence(t *testing.T) {
	p := NewPresence(filepath.Join(t.TempDir(), "s.json"))
	now := time.Unix(1_800_000_000, 0)

	if st := p.Touch(1013, "listener-a", now); st.Listeners != 1 {
		t.Fatalf("first heartbeat: %+v", st)
	}
	if st := p.Touch(1013, "listener-b", now.Add(time.Second)); st.Listeners != 2 {
		t.Fatalf("second listener: %+v", st)
	}
	p.Touch(885, "listener-c", now.Add(2*time.Second))

	stations, total := p.Stations(now.Add(3 * time.Second))
	if total != 3 || len(stations) != 2 || stations[0].Id != 1013 || stations[0].Listeners != 2 {
		t.Fatalf("stations: total %d %+v", total, stations)
	}

	// heartbeats expire, the station lingers for the day
	stations, total = p.Stations(now.Add(ttl + 5*time.Second))
	if total != 0 || len(stations) != 2 || stations[0].Listeners != 0 {
		t.Fatalf("after ttl: total %d %+v", total, stations)
	}
	stations, _ = p.Stations(now.Add(recent + time.Minute))
	if len(stations) != 0 {
		t.Fatalf("after a day: %+v", stations)
	}

	p.Touch(1013, "listener-d", now.Add(recent+2*time.Minute))
	p.Leave("listener-d")
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
		p.Touch(900, "id-"+time.Duration(i).String(), now)
	}
	if _, total := p.Stations(now); total != maxListeners {
		t.Fatalf("cap: %d", total)
	}
}
