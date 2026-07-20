// Dev server for the (now-complete) React SPA.
//   • bundles the single entry index.html (HashRouter, with HMR)
//   • serves the redirect stubs (quiz/app-n3.html), the SW/manifest/icons, and the
//     runtime data/*.json straight from disk, exactly as the GitHub Pages deploy does.
// The Tailwind CLI compiles the token CSS separately — bun-plugin-tailwind is
// incompatible with Bun's runtime bundler, so the CLI is the working path.
import index from "../index.html";

// The still-vanilla files served statically. EXACT allowlist so no user-controlled
// path ever reaches the filesystem (no traversal, no dotfile/.git/.env exposure).
// Grows as pages migrate — the same ledger as the deploy `cp` list.
const STATIC_FILES = new Set([
  // quiz.html / app-n3.html are now tiny redirect stubs → the SPA hash routes.
  "/quiz.html", "/app-n3.html",
  "/sw.js", "/manifest.webmanifest",
  "/icon-180.png", "/icon-192.png", "/icon-512.png",
  // Graphe JSON-LD — TOUT ce que l'app lit au runtime depuis le lot 2 : les cinq shards de
  // questions (src/lib/graph.ts), les intervalles du corpus (couverture + reprise de
  // session) et les mots (dictionnaire, src/lib/dict.ts). Les autres documents sont servis
  // pour que le dev soit identique à la prod.
  "/data/graph/q-grammaire.jsonld", "/data/graph/q-vocabulaire.jsonld",
  "/data/graph/q-kanji.jsonld", "/data/graph/q-lecture.jsonld", "/data/graph/q-ecoute.jsonld",
  "/data/graph/corpus.jsonld", "/data/graph/word.jsonld",
  "/data/graph/kanji.jsonld", "/data/graph/gram.jsonld", "/data/graph/lesson.jsonld",
  "/data/graph/context.jsonld", "/data/graph/shapes.jsonld",
  // Contenu du cours (route /cours) — fetché au runtime par src/features/cours.
  "/data/cours-gram.json", "/data/cours-kanji.json", "/data/cours-vocab.json",
  "/data/cours-method.json",
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
  port: Number(process.env.PORT) || 3030, // override via PORT if macOS AirPlay squats :5000
  development: true, // HMR for the bundled React route
  routes: { "/": index, "/index.html": index },
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

// Tear down the spawned CSS watcher AND the server on *every* stop path — not
// only a terminal Ctrl-C. Ctrl-C sends SIGINT to the whole process group, so the
// watcher dies on its own; but an IDE "stop task", a bare `kill` (SIGTERM) or a
// closed terminal (SIGHUP) signals only this process, and Bun.spawn children are
// not tied to the parent's lifetime — without this the watcher orphans to PID 1
// and keeps running (they pile up across dev sessions). SIGKILL the watcher: it
// only rebuilds a build artifact, has nothing to flush, and its own graceful
// handler can hang once our stdio is gone.
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  css.kill("SIGKILL");
  server.stop(true);
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, shutdown);
await css.exited;
