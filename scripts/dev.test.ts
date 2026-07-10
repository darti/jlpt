import { test, expect } from "bun:test";

// Regression test for the leaked Tailwind `--watch` process.
//
// `scripts/dev.ts` spawns a long-running `bunx @tailwindcss/cli … --watch`
// child. Stopping the dev orchestrator with anything other than a terminal
// Ctrl-C (SIGINT to the whole process group) — e.g. an IDE "stop task", a bare
// `kill`, or a closed terminal (SIGHUP) — used to orphan that watcher: it was
// reparented to PID 1 and kept running. Over many dev sessions the zombies pile
// up. This test drives the previously-broken path (SIGTERM to the dev process)
// and asserts the watcher is reaped, not orphaned.

const repoRoot = `${import.meta.dir}/..`;

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0); // signal 0 = existence check, kills nothing
    return true;
  } catch {
    return false;
  }
};

// PID of the dev process's Tailwind `--watch` child, or null if not spawned yet.
// Matched on `watch=always` so the transient one-shot CSS build never matches.
function watcherChildPid(devPid: number): number | null {
  const r = Bun.spawnSync(["pgrep", "-P", String(devPid), "-f", "watch=always"]);
  const first = r.stdout.toString().trim().split(/\s+/)[0];
  return first ? Number(first) : null;
}

async function poll<T>(fn: () => T | null, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = fn();
    if (v != null) return v;
    await Bun.sleep(100);
  }
  return null;
}

test("stopping the dev orchestrator (SIGTERM) reaps the tailwind watcher", async () => {
  const port = 5200 + Math.floor(Math.random() * 400);
  const proc = Bun.spawn(["bun", "scripts/dev.ts"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port) },
    stdout: "ignore",
    stderr: "ignore",
  });

  let watcherPid: number | null = null;
  try {
    // dev.ts runs a one-shot CSS build, then spawns the watcher, then serves.
    watcherPid = await poll(() => watcherChildPid(proc.pid), 20_000);
    expect(watcherPid).not.toBeNull();
    expect(isAlive(watcherPid!)).toBe(true);

    // Non-Ctrl-C stop: signal only the dev process, as an IDE/kill would.
    proc.kill("SIGTERM");
    await proc.exited;

    // The watcher must die with its parent, not linger as a PID-1 orphan.
    const reaped = await poll(() => (isAlive(watcherPid!) ? null : true), 5_000);
    expect(reaped).toBe(true);
  } finally {
    try {
      proc.kill("SIGKILL");
    } catch {}
    if (watcherPid && isAlive(watcherPid)) {
      try {
        process.kill(watcherPid, 9);
      } catch {}
    }
  }
}, 30_000);
