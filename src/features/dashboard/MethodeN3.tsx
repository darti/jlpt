import { Link } from "react-router-dom";
import { PANEL, PANEL_BARE, H2_ACCENT } from "../../ui/styles.ts";

type Phase = "p1" | "p2" | "p3" | "p4";

const SECTION_H2 = `${H2_ACCENT} mt-2 mb-1`;
const PHASE_CLS: Record<Phase, string> = {
  p1: "bg-surface-2 text-accent",
  p2: "bg-surface-2 text-prio-high",
  p3: "bg-surface-2 text-status-completed",
  p4: "bg-surface-2 text-status-failed",
};

const STATS: [string, string][] = [
  ["~650", "kanji"],
  ["~3 700", "mots de vocabulaire"],
  ["~150", "points de grammaire"],
  ["95 / 180", "score visé (sécurité)"],
];

const PHASES: [Phase, string, string, string, string][] = [
  ["p1", "Phase 1", "1–5", "Fondations", "Réviser N4, démarrer kanji & grammaire N3, routine quotidienne"],
  ["p2", "Phase 2", "6–11", "Construction", "Gros volume vocab/kanji, grammaire N3 complète, écoute"],
  ["p3", "Phase 3", "12–16", "Consolidation", "Compréhension écrite/orale intensive, révisions espacées"],
  ["p4", "Phase 4", "17–20", "Examen blanc", "Tests chronométrés, points faibles, conditions réelles"],
];

/** Repliable « Méthode N3 » sur l'Accueil : ce qu'il faut maîtriser, les 4 phases,
 *  la routine quotidienne. Contenu d'orientation intemporel récupéré de l'onglet Planning retiré. */
export function MethodeN3() {
  return (
    <details className={`${PANEL_BARE} overflow-hidden`}>
      <summary className="cursor-pointer px-5 py-4 font-bold text-fg text-lg">
        La méthode N3
      </summary>
      <div className="px-5 pb-5 pt-1 flex flex-col gap-5 border-t border-line">

        {/* Ce qu'il faut maîtriser + structure de l'examen */}
        <section>
          <h2 className={SECTION_H2}>Ce qu'il faut maîtriser au N3</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {STATS.map(([n, l]) => (
              <div key={l} className="bg-surface-2 border border-line rounded-xl p-4">
                <div className="text-xl font-bold text-accent">{n}</div>
                <div className="text-fg-dim text-meta">{l}</div>
              </div>
            ))}
          </div>
          <div className={`${PANEL} text-fg-dim text-sm mt-3`}>
            <b className="text-fg">Structure de l'examen :</b> 言語知識 (vocabulaire/kanji 30 min) · 言語知識・読解 (grammaire + compréhension écrite 70 min) · 聴解 (compréhension orale 40 min).
            Il faut <b className="text-fg">≥ 19/60 par section</b> ET un total <b className="text-fg">≥ 95/180</b>. Ne néglige aucune section.
          </div>
        </section>

        {/* Les 4 phases */}
        <section>
          <h2 className={SECTION_H2}>Les 4 phases</h2>
          <div className={`${PANEL} mt-3 overflow-x-auto`}>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-fg-dim">{["Phase", "Semaines", "Focus", "But"].map((h) => <th key={h} className="text-left py-2 px-2 border-b border-line font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {PHASES.map(([p, name, wk, focus, but]) => (
                  <tr key={p} className="align-top">
                    <td className="py-2 px-2 border-b border-line"><span className={`${PHASE_CLS[p]} text-meta font-bold rounded-full px-2 py-0.5 whitespace-nowrap`}>{name}</span></td>
                    <td className="py-2 px-2 border-b border-line text-fg-dim">{wk}</td>
                    <td className="py-2 px-2 border-b border-line text-fg">{focus}</td>
                    <td className="py-2 px-2 border-b border-line text-fg-dim">{but}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Routine quotidienne */}
        <section>
          <h2 className={SECTION_H2}>Routine quotidienne (≈ 60–90 min/jour)</h2>
          <div className={`${PANEL} mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm`}>
            <b className="text-accent">15 min</b><span className="text-fg-dim"><Link to="/entrainement" className="text-accent">Entraînement</Link> — un quiz du jour (kanji + vocabulaire), puis « Réviser mes erreurs ».</span>
            <b className="text-accent">20 min</b><span className="text-fg-dim"><Link to="/cours" className="text-accent">Cours de grammaire</Link> : 1 à 2 nouveaux points + écris 2 phrases à toi avec chacun.</span>
            <b className="text-accent">20 min</b><span className="text-fg-dim">Compréhension écrite : relis les exemples du cours à voix haute, puis quiz « 読解 » de l'app.</span>
            <b className="text-accent">15 min</b><span className="text-fg-dim">Écoute : écoute du japonais autour de toi (audio, vidéos sans sous-titres FR), même en passif.</span>
            <b className="text-accent">+ week-end</b><span className="text-fg-dim">Bilan : un <b className="text-fg">diagnostic complet</b> dans l'app + écris un court journal en japonais.</span>
          </div>
          <p className="text-fg-dim text-sm mt-2">Règle d'or : <b className="text-fg">la régularité bat l'intensité</b>. 60 min/jour valent mieux que 7 h le dimanche.</p>
        </section>

      </div>
    </details>
  );
}
