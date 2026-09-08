import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: { port: 5179, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8811', '/dev': 'http://127.0.0.1:8811' } }
});
