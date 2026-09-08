package main

import (
	"context"
	"time"

	"github.com/spencerhhubert/normal-guy-radio/server/api"
)

// Station timelines are a function of the clock; these must match the composer.
const (
	Epoch   = 1788825600
	Segment = 1200
)

type Server struct{ p *Presence }

func (s *Server) GetNow(ctx context.Context, _ api.GetNowRequestObject) (api.GetNowResponseObject, error) {
	return api.GetNow200JSONResponse{Now: time.Now().UnixMilli(), Epoch: Epoch, Segment: Segment}, nil
}

func (s *Server) ListStations(ctx context.Context, _ api.ListStationsRequestObject) (api.ListStationsResponseObject, error) {
	stations, total := s.p.Stations(time.Now())
	return api.ListStations200JSONResponse{Stations: stations, Listeners: total}, nil
}

func (s *Server) Listen(ctx context.Context, req api.ListenRequestObject) (api.ListenResponseObject, error) {
	b := req.Body
	if b == nil || b.Station < MinStation || b.Station > MaxStation || !idOK(b.Listener) || !idOK(b.Person) {
		return api.Listen400Response{}, nil
	}
	return api.Listen200JSONResponse{Station: s.p.Touch(b.Station, b.Listener, b.Person, time.Now()), You: Name(b.Person)}, nil
}

func idOK(id string) bool { return len(id) >= 8 && len(id) <= 64 }

func (s *Server) Leave(ctx context.Context, req api.LeaveRequestObject) (api.LeaveResponseObject, error) {
	if req.Body != nil && len(req.Body.Listener) >= 8 {
		s.p.Leave(req.Body.Listener)
	}
	return api.Leave204Response{}, nil
}

func (s *Server) GetVersion(ctx context.Context, _ api.GetVersionRequestObject) (api.GetVersionResponseObject, error) {
	return api.GetVersion200JSONResponse{Version: version}, nil
}
