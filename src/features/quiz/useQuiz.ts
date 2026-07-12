import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SKILLS, type Progress, type Skill } from "../../types/progress.ts";
import type { Question, SkillState } from "../../types/quiz.ts";
import { updateRating } from "../../lib/elo.ts";
import {
  questionCount, allocateCount, loadCategory, pickAdaptive,
  questionsForIds, selectRecentErrors, composeSession, selectDiagnostic,
} from "../../lib/bank.ts";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { decodeBits, encodeBits, setBit } from "../../lib/coverage.ts";
import { dashboardModel, masteryOf } from "../../lib/scoring.ts";
import { cloudPush, type GistDeps } from "../../lib/gist.ts";
import { pickSessionPlan, BUILT_CAPS } from "../entrainement/sessionPlan.ts";

export type Phase = "home" | "question" | "corrige" | "results" | "diag-intro" | "diag-results";

/** Shape persisted at `jlptN3quiz_resume` — port of legacy `saveResume`/`getResume` (app-n3.html:430-446). */
export interface ResumeState {
  kind: "quiz";
  ids: number[];
  qi: number;
  right: number;
  t: number;
}

/** One answered diagnostic item, kept for the end-of-test corrigé. */
export interface DiagAnswer { question: Question; chosen: number; }

// Deliberately separate from vanilla `app-n3`'s `jlptN3_resume` key so the two
// apps never clobber each other's in-progress session — within-app resume
// still round-trips.
const RESUME_KEY = "jlptN3quiz_resume";
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

/** Builds the minimal `Progress`-shaped view of the raw blob that `scoring.ts#masteryOf` reads. */
function asProgress(raw: Record<string, unknown> | null): Progress {
  const skillRaw = raw?.skill;
  const skill =
    skillRaw && typeof skillRaw === "object" && !Array.isArray(skillRaw)
      ? (skillRaw as Progress["skill"])
      : {};
  return { total: numField(raw, "total"), skill };
}

/** Full `{R,t,r}` skill state for one category from the raw blob — defaults to a blank skill (R:1450). */
function skillStateOf(raw: Record<string, unknown> | null, cat: Skill): SkillState {
  const skillRaw = raw?.skill;
  const skill = skillRaw && typeof skillRaw === "object" && !Array.isArray(skillRaw)
    ? (skillRaw as Record<string, unknown>)
    : {};
  const s = skill[cat];
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

    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the resume
    // decision is handled at the card level. Errors are built (BUILT_CAPS.errors); learn is not
    // yet. Later sub-projects flip a cap and branch.
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints: 0 },
      total,
      BUILT_CAPS,
    );

    if (plan.kind === "diagnostic") {
      const poolsBySkill = {} as Record<Skill, Question[]>;
      await Promise.all(SKILLS.map(async (s) => { poolsBySkill[s] = await loadCategory(s); }));
      const session = selectDiagnostic(poolsBySkill, total, Math.random);
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
    // C2: if the bank index is unavailable (network failure — ensureBankIndex resolves null), the
    // guaranteed errors floor is skipped and the session degrades to adaptive-only. That is the
    // accepted fallback: pickAdaptive still soft-surfaces wrong ids via its +150 boost (for
    // mastery-loaded categories). resumeNow bails on a null index (nothing to resume); start() has a
    // valid adaptive session to build, so it proceeds.
    const errorIds = selectRecentErrors(wrong, plan.alloc.errors);
    const idx = await ensureBankIndex();
    const errorQs = idx ? await questionsForIds(errorIds, idx) : [];

    // Adaptive fills exactly the remaining budget, weighted by mastery — so no weighted pick is
    // dropped (C1). Seed `exclude` with the error ids first → no duplicates.
    const adaptiveTarget = Math.max(0, total - errorQs.length);
    const alloc = allocateCount((c) => masteryOf(progress, c), adaptiveTarget);
    const exclude = new Set<number>(errorQs.map((q) => q.id));
    const picked: Question[] = [];
    for (const cat of SKILLS) {
      const n = alloc[cat];
      if (!n) continue;
      const pool = await loadCategory(cat);
      const R = skillStateOf(raw, cat).R;
      const picks = pickAdaptive(pool, R, exclude, wrong).slice(0, n); // wrong kept → +150 boost (soft floor)
      for (const q of picks) exclude.add(q.id);
      picked.push(...picks);
    }

    const session = composeSession(errorQs, picked, total, Math.random);
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
      const next: ResumeState = { ...prev, qi: index, right: rightRef.current };
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
        const next: ResumeState = { ...prev, qi: ni, right: rightRef.current };
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

    rightRef.current = r.right;
    setQuestions(rebuilt);
    setIndex(Math.min(r.qi, rebuilt.length - 1));
    setAnswered(false);
    setChosen(null);
    setPhase("question");
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
    answered,
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
