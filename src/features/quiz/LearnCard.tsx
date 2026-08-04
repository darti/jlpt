/**
 * Une carte de la phase d'apprentissage : l'entité qu'on présente avant de la tester.
 *
 * Rend la MÊME `EntityCard` que le paquet du cours et que le rappel du corrigé — une notion a
 * une seule apparence dans toute l'application.
 *
 * ⚠ « Je sais déjà » est offert dans les DEUX régimes — c'est le même geste que dans le paquet du
 * cours, et il porte la même déclaration (l'entité est classée acquise, cf. `declaredKnownCard`).
 * Le réserver aux cartes sans ancre obligeait à répondre au QCM pour évacuer un point déjà su,
 * soit sur ~96 % des cartes.
 *
 * ⚠ Ce qui DIFFÈRE d'un régime à l'autre, c'est l'autre branche. Avec ancre, c'est la question
 * qui porte le signal — on enchaîne sur elle. Sans ancre (38 kanji, ~14 % du reste : rien dans le
 * corpus ne les teste), on n'invente pas de question : « À revoir » est le seul signal d'échec
 * disponible.
 */
import type { CoursItem } from "../cours/coursSchema.ts";
import type { EntityState } from "../cours/entityState.ts";
import { EntityCard } from "../cours/EntityCard.tsx";
import { PANEL, BTN_PRIMARY, BTN_GHOST } from "../../ui/styles.ts";

export function LearnCard({
  item, state, index, count, hasAnchor, onNext, onDeclareKnown, onNeedsReview,
}: {
  item: CoursItem;
  state: EntityState;
  index: number;
  count: number;
  hasAnchor: boolean;
  onNext: () => void;
  onDeclareKnown: () => void;
  onNeedsReview: () => void;
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
        <>
          <button type="button" onClick={onNext} className={`w-full ${BTN_PRIMARY}`}>
            Question →
          </button>
          <button type="button" onClick={onDeclareKnown} className={`w-full ${BTN_GHOST}`}>
            Je sais déjà — le classer acquis
          </button>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button" onClick={onDeclareKnown}
            className={`flex-1 ${BTN_PRIMARY}`}
          >
            Je sais déjà
          </button>
          <button
            type="button" onClick={onNeedsReview}
            className={`flex-1 ${BTN_GHOST}`}
          >
            À revoir
          </button>
        </div>
      )}
    </div>
  );
}
