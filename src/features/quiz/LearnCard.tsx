/**
 * Une carte de la phase d'apprentissage : l'entité qu'on présente avant de la tester.
 *
 * Rend la MÊME `EntityCard` que le paquet du cours et que le rappel du corrigé — une notion a
 * une seule apparence dans toute l'application.
 *
 * ⚠ Deux régimes. Avec ancre, un seul geste : on enchaîne sur la question, et c'est elle qui
 * écrit la mémoire. Sans ancre (38 kanji, ~14 % du reste : rien dans le corpus ne les teste),
 * on n'invente pas de question — l'auto-évaluation est le seul signal disponible, et elle
 * amorce le planificateur au lieu de ne rien faire.
 */
import type { CoursItem } from "../cours/coursSchema.ts";
import type { EntityState } from "../cours/entityState.ts";
import { EntityCard } from "../cours/EntityCard.tsx";
import { PANEL, BTN_PRIMARY, BTN_GHOST } from "../../ui/styles.ts";

export function LearnCard({
  item, state, index, count, hasAnchor, onNext, onSelfGrade,
}: {
  item: CoursItem;
  state: EntityState;
  index: number;
  count: number;
  hasAnchor: boolean;
  onNext: () => void;
  onSelfGrade: (grade: 1 | 3) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-accent text-meta font-bold m-0">
        Apprendre · {index + 1} / {count}
      </p>
      <div className={PANEL}>
        <EntityCard item={item} state={state} legende />
      </div>
      {hasAnchor ? (
        <button type="button" onClick={onNext} className={`w-full ${BTN_PRIMARY}`}>
          Question →
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button" onClick={() => onSelfGrade(3)}
            className={`flex-1 ${BTN_PRIMARY}`}
          >
            Je connais
          </button>
          <button
            type="button" onClick={() => onSelfGrade(1)}
            className={`flex-1 ${BTN_GHOST}`}
          >
            À revoir
          </button>
        </div>
      )}
    </div>
  );
}
