import { PANEL, H2 } from "../../ui/styles.ts";

export interface DueCounts { kanji: number; vocab: number; gram: number; autre: number; total: number }

/** Panneau « À réviser » : entités dont la mémoire décline (FSRS). Sans logique — le décompte
 *  vient de `dueBySkill`, pur et testé à part. */
export function RevisionPanel({ counts }: { counts: DueCounts | null }) {
  if (!counts) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>À réviser</h2>
        <p className="text-fg-dim text-sm m-0">
          Rien à réviser pour l&#39;instant — réponds à quelques questions pour amorcer la mémoire.
        </p>
      </section>
    );
  }
  if (counts.total === 0) {
    return (
      <section className={PANEL}>
        <h2 className={H2}>À réviser</h2>
        <p className="text-fg-dim text-sm m-0">Tu es à jour : aucune entité à revoir aujourd&#39;hui.</p>
      </section>
    );
  }
  const lignes: [string, number][] = [["Kanji", counts.kanji], ["Vocab", counts.vocab], ["Grammaire", counts.gram]];
  return (
    <section className={PANEL}>
      <h2 className={H2}>À réviser</h2>
      <p className="text-fg text-2xl font-bold m-0">{counts.total}</p>
      <p className="text-fg-dim text-meta mt-0 mb-3">entités dont la mémoire décline aujourd&#39;hui</p>
      <ul className="list-none p-0 m-0 flex gap-4 text-sm">
        {lignes.filter(([, n]) => n > 0).map(([lbl, n]) => (
          <li key={lbl} className="text-fg-dim">{lbl} <span className="text-fg tabular-nums">{n}</span></li>
        ))}
      </ul>
      {/* L'Accueil n'a pas de lanceur (il vit sur /entrainement) : le décompte reste sinon un
          cul-de-sac. Le lien mène au hub, où une session priorise justement les entités dues. */}
      <a href="#/entrainement" className="text-accent text-sm inline-block mt-3">Réviser maintenant →</a>
    </section>
  );
}
