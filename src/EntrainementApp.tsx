import { useState } from "react";
import { EntrainementHome } from "./features/entrainement/EntrainementHome.tsx";
import { QuestionCard } from "./features/quiz/QuestionCard.tsx";
import { Corrige } from "./features/quiz/Corrige.tsx";
import { Results } from "./features/quiz/Results.tsx";
import { useQuiz, type Phase, type ResumeState } from "./features/quiz/useQuiz.ts";
import { speak, sentenceFromG } from "./lib/tts.ts";
import type { Question } from "./types/quiz.ts";

/** Pure, prop-driven Entraînement content: the hub (phase "home") or the quiz flow
 *  (question/corrigé/résultats). SSR-renderable — all effects live in the container +
 *  leaves. The stats overview + progression chart live on the Accueil route. */
export function EntrainementAppView(props: {
  phase: Phase; question: Question | null; count: number; right: number;
  minutes: number; resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  onStart: () => void; onChoose: (i: number) => void; onNext: () => void; onRestart: () => void;
  onSetMinutes: (m: number) => void;
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
        minutes={props.minutes} resume={props.resume}
        onSetMinutes={props.onSetMinutes} onStart={props.onStart}
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

/** Single Entraînement route: drives `useQuiz` (hub start card + quiz flow). Progress stats
 *  and the session-score chart moved to the Accueil route. */
export default function EntrainementApp() {
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);

  return (
    <EntrainementAppView
      phase={quiz.phase} question={quiz.question} count={quiz.count} right={quiz.right}
      minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      onStart={quiz.start} onChoose={quiz.choose} onNext={quiz.next} onRestart={quiz.restart}
      onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow} onDismissResume={() => setResumeDismissed(true)}
    />
  );
}
