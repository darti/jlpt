type Poster = { postMessage: (m: unknown) => void };

export function applyUpdate(worker: Poster | null): void {
  if (worker) worker.postMessage({ type: "SKIP_WAITING" });
}

export async function forceRefresh(
  nav: Navigator = navigator,
  cacheStore: CacheStorage = caches,
  reload: () => void = () => location.reload(),
): Promise<void> {
  try {
    if (nav.serviceWorker) {
      const regs = await nav.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (cacheStore?.keys) {
      const keys = await cacheStore.keys();
      await Promise.all(keys.map((k) => cacheStore.delete(k)));
    }
  } catch { /* best-effort */ }
  reload();
}

/** Pure. Highest `jlpt-n3-vNN` version among a list of cache names, or null if none match. */
export function maxCacheVersion(cacheNames: readonly string[]): string | null {
  const versions = cacheNames
    .map((name) => /^jlpt-n3-(v\d+)$/.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1].slice(1), 10));
  if (versions.length === 0) return null;
  return `v${Math.max(...versions)}`;
}

/** Pure. Parses the active SW's `{type:'VERSION'}` reply (its cache name) into `vNN`. */
export function parseVersionMessage(data: unknown): string | null {
  const m = /v(\d+)/.exec(typeof data === "string" ? data : "");
  return m ? `v${m[1]}` : null;
}
