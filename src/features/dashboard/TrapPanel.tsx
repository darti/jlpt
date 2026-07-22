import { KIND_LABELS, type TrapModel } from "../../features/quiz/traps.ts";
import { PANEL, H2 } from "../../ui/styles.ts";

const libelle = (k: string): string => KIND_LABELS[k] ?? k;

/** Panneau de diagnostic : par quel type de piège l'apprenant se fait avoir. Sans logique —
 *  le modèle vient de `trapModel`, pur et testé à part. */
export function TrapPanel({ model }: { model: TrapModel | null }) {
  if (!model || (!model.active.length && !model.resolved.length && !model.untyped && !model.outOfScope)) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>Tes pièges</h2>
        <p className="text-fg-dim text-sm m-0">
          Il n&#39;y a pas encore assez d&#39;erreurs pour dégager une tendance — réponds à
          quelques questions de vocabulaire ou de kanji.
        </p>
      </section>
    );
  }
  const max = Math.max(1, ...model.active.map((a) => a.recent));
  // Un apprenant peut avoir des erreurs SANS aucun type récurrent nommé (toutes « non typées »
  // ou hors périmètre) : sans cette phrase, le panneau n'afficherait que deux compteurs de
  // jargon (« 12 non typées · 34 hors périmètre ») et se lirait comme une carte cassée.
  const aucunType = !model.active.length && !model.resolved.length;
  return (
    <section className={PANEL}>
      <h2 className={H2}>Tes pièges</h2>
      {aucunType && (
        <p className="text-fg-dim text-sm mt-0 mb-2">
          Aucun type de piège récurrent identifié pour l&#39;instant.
        </p>
      )}
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {model.active.map((a) => (
          <li key={a.kind} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg">{libelle(a.kind)}</span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="text-accent tracking-widest">
                {"●".repeat(Math.round((a.recent / max) * 6)).padEnd(6, "○")}
              </span>
              <span className="text-fg-dim tabular-nums">{a.recent}</span>
            </span>
          </li>
        ))}
        {model.resolved.map((k) => (
          <li key={k} className="flex items-center justify-between text-sm text-fg-dim">
            <span>{libelle(k)}</span>
            <span className="text-status-completed">✓ résolu</span>
          </li>
        ))}
      </ul>
      <p className="text-meta text-fg-dim mt-3 mb-0">
        {model.untyped} non typée(s) · {model.outOfScope} hors périmètre (grammaire, écoute, lecture)
      </p>
    </section>
  );
}
