import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SKILLS } from "../../types/progress.ts";
import type { Question } from "../../types/quiz.ts";
import {
  questionCount, allocateCount, loadAllCategories,
  questionsForIds, selectRecentErrors, composeSession, selectDiagnostic, withPassageGroups,
} from "../../lib/bank.ts";
import { loadCorpus, type SkillRange } from "../../lib/graph.ts";
import { readRawProgress, writeProgress, readCadence, writeCadence } from "../../lib/storage.ts";
import { asBits, asHistory, asProgress, asWrong } from "../../lib/blob.ts";
import { hasBit, countUnseen } from "../../lib/coverage.ts";
import { recordAnswer } from "../../lib/cadence.ts";
import { dashboardModel, prescriptiveWeights, daysUntilExam } from "../../lib/scoring.ts";
import { cloudPush, type GistDeps } from "../../lib/gist.ts";
import { pickSessionPlan, BUILT_CAPS } from "../entrainement/sessionPlan.ts";
import { asConfusions, dayNumber, trapModel, kindIndex, selectConfusion, activeConfusionCount } from "./traps.ts";
import { asFsrs, dueBySkill, selectRevision } from "./revision.ts";
import { checkReading } from "../../lib/kana.ts";
import { answerPatch, pickSlice } from "./answerPatch.ts";
import { resolveMinutes, parseSessionParams } from "./sessionParams.ts";
import {
  clearResumeState, persistResumeState, readResumeState, restoredCorrige, type ResumeState,
} from "./resume.ts";

export type Phase = "home" | "question" | "corrige" | "results" | "diag-intro" | "diag-results";

/** One answered diagnostic item, kept for the end-of-test corrigé. */
export interface DiagAnswer { question: Question; chosen: number; }

const DAY_MS = 864e5;
const PUSH_DEBOUNCE_MS = 1500;

