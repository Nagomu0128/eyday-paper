import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One Vite build produces both the React client (static assets) and the Worker
// bundle. The Cloudflare plugin reads wrangler.jsonc and serves the Worker on the
// same origin as the client during `vite dev` (no CORS).
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
});
