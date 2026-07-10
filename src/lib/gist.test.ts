import { test, expect } from "bun:test";
import {
  collectData, applyData, ghFetch, findExistingGist, cloudPull,
  CONFIRM_OVERWRITE_MESSAGE, type GistFetchResponse, type GistStore,
} from "./gist.ts";

/** Minimal in-memory localStorage-shaped fake — never touches the real DOM/network. */
function fakeStore(initial: Record<string, string> = {}): GistStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; },
  };
}

function fakeResponse(status: number, body: unknown, text?: string): GistFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => text ?? JSON.stringify(body),
  };
}

// ---------- collectData ----------

test("collectData includes jlptN3_* keys, excludes jlptN3_gh, and sets app/updatedAt/store", () => {
  const store = fakeStore({
    jlptN3adapt_v2: '{"total":5}',
    jlptN3_theme: "dark",
    jlptN3_gh: '{"token":"t","gist":"g"}',
    jlptN3_updatedAt: "2026-01-01T00:00:00.000Z",
    unrelatedKey: "nope",
  });
  const payload = collectData(store);
  expect(payload.app).toBe("jlpt-n3");
  expect(payload.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  expect(payload.store.jlptN3adapt_v2).toBe('{"total":5}');
  expect(payload.store.jlptN3_theme).toBe("dark");
  expect(payload.store.jlptN3_gh).toBeUndefined();
  expect(payload.store.unrelatedKey).toBeUndefined();
});

test("collectData falls back to nowIso when jlptN3_updatedAt is absent", () => {
  const store = fakeStore({ jlptN3_theme: "light" });
  const payload = collectData(store, "2026-07-10T00:00:00.000Z");
  expect(payload.updatedAt).toBe("2026-07-10T00:00:00.000Z");
});

// ---------- applyData ----------

test("applyData writes each key of payload.store back into the store", () => {
  const store = fakeStore();
  const ok = applyData(store, { app: "jlpt-n3", updatedAt: "now", store: { jlptN3_theme: "light", jlptN3adapt_v2: '{"total":9}' } });
  expect(ok).toBe(true);
  expect(store.getItem("jlptN3_theme")).toBe("light");
  expect(store.getItem("jlptN3adapt_v2")).toBe('{"total":9}');
});

test("applyData returns false and writes nothing when the payload is missing store", () => {
  const store = fakeStore();
  expect(applyData(store, null)).toBe(false);
  expect(applyData(store, undefined)).toBe(false);
  expect(applyData(store, { app: "jlpt-n3", updatedAt: "now" } as never)).toBe(false);
  expect(store.data.size).toBe(0);
});

// ---------- ghFetch ----------

test("ghFetch attaches the Bearer token and the 3 GitHub headers", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    seenUrl = url; seenInit = init;
    return fakeResponse(200, { ok: true });
  };
  await ghFetch(fetchImpl, "my-token", "https://api.github.com/gists/abc", {});
  expect(seenUrl).toBe("https://api.github.com/gists/abc");
  const headers = seenInit?.headers as Record<string, string>;
  expect(headers.Authorization).toBe("Bearer my-token");
  expect(headers.Accept).toBe("application/vnd.github+json");
  expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
});

test("ghFetch returns the parsed JSON body on success", async () => {
  const fetchImpl = async () => fakeResponse(200, { id: "abc123" });
  const j = await ghFetch<{ id: string }>(fetchImpl, "t", "https://api.github.com/gists", {});
  expect(j.id).toBe("abc123");
});

test("ghFetch maps 401 to an invalid/expired-token hint", async () => {
  const fetchImpl = async () => fakeResponse(401, { message: "Bad credentials" });
  await expect(ghFetch(fetchImpl, "t", "https://api.github.com/gists", {})).rejects.toThrow(
    /GitHub 401 : Bad credentials — token invalide ou expiré/,
  );
});

test("ghFetch maps 403 to the classic-token/gist-scope hint", async () => {
  const fetchImpl = async () => fakeResponse(403, { message: "Forbidden" });
  await expect(ghFetch(fetchImpl, "t", "https://api.github.com/gists", {})).rejects.toThrow(
    /le token n'a pas le droit « gist »/,
  );
});

