import type { CoursCategory } from "./coursSchema.ts";
import { categoryStates } from "./entityState.ts";
import type { EntityStates } from "./useEntityStates.ts";
import { TILE, H2_ACCENT } from "../../ui/styles.ts";

/** Niveau 0 : cartes de catégories (learn = ratio dérivé ; method = page conseils). */
export function CoursHub({
  categories, etats,
}: {
  categories: CoursCategory[];
  etats: EntityStates;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className={H2_ACCENT}>
        Cours
      </h2>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
        {categories.map((c) => {
          const s = c.kind === "learn" ? categoryStates(c, etats.fsrs, etats.today) : null;
          return (
            <a
              key={c.id}
              href={`#/cours/${c.id}`}
              className={`${TILE} flex flex-col gap-1 no-underline`}
            >
              <span className="text-fg font-bold">{c.title}</span>
              <span className="text-fg-muted text-meta">
                {s
                  ? `${s.acquis}/${s.total} acquis${s.aRevoir > 0 ? ` · ${s.aRevoir} à revoir` : ""}`
                  : "Conseils d'examen"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
