package main

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// static serves the built site; paths that are not files fall back to the app shell.
func static(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean(r.URL.Path)
		switch {
		case strings.HasPrefix(p, "/_app/immutable/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		case strings.HasPrefix(p, "/samples/"):
			w.Header().Set("Cache-Control", "public, max-age=604800")
		default:
			w.Header().Set("Cache-Control", "no-cache")
		}
		if st, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p))); err != nil || st.IsDir() {
			if idx, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p), "index.html")); err != nil || idx.IsDir() {
				r.URL.Path = "/"
			}
		}
		fs.ServeHTTP(w, r)
	})
}
