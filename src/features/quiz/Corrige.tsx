import type { Question } from "../../types/quiz.ts";
import type { Rappel } from "./rappel.ts";
import { rappelHref } from "../cours/coursDeepLink.ts";
import { SentenceAnalysis } from "../../ui/SentenceAnalysis.tsx";
import { PANEL } from "../../ui/styles.ts";
import { furi } from "../../lib/dict.ts";
import { KIND_LABELS } from "./traps.ts";

/** Port of the legacy corrigé block from `answer()` (app-n3.html:937-957):
 * correct/incorrect banner, rule explanation, grammar decomposition, and the
 * per-option analysis (`od`). Does not receive `chosen` — only `correct`. */
export function Corrige({ question, correct, rappel }: { question: Question; correct: boolean; rappel?: Rappel | null }) {
  const correctAnswer = question.o[question.a];
  const od = question.od;
  const hasOd = od !== undefined && od.length === question.o.length;
  const script = typeof question.script === "string" ? question.script : "";
  const hasScript = question.cat === "ecoute" && script.length > 0;

  return (
    <div className={PANEL}>
      <p className={`text-lg font-bold mb-3 ${correct ? "text-status-completed" : "text-status-failed"}`}>
        {correct ? (
          "Correct !"
        ) : (
          <>
            Faux. Réponse : <span className="text-fg" dangerouslySetInnerHTML={{ __html: furi(correctAnswer) }} />
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
            dangerouslySetInnerHTML={{ __html: furi(script) }}
          />
        </div>
      )}
      {question.g && (
        <div className="mb-3">
          <p className="text-accent text-sm font-bold mb-1">Analyse de la phrase</p>
          <SentenceAnalysis source={question.g} />
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
                <span dangerouslySetInnerHTML={{ __html: furi(opt) }} />
                {" — "}
                <span dangerouslySetInnerHTML={{ __html: furi(od[i]) }} />
              </li>
            ))}
          </ul>
          {!correct && Array.isArray(question.trap) && (() => {
            // Le type de piège n'a de sens que sur une option FAUSSE : à l'index de la réponse,
            // le champ vaut "" par construction. `autre` n'est pas affiché — un « Non classé »
            // n'apprend rien à l'apprenant et sert seulement au diagnostic agrégé.
            const kinds = question.trap.filter((k, i) => k && k !== "autre" && i !== question.a);
            const uniques = [...new Set(kinds)];
            if (!uniques.length) return null;
            return (
              <p className="text-meta text-fg-dim mt-2 mb-0">
                Type de piège : {uniques.map((k) => KIND_LABELS[k] ?? k).join(" · ")}
              </p>
            );
          })()}
        </div>
      )}
      {rappel ? <RappelCard rappel={rappel} /> : <RappelAbsent cat={question.cat} />}
    </div>
  );
}

/** Le « Rappel » d un corrigé, alimenté par l arête `tests` de la question.
 *
 *  Une seule carte pour les trois natures d entité : un point de grammaire montre sa forme et,
 *  quand il en porte une, une phrase d exemple ; un mot et un kanji montrent leur lecture. Le
 *  lien profond n apparaît que si une leçon couvre l entité — 45 % des questions testent une
 *  notion que le cours n enseigne pas, et un lien vers une page inexistante est pire que rien. */
function RappelCard({ rappel }: { rappel: Rappel }) {
  const href = rappelHref(rappel);
  const LIBELLE: Record<Rappel["kind"], string> = {
    gram: "voir le point de grammaire",
    word: "voir le mot dans le cours",
    kanji: "voir le kanji dans le cours",
  };
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-accent text-sm font-bold mb-1">Rappel</p>
      <p className="text-fg-dim text-sm m-0">
        <span className="text-fg font-bold" dangerouslySetInnerHTML={{ __html: furi(rappel.titre) }} />
        {rappel.lecture && <span className="text-accent"> {rappel.lecture}</span>}
        {rappel.niv && ` (${rappel.niv})`}
        {rappel.sens && ` — ${rappel.sens}`}
        {href && (
          <>
            {" "}
            <a href={href} className="text-accent whitespace-nowrap">{LIBELLE[rappel.kind]} →</a>
          </>
        )}
      </p>
      {rappel.exemple && (
        <p className="text-fg-dim text-sm mt-2 mb-0">
          <span className="text-fg" dangerouslySetInnerHTML={{ __html: furi(rappel.exemple.jp) }} />
          {rappel.exemple.fr && <span className="block text-fg-muted">{rappel.exemple.fr}</span>}
        </p>
      )}
    </div>
  );
}

/** Catégorie de cours d une compétence — lecture et écoute n en ont pas. */
const CAT_COURS: Partial<Record<Question["cat"], { href: string; libelle: string }>> = {
  grammaire: { href: "#/cours/gram", libelle: "Revoir la grammaire dans le cours" },
  vocabulaire: { href: "#/cours/vocab", libelle: "Revoir le vocabulaire dans le cours" },
  kanji: { href: "#/cours/kanji", libelle: "Revoir les kanji dans le cours" },
};

/** Repli quand aucune arête ne résout — 46 % des questions de grammaire, faute d entité
 *  correspondante. Un lien vers la catégorie vaut mieux que rien, et c est le comportement
 *  qu avait déjà le corrigé avant que les arêtes ne soient consommées. */
function RappelAbsent({ cat }: { cat: Question["cat"] }) {
  const c = CAT_COURS[cat];
  if (!c) return null;
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <a href={c.href} className="text-accent text-sm">📖 {c.libelle} →</a>
    </div>
  );
}
