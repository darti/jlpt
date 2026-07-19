import type { MethodCategory } from "./coursSchema.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { TILE } from "../../ui/styles.ts";

/** Catégorie method : pages de conseils, pas d'items ni de progression. */
export function MethodPage({ category }: { category: MethodCategory }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        crumbs={[
          { label: "Cours", to: "/cours" },
          { label: "Méthode" },
        ]}
      />
      {category.sections.map((s, i) => (
        <section
          key={i}
          className={TILE}
        >
          <h3 className="text-fg font-bold mb-2">{s.title}</h3>
          <ul className="list-disc pl-5 flex flex-col gap-1.5 text-fg-dim text-sm m-0">
            {s.tips.map((t, j) => (
              <li
                key={j}
                dangerouslySetInnerHTML={{ __html: t }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
