import type { Question } from "../../types/quiz.ts";

/** Furigana rendering hook, provided globally by `dict.js` (loaded by `quiz.html`).
 * `typeof` guard keeps this module SSR-safe: `renderToStaticMarkup` (no `dict.js`
 * on the server) falls back to the raw text instead of throwing. */
declare const furi: ((s: string) => string) | undefined;
function furiOrPlain(text: string): string {
  return typeof furi === "function" ? furi(text) : text;
}

/** Port of legacy `renderQ` (app-n3.html:906-935): stem + options, in original
 * order — `onChoose(i)` must receive the ORIGINAL index into `question.o` since
 * `useQuiz.choose` compares it against `question.a`. Options are therefore never
 * shuffled here. */
export function QuestionCard({
  question, chosen, answered, onChoose, onSpeak,
}: {
  question: Question;
  chosen: number | null;
  answered: boolean;
  onChoose: (i: number) => void;
  onSpeak: () => void;
}) {
  const passage = typeof question.passage === "string" ? question.passage : null;
  const stemHtml = furiOrPlain(question.q).replace("___", '<span class="blank">？</span>');

  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      {question.cat === "lecture" && passage && (
        <div
          className="text-fg text-base mb-3 leading-loose"
          dangerouslySetInnerHTML={{ __html: furiOrPlain(passage) }}
        />
      )}
      <div
        className="text-fg text-xl leading-relaxed mb-6"
        dangerouslySetInnerHTML={{ __html: stemHtml }}
      />
      {question.cat === "ecoute" && (
        <button
          type="button"
          onClick={onSpeak}
          className="mb-4 inline-flex items-center gap-2 bg-accent text-fg-on-accent border-none rounded-lg px-4 py-2 text-sm font-bold cursor-pointer"
        >
          ▶ Écouter
        </button>
      )}
      <div className="flex flex-col gap-2">
        {question.o.map((opt, i) => {
          const isCorrectOpt = answered && i === question.a;
          const isWrongChosen = answered && !isCorrectOpt && i === chosen;
          const cls = isCorrectOpt
            ? "bg-surface-2 border border-status-completed text-status-completed"
            : isWrongChosen
              ? "bg-surface-2 border border-status-failed text-status-failed"
              : answered
                ? "bg-surface-2 border border-line text-fg-dim"
                : "bg-surface-2 border border-line text-fg hover:border-accent transition-colors";
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => onChoose(i)}
              className={`text-left rounded-lg px-4 py-2.5 text-base cursor-pointer ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
