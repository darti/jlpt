/**
 * Niveau 2 du cours : un PAQUET de cartes, une entité par écran, zéro défilement de liste.
 *
 * L'écran précédent (`GroupDetail`) dépliait tout : jusqu'à 26 points de grammaire et 47 mots,
 * soit plusieurs milliers de pixels sans pliage, sans ancre et sans filtre. Le paquet supprime
 * le problème au lieu de le replier.
 *
 * ⚠ Sans `?focus=`, le paquet s'ouvre sur la PREMIÈRE carte non acquise. C'est ce qui rend un
 * thème de 47 mots praticable sans introduire de filtre : la traversée démarre là où le travail
 * reste, et raccourcit d'elle-même à mesure que l'état dérivé progresse.
 *
 * `?focus=<iri>` POSITIONNE le paquet (là où l'ancien écran faisait défiler) : les voisins
 * — 〜たら / 〜ば / 〜なら — sont alors à une touche, contre 800 px auparavant.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { CoursGroup, CoursItem, LearnCategory } from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";
import { EntityCard } from "./EntityCard.tsx";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { quizResumeHref } from "./coursDeepLink.ts";
import { H2_TIGHT, BTN_GHOST, PANEL } from "../../ui/styles.ts";

/** Carte d'ouverture : le `focus` demandé s'il existe, sinon la première non acquise, sinon 0. */
export function initialIndex(
  items: CoursItem[], focus: string | null, estAcquis: (iri: string) => boolean,
): number {
  if (focus) {
    const k = items.findIndex((it) => it.id === focus);
    if (k >= 0) return k;
  }
  const k = items.findIndex((it) => !estAcquis(it.id));
  return k >= 0 ? k : 0;
}

const POINT: Record<EntityState, string> = {
  neuf: "bg-line",
  "en-cours": "bg-accent/50",
  "a-revoir": "bg-status-failed",
  acquis: "bg-status-completed",
};

export function Deck({ category, group, stateOf, onKnown }: {
  category: LearnCategory;
  group: CoursGroup;
  stateOf: (iri: string) => EntityState;
  onKnown: (iri: string) => void;
}) {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const fromQuiz = params.get("from") === "quiz";
  const items = group.items;

  const [i, setI] = useState(() =>
    initialIndex(items, focus, (iri) => stateOf(iri) === "acquis"));

  // Le groupe change (navigation interne) → on rouvre le paquet à sa carte d'entrée.
  // ⚠ `stateOf` est DÉLIBÉRÉMENT absent des dépendances : il change à chaque `markKnown`, et
  // l'inclure repositionnerait le paquet à chaque clic sur « Je connais déjà » — on veut ne
  // rouvrir la carte d'entrée qu'au changement de groupe ou de focus. (Le projet n'a pas de
  // linter : cette omission se documente ici, elle ne se désactive nulle part.)
  useEffect(() => {
    setI(initialIndex(items, focus, (iri) => stateOf(iri) === "acquis"));
  }, [group.id, focus]);

  const bouge = useCallback((d: number) => {
    setI((cur) => Math.min(items.length - 1, Math.max(0, cur + d)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") bouge(1);
      else if (e.key === "ArrowLeft") bouge(-1);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [bouge]);

  const item = items[i];
  if (!item) return <p className="text-fg-dim text-sm">Thème vide.</p>;
  const etat = stateOf(item.id);

  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb
        crumbs={[
          { label: "Cours", to: "/cours" },
          { label: category.title.split(" ")[0], to: `/cours/${category.id}` },
          { label: group.title },
        ]}
      />
      {fromQuiz && (
        <a
          href={quizResumeHref}
          className="self-start inline-flex items-center gap-1 text-accent text-sm font-bold no-underline"
        >
          <span aria-hidden="true">←</span> Revenir à la question
        </a>
      )}
      <h2 className={H2_TIGHT}>{group.title}</h2>

      <div className="flex gap-1" aria-hidden="true">
        {items.map((it, k) => (
          <span
            key={it.id}
            className={`h-1 flex-1 rounded-full ${POINT[stateOf(it.id)]} ${k === i ? "ring-1 ring-accent" : ""}`}
          />
        ))}
      </div>

      <div className={PANEL}>
        <EntityCard item={item} state={etat} legende />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button" onClick={() => bouge(-1)} disabled={i === 0}
          className={`${BTN_GHOST} disabled:opacity-40`} aria-label="carte précédente"
        >
          ‹
        </button>
        <span className="text-fg-muted text-meta flex-1 text-center">
          {i + 1} / {items.length}
        </span>
        <button
          type="button" onClick={() => bouge(1)} disabled={i === items.length - 1}
          className={`${BTN_GHOST} disabled:opacity-40`} aria-label="carte suivante"
        >
          ›
        </button>
      </div>

      {etat === "neuf" && (
        <button
          type="button"
          onClick={() => { onKnown(item.id); bouge(1); }}
          className={`w-full ${BTN_GHOST}`}
        >
          Je connais déjà — le mettre en révision
        </button>
      )}
    </div>
  );
}
