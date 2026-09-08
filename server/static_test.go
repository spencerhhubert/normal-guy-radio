package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestShell(t *testing.T) {
	dir := t.TempDir()
	page := `<title>Normal Radio</title><meta property="og:title" content="Normal Radio" /><meta property="og:image" content="/og.png" />`
	os.WriteFile(filepath.Join(dir, "index.html"), []byte(page), 0o644)
	h := static(dir)

	get := func(url string) string {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", url, nil)
		req.Header.Set("X-Forwarded-Proto", "https")
		h.ServeHTTP(rec, req)
		return rec.Body.String()
	}
	body := get("http://radio.example/?fm=92.9")
	for _, want := range []string{`<title>92.9 FM · Normal Radio</title>`, `og:title" content="92.9 FM · Normal Radio"`, `content="https://radio.example/og.png"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("missing %q in %s", want, body)
		}
	}
	if body := get("http://radio.example/anything?fm=50"); !strings.Contains(body, `<title>Normal Radio</title>`) {
		t.Fatalf("bad station should keep the plain title: %s", body)
	}
}
