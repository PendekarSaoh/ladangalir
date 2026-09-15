import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static site for GitHub Pages. It builds only what the browser needs: no Worker, no Sites
// plugin, no server routes. `base` must match the repository path of the Pages site.
export default defineConfig({
  root: "static-site",
  base: "/ladangalir/",
  publicDir: "../public",
  plugins: [react()],
  // The app reads process.env.NEXT_PUBLIC_* in both builds. Next inlines those itself; here they
  // are substituted at build time too, so no runtime `process` lookup reaches the browser.
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""),
  },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
  },
});
