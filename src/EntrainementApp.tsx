import { useCallback, useEffect, useState } from "react";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { QuestionCard } from "./features/quiz/QuestionCard.tsx";
import { Corrige } from "./features/quiz/Corrige.tsx";
import { Results } from "./features/quiz/Results.tsx";
import { useQuiz, type Phase, type ResumeState } from "./features/quiz/useQuiz.ts";
import { useProgress } from "./features/dashboard/useProgress.ts";
import { readSessionScores } from "./lib/history.ts";
import { speak, sentenceFromG } from "./lib/tts.ts";
import { dashboardModel, daysUntilExam, type DashboardModel } from "./lib/scoring.ts";
import type { Skill } from "./types/progress.ts";
import type { Question } from "./types/quiz.ts";

/** Pure, prop-driven Entraînement content: the hub (phase "home") or the quiz flow
 *  (question/corrigé/résultats). SSR-renderable — all effects live in the container +
 *  leaves. Merges the former EntrainementHome hub with the QuizApp phase switch. */
export function EntrainementAppView(props: {
  model: DashboardModel | null; days: number; scores: number[];
  phase: Phase; question: Question | null; count: number; right: number;
  selected: Set<Skill>; minutes: number; resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onToggleCat: (c: Skill) => void; onSetMinutes: (m: number) => void;
  onResumeNow: () => void; onDismissResume: () => void;
}) {
  const { question } = props;
  const onSpeak = () => {
    if (!question) return;
    const speakText = question.cat === "ecoute"
      ? (typeof question.script === "string" && question.script ? question.script : question.q)
      : sentenceFromG(question.g ?? question.q);
    speak(speakText);
  };

  if (props.phase === "home") {
    return (
      <EntrainementHome
        model={props.model} days={props.days} scores={props.scores}
        selected={props.selected} minutes={props.minutes} resume={props.resume}
        onToggleCat={props.onToggleCat} onSetMinutes={props.onSetMinutes} onStart={props.onStart}
        onResumeNow={props.onResumeNow} onDismissResume={props.onDismissResume}
      />
    );
  }

  return (
    <>
      {props.phase === "question" && question && (
        <QuestionCard question={question} chosen={null} answered={false} onChoose={props.onChoose} onSpeak={onSpeak} />
      )}
      {props.phase === "corrige" && question && (
        <div className="flex flex-col gap-4">
          <QuestionCard question={question} chosen={props.chosen} answered={true} onChoose={() => {}} onSpeak={onSpeak} />
          <Corrige question={question} correct={props.chosen != null && props.chosen === question.a} />
          <button
            type="button"
            onClick={props.onNext}
            className="w-full bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer"
          >
            Suivant
          </button>
        </div>
      )}
      {props.phase === "results" && (
        <Results count={props.count} right={props.right} onRestart={props.onRestart} />
      )}
    </>
  );
}

/** Single Entraînement route: drives `useQuiz` (hub + quiz flow) and the progress/scores
 *  overview. Returning to the hub (`phase === "home"`) re-reads progress + session scores
 *  so the Dashboard/chart reflect a just-finished session. */
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [progress, refreshProgress] = useProgress();
  const [scores, setScores] = useState<number[]>([]);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const refreshHub = useCallback(() => {
    refreshProgress();
    setScores(readSessionScores());
  }, [refreshProgress]);

  useEffect(() => {
    if (quiz.phase === "home") refreshHub();
  }, [quiz.phase, refreshHub]);

  const now = new Date();
  const model = progress ? dashboardModel(progress, now) : null;

  return (
    <EntrainementAppView
      model={model} days={daysUntilExam(now)} scores={scores}
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right}
      selected={quiz.selected} minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onToggleCat={quiz.toggleCat} onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
    />
  );
}