/** Days since a persisted timestamp (`diagAt`), or `null` when absent/invalid. */
function daysSince(ts: unknown): number | null {
  return typeof ts === "number" && ts > 0 ? (Date.now() - ts) / DAY_MS : null;
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
  const [typed, setTyped] = useState<string | null>(null);
  // Ids des questions réservées par la tranche confusion de la session (source du badge « ciblée »).
  const [confusionIds, setConfusionIds] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"normal" | "diagnostic">("normal");
  const [diagAnswers, setDiagAnswers] = useState<DiagAnswer[]>([]);

  const rightRef = useRef(0);
  const corpusRef = useRef<SkillRange[] | null>(null);
  const corpusPromiseRef = useRef<Promise<SkillRange[] | null> | null>(null);
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

  // Hook-local, useRef-cached, retry-on-failure variant des intervalles du corpus — distinct
  // du `loadCorpus` de graph.ts (mémoïsé au module, sans reprise, partagé par le hook de
  // couverture). Un échec réseau ici doit pouvoir être retenté à l'appel suivant.
  const ensureCorpus = useCallback((): Promise<SkillRange[] | null> => {
    if (corpusRef.current) return Promise.resolve(corpusRef.current);
    if (!corpusPromiseRef.current) {
      corpusPromiseRef.current = loadCorpus()
        .then((ranges) => { corpusRef.current = ranges; return ranges; })
        .catch(() => { corpusPromiseRef.current = null; return null; }); // allow a retry on the next call
    }
    return corpusPromiseRef.current;
  }, []);

  // On mount: surface a resumable session banner (if any, <2 days old) and prefetch the
  // corpus ranges resumeNow() needs to rebuild questions.
  useEffect(() => {
    setResume(readResumeState());
    void ensureCorpus();
  }, [ensureCorpus]);

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

    // Coverage: count never-seen items for the learn ingredient (needs the corpus ranges).
    // ensureCorpus is prefetched on mount + cached, so awaiting it here is cheap.
    const ranges = await ensureCorpus();
    const seen = asBits(raw, "seen");
    const newCoursePoints = ranges ? countUnseen(seen, ranges) : 0;
    // Modèle de mémoire : entités dues (R < 0,9) toutes compétences confondues — 0 tant que
    // la mémoire ne s'est pas accumulée (blob sans `fsrs`), la session reste alors inchangée.
    // Carte et jour lus UNE fois : le décompte du plan et la sélection doivent partager le même
    // « aujourd'hui » (deux `new Date()` pourraient enjamber minuit).
    const fsrsMap = asFsrs(raw);
    const confusions = asConfusions(raw);
    const jourRevision = dayNumber(new Date());
    const revisionDue = dueBySkill(fsrsMap, jourRevision).total;
    // Confusion : proxy de comptage (ne nécessite pas les pools) pour le plan ; le tri fin par
    // type se fait après le chargement des pools, réconcilié par composeSession.
    const confusionCount = activeConfusionCount(confusions, jourRevision);

    // Consult the decision engine. `resume: false` — "Commencer" always starts fresh; the resume
    // decision is handled at the card level. All caps are now built.
    const plan = pickSessionPlan(
      { resume: false, daysSinceDiagnostic, wrongCount: wrong.length, newCoursePoints, revisionDue, confusionCount },
      total,
      BUILT_CAPS,
    );

    if (plan.kind === "diagnostic") {
      const poolsDiag = await loadAllCategories();
      const session = withPassageGroups(
        selectDiagnostic(poolsDiag, total, Math.random),
        poolsDiag.lecture, // seule compétence à passages
        total,
      );
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
      setConfusionIds(new Set()); // le diagnostic n'a pas de tranche confusion
      setPhase("diag-intro"); // notify before the first question
      return;
    }
    if (plan.kind !== "composed") return; // resume unreachable from start()

    setMode("normal");
    const progress = asProgress(raw); // MINOR #6: only the composed path needs mastery
    const weights = prescriptiveWeights(progress); // poids d'allocation prescriptif, calculé une fois

    // Errors slice: the most-recent wrong[] ids (up to plan.alloc.errors), resolved to questions.
    // (ranges already loaded above; C2 fallback unchanged — null → empty errors, session degrades.)
    const errorIds = selectRecentErrors(wrong, plan.alloc.errors);
    const errorQs = ranges ? await questionsForIds(errorIds, ranges) : [];
    const exclude = new Set<number>(errorQs.map((q) => q.id));

    // Les deux tranches piochent dans les mêmes viviers : les charger en parallèle une fois
    // plutôt qu'au fil de deux boucles `await` (jusqu'à dix allers-retours sérialisés à froid).
    const pools = await loadAllCategories();

    // Tranche révision : questions testant les entités dues, la plus en retard d'abord.
    const allPool = SKILLS.flatMap((c) => pools[c]);
    const revisionQs = plan.alloc.revision > 0
      ? selectRevision(fsrsMap, jourRevision, allPool, exclude, plan.alloc.revision)
      : [];
    for (const q of revisionQs) exclude.add(q.id);

    // Tranche confusion : questions exerçant un type de piège encore actif (motif répété), la
    // plus fréquente d'abord. Même fenêtre 30 j que l'affichage → cible ce que voit l'apprenant.
    // Placée après errors/révision dans `exclude` → jamais de doublon.
    const confusionQs = plan.alloc.confusion > 0
      ? selectConfusion(
          trapModel(confusions, kindIndex(allPool), jourRevision).active,
          allPool, exclude, plan.alloc.confusion, Math.random,
        )
      : [];
    for (const q of confusionQs) exclude.add(q.id);
    setConfusionIds(new Set(confusionQs.map((q) => q.id))); // alimente le badge « ciblée » du corrigé

    // Learn slice: never-seen items, distributed by mastery and picked near the level. Each category's
    // pool is filtered to unseen; unseen-thin categories simply contribute fewer (adaptive covers the
    // shortfall below — budget still `total`).
    // wrong ⊆ seen (choose() sets the seen bit when appending to wrong[]), so no wrong id is ever
    // dans `unseen` — on passe [] plutôt qu'un bonus +150 qui ne peut pas se déclencher ici.
    const learnQs = plan.alloc.learn > 0
      ? pickSlice(
          allocateCount((c) => weights[c], plan.alloc.learn),
          (cat) => pools[cat].filter((q) => !hasBit(seen, q.id)),
          raw, exclude, [],
        )
      : [];

    // Adaptive fills the remaining budget (weighted by mastery), from the full pools.
    // `wrong` conservé → bonus +150 (plancher souple sur les erreurs passées).
    const adaptiveTarget = Math.max(0, total - errorQs.length - confusionQs.length - revisionQs.length - learnQs.length);
    const picked = pickSlice(
      allocateCount((c) => weights[c], adaptiveTarget),
      (cat) => pools[cat],
      raw, exclude, wrong,
    );

    // Guaranteed slices (errors + révision + learn) + adaptive fill → composeSession reconciles the budget.
    const session = withPassageGroups(
      composeSession([...errorQs, ...confusionQs, ...revisionQs, ...learnQs], picked, total, Math.random),
      pools.lecture,
      total,
    );
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

  const commitAnswer = useCallback((q: Question, correct: boolean, chosen: number | null, production = false) => {
    // Mesure partagée QCM/production : Elo + progression via le patch pur `answerPatch`.
    const raw = readRawProgress();
    const now = new Date(); // un seul instant : évite qu'un appel straddle minuit UTC entre progression et cadence
    // MAJOR #5a: on the LAST diagnostic answer, fold `diagAt` into this same write (one round-trip).
    const isLastDiag = mode === "diagnostic" && index + 1 >= questions.length;
    writeProgress(answerPatch(raw, q, correct, chosen, dayNumber(now), now.getTime(), isLastDiag, production));
    // Cadence : enregistrer une éventuelle NOUVELLE maîtrise, au même instant que le bit `mastered`.
    const prevMastered = asBits(raw, "mastered");
    const cad = readCadence();
    const nextCad = recordAnswer(cad, prevMastered, q.id, correct, dayNumber(now), daysUntilExam(now));
    if (nextCad !== cad) writeCadence(nextCad);
    schedulePush();
    rightRef.current += correct ? 1 : 0;

    if (mode === "diagnostic") {
      // Le diagnostic reste en QCM : `chosen` y est toujours un index réel.
      setDiagAnswers((prev) => [...prev, { question: q, chosen: chosen ?? -1 }]);
      const ni = index + 1;
      if (ni >= questions.length) setPhase("diag-results"); // diagAt already stamped in the merged write
      else setIndex(ni);                                    // phase stays "question"
      return;
    }

    // Normal: reveal the corrigé.
    setChosen(chosen);
    setAnswered(true);
    setPhase("corrige");
    setResume((prev) => {
      if (!prev) return prev;
      // Persist the corrigé so a round-trip to the cours (deep link → « Revenir à la question »)
      // restores this exact correction, not a fresh question.
      const next: ResumeState = { ...prev, qi: index, right: rightRef.current, phase: "corrige", chosen: chosen ?? undefined };
      persistResumeState(next);
      return next;
    });
  }, [questions, index, mode, schedulePush]);

  const choose = useCallback((i: number) => {
    const q = questions[index];
    if (!q || answered) return;
    commitAnswer(q, i === q.a, i);
  }, [questions, index, answered, commitAnswer]);

  const submitTyped = useCallback((text: string) => {
    const q = questions[index];
    if (!q || answered) return;
    const correct = checkReading(text, q.o[q.a]);
    setTyped(text);
    // Bonne réponse → on « coche » l'option correcte pour le corrigé (surlignage vert, correct===a) ;
    // mauvaise → chosen null (aucun distracteur coché → pas de graphe de confusion).
    // production=true → une réponse tapée juste vaut Easy(4) en FSRS (crédit renforcé).
    commitAnswer(q, correct, correct ? q.a : null, true);
  }, [questions, index, answered, commitAnswer]);

  const next = useCallback(() => {
    const ni = index + 1;
    if (ni >= questions.length) {
      // C2: append a session-score history entry (legacy `finish()` shape, app-n3.html:971)
      // so ProgressChart has a real data source — the React quiz is otherwise history-less.
      const raw = readRawProgress();
      const score = dashboardModel(asProgress(raw), new Date()).sectionTotal; // estimated /180
      const prevHist = asHistory(raw);
      writeProgress({ history: [...prevHist, { mode: "session", score, right: rightRef.current, n: questions.length }].slice(-40) });
      setPhase("results");
      clearResumeState();
      setResume(null);
    } else {
      setIndex(ni);
      setPhase("question");
      setAnswered(false);
      setChosen(null);
      setTyped(null);

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
    setTyped(null);
    setConfusionIds(new Set());
    setMode("normal");
    setDiagAnswers([]);
  }, []);

  const beginDiagnostic = useCallback(() => {
    setPhase("question"); // questions already loaded by start(); mode is "diagnostic"
    setAnswered(false);
    setChosen(null);
    setTyped(null);
  }, []);

  // `explicit` lets the URL handoff (?resume=1) resume from the value read straight out
  // of localStorage at mount, when the async `resume` state is still null (C3.2).
  const resumeNow = useCallback(async (explicit?: ResumeState) => {
    // `explicit` is only honored when it's a real ResumeState — resumeNow is also wired as
    // an onClick handler (quiz session card), which would otherwise pass a click event here.
    const r = explicit && Array.isArray(explicit.ids) ? explicit : resume;
    if (!r) return;
    const ranges = await ensureCorpus();
    if (!ranges) return;

    const rebuilt = await questionsForIds(r.ids, ranges);
    if (!rebuilt.length) {
      clearResumeState();
      setResume(null);
      return;
    }

    const qi = Math.min(r.qi, rebuilt.length - 1);
    // Restore the corrigé the user left (deep-linked to the cours and came back) when the
    // resume blob recorded one; otherwise resume on the question, as before.
    const { answered: onCorrige, chosen: restoredChosen } = restoredCorrige(r);
    rightRef.current = r.right;
    setQuestions(rebuilt);
    setIndex(qi);
    setAnswered(onCorrige);
    setChosen(restoredChosen);
    setTyped(null);
    setPhase(onCorrige ? "corrige" : "question");
  }, [resume, ensureCorpus]);

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
    typed,
    confusionIds,
    mode,
    diagAnswers,
    start,
    choose,
    submitTyped,
    next,
    restart,
    setMinutes,
    resumeNow,
    beginDiagnostic,
  };
}