test("ghFetch maps 404 to a Gist-not-found hint", async () => {
  const fetchImpl = async () => fakeResponse(404, { message: "Not Found" });
  await expect(ghFetch(fetchImpl, "t", "https://api.github.com/gists/x", {})).rejects.toThrow(
    /Gist introuvable \(vérifie l'ID\)/,
  );
});

// ---------- findExistingGist ----------

test("findExistingGist returns the id of the first gist whose files contain jlpt-n3-progress.json", async () => {
  const store = fakeStore({ jlptN3_gh: JSON.stringify({ token: "t", gist: "" }) });
  const fetchImpl = async (url: string) => {
    expect(url).toContain("page=1");
    return fakeResponse(200, [
      { id: "no-match", files: { "other.json": {} } },
      { id: "match-here", files: { "jlpt-n3-progress.json": {} } },
    ]);
  };
  const id = await findExistingGist({ store, fetchImpl });
  expect(id).toBe("match-here");
});

test("findExistingGist returns null when no configured token exists", async () => {
  const store = fakeStore();
  const fetchImpl = async () => fakeResponse(200, []);
  expect(await findExistingGist({ store, fetchImpl })).toBeNull();
});

test("findExistingGist returns null once a page comes back empty", async () => {
  const store = fakeStore({ jlptN3_gh: JSON.stringify({ token: "t", gist: "" }) });
  const fetchImpl = async () => fakeResponse(200, []);
  expect(await findExistingGist({ store, fetchImpl })).toBeNull();
});

// ---------- cloudPull ----------

const GIST_FILE = "jlpt-n3-progress.json";

function gistFileResponse(payload: unknown) {
  return fakeResponse(200, { id: "g1", files: { [GIST_FILE]: { content: JSON.stringify(payload) } } });
}

test("cloudPull applies the remote payload when it is newer than local", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-06-01T00:00:00.000Z", store: { jlptN3_theme: "light" } };
  const fetchImpl = async () => gistFileResponse(remote);
  const result = await cloudPull({ store, fetchImpl }, false);
  expect(result.kind).toBe("applied");
  expect(store.getItem("jlptN3_theme")).toBe("light");
});

test("cloudPull applies on manual pull even when remote is not newer", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-06-01T00:00:00.000Z",
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-01-01T00:00:00.000Z", store: { jlptN3_theme: "dark" } };
  const fetchImpl = async () => gistFileResponse(remote);
  const result = await cloudPull({ store, fetchImpl }, true);
  expect(result.kind).toBe("applied");
  expect(store.getItem("jlptN3_theme")).toBe("dark");
});

test("cloudPull skips (store unchanged) when local is newer and the pull is not manual", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-06-01T00:00:00.000Z",
    jlptN3_theme: "dark",
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-01-01T00:00:00.000Z", store: { jlptN3_theme: "light" } };
  const fetchImpl = async () => gistFileResponse(remote);
  const result = await cloudPull({ store, fetchImpl }, false);
  expect(result.kind).toBe("up-to-date");
  expect(store.getItem("jlptN3_theme")).toBe("dark"); // unchanged
});

test("cloudPull is a no-op when not configured (no token/gist)", async () => {
  const store = fakeStore();
  const fetchImpl = async () => fakeResponse(200, {});
  const result = await cloudPull({ store, fetchImpl }, true);
  expect(result.kind).toBe("not-configured");
});

test("cloudPull reports missing-file when the Gist has no jlpt-n3-progress.json entry", async () => {
  const store = fakeStore({ jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }) });
  const fetchImpl = async () => fakeResponse(200, { id: "g1", files: {} });
  const result = await cloudPull({ store, fetchImpl }, true);
  expect(result.kind).toBe("missing-file");
});

test("cloudPull reports unreadable when the remote content isn't valid JSON", async () => {
  const store = fakeStore({ jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }) });
  const fetchImpl = async () => fakeResponse(200, { id: "g1", files: { [GIST_FILE]: { content: "{not json" } } });
  const result = await cloudPull({ store, fetchImpl }, true);
  expect(result.kind).toBe("unreadable");
});

test("cloudPull asks confirmFn before overwriting newer local data on a manual pull, and honors a decline", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-06-01T00:00:00.000Z",
    jlptN3adapt_v2: JSON.stringify({ total: 12, skill: {} }),
    jlptN3_theme: "dark",
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-01-01T00:00:00.000Z", store: { jlptN3_theme: "light" } };
  const fetchImpl = async () => gistFileResponse(remote);
  let seenMessage = "";
  const confirmFn = (message: string) => { seenMessage = message; return false; };
  const result = await cloudPull({ store, fetchImpl }, true, confirmFn);
  expect(seenMessage).toBe(CONFIRM_OVERWRITE_MESSAGE);
  expect(result.kind).toBe("cancelled");
  expect(store.getItem("jlptN3_theme")).toBe("dark"); // untouched — decline wins
});

test("cloudPull proceeds past the confirm guard when the user accepts", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-06-01T00:00:00.000Z",
    jlptN3adapt_v2: JSON.stringify({ total: 12, skill: {} }),
    jlptN3_theme: "dark",
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-01-01T00:00:00.000Z", store: { jlptN3_theme: "light" } };
  const fetchImpl = async () => gistFileResponse(remote);
  const result = await cloudPull({ store, fetchImpl }, true, () => true);
  expect(result.kind).toBe("applied");
  expect(store.getItem("jlptN3_theme")).toBe("light");
});

test("cloudPull does not prompt when there is no local data to protect (has-local-data guard)", async () => {
  const store = fakeStore({
    jlptN3_gh: JSON.stringify({ token: "t", gist: "g1" }),
    jlptN3_updatedAt: "2026-06-01T00:00:00.000Z",
    // no jlptN3adapt_v2 progress blob at all
  });
  const remote = { app: "jlpt-n3", updatedAt: "2026-01-01T00:00:00.000Z", store: { jlptN3_theme: "light" } };
  const fetchImpl = async () => gistFileResponse(remote);
  let confirmCalled = false;
  const result = await cloudPull({ store, fetchImpl }, true, () => { confirmCalled = true; return false; });
  expect(confirmCalled).toBe(false);
  expect(result.kind).toBe("applied");
});
