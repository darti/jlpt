import { useState } from "react";
import { SessionCard } from "./features/entrainement/SessionCard.tsx";
import { QuestionCard } from "./features/quiz/QuestionCard.tsx";
import { Corrige } from "./features/quiz/Corrige.tsx";
import { SessionProgress } from "./features/quiz/SessionProgress.tsx";
import { Results } from "./features/quiz/Results.tsx";
import { useQuiz, type Phase, type ResumeState } from "./features/quiz/useQuiz.ts";
import { DiagnosticIntro } from "./features/quiz/DiagnosticIntro.tsx";
import { DiagnosticResults } from "./features/quiz/DiagnosticResults.tsx";
import { dashboardModel, type DashboardModel } from "./lib/scoring.ts";
import { readProgress } from "./lib/storage.ts";
import { speakQuestion } from "./lib/tts.ts";
import type { Question } from "./types/quiz.ts";
import type { DiagAnswer } from "./features/quiz/useQuiz.ts";
import { useRappelIndex } from "./features/quiz/useRappelIndex.ts";
import { resolveRappel, type RappelIndex } from "./features/quiz/rappel.ts";
import { BTN_PRIMARY } from "./ui/styles.ts";
import { readProduction, writeProduction } from "./lib/production.ts";

/** Pure, prop-driven Entraînement content: the hub (phase "home") or the quiz flow
 *  (question/corrigé/résultats). SSR-renderable — all effects live in the container +
 *  leaves. The stats overview + progression chart live on the Accueil route. */
export function EntrainementAppView(props: {
  phase: Phase; question: Question | null; count: number; right: number;
  minutes: number; resume: ResumeState | null;
  chosen: number | null;
  index?: number;
  mode?: "normal" | "diagnostic"; diagAnswers?: DiagAnswer[]; diagModel?: DashboardModel | null;
  coursIndex?: RappelIndex | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onSetMinutes: (m: number) => void;
  onResumeNow: () => void; onDismissResume: () => void;
  onBeginDiag?: () => void; onLater?: () => void; onDiagDone?: () => void;
  production?: boolean; onToggleProduction?: () => void;
  onSubmitTyped?: (text: string) => void; typed?: string | null;
}) {
  const { question } = props;
  const onSpeak = (rate?: number) => { if (question) speakQuestion(question, rate); };

  if (props.phase === "home") {
    // Le hub, c'est cette carte et rien d'autre : réglages et synchro vivent sur
    // Paramétrage, stats et courbe de progression sur l'Accueil.
    return (
      <div className="flex flex-col gap-6">
        <SessionCard
          minutes={props.minutes} resume={props.resume}
          onSetMinutes={props.onSetMinutes} onStart={props.onStart}
          onResumeNow={props.onResumeNow} onDismissResume={props.onDismissResume}
        />
        <label className="flex items-center gap-3 text-fg text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.production ?? false}
            onChange={() => props.onToggleProduction?.()}
            className="w-4 h-4 accent-accent"
          />
          <span>Mode rappel actif — taper les lectures (vocabulaire &amp; kanji)</span>
        </label>
      </div>
    );
  }

  if (props.phase === "diag-intro") {
    return <DiagnosticIntro count={props.count} onStart={props.onBeginDiag ?? (() => {})} onLater={props.onLater ?? (() => {})} />;
  }

  return (
    <>
      {props.phase === "question" && question && (
        <div className="flex flex-col gap-3">
          <SessionProgress index={props.index ?? 0} count={props.count} mode={props.mode} right={props.right} answered={props.index ?? 0} />
          <QuestionCard question={question} chosen={null} answered={false} onChoose={props.onChoose} onSpeak={onSpeak} production={props.mode === "diagnostic" ? false : props.production} onSubmitTyped={props.onSubmitTyped} typed={props.typed} />
        </div>
      )}
      {props.phase === "corrige" && question && (
        <div className="flex flex-col gap-4">
          <SessionProgress index={props.index ?? 0} count={props.count} mode={props.mode} right={props.right} answered={(props.index ?? 0) + 1} />
          <QuestionCard question={question} chosen={props.chosen} answered={true} onChoose={() => {}} onSpeak={onSpeak} production={props.production} typed={props.typed} />
          <Corrige question={question} correct={props.chosen != null && props.chosen === question.a} rappel={resolveRappel(question, props.coursIndex ?? null)} />
          <button
            type="button"
            onClick={props.onNext}
            className={`w-full ${BTN_PRIMARY}`}
          >
            Suivant
          </button>
        </div>
      )}
      {props.phase === "results" && (
        <Results count={props.count} right={props.right} onRestart={props.onRestart} />
      )}
      {props.phase === "diag-results" && props.diagModel && (
        <DiagnosticResults model={props.diagModel} answers={props.diagAnswers ?? []} onDone={props.onDiagDone ?? (() => {})} coursIndex={props.coursIndex ?? null} />
      )}
    </>
  );
}

/** Single Entraînement route: drives `useQuiz` (hub start card + quiz flow). Progress stats
 *  and the session-score chart moved to the Accueil route. */
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [production, setProduction] = useState<boolean>(() => readProduction());
  const toggleProduction = () => setProduction((p) => { const n = !p; writeProduction(n); return n; });
  const coursIndex = useRappelIndex();

  const diagModel: DashboardModel | null = quiz.phase === "diag-results"
    ? dashboardModel(readProgress() ?? { total: 0, skill: {} }, new Date())
    : null;

  return (
    <EntrainementAppView
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right} index={quiz.index}
      minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      chosen={quiz.chosen}
      mode={quiz.mode} diagAnswers={quiz.diagAnswers} diagModel={diagModel}
      coursIndex={coursIndex}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
      onBeginDiag={quiz.beginDiagnostic} onLater={() => quiz.start(undefined, { skipDiagnostic: true })}
      onDiagDone={quiz.restart}
      production={production} onToggleProduction={toggleProduction}
      onSubmitTyped={quiz.submitTyped} typed={quiz.typed}
    />
  );
}
