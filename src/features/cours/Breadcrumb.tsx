/** Fil d'Ariane pur : le dernier crumb est inactif, les précédents sont des liens. */
export function Breadcrumb({
  crumbs
}: {
  crumbs: { label: string; to?: string }[];
}) {
  return (
    <nav className="text-meta text-fg-dim flex gap-1 flex-wrap mb-3">
      {crumbs.map((c, i) => (
        <span key={i} className="flex gap-1 items-center">
          {c.to ? (
            <a href={`#${c.to}`} className="text-accent">
              {c.label}
            </a>
          ) : (
            <span className="text-fg">{c.label}</span>
          )}
          {i < crumbs.length - 1 && <span aria-hidden>›</span>}
        </span>
      ))}
    </nav>
  );
}
