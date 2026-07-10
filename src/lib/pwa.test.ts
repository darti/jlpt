import { test, expect } from "bun:test";
import { applyUpdate, forceRefresh, maxCacheVersion, parseVersionMessage } from "./pwa.ts";

test("applyUpdate posts SKIP_WAITING to the waiting worker", () => {
  const posted: unknown[] = [];
  applyUpdate({ postMessage: (m) => posted.push(m) });
  expect(posted).toEqual([{ type: "SKIP_WAITING" }]);
});

test("applyUpdate is a no-op with no worker", () => {
  expect(() => applyUpdate(null)).not.toThrow();
});

test("forceRefresh unregisters SWs, clears caches, then reloads", async () => {
  const calls: string[] = [];
  const nav = {
    serviceWorker: {
      getRegistrations: async () => [{ unregister: async () => { calls.push("unregister"); return true; } }],
    },
  };
  const cacheStore = {
    keys: async () => ["jlpt-n3-v78"],
    delete: async (k: string) => { calls.push("delete:" + k); return true; },
  };
  await forceRefresh(nav as any, cacheStore as any, () => calls.push("reload"));
  expect(calls).toContain("unregister");
  expect(calls).toContain("delete:jlpt-n3-v78");
  expect(calls[calls.length - 1]).toBe("reload");
});

test("forceRefresh handles errors gracefully and still reloads", async () => {
  const calls: string[] = [];
  const nav = {
    serviceWorker: {
      getRegistrations: async () => {
        throw new Error("Service worker error");
      },
    },
  };
  const cacheStore = {
    keys: async () => ["cache-1"],
    delete: async () => { throw new Error("Cache error"); },
  };
  await forceRefresh(nav as any, cacheStore as any, () => calls.push("reload"));
  expect(calls).toContain("reload");
});

test("maxCacheVersion picks the highest jlpt-n3-vNN among cache names", () => {
  expect(maxCacheVersion(["jlpt-n3-v78", "jlpt-n3-v80", "jlpt-n3-v3"])).toBe("v80");
});

test("maxCacheVersion ignores non-matching cache names", () => {
  expect(maxCacheVersion(["some-other-cache", "jlpt-n3-v5"])).toBe("v5");
});

test("maxCacheVersion returns null when nothing matches", () => {
  expect(maxCacheVersion([])).toBeNull();
  expect(maxCacheVersion(["unrelated"])).toBeNull();
});

test("parseVersionMessage extracts vNN from the SW's cache-name reply", () => {
  expect(parseVersionMessage("jlpt-n3-v80")).toBe("v80");
});

test("parseVersionMessage returns null for a reply with no version", () => {
  expect(parseVersionMessage("no-version-here")).toBeNull();
  expect(parseVersionMessage(undefined)).toBeNull();
  expect(parseVersionMessage(42)).toBeNull();
});
