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
import { countUnseen } from "../../lib/coverage.ts";
import { recordAnswer } from "../../lib/cadence.ts";
import { dashboardModel, prescriptiveWeights, daysUntilExam } from "../../lib/scoring.ts";
import { cloudPush, type GistDeps } from "../../lib/gist.ts";
import { pickSessionPlan, BUILT_CAPS } from "../entrainement/sessionPlan.ts";
import {
  allocateLearn, buildLearnQueue, rebuildLearnQueue, selectReprises, type LearnStep,
} from "../entrainement/learnQueue.ts";
import { loadCours, useCours } from "../cours/useCours.ts";
import { declaredKnownCard, entityState } from "../cours/entityState.ts";
import type { CoursCategory } from "../cours/coursSchema.ts";
import { anchorIndex } from "./anchor.ts";
import { asConfusions, dayNumber, trapModel, kindIndex, selectConfusion, activeConfusionCount } from "./traps.ts";
import { asFsrs, dueBySkill, fsrsPatch, selectRevision } from "./revision.ts";
import { checkReading } from "../../lib/kana.ts";
import { answerPatch, pickSlice } from "./answerPatch.ts";
import { resolveMinutes, parseSessionParams } from "./sessionParams.ts";
import {
  clearResumeState, persistResumeState, readResumeState, restoredCorrige, type ResumeState,
} from "./resume.ts";

