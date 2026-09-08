# Dev loop only. Serves the repo and accepts POST /render (wav bytes) from index.html?render=60&seed=N,
# saving to renders/<name>.wav so tools/analyze.py can compare it against the reference clip.
#   python tools/harness.py [port]
import http.server, os, sys, time
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5179
out = os.path.join(root, 'renders'); os.makedirs(out, exist_ok=True)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); data = self.rfile.read(n)
        name = self.headers.get('X-Name', f'render-{int(time.time())}')
        p = os.path.join(out, name + ('.json' if name.endswith('.log') else '.wav'))
        open(p, 'wb').write(data)
        self.send_response(200); self.send_header('Content-Type', 'text/plain'); self.end_headers(); self.wfile.write(p.encode())
        print('saved', p, n, 'bytes', flush=True)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store'); super().end_headers()
    def log_message(self, *a): pass

print(f'harness on http://127.0.0.1:{port}', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
