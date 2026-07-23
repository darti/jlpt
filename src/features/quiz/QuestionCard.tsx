import { useEffect, useState } from "react";
import type { Question } from "../../types/quiz.ts";
import { PANEL } from "../../ui/styles.ts";
import { furi } from "../../lib/dict.ts";
import { RATES, readRate, writeRate, type Rate } from "../../lib/audioRate.ts";
import { stopSpeaking } from "../../lib/tts.ts";

const RATE_LABEL: Record<number, string> = { 0.7: "Lent", 0.9: "Normal", 1.0: "Rapide" };

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
  onSpeak: (rate?: number) => void;
}) {
  const passage = typeof question.passage === "string" ? question.passage : null;
  const stemHtml = furi(question.q).replace("___", '<span class="blank">？</span>');

  const [rate, setRate] = useState<Rate>(() => readRate());

  // Auto-play : à l'arrivée d'une NOUVELLE question d'écoute non encore répondue, lire le
  // dialogue. Deps volontairement [question.id] uniquement (pas `rate`/`onSpeak`/`answered`) :
  // sinon un changement de vitesse ou un re-render rejouerait l'audio. Nettoyage = stopSpeaking
  // (via tts.ts, pas speechSynthesis brut) → aucune lecture ne survit au changement de question.
  useEffect(() => {
    if (question.cat === "ecoute" && !answered) onSpeak(rate);
    return () => stopSpeaking();
  }, [question.id]);

  return (
    <div className={PANEL}>
      {/* Identifiant discret de la question — permet de pointer précisément un item à corriger. */}
      <div className="text-fg-muted text-meta text-right mb-1 select-all font-mono">#{question.id}</div>
      {question.cat === "lecture" && passage && (
        <div
          className="text-fg text-base mb-3 leading-loose"
          dangerouslySetInnerHTML={{ __html: furi(passage) }}
        />
      )}
      <div
        className="text-fg text-xl leading-relaxed mb-6"
        dangerouslySetInnerHTML={{ __html: stemHtml }}
      />
      {question.cat === "ecoute" && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSpeak(rate)}
            className="inline-flex items-center gap-2 bg-accent text-fg-on-accent border-none rounded-lg px-4 py-2 text-sm font-bold cursor-pointer"
          >
            ↻ Réécouter
          </button>
          <span className="text-fg-dim text-meta ml-1">Vitesse</span>
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRate(r); writeRate(r); }}
              className={`rounded-lg px-3 py-1.5 text-sm cursor-pointer border ${
                r === rate ? "bg-surface-2 border-accent text-accent" : "bg-surface-2 border-line text-fg-dim"
              }`}
            >
              {RATE_LABEL[r]}
            </button>
          ))}
        </div>
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
              dangerouslySetInnerHTML={{ __html: furi(opt) }}
            />
          );
        })}
      </div>
    </div>
  );
}