export type Phase =
  | "home" | "apprendre" | "question" | "corrige" | "results" | "diag-intro" | "diag-results";

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
  // Phase 1 — les entités à enseigner et l'étape courante. Les questions d'ancrage OUVRENT
  // `questions` (dans l'ordre de la file) : `index` y pointe déjà, il n'y a rien à remonter au
  // passage en phase quiz, et la reprise persiste une seule liste d'ords comme avant.
  const [learnQueue, setLearnQueue] = useState<LearnStep[]>([]);
  const [learnIdx, setLearnIdx] = useState(0);
  // Le programme, pour savoir quoi enseigner. `null` tant que les six documents ne sont pas
  // chargés (ou en cas d'échec) : la phase d'apprentissage est alors SAUTÉE — une séance ne se
  // bloque, ni ne se retarde, sur le chargement du cours.
  // ⚠ Lu par `coursRef` dans `start`, jamais depuis la fermeture : `start` attend corpus et
  // viviers avant de composer, et le cours peut arriver pendant cette attente. Le prendre de la
  // fermeture figerait le `null` du montage — une séance ouverte par `?min=` n'enseignerait
  // alors jamais rien.
  // ⚠ Le ref ne suffit PAS à `resumeNow` : il est posé par un effet, donc par un COMMIT React,
  // et l'auto-reprise `?resume=1` tire au montage — ses `await` résolvent depuis des caches
  // module, en microtâches, jamais assez pour que React reflushe. `resumeNow` attend donc
  // `loadCours()` (mémoïsé au module, précaché par le SW) au lieu de lire le ref.
  const cours = useCours();
  const coursRef = useRef<CoursCategory[] | null>(null);
  useEffect(() => { coursRef.current = cours; }, [cours]);

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
      setLearnQueue([]); // un diagnostic n'enseigne rien : la file d'une séance précédente tombe
      setLearnIdx(0);
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

    // Phase d'apprentissage : `plan.alloc.learn` ne compte plus des questions inédites mais des
    // ENTITÉS à enseigner (spec §5.1 — `sessionPlan` est inchangé, seule sa lecture change).
    // Chaque carte est suivie de la question qui la teste ; la règle (quelle leçon, quelle ancre)
    // vit dans `curriculum.ts` / `learnQueue.ts`, le hook n'orchestre que les phases.
    // L'index d'ancrage balaie les 10 351 questions : on ne le construit que si la phase a lieu.
    const programme = plan.alloc.learn > 0 ? coursRef.current : null;
    const anchors = programme ? anchorIndex(allPool) : null;
    const byId = anchors ? new Map(allPool.map((q) => [q.id, q])) : null;
    const learnFile: LearnStep[] = [];
    const ancreQs: Question[] = [];
    if (programme && anchors && byId) {
      for (const step of buildLearnQueue({
        categories: programme, fsrs: fsrsMap, today: jourRevision,
        alloc: allocateLearn((c) => weights[c], plan.alloc.learn),
        index: anchors, exclude,
      })) {
        // Une ancre qui ne résout pas de question (impossible en principe : l'index vient des
        // mêmes pools) redevient une entité SANS ancre — jamais une carte suivie d'un vide.
        const q = step.anchor !== null ? byId.get(step.anchor) : undefined;
        if (!q) { learnFile.push({ item: step.item, anchor: null }); continue; }
        exclude.add(q.id);
        ancreQs.push(q);
        learnFile.push(step);
      }
    }

    // ⚠ INVARIANT DE BUDGET : seule une ancre RÉSOLUE consomme un créneau de question. Le créneau
    // d'une entité sans ancre retourne au quiz — la séance compte `total` questions quel que soit
    // le taux d'ancrage (spec §5.1).
    const quizBudget = Math.max(0, total - ancreQs.length);

    // Reprises : une SECONDE question par entité enseignée. Elles rejoignent la tranche GARANTIE
    // et non la tête de la file adaptive — `composeSession` mélange tout (bank.ts:125-131), aucune
    // position ne survit, et c'est tant mieux : c'est l'espacement entre l'exposition et le
    // re-test qui fabrique la mémoire, pas la proximité.
    // ⚠ Elles ne prennent que les places que les trois autres tranches garanties laissent :
    // `composeSession` ne tronque jamais son lot garanti, et `sessionPlan` n'a jamais budgété de
    // reprises. La borne vit dans `selectReprises` — c'est là qu'elle est testée.
    // La place que les trois tranches garanties déjà servies laissent dans le budget du quiz.
    const place = Math.max(
      0, quizBudget - errorQs.length - confusionQs.length - revisionQs.length,
    );
    const repriseQs: Question[] = [];
    if (anchors && byId) {
      for (const ord of selectReprises(learnFile, anchors, exclude, place)) {
        const q = byId.get(ord);
        if (!q) continue;
        exclude.add(q.id);
        repriseQs.push(q);
      }
    }

    // Adaptive fills the remaining budget (weighted by mastery), from the full pools.
    // `wrong` conservé → bonus +150 (plancher souple sur les erreurs passées).
    const adaptiveTarget = place - repriseQs.length; // ≥ 0 : `selectReprises` borne à `place`
    const picked = pickSlice(
      allocateCount((c) => weights[c], adaptiveTarget),
      (cat) => pools[cat],
      raw, exclude, wrong,
    );

    // Guaranteed slices (errors + confusion + révision + reprises) + adaptive fill → composeSession
    // reconciles the quiz budget.
    const quizQs = withPassageGroups(
      composeSession([...errorQs, ...confusionQs, ...revisionQs, ...repriseQs], picked, quizBudget, Math.random),
      pools.lecture,
      quizBudget,
    );
    if (!quizQs.length) return;
    // Les ancres d'abord, dans l'ordre de la file : `index` les traverse pendant la phase 1 et
    // arrive naturellement sur la première question de quiz.
    const session = [...ancreQs, ...quizQs];

    rightRef.current = 0;
    setQuestions(session);
    setIndex(0);
    setAnswered(false);
    setChosen(null);
    setLearnQueue(learnFile);
    setLearnIdx(0);
    setPhase(learnFile.length ? "apprendre" : "question");

    const r: ResumeState = {
      kind: "quiz", ids: session.map((q) => q.id), qi: 0, right: 0, t: Date.now(),
      ...(learnFile.length ? { learn: learnFile.map((s) => s.item.id) } : {}),
    };
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

  /**
   * Avance d'une étape dans la file d'apprentissage, et entre dans le quiz quand elle est
   * épuisée. `consommee` dit si l'étape quittée a bien consommé sa question d'ancrage — c'est ce
   * qui garde `index` aligné sur la prochaine ancre, puis sur la première question du quiz.
   */
  /**
   * Avance la file d'apprentissage d'une étape.
   *
   * `consommee` : la question d'ancrage a été RÉPONDUE — l'index avance sur elle.
   * `retiree` : elle a été RETIRÉE de la séance (déclaration « je sais déjà ») — l'index ne bouge
   * pas, la suivante ayant pris sa place, mais `questions` **et** `ids` doivent perdre l'entrée.
   *
   * ⚠ Retirer plutôt que sauter : `count` vaut `questions.length`, et le bilan de séance
   * enregistre `n: questions.length`. Un simple saut d'index laisserait une question comptée mais
   * jamais posée — une séance qui finit à 14/15 sans que rien ne soit raté.
   */
  const avancerLearn = useCallback((consommee: boolean, retiree = false) => {
    const ni = learnIdx + 1;
    const qi = index + (consommee ? 1 : 0);
    if (retiree) setQuestions((qs) => qs.filter((_, k) => k !== index));
    setLearnIdx(ni);
    setIndex(qi);
    setAnswered(false);
    setChosen(null);
    setTyped(null);
    setPhase(ni < learnQueue.length ? "apprendre" : "question");
    setResume((prev) => {
      if (!prev) return prev;
      // `learn` ne garde que ce qui RESTE à enseigner : une reprise rouvre la carte courante.
      const next: ResumeState = {
        ...prev, qi, right: rightRef.current, phase: "question", chosen: undefined,
        ...(retiree ? { ids: prev.ids.filter((_, k) => k !== index) } : {}),
        learn: learnQueue.slice(ni).map((s) => s.item.id),
      };
      persistResumeState(next);
      return next;
    });
  }, [index, learnIdx, learnQueue]);

  /** Carte suivante : sa question d'ancrage quand elle en a une, l'étape suivante sinon. */
  const learnNext = useCallback(() => {
    const step = learnQueue[learnIdx];
    if (!step) return;
    if (step.anchor === null) { avancerLearn(false); return; }
    setAnswered(false);
    setChosen(null);
    setTyped(null);
    setPhase("question"); // `index` pointe déjà sur l'ancre : elles ouvrent la session, dans l'ordre
  }, [learnQueue, learnIdx, avancerLearn]);

  /**
   * « Je sais déjà » — la MÊME déclaration que dans le cours (`declaredKnownCard`), sur n'importe
   * quelle carte de la phase 1.
   *
   * ⚠ Ce n'est pas une note de révision, et c'est pourquoi elle ne passe pas par `fsrsPatch` :
   * un `Good(3)` posait `S = 3,7 j`, donc ramenait le point quatre jours plus tard alors que
   * l'apprenant vient d'affirmer le connaître. La déclaration pose le seuil d'acquisition — un
   * seul geste, et l'entité sort du programme (`nextLessonBlock` ne prend que le neuf et le dû).
   *
   * ⚠ Sur une entité ANCRÉE, la question est retirée de la séance (`avancerLearn(false, true)`)
   * plutôt que sautée : sans cela la file avancerait en laissant l'ancre derrière elle, et la
   * carte suivante s'ouvrirait sur l'ancre de la PRÉCÉDENTE — le défaut que l'ancien refus
   * catégorique évitait faute de savoir la retirer.
   *
   * `writeProgress` ne fusionne en profondeur que `skill` : on réécrit donc la carte ENTIÈRE.
   */
  const learnDeclareKnown = useCallback(() => {
    const step = learnQueue[learnIdx];
    if (!step) return;
    const base = asFsrs(readRawProgress());
    const jour = dayNumber(new Date());
    writeProgress({ fsrs: { ...base, [step.item.id]: declaredKnownCard(base[step.item.id], jour) } });
    schedulePush();
    avancerLearn(false, step.anchor !== null);
  }, [learnQueue, learnIdx, avancerLearn, schedulePush]);

  /**
   * « À revoir » — auto-évaluation NÉGATIVE d'une entité sans ancre (`Again(1)`).
   *
   * ⚠ Réservée aux entités sans ancre : quand une question existe, c'est ELLE qui porte le signal
   * d'échec. Le hook se garde lui-même plutôt que de compter sur la vue pour ne pas exposer le
   * bouton — sans ancre à consommer, la file avancerait en laissant la question derrière elle.
   *
   * ⚠ `fsrsPatch` plutôt que `fsrsInit` : une entité déjà rencontrée a une carte, et `fsrsInit`
   * la remettrait à zéro — on RÉVISE une carte connue, on n'en crée une que s'il n'y en a pas.
   */
  const learnNeedsReview = useCallback(() => {
    const step = learnQueue[learnIdx];
    if (!step || step.anchor !== null) return;
    const patch = fsrsPatch(asFsrs(readRawProgress()), [step.item.id], false, dayNumber(new Date()));
    if (patch) writeProgress({ fsrs: patch });
    schedulePush();
    avancerLearn(false);
  }, [learnQueue, learnIdx, avancerLearn, schedulePush]);

  const next = useCallback(() => {
    // Phase 1 : le corrigé d'une ancre rend la main à la FILE, pas à la question suivante.
    if (learnIdx < learnQueue.length) { avancerLearn(true); return; }
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
  }, [index, questions.length, learnIdx, learnQueue.length, avancerLearn]);

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
    setLearnQueue([]);
    setLearnIdx(0);
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
    // La file d'apprentissage restante. Absente d'un blob antérieur au lot 2, vide une fois la
    // phase 1 terminée. Le programme s'ATTEND ici (cf. le ⚠ du `coursRef` : le ref n'est posé
    // qu'au commit suivant, l'auto-reprise le lirait toujours à `null`) — l'attente ne coûte que
    // sur un cache froid, et `resumeNow` attend déjà `questionsForIds`, bien plus lourd. Un
    // chargement en échec rend `[]` : on reprend alors en phase quiz, exactement comme avant.
    const programme = r.learn?.length ? await loadCours() : null;
    const file = r.learn?.length && programme?.length
      ? rebuildLearnQueue(r.learn, programme, rebuilt, qi)
      : [];
    rightRef.current = r.right;
    setQuestions(rebuilt);
    setIndex(qi);
    setAnswered(onCorrige);
    setChosen(restoredChosen);
    setTyped(null);
    setLearnQueue(file);
    setLearnIdx(0);
    // Un corrigé interrompu se rouvre TEL QUEL : sa question était l'ancre de l'étape 0 de la
    // file restante, et `next()` rendra la main à la file.
    setPhase(onCorrige ? "corrige" : (file.length ? "apprendre" : "question"));
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

  // La carte courante de la phase 1. L'état de l'entité se DÉRIVE de la mémoire (`entityState`)
  // au moment où la carte s'ouvre : le blob n'est relu qu'au changement d'étape, pas à chaque
  // rendu du hook.
  const learnStep = useMemo(() => {
    const step = learnQueue[learnIdx];
    if (!step) return null;
    return {
      item: step.item,
      state: entityState(asFsrs(readRawProgress())[step.item.id], dayNumber(new Date())),
      index: learnIdx,
      count: learnQueue.length,
      hasAnchor: step.anchor !== null,
    };
  }, [learnQueue, learnIdx]);

  return {
    phase,
    question: questions[index] ?? null,
    index,
    count: questions.length,
    learnStep,
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
    learnNext,
    learnDeclareKnown,
    learnNeedsReview,
    restart,
    setMinutes,
    resumeNow,
    beginDiagnostic,
  };
}
