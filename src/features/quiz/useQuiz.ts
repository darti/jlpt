import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SKILLS, type Progress, type Skill } from "../../types/progress.ts";
import type { Question, SkillState } from "../../types/quiz.ts";
import { updateRating } from "../../lib/elo.ts";
import {
  questionCount, allocateCount, loadAllCategories, pickAdaptive,
  questionsForIds, selectRecentErrors, composeSession, selectDiagnostic,
} from "../../lib/bank.ts";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { decodeBits, encodeBits, setBit, hasBit, countUnseen } from "../../lib/coverage.ts";
import { dashboardModel, masteryOf } from "../../lib/scoring.ts";
import { cloudPush, type GistDeps } from "../../lib/gist.ts";
import { pickSessionPlan, BUILT_CAPS } from "../entrainement/sessionPlan.ts";
import { RESUME_KEY } from "../../lib/keys.ts";

export type Phase = "home" | "question" | "corrige" | "results" | "diag-intro" | "diag-results";

/** Shape persisted at `jlptN3quiz_resume` — port of legacy `saveResume`/`getResume` (app-n3.html:430-446).
 *  `phase`/`chosen` are optional so a session interrupted on the corrigé (e.g. the user tapped
 *  « voir le point de grammaire ») re-opens on that same corrigé instead of the bare question —
 *  older blobs without them resume as a question, exactly as before. */
export interface ResumeState {
  kind: "quiz";
  ids: number[];
  qi: number;
  right: number;
  t: number;
  phase?: "question" | "corrige";
  chosen?: number;
}

/** One answered diagnostic item, kept for the end-of-test corrigé. */
export interface DiagAnswer { question: Question; chosen: number; }

const DAY_MS = 864e5;
const RESUME_MAX_AGE_MS = 2 * DAY_MS; // 2 days — mirrors legacy getResume()
const PUSH_DEBOUNCE_MS = 1500;

/** Days since a persisted timestamp (`diagAt`), or `null` when absent/invalid. */
function daysSince(ts: unknown): number | null {
  return typeof ts === "number" && ts > 0 ? (Date.now() - ts) / DAY_MS : null;
}

/** Resolve a session length: a numeric `minArg` (URL handoff `?min=N`) wins; anything else
 *  falls back to the `minutes` state. Guards `start` when it's wired as `onStart={quiz.start}`
 *  and React passes the click event as the first arg (which would otherwise be NaN-ed). */
export function resolveMinutes(minArg: unknown, minutes: number): number {
  return typeof minArg === "number" ? minArg : minutes;
}

/** Pure parse of quiz session params from a URL query string (hub → quiz handoff). */
export function parseSessionParams(search: string): { min?: number; resume: boolean } {
  const p = new URLSearchParams(search);
  if (p.get("resume") === "1") return { resume: true };
  const raw = Number(p.get("min"));
  if (Number.isFinite(raw) && raw > 0) return { min: Math.min(45, Math.max(1, Math.round(raw))), resume: false };
  return { resume: false };
}

function numField(raw: Record<string, unknown> | null, key: string): number {
  const v = raw?.[key];
  return typeof v === "number" ? v : 0;
}

