// Runs the Tailwind CLI watcher + Bun's HTML dev server together.
// (bun-plugin-tailwind is incompatible with Bun's runtime bundler — the CLI is the working path.)
export {}; // force module scope so top-level `await` is allowed under tsc

await Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css"],
  { stdout: "inherit", stderr: "inherit" },
).exited; // one-shot build first so the generated CSS exists

const css = Bun.spawn(
  ["bunx", "@tailwindcss/cli", "-i", "src/styles/tailwind.css", "-o", "src/styles/styles.gen.css", "--watch=always"],
  { stdout: "inherit", stderr: "inherit" },
);
const app = Bun.spawn(["bun", "./index.html"], { stdout: "inherit", stderr: "inherit" });
process.on("SIGINT", () => { css.kill(); app.kill(); process.exit(0); });
await Promise.race([css.exited, app.exited]);
