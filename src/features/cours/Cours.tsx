/** Route /cours/* : master-detail à 3 niveaux. Charge le contenu + la progression une fois, rend un
 *  <Routes> interne (hub → index de catégorie → détail de thème). */
import { Routes, Route, useParams } from "react-router-dom";
import { useCours } from "./useCours.ts";
import { useCoursProgress } from "./useCoursProgress.ts";
import { CoursHub } from "./CoursHub.tsx";
import { CategoryIndex } from "./CategoryIndex.tsx";
import { GroupDetail } from "./GroupDetail.tsx";
import { MethodPage } from "./MethodPage.tsx";
import type { CoursCategory } from "./coursSchema.ts";
import type { CoursProgress } from "./coursProgress.ts";

function NotFound() { return <p className="text-fg-dim text-sm">Thème introuvable.</p>; }

function CategoryRoute(
  { categories, progress }: { categories: CoursCategory[]; progress: CoursProgress },
) {
  const { cat } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category) return <NotFound />;
  if (category.kind === "method") return <MethodPage category={category} />;
  return <CategoryIndex category={category} progress={progress} />;
}

function GroupRoute({ categories, progress, onToggle }: {
  categories: CoursCategory[]; progress: CoursProgress; onToggle: (id: string) => void;
}) {
  const { cat, group } = useParams();
  const category = categories.find((c) => c.id === cat);
  if (!category || category.kind !== "learn") return <NotFound />;
  const g = category.groups.find((x) => x.id === group);
  if (!g) return <NotFound />;
  return <GroupDetail category={category} group={g} progress={progress} onToggle={onToggle} />;
}

export function Cours() {
  const categories = useCours();
  const { progress, toggle } = useCoursProgress();
  if (!categories) return <p className="text-fg-dim text-sm">Chargement du cours…</p>;
  if (!categories.length) {
    return <p className="text-fg-dim text-sm">Cours indisponible (hors ligne ?).</p>;
  }
  return (
    <Routes>
      <Route index element={<CoursHub categories={categories} progress={progress} />} />
      <Route path=":cat" element={<CategoryRoute categories={categories} progress={progress} />} />
      <Route
        path=":cat/:group"
        element={<GroupRoute categories={categories} progress={progress} onToggle={toggle} />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
