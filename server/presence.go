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
	MinStation   = 875
	MaxStation   = 1080
)

type listener struct {
	station int
	seen    time.Time
}

// Presence is who is tuned where. Listeners expire after ttl without a heartbeat; a station stays
// listed for a day after its last listener so the dial shows where people have been.
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

func (p *Presence) Touch(station int, id string, now time.Time) api.Station {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.sweep(now)
	if _, ok := p.listeners[id]; ok || len(p.listeners) < maxListeners {
		p.listeners[id] = listener{station, now}
	}
	p.last[station] = now.Unix()
	p.dirty = true
	return api.Station{Id: station, Listeners: p.count(station), LastHeard: now.Unix()}
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
	counts := map[int]int{}
	for _, l := range p.listeners {
		counts[l.station]++
	}
	out := []api.Station{}
	for st, heard := range p.last {
		if counts[st] == 0 && now.Unix()-heard > int64(recent.Seconds()) {
			continue
		}
		out = append(out, api.Station{Id: st, Listeners: counts[st], LastHeard: heard})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Listeners != out[j].Listeners {
			return out[i].Listeners > out[j].Listeners
		}
		return out[i].LastHeard > out[j].LastHeard
	})
	return out, len(p.listeners)
}

func (p *Presence) count(station int) int {
	n := 0
	for _, l := range p.listeners {
		if l.station == station {
			n++
		}
	}
	return n
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
