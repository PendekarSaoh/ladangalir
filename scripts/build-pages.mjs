// Builds the static site that GitHub Pages serves. Runs the same way on Windows, macOS and
// Linux: `node scripts/build-pages.mjs`. Output lands in dist-pages/.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const result = spawnSync(process.execPath, [vite, "build", "--config", "vite.pages.config.ts"], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
