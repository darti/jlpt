import { readProgress } from "./storage.ts";

/** Config persisted at `jlptN3_gh`. `gist` may be `""` before a Gist has been found/created. */
export interface GistCfg { token: string; gist: string }

/** The whole-app snapshot stored as the Gist file's content. */
export interface SyncPayload { app: string; updatedAt: string; store: Record<string, string> }

const GH_CFG_KEY = "jlptN3_gh";
const GIST_FILE = "jlpt-n3-progress.json";
const PENDING_KEY = "jlptN3_pending";
const UPDATED_KEY = "jlptN3_updatedAt";
const API = "https://api.github.com";

export const CONFIRM_OVERWRITE_MESSAGE =
  "Tes données locales semblent plus récentes que le Gist.\n" +
  "Récupérer quand même la version en ligne (cela remplacera le local) ?";

/** Minimal localStorage-shaped store — matches `storage.ts`/`theme.ts`'s injectable-store pattern. */
export type GistStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

/** Minimal `fetch` Response shape, narrow enough that tests can hand-roll fakes without a real `Response`. */
export interface GistFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
export type GistFetch = (url: string, init?: RequestInit) => Promise<GistFetchResponse>;

export interface GistDeps { store: GistStore; fetchImpl: GistFetch }

function defaultDeps(): GistDeps {
  return { store: globalThis.localStorage, fetchImpl: globalThis.fetch };
}

/** Typed error thrown by `ghFetch` — carries the HTTP status alongside the French, hint-augmented message. */
export class GhError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GhError";
    this.status = status;
  }
}

function defaultConfirm(message: string): boolean {
  return typeof globalThis.confirm === "function" ? globalThis.confirm(message) : true;
}

export function readCfg(store: GistStore = globalThis.localStorage): GistCfg | null {
  try {
    const raw = store.getItem(GH_CFG_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { token, gist } = parsed as Record<string, unknown>;
    if (typeof token !== "string" || typeof gist !== "string") return null;
    return { token, gist };
  } catch { return null; }
}

export function writeCfg(store: GistStore, cfg: GistCfg): void {
  store.setItem(GH_CFG_KEY, JSON.stringify(cfg));
}

/** Disconnects sync: removes the Gist config only. Local app data is left untouched. */
export function clearCfg(store: GistStore): void {
  store.removeItem(GH_CFG_KEY);
}

/** True once a push scheduled while offline/failed is waiting to be flushed. */
export function hasPending(store: GistStore = globalThis.localStorage): boolean {
  return store.getItem(PENDING_KEY) === "1";
}

/** Local answers worth protecting from an accidental overwrite (mirrors legacy's `S.total>0` guard). */
function hasLocalData(store: GistStore): boolean {
  const p = readProgress(store);
  return !!p && p.total > 0;
}

/** Pure. Every `jlptN3*` key except the Gist config itself, e.g. for upload as the Gist file content. */
export function collectData(store: GistStore = globalThis.localStorage, nowIso: string = new Date().toISOString()): SyncPayload {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k && k.startsWith("jlptN3") && k !== GH_CFG_KEY) {
      const v = store.getItem(k);
      if (v !== null) data[k] = v;
    }
  }
  return { app: "jlpt-n3", updatedAt: store.getItem(UPDATED_KEY) || nowIso, store: data };
}

/** Writes every key of a pulled payload back into the store. `false` (no writes) when the payload is unusable. */
export function applyData(store: GistStore, payload: SyncPayload | null | undefined): boolean {
  if (!payload || !payload.store) return false;
  for (const [k, v] of Object.entries(payload.store)) store.setItem(k, v);
  return true;
}

