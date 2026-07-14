import type { Question } from "../../types/quiz.ts";
import type { GrammarRappel } from "../cours/coursGramIndex.ts";
import { grammarPointHref } from "../cours/coursDeepLink.ts";

/** Same SSR-safe furigana guard as `QuestionCard` — see there for rationale. */
declare const furi: ((s: string) => string) | undefined;
function furiOrPlain(text: string): string {
  return typeof furi === "function" ? furi(text) : text;
}

/** `window.visualBreak` (dict.js:75/236) renders `q.g`'s `·`-separated decomposition as
 * colored role-tagged token pills + legend — legacy `app-n3.html:954`. SSR-guarded like `furi`. */
declare const visualBreak: ((s: string) => string) | undefined;
function visualBreakOrPlain(text: string): string {
  return typeof visualBreak === "function" ? visualBreak(text) : furiOrPlain(text);
}

/** Port of the legacy corrigé block from `answer()` (app-n3.html:937-957):
 * correct/incorrect banner, rule explanation, grammar decomposition, and the
 * per-option analysis (`od`). Does not receive `chosen` — only `correct`. */
export function Corrige({ question, correct, rappel }: { question: Question; correct: boolean; rappel?: GrammarRappel | null }) {
  const correctAnswer = question.o[question.a];
  const od = question.od;
  const hasOd = od !== undefined && od.length === question.o.length;
  const script = typeof question.script === "string" ? question.script : "";
  const hasScript = question.cat === "ecoute" && script.length > 0;

  return (
    <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
      <p className={`text-lg font-bold mb-3 ${correct ? "text-status-completed" : "text-status-failed"}`}>
        {correct ? (
          "Correct !"
        ) : (
          <>
            Faux. Réponse : <span className="text-fg" dangerouslySetInnerHTML={{ __html: furiOrPlain(correctAnswer) }} />
          </>
        )}
      </p>
      {question.e && (
        <div className="text-fg text-sm mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: question.e }} />
      )}
      {hasScript && (
        <div className="mb-3">
          <p className="text-accent text-sm font-bold mb-1">Transcription</p>
          <div
            className="text-fg-dim text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: furiOrPlain(script) }}
          />
        </div>
      )}
      {question.g && (
        <div className="mb-3">
          <p className="text-accent text-sm font-bold mb-1">Analyse de la phrase</p>
          <div
            className="text-fg-dim text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: visualBreakOrPlain(question.g) }}
          />
        </div>
      )}
      {!correct && hasOd && (
        <div>
          <p className="text-accent text-sm font-bold mb-1">Pourquoi chaque réponse</p>
          <ul className="list-none p-0 m-0 flex flex-col gap-1">
            {question.o.map((opt, i) => (
              <li
                key={i}
                className={`text-sm ${i === question.a ? "text-status-completed" : "text-fg-dim"}`}
              >
                <span aria-hidden="true">{i === question.a ? "✓" : "✗"}</span>{" "}
                <span dangerouslySetInnerHTML={{ __html: furiOrPlain(opt) }} />
                {" — "}
                <span dangerouslySetInnerHTML={{ __html: furiOrPlain(od[i]) }} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {question.cat === "grammaire" && (
        <div className="mt-3 pt-3 border-t border-line">
          <p className="text-accent text-sm font-bold mb-1">Rappel de cours</p>
          {rappel ? (
            <p className="text-fg-dim text-sm m-0">
              <span className="text-fg font-bold" dangerouslySetInnerHTML={{ __html: furiOrPlain(rappel.forme) }} />
              {" "}
              {rappel.niv && `(${rappel.niv})`}
              {rappel.sens && ` — ${rappel.sens}`}
              {" "}
              <a href={grammarPointHref(rappel)} className="text-accent whitespace-nowrap">voir le point de grammaire →</a>
            </p>
          ) : (
            <a href="#/cours/gram" className="text-accent text-sm">📖 Revoir la grammaire dans le cours →</a>
          )}
        </div>
      )}
    </div>
  );
}
