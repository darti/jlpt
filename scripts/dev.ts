// Dev server for the strangler migration.
//   • bundles the React index.html (with HMR) — the migrated page
//   • serves the still-vanilla pages (app-n3/cours/planning) + shared assets
//     straight from disk, so navigating to /app-n3.html works in dev exactly as
//     it does in the GitHub Pages deploy.
// The Tailwind CLI compiles the token CSS separately — bun-plugin-tailwind is
// incompatible with Bun's runtime bundler, so the CLI is the working path.
import index from "../index.html";
import quiz from "../quiz.html";

// The still-vanilla files served statically. EXACT allowlist so no user-controlled
// path ever reaches the filesystem (no traversal, no dotfile/.git/.env exposure).
// Grows as pages migrate — the same ledger as the deploy `cp` list.
const STATIC_FILES = new Set([
  "/app-n3.html", "/cours-n3.html", "/planning-n3.html",
  "/progress.js", "/dict.js", "/vocab-data.js", "/theme.css",
  "/sw.js", "/manifest.webmanifest",
  "/icon-180.png", "/icon-192.png", "/icon-512.png",
  // Quiz question banks — quiz.html fetches these at "data/bank-${cat}.json"
  // (relative), which resolves to these same absolute pathnames at runtime.
  "/data/bank-grammaire.json", "/data/bank-vocabulaire.json",
  "/data/bank-kanji.json", "/data/bank-lecture.json", "/data/bank-ecoute.json",
  "/data/bank-index.json",
]);

// One-shot CSS build so styles.gen.css exists before the first request…
await Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css"],
  { stdout: "inherit", stderr: "inherit" },
).exited;

// …then keep watching it.
const css = Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css", "--watch=always"],
  { stdout: "inherit", stderr: "inherit" },
);

const server = Bun.serve({
  port: Number(process.env.PORT) || 5000, // override via PORT if macOS AirPlay squats :5000
  development: true, // HMR for the bundled React route
  routes: { "/": index, "/index.html": index, "/quiz.html": quiz },
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (STATIC_FILES.has(path)) {
      const file = Bun.file("." + path);
      if (await file.exists()) return new Response(file);
    }
    return new Response("Not found", { status: 404 });
  },
});

console.log(`dev: ${server.url} — index.html bundled (HMR); vanilla pages served static`);
process.on("SIGINT", () => { css.kill(); server.stop(true); process.exit(0); });
await css.exited;
