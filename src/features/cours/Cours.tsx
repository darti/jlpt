/** Route /cours/* : master-detail à 3 niveaux. Charge le contenu une fois, dérive l'état des
 *  entités depuis le modèle de mémoire, rend un <Routes> interne (hub → index de catégorie →
 *  paquet de cartes). */
import { Routes, Route, useParams } from "react-router-dom";
import { useCours } from "./useCours.ts";
import { useEntityStates, type EntityStates } from "./useEntityStates.ts";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import { Deck } from "./Deck.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { CoursCategory } from "./coursSchema.ts";

function NotFound() { return <p className="text-fg-dim text-sm">Thème introuvable.</p>; }

function CategoryRoute(
  { categories, etats }: { categories: CoursCategory[]; etats: EntityStates },
) {
  const { cat } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category) return <NotFound />;
  if (category.kind === "method") return <MethodPage category={category} />;
  return <CategoryIndex category={category} etats={etats} />;
}

function GroupRoute(
  { categories, etats }: { categories: CoursCategory[]; etats: EntityStates },
) {
  const { cat, group } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category || category.kind !== "learn") return <NotFound />;
  const g = category.groups.find((x) => x.id === group);
  if (!g) return <NotFound />;
  return (
    <Deck
      category={category} group={g}
      stateOf={etats.stateOf} onKnown={etats.markKnown}
    />
  );
}

export function Cours() {
  const categories = useCours();
  const etats = useEntityStates();
  if (!categories) return <p className="text-fg-dim text-sm">Chargement du cours…</p>;
  if (!categories.length) {
    return <p className="text-fg-dim text-sm">Cours indisponible (hors ligne ?).</p>;
  }
  return (
    <Routes>
      <Route index element={<CoursHub categories={categories} etats={etats} />} />
      <Route path=":cat" element={<CategoryRoute categories={categories} etats={etats} />} />
      <Route path=":cat/:group" element={<GroupRoute categories={categories} etats={etats} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