/** Adds the GitHub auth/version headers and maps non-OK responses to helpful French errors. */
export async function ghFetch<T>(
  fetchImpl: GistFetch,
  token: string,
  url: string,
  opt: RequestInit = {},
): Promise<T> {
  const res = await fetchImpl(url, {
    ...opt,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opt.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    let msg = "";
    try {
      const j = (await res.json()) as { message?: string };
      msg = j.message || "";
    } catch { /* body wasn't JSON */ }
    const hint =
      res.status === 401 ? " — token invalide ou expiré"
      : res.status === 403 ? " — le token n'a pas le droit « gist ». Utilise un token CLASSIC avec le scope gist coché."
      : res.status === 404 ? " — Gist introuvable (vérifie l'ID)"
      : "";
    throw new GhError(res.status, `GitHub ${res.status}${msg ? ` : ${msg}` : ""}${hint}`);
  }
  return (await res.json()) as T;
}

interface GistListItem { id: string; files?: Record<string, unknown> }
interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface GistResponse { id: string; files?: Record<string, GistFile> }

/** Scans the user's Gists (paged) for the first one already containing our progress file. */
export async function findExistingGist(deps: GistDeps = defaultDeps()): Promise<string | null> {
  const cfg = readCfg(deps.store);
  if (!cfg || !cfg.token) return null;
  for (let page = 1; page <= 5; page++) {
    const list = await ghFetch<GistListItem[]>(deps.fetchImpl, cfg.token, `${API}/gists?per_page=100&page=${page}`, {});
    if (!Array.isArray(list) || list.length === 0) return null;
    const hit = list.find((g) => g.files && Object.prototype.hasOwnProperty.call(g.files, GIST_FILE));
    if (hit) return hit.id;
    if (list.length < 100) return null;
  }
  return null;
}

/** Creates a new private Gist seeded with the current local data; saves its id into the config. */
export async function cloudCreate(deps: GistDeps = defaultDeps()): Promise<GistCfg> {
  const cfg = readCfg(deps.store);
  if (!cfg || !cfg.token) throw new Error("Aucun token configuré.");
  const body = {
    description: "JLPT N3 — progression (sauvegarde auto)",
    public: false,
    files: { [GIST_FILE]: { content: JSON.stringify(collectData(deps.store), null, 2) } },
  };
  const created = await ghFetch<{ id: string }>(deps.fetchImpl, cfg.token, `${API}/gists`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const next: GistCfg = { ...cfg, gist: created.id };
  writeCfg(deps.store, next);
  return next;
}

export type PushResult =
  | { kind: "not-configured" }
  | { kind: "offline" }
  | { kind: "pushed" }
  | { kind: "failed"; message: string };

/** Pushes the current local data to the configured Gist. Records `jlptN3_pending` when offline or failed. */
export async function cloudPush(deps: GistDeps, manual: boolean): Promise<PushResult> {
  const cfg = readCfg(deps.store);
  if (!cfg || !cfg.token || !cfg.gist) return { kind: "not-configured" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    deps.store.setItem(PENDING_KEY, "1");
    return { kind: "offline" };
  }
  try {
    const body = { files: { [GIST_FILE]: { content: JSON.stringify(collectData(deps.store), null, 2) } } };
    await ghFetch(deps.fetchImpl, cfg.token, `${API}/gists/${cfg.gist}`, { method: "PATCH", body: JSON.stringify(body) });
    deps.store.removeItem(PENDING_KEY);
    // `manual` doesn't change push behavior — only whether the caller surfaces a "pushed" status message.
    return { kind: "pushed" };
  } catch (e) {
    deps.store.setItem(PENDING_KEY, "1");
    return { kind: "failed", message: e instanceof Error ? e.message : String(e) };
  }
}

export type PullResult =
  | { kind: "not-configured" }
  | { kind: "missing-file" }
  | { kind: "unreadable"; message: string }
  | { kind: "cancelled" }
  | { kind: "unusable" }
  | { kind: "applied" }
  | { kind: "up-to-date" };

/**
 * Pulls the configured Gist and applies it when appropriate: always on `manual`, otherwise only if
 * remote is newer than local. Guards against clobbering newer local data with `confirmFn` (injectable
 * so tests never block on a real `confirm()` dialog).
 */
export async function cloudPull(
  deps: GistDeps,
  manual: boolean,
  confirmFn: (message: string) => boolean = defaultConfirm,
): Promise<PullResult> {
  const cfg = readCfg(deps.store);
  if (!cfg || !cfg.token || !cfg.gist) return { kind: "not-configured" };

  const j = await ghFetch<GistResponse>(deps.fetchImpl, cfg.token, `${API}/gists/${cfg.gist}`, {});
  const f = j.files?.[GIST_FILE];
  if (!f) return { kind: "missing-file" };

  let content = f.content;
  if (f.truncated || !content) {
    try { content = await deps.fetchImpl(f.raw_url ?? "", { cache: "no-store" }).then((r) => r.text()); }
    catch { /* fall through to the parse error below */ }
  }

  let payload: SyncPayload;
  try { payload = JSON.parse(content ?? "") as SyncPayload; }
  catch (e) { return { kind: "unreadable", message: e instanceof Error ? e.message : String(e) }; }

  const remoteT = payload.updatedAt || "";
  const localT = deps.store.getItem(UPDATED_KEY) || "";

  if (manual && localT && remoteT && localT > remoteT && hasLocalData(deps.store)) {
    if (!confirmFn(CONFIRM_OVERWRITE_MESSAGE)) return { kind: "cancelled" };
  }

  if (manual || !localT || remoteT > localT) {
    if (!applyData(deps.store, payload)) return { kind: "unusable" };
    return { kind: "applied" };
  }
  return { kind: "up-to-date" };
}
