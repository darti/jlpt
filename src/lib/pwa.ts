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
