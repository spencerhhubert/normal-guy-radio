package main

import (
	"context"
	"encoding/json"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/spencerhhubert/normal-guy-radio/server/api"
)

const (
	ttl          = 25 * time.Second
	recent       = 24 * time.Hour
	maxListeners = 10000
	maxPeople    = 24
	MinStation   = 875
	MaxStation   = 1080
)

// A listener is one open tab; the person behind it may have several, on the same station or not.
type listener struct {
	station int
	person  string
	since   time.Time
	seen    time.Time
}

// Presence is who is tuned where. Tabs expire after ttl without a heartbeat; a station stays listed
// for a day after its last listener so the dial shows where people have been.
type Presence struct {
	mu        sync.Mutex
	path      string
	listeners map[string]listener
	last      map[int]int64
	dirty     bool
}

func NewPresence(path string) *Presence {
	return &Presence{path: path, listeners: map[string]listener{}, last: map[int]int64{}}
}

func (p *Presence) Touch(station int, id, person string, now time.Time) api.Station {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sweep(now)
	if l, ok := p.listeners[id]; ok {
		p.listeners[id] = listener{station, person, l.since, now}
	} else if len(p.listeners) < maxListeners {
		p.listeners[id] = listener{station, person, now, now}
	}
	p.last[station] = now.Unix()
	p.dirty = true
	first := map[string]time.Time{}
	for _, l := range p.listeners {
		if l.station == station {
			arrive(first, l)
		}
	}
	return describe(station, now.Unix(), first)
}

func (p *Presence) Leave(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.listeners, id)
}

func (p *Presence) Stations(now time.Time) ([]api.Station, int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sweep(now)
	arrivals, people := p.arrivals(), map[string]bool{}
	for _, l := range p.listeners {
		people[l.person] = true
	}
	out := []api.Station{}
	for st, heard := range p.last {
		if len(arrivals[st]) == 0 && now.Unix()-heard > int64(recent.Seconds()) {
			continue
		}
		out = append(out, describe(st, heard, arrivals[st]))
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Listeners != out[j].Listeners {
			return out[i].Listeners > out[j].Listeners
		}
		return out[i].LastHeard > out[j].LastHeard
	})
	return out, len(people)
}

// arrivals is, per station, when each person first showed up there.
func (p *Presence) arrivals() map[int]map[string]time.Time {
	out := map[int]map[string]time.Time{}
	for _, l := range p.listeners {
		if out[l.station] == nil {
			out[l.station] = map[string]time.Time{}
		}
		arrive(out[l.station], l)
	}
	return out
}

func arrive(first map[string]time.Time, l listener) {
	if t, ok := first[l.person]; !ok || l.since.Before(t) {
		first[l.person] = l.since
	}
}

func describe(station int, heard int64, first map[string]time.Time) api.Station {
	ids := make([]string, 0, len(first))
	for id := range first {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool {
		if !first[ids[i]].Equal(first[ids[j]]) {
			return first[ids[i]].Before(first[ids[j]])
		}
		return ids[i] < ids[j]
	})
	people := make([]api.Person, 0, len(ids))
	for _, id := range ids {
		if len(people) == maxPeople {
			break
		}
		people = append(people, Name(id))
	}
	return api.Station{Id: station, Listeners: len(ids), LastHeard: heard, People: people}
}

func (p *Presence) sweep(now time.Time) {
	for id, l := range p.listeners {
		if now.Sub(l.seen) > ttl {
			delete(p.listeners, id)
		}
	}
	for st, heard := range p.last {
		if now.Unix()-heard > int64(recent.Seconds()) {
			delete(p.last, st)
		}
	}
}

func (p *Presence) Load() error {
	b, err := os.ReadFile(p.path)
	if err != nil {
		return err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return json.Unmarshal(b, &p.last)
}

func (p *Presence) Save() error {
	p.mu.Lock()
	b, err := json.Marshal(p.last)
	p.dirty = false
	p.mu.Unlock()
	if err != nil {
		return err
	}
	tmp := p.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p.path)
}

func (p *Presence) Run(ctx context.Context) {
	t := time.NewTicker(30 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			p.mu.Lock()
			p.sweep(now)
			dirty := p.dirty
			p.mu.Unlock()
			if dirty {
				p.Save()
			}
		}
	}
}
