// Entry for the static build served from GitHub Pages. The app itself is client-only, so the
// whole thing mounts here; the Site (vinext/Next) build keeps using app/layout.tsx instead.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SupabaseGate from "../app/supabase-gate.jsx";
import "../app/globals.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SupabaseGate />
  </StrictMode>,
);
