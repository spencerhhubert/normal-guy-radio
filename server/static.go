package main

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

// static serves the built site. Anything that is not a file gets the app shell, with the share
// image pointed at this host and the title at the station in the URL, so a shared link previews right.
func static(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean(r.URL.Path)
		if st, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p))); p == "/" || p == "/index.html" || err != nil || st.IsDir() {
			shell(dir, w, r)
			return
		}
		switch {
		case strings.HasPrefix(p, "/_app/immutable/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasPrefix(p, "/samples/"):
			w.Header().Set("Cache-Control", "public, max-age=604800")
		default:
			w.Header().Set("Cache-Control", "no-cache")
		}
		fs.ServeHTTP(w, r)
	})
}

func shell(dir string, w http.ResponseWriter, r *http.Request) {
	b, err := os.ReadFile(filepath.Join(dir, "index.html"))
	if err != nil {
		http.Error(w, "site not built", http.StatusServiceUnavailable)
		return
	}
	scheme := r.Header.Get("X-Forwarded-Proto")
	if scheme == "" {
		scheme = "http"
		if r.TLS != nil {
			scheme = "https"
		}
	}
	s := strings.ReplaceAll(string(b), `content="/og.png"`, `content="`+scheme+"://"+r.Host+`/og.png"`)
	if fm, err := strconv.ParseFloat(r.URL.Query().Get("fm"), 64); err == nil {
		if id := int(math.Round(fm * 10)); id >= MinStation && id <= MaxStation {
			t := fmt.Sprintf("%.1f FM · Normal Radio", float64(id)/10)
			s = strings.ReplaceAll(s, ">Normal Radio</title>", ">"+t+"</title>")
			s = strings.ReplaceAll(s, `og:title" content="Normal Radio"`, `og:title" content="`+t+`"`)
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	io.WriteString(w, s)
}
