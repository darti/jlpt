import type { CoursCategory } from "./coursSchema.ts";
import { categoryProgress, type CoursProgress } from "./coursProgress.ts";
import { TILE, H2_ACCENT } from "../../ui/styles.ts";

/** Niveau 0 : cartes de catégories (learn = ratio global ; method = page conseils). */
export function CoursHub({
  categories,
  progress
}: {
  categories: CoursCategory[];
  progress: CoursProgress;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className={H2_ACCENT}>
        Cours
      </h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
        {categories.map((c) => {
          const s =
            c.kind === "learn" ? categoryProgress(c, progress) : null;
          return (
            <a
              key={c.id}
              href={`#/cours/${c.id}`}
              className={`${TILE} flex flex-col gap-1 no-underline`}
            >
              <span className="text-fg font-bold">{c.title}</span>
              <span className="text-fg-muted text-meta">
                {s
                  ? `${s.known}/${s.total} appris${s.review > 0 ? ` · ${s.review} à revoir` : ""}`
                  : "Conseils d'examen"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