/** La table `skill` du blob brut, ou `{}` si absente / malformée. */
function skillMap(raw: Record<string, unknown> | null): Record<string, unknown> {
  const s = raw?.skill;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

/** Builds the minimal `Progress`-shaped view of the raw blob that `scoring.ts#masteryOf` reads. */
function asProgress(raw: Record<string, unknown> | null): Progress {
  return { total: numField(raw, "total"), skill: skillMap(raw) as Progress["skill"] };
}

/** Full `{R,t,r}` skill state for one category from the raw blob — defaults to a blank skill (R:1450). */
function skillStateOf(raw: Record<string, unknown> | null, cat: Skill): SkillState {
  const s = skillMap(raw)[cat];
  if (s && typeof s === "object") {
    const o = s as Record<string, unknown>;
    return {
      R: typeof o.R === "number" ? o.R : 1450,
      t: typeof o.t === "number" ? o.t : 0,
      r: typeof o.r === "number" ? o.r : 0,
    };
  }
  return { R: 1450, t: 0, r: 0 };
}

function asWrong(raw: Record<string, unknown> | null): number[] {
  return Array.isArray(raw?.wrong) ? (raw.wrong as number[]) : [];
}

/**
 * Pioche `alloc[cat]` questions par catégorie via `pickAdaptive`, au niveau (R) de la
 * compétence. `exclude` est muté au fil de l'eau : aucune question ne sort deux fois dans
 * la même session, y compris entre deux tranches successives.
 *
 * `poolOf` laisse l'appelant restreindre le vivier — la tranche « apprendre » le filtre sur
 * le non-vu, la tranche adaptative prend le pool entier. C'est la seule différence entre les
 * deux, avec `wrong` (le bonus +150 n'a de sens que là où des erreurs peuvent apparaître).
 */
function pickSlice(
  alloc: Record<Skill, number>,
  poolOf: (cat: Skill) => Question[],
  raw: Record<string, unknown> | null,
  exclude: Set<number>,
  wrong: number[],
): Question[] {
  const out: Question[] = [];
  for (const cat of SKILLS) {
    const n = alloc[cat];
    if (!n) continue;
    const picks = pickAdaptive(poolOf(cat), skillStateOf(raw, cat).R, exclude, wrong).slice(0, n);
    for (const q of picks) exclude.add(q.id);
    out.push(...picks);
  }
  return out;
}

/** Reads + validates the persisted `jlptN3quiz_resume` session (clears it if >2 days
 *  old). Exported so the Entraînement hub's session card reuses the exact same
 *  key + staleness rule instead of duplicating it. */
export function readResumeState(): ResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as ResumeState;
    if (!r || r.kind !== "quiz" || !Array.isArray(r.ids)) return null;
    if (typeof r.t !== "number" || Date.now() - r.t > RESUME_MAX_AGE_MS) {
      localStorage.removeItem(RESUME_KEY);
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

function persistResumeState(r: ResumeState): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ ...r, t: Date.now() }));
  } catch { /* best-effort, mirrors legacy saveResume */ }
}

function clearResumeState(): void {
  try { localStorage.removeItem(RESUME_KEY); } catch { /* best-effort */ }
}

/**
 * Session state machine for the adaptive quiz — a thin orchestrator over the tested
 * `elo`/`bank`/`storage`/`scoring`/`gist` libs. Port of legacy `buildSession`/`renderQ`/
 * `answer`/`next`/`finish`/resume (app-n3.html: buildSession 786, pickAdaptive 742,
 * answer 937, next/finish 963-990, saveResume/getResume/resumeSession 430-447).
 * All browser access (`localStorage`, `fetch`, `setTimeout`) stays inside effects/handlers.
 */
