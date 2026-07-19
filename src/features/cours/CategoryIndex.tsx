import type { LearnCategory } from "./coursSchema.ts";
import { groupProgress, type CoursProgress } from "./coursProgress.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { TILE } from "../../ui/styles.ts";

/** Niveau 1 : les thèmes d'une catégorie, en cartes, avec ratio de progression. */
export function CategoryIndex({
  category,
  progress
}: {
  category: LearnCategory;
  progress: CoursProgress;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        crumbs={[
          { label: "Cours", to: "/cours" },
          { label: category.title.split(" ")[0] }
        ]}
      />
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
        {category.groups.map((g) => {
          const s = groupProgress(g, progress);
          return (
            <a
              key={g.id}
              href={`#/cours/${category.id}/${g.id}`}
              className={`${TILE} flex flex-col gap-1 no-underline`}
            >
              <span className="text-fg font-semibold text-sm">
                {g.title}
              </span>
              {g.subtitle && (
                <span className="text-fg-dim text-meta">{g.subtitle}</span>
              )}
              <span className="text-fg-muted text-meta mt-1">
                {s.known}/{s.total} appris
                {s.review > 0 ? ` · ${s.review} à revoir` : ""}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
