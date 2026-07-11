import { useEffect, useState } from "react";
import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { QuizHome } from "./features/quiz/QuizHome.tsx";
import { QuestionCard } from "./features/quiz/QuestionCard.tsx";
import { Corrige } from "./features/quiz/Corrige.tsx";
import { Results } from "./features/quiz/Results.tsx";
import { ResumeBanner } from "./features/quiz/ResumeBanner.tsx";
import { useQuiz, type Phase, type ResumeState } from "./features/quiz/useQuiz.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { speak, sentenceFromG } from "./lib/tts.ts";
import type { ThemeName } from "./lib/theme.ts";
import type { Skill } from "./types/progress.ts";
import type { Question } from "./types/quiz.ts";

/** Pure, prop-driven view — mirrors `AppView`: phase-switches the quiz feature
 * (Task 7 components) driven entirely by `useQuiz()` outputs threaded in as
 * props by `QuizApp`. SSR-renderable: no hooks, no direct browser reads —
 * `speak`/`sentenceFromG` (called from the `onSpeak` handler) only ever run
 * inside event handlers, never during render. */
export function QuizAppView(props: {
  theme: ThemeName; onToggleTheme: () => void;
  phase: Phase;
  question: Question | null;
  count: number; right: number;
  selected: Set<Skill>; minutes: number;
  resume: ResumeState | null;
  answered: boolean; chosen: number | null;
  onStart: () => void;
  onChoose: (i: number) => void;
  onNext: () => void;
  onRestart: () => void;
  onToggleCat: (c: Skill) => void;
  onSetMinutes: (m: number) => void;
  onResumeNow: () => void;
  onDismissResume: () => void;
}) {
  const { question } = props;
  const onSpeak = () => {
    if (!question) return;
    // Écoute: the visible prompt (`q.q`) is not what's spoken — the listenable
    // dialogue is `q.script`, when present (legacy app-n3.html:915-919 displays
    // `q.q` but speaks `q.script`).
    const speakText = question.cat === "ecoute"
      ? (typeof question.script === "string" && question.script ? question.script : question.q)
      : sentenceFromG(question.g ?? question.q);
    speak(speakText);
  };

  return (
    <>
      <Header />
      <TopNav theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        {props.phase === "home" && props.resume && (
          <ResumeBanner resume={props.resume} onResume={props.onResumeNow} onDismiss={props.onDismissResume} />
        )}
        {props.phase === "home" && (
          <QuizHome
            selected={props.selected}
            minutes={props.minutes}
            onToggleCat={props.onToggleCat}
            onSetMinutes={props.onSetMinutes}
            onStart={props.onStart}
          />
        )}
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
      </div>
    </>
  );
}

export default function QuizApp() {
  const { theme, toggle } = useTheme();
  const quiz = useQuiz();
  const [resumeDismissed, setResumeDismissed] = useState(false);

  // Wires dict.js's delegation-based tap-to-define (quiz.html loads dict.js) —
  // one call covers dynamically-rendered questions, incl. vocab/kanji defs.
  useEffect(() => {
    (window as unknown as { initDefs?: (o: { singleTap: boolean }) => void }).initDefs?.({ singleTap: true });
  }, []);

  return (
    <QuizAppView
      theme={theme} onToggleTheme={toggle}
      phase={quiz.phase}
      question={quiz.question}
      count={quiz.count} right={quiz.right}
      selected={quiz.selected} minutes={quiz.minutes}
      resume={resumeDismissed ? null : quiz.resume}
      answered={quiz.answered} chosen={quiz.chosen}
      onStart={quiz.start}
      onChoose={quiz.choose}
      onNext={quiz.next}
      onRestart={quiz.restart}
      onToggleCat={quiz.toggleCat}
      onSetMinutes={quiz.setMinutes}
      onResumeNow={quiz.resumeNow}
      onDismissResume={() => setResumeDismissed(true)}
    />
  );
}