export function useQuiz() {
  const [phase, setPhase] = useState<Phase>("home");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [minutes, setMinutesState] = useState(10);
  const [resume, setResume] = useState<ResumeState | null>(null);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [mode, setMode] = useState<"normal" | "diagnostic">("normal");
  const [diagAnswers, setDiagAnswers] = useState<DiagAnswer[]>([]);

  const rightRef = useRef(0);
  const bankIndexRef = useRef<Record<number, Skill> | null>(null);
  const bankIndexPromiseRef = useRef<Promise<Record<number, Skill> | null> | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoRef = useRef(false);
  const [searchParams] = useSearchParams();

  const gistDeps = useMemo<GistDeps>(
    () => ({ store: globalThis.localStorage, fetchImpl: globalThis.fetch }),
    [],
  );

  const schedulePush = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => { void cloudPush(gistDeps, false); }, PUSH_DEBOUNCE_MS);
  }, [gistDeps]);

  // Hook-local, useRef-cached, retry-on-failure variant of the id→skill index — distinct from
  // lib `loadBankIndex` (module-memoized, no retry, shared by the coverage hook; see bank.ts).
  const ensureBankIndex = useCallback((): Promise<Record<number, Skill> | null> => {
    if (bankIndexRef.current) return Promise.resolve(bankIndexRef.current);
    if (!bankIndexPromiseRef.current) {
      bankIndexPromiseRef.current = fetch("data/bank-index.json")
        .then((r) => r.json() as Promise<Record<number, Skill>>)
        .then((idx) => { bankIndexRef.current = idx; return idx; })
        .catch(() => { bankIndexPromiseRef.current = null; return null; }); // allow a retry on the next call
    }
    return bankIndexPromiseRef.current;
  }, []);

  // On mount: surface a resumable session banner (if any, <2 days old) and prefetch the
  // id→category index resumeNow() needs to rebuild questions.
  useEffect(() => {
    setResume(readResumeState());
    void ensureBankIndex();
  }, [ensureBankIndex]);

  // Flush the pending debounced push on unmount.
  useEffect(() => () => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
  }, []);

  const setMinutes = useCallback((m: number) => setMinutesState(m), []);

  // `minArg` lets the URL handoff (?min=N) start a session directly, without waiting
  // on the async `minutes` state (C3.1 — avoids a stale-closure auto-start bug).
  const start = useCallback(async (minArg?: number, opts?: { skipDiagnostic?: boolean }) => {
    const min = resolveMinutes(minArg, minutes);
    const raw = readRawProgress();
    const wrong = asWrong(raw);
    const total = questionCount(min);

    // `skipDiagnostic` ([Plus tard]) forces a recent-diagnostic reading → composed path.
    const daysSinceDiagnostic = opts?.skipDiagnostic ? 0 : daysSince(raw?.diagAt);

    // Coverage: count never-seen items for the learn ingredient (needs the full bank index).
    // ensureBankIndex is prefetched on mount + cached, so awaiting it here is cheap.
    const idx = await ensureBankIndex();
    const seen = decodeBits(typeof raw?.seen === "string" ? raw.seen : "");
    const newCoursePoints = idx ? countUnseen(seen, idx) : 0;

    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the resume
    // decision is handled at the card level. All four caps are now built.
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints },
      total,
      BUILT_CAPS,
    );

    if (plan.kind === "diagnostic") {
      const session = selectDiagnostic(await loadAllCategories(), total, Math.random);
      if (!session.length) return;
      // Starting a diagnostic abandons any pending normal session — clear its resume so a stale
      // "Reprendre" card can't resurface on a later reload (MAJOR #5b).
      clearResumeState();
      setResume(null);
      rightRef.current = 0;
      setQuestions(session);
      setIndex(0);
      setDiagAnswers([]);
      setMode("diagnostic");
      setAnswered(false);
      setChosen(null);
      setPhase("diag-intro"); // notify before the first question
      return;
    }
    if (plan.kind !== "composed") return; // resume unreachable from start()

    setMode("normal");
    const progress = asProgress(raw); // MINOR #6: only the composed path needs mastery

    // Errors slice: the most-recent wrong[] ids (up to plan.alloc.errors), resolved to questions.
    // (idx already loaded above; C2 fallback unchanged — null idx → empty errors, session degrades.)
    const errorIds = selectRecentErrors(wrong, plan.alloc.errors);
    const errorQs = idx ? await questionsForIds(errorIds, idx) : [];
    const exclude = new Set<number>(errorQs.map((q) => q.id));

    // Les deux tranches piochent dans les mêmes viviers : les charger en parallèle une fois
    // plutôt qu'au fil de deux boucles `await` (jusqu'à dix allers-retours sérialisés à froid).
    const pools = await loadAllCategories();

    // Learn slice: never-seen items, distributed by mastery and picked near the level. Each category's
    // pool is filtered to unseen; unseen-thin categories simply contribute fewer (adaptive covers the
    // shortfall below — budget still `total`).
    // wrong ⊆ seen (choose() sets the seen bit when appending to wrong[]), so no wrong id is ever
    // dans `unseen` — on passe [] plutôt qu'un bonus +150 qui ne peut pas se déclencher ici.
    const learnQs = plan.alloc.learn > 0
      ? pickSlice(
          allocateCount((c) => masteryOf(progress, c), plan.alloc.learn),
          (cat) => pools[cat].filter((q) => !hasBit(seen, q.id)),
          raw, exclude, [],
        )
      : [];

    // Adaptive fills the remaining budget (weighted by mastery), from the full pools.
    // `wrong` conservé → bonus +150 (plancher souple sur les erreurs passées).
    const adaptiveTarget = Math.max(0, total - errorQs.length - learnQs.length);
    const picked = pickSlice(
      allocateCount((c) => masteryOf(progress, c), adaptiveTarget),
      (cat) => pools[cat],
      raw, exclude, wrong,
    );

    // Guaranteed slices (errors + learn) + adaptive fill → composeSession reconciles the budget.
    const session = composeSession([...errorQs, ...learnQs], picked, total, Math.random);
    if (!session.length) return;

    rightRef.current = 0;
    setQuestions(session);
    setIndex(0);
    setAnswered(false);
    setChosen(null);
    setPhase("question");

    const r: ResumeState = { kind: "quiz", ids: session.map((q) => q.id), qi: 0, right: 0, t: Date.now() };
    persistResumeState(r);
    setResume(r);
  }, [minutes]);

  const choose = useCallback((i: number) => {
    const q = questions[index];
    if (!q || answered) return;
    const correct = i === q.a;

    // Shared: measure — write the Elo rating + progression exactly like a normal answer.
    const raw = readRawProgress();
    const curWrong = asWrong(raw);
    const nextSkill = updateRating(skillStateOf(raw, q.cat), q.d, correct);
    const withoutId = curWrong.filter((id) => id !== q.id);
    const nextWrong = (correct ? withoutId : [...withoutId, q.id]).slice(-80);
    const seen = encodeBits(setBit(decodeBits(typeof raw?.seen === "string" ? raw.seen : ""), q.id));
    const mastered = correct
      ? encodeBits(setBit(decodeBits(typeof raw?.mastered === "string" ? raw.mastered : ""), q.id))
      : undefined;
    // MAJOR #5a: on the LAST diagnostic answer, fold `diagAt` into this same write (one round-trip).
    const isLastDiag = mode === "diagnostic" && index + 1 >= questions.length;
    writeProgress({
      skill: { [q.cat]: nextSkill },
      total: numField(raw, "total") + 1,
      right: numField(raw, "right") + (correct ? 1 : 0),
      wrong: nextWrong,
      seen,
      ...(mastered !== undefined ? { mastered } : {}),
      ...(isLastDiag ? { diagAt: Date.now() } : {}),
    });
    schedulePush();
    rightRef.current += correct ? 1 : 0;

    if (mode === "diagnostic") {
      // Tout droit: record the answer for the end-of-test corrigé, then advance immediately.
      setDiagAnswers((prev) => [...prev, { question: q, chosen: i }]);
      const ni = index + 1;
      if (ni >= questions.length) setPhase("diag-results"); // diagAt already stamped in the merged write
      else setIndex(ni);                                    // phase stays "question"
      return;
    }

    // Normal: reveal the corrigé.
    setChosen(i);
    setAnswered(true);
    setPhase("corrige");
    setResume((prev) => {
      if (!prev) return prev;
      // Persist the corrigé so a round-trip to the cours (deep link → « Revenir à la question »)
      // restores this exact correction, not a fresh question.
      const next: ResumeState = { ...prev, qi: index, right: rightRef.current, phase: "corrige", chosen: i };
      persistResumeState(next);
      return next;
    });
  }, [questions, index, answered, schedulePush, mode]);

  const next = useCallback(() => {
    const ni = index + 1;
    if (ni >= questions.length) {
      // C2: append a session-score history entry (legacy `finish()` shape, app-n3.html:971)
      // so ProgressChart has a real data source — the React quiz is otherwise history-less.
      const raw: Record<string, unknown> = readRawProgress() ?? {};
      const score = dashboardModel(asProgress(raw), new Date()).sectionTotal; // estimated /180
      const prevHist = Array.isArray(raw.history) ? (raw.history as unknown[]) : [];
      writeProgress({ history: [...prevHist, { mode: "session", score, right: rightRef.current, n: questions.length }].slice(-40) });
      setPhase("results");
      clearResumeState();
      setResume(null);
    } else {
      setIndex(ni);
      setPhase("question");
      setAnswered(false);
      setChosen(null);

      setResume((prev) => {
        if (!prev) return prev;
        // Advancing drops the corrigé marker so a later resume opens the new question.
        const next: ResumeState = { ...prev, qi: ni, right: rightRef.current, phase: "question", chosen: undefined };
        persistResumeState(next);
        return next;
      });
    }
  }, [index, questions.length]);

  const restart = useCallback(() => {
    setPhase("home");
    setQuestions([]);
    setIndex(0);
    setAnswered(false);
    setChosen(null);
    setMode("normal");
    setDiagAnswers([]);
  }, []);

  const beginDiagnostic = useCallback(() => {
    setPhase("question"); // questions already loaded by start(); mode is "diagnostic"
    setAnswered(false);
    setChosen(null);
  }, []);

  // `explicit` lets the URL handoff (?resume=1) resume from the value read straight out
  // of localStorage at mount, when the async `resume` state is still null (C3.2).
  const resumeNow = useCallback(async (explicit?: ResumeState) => {
    // `explicit` is only honored when it's a real ResumeState — resumeNow is also wired as
    // an onClick handler (quiz session card), which would otherwise pass a click event here.
    const r = explicit && Array.isArray(explicit.ids) ? explicit : resume;
    if (!r) return;
    const idx = await ensureBankIndex();
    if (!idx) return;

    const rebuilt = await questionsForIds(r.ids, idx);
    if (!rebuilt.length) {
      clearResumeState();
      setResume(null);
      return;
    }

    const qi = Math.min(r.qi, rebuilt.length - 1);
    // Restore the corrigé the user left (deep-linked to the cours and came back) when the
    // resume blob recorded one; otherwise resume on the question, as before.
    const onCorrige = r.phase === "corrige" && typeof r.chosen === "number";
    rightRef.current = r.right;
    setQuestions(rebuilt);
    setIndex(qi);
    setAnswered(onCorrige);
    setChosen(onCorrige ? (r.chosen as number) : null);
    setPhase(onCorrige ? "corrige" : "question");
  }, [resume, ensureBankIndex]);

  // One-shot hub → quiz handoff: `?min=N` (router search) auto-starts a session of that
  // length, `?resume=1` auto-resumes an existing quiz. Read from the router + localStorage
  // directly, never from the async `resume`/`minutes` state (null/stale at mount — C3).
  // Guarded so it fires exactly once.
  useEffect(() => {
    if (didAutoRef.current) return;
    didAutoRef.current = true;
    const params = parseSessionParams("?" + searchParams.toString());
    const saved = readResumeState();
    if (params.resume && saved) { void resumeNow(saved); }
    else if (params.min) { setMinutes(params.min); void start(params.min); }
  }, [resumeNow, start, setMinutes, searchParams]);

  return {
    phase,
    question: questions[index] ?? null,
    index,
    count: questions.length,
    right: rightRef.current,
    minutes,
    resume,
    chosen,
    mode,
    diagAnswers,
    start,
    choose,
    next,
    restart,
    setMinutes,
    resumeNow,
    beginDiagnostic,
  };
}
