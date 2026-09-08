package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/spencerhhubert/normal-guy-radio/server/api"
)

var version = "dev"

func main() {
	addr := flag.String("addr", "127.0.0.1:8811", "listen address")
	web := flag.String("web", "web", "built site directory")
	data := flag.String("data", "data", "state directory")
	dev := flag.Bool("dev", false, "enable /dev endpoints")
	flag.Parse()

	p := NewPresence(filepath.Join(*data, "stations.json"))
	if err := p.Load(); err != nil && !os.IsNotExist(err) {
		log.Printf("load state: %v", err)
	}

	mux := http.NewServeMux()
	api.HandlerWithOptions(api.NewStrictHandler(&Server{p: p}, nil), api.StdHTTPServerOptions{BaseURL: "/api", BaseRouter: mux})
	if *dev {
		mux.HandleFunc("POST /dev/render", devRender)
	}
	mux.Handle("/", static(*web))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go p.Run(ctx)

	srv := &http.Server{Addr: *addr, Handler: cors(mux), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutdown)
		if err := p.Save(); err != nil {
			log.Printf("save state: %v", err)
		}
	}()
	log.Printf("radiod %s on %s", version, *addr)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func devRender(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(r.Header.Get("X-Name"))
	if name == "" || name == "." {
		name = "render"
	}
	ext := ".wav"
	if r.Header.Get("Content-Type") == "application/json" {
		ext = ".json"
	}
	os.MkdirAll("renders", 0o755)
	f, err := os.Create(filepath.Join("renders", name+ext))
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	defer f.Close()
	if _, err := f.ReadFrom(r.Body); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte(f.Name()))
}
