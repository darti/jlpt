import { useState } from "react";
import { Link } from "react-router-dom";
import { WEEKS, PHASE_NAME, type Phase } from "./weeks.ts";
import { usePlanning, progressOf, weekDone } from "./usePlanning.ts";
import { readPlanStart, currentWeekIdx, daysUntilExam, weekRange, fmtDay } from "../../lib/planning.ts";

const PHASE_CLS: Record<Phase, string> = {
  p1: "bg-surface-2 text-accent",
  p2: "bg-surface-2 text-prio-high",
  p3: "bg-surface-2 text-status-completed",
  p4: "bg-surface-2 text-status-failed",
};
const PILL = "bg-surface-2 border border-line rounded-full px-4 py-2 text-sm";
const CARD = "bg-panel border border-line rounded-xl p-5 shadow-card surface-blur";
const H2 = "text-fg text-lg font-bold border-l-4 border-accent pl-2.5 mt-2 mb-1";

function ThisWeek({ cur, start }: { cur: number; start: Date }) {
  let msg: React.ReactNode;
  if (cur < 0) {
    msg = <>Le plan intensif (20 semaines) démarre le <b>lundi {fmtDay(start)}</b> — d'ici là, <b>calibre-toi</b> : un diagnostic dans l'app et quelques notions de grammaire par jour.</>;
  } else if (cur >= WEEKS.length) {
    msg = <>Plan terminé — place aux <b>examens blancs</b> et au repos avant le jour J. 頑張って！</>;
  } else {
    const w = WEEKS[cur];
    msg = <>Cette semaine : <b>S{cur + 1} — {w.t}</b> ({PHASE_NAME[w.p]}). Ouvre-la ci-dessous et coche au fur et à mesure.</>;
  }
  return <div className="bg-surface-2 border border-accent rounded-xl px-4 py-2.5 text-sm max-w-[560px] mx-auto text-fg">{msg}</div>;
}

/** Planning route: 20-week checklist + countdown to the exam. Port of planning-n3.html. */
export function Planning() {
  const { state, toggle, reset } = usePlanning();
  const now = new Date();
  const [start] = useState(() => readPlanStart(undefined, now));
  const cur = currentWeekIdx(WEEKS.length, undefined, now);
  const days = daysUntilExam(now);
  const prog = progressOf(state, WEEKS);

  const onReset = () => { if (confirm("Effacer toute la progression cochée ?")) reset(); };

  return (
    <div className="flex flex-col gap-5">
      {/* Countdown + progress + this-week + reset */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex gap-3 justify-center flex-wrap">
          <span className={PILL}>⏳ <b className="text-accent">{days}</b> jours restants</span>
          <span className={PILL}>≈ <b className="text-accent">{Math.floor(days / 7)}</b> semaines</span>
          <span className={PILL}>📅 Examen : <b className="text-accent">6 déc. 2026</b></span>
        </div>
        <div className="h-2.5 bg-surface-2 border border-line rounded-full overflow-hidden max-w-[560px] w-full">
          <div className="h-full bg-accent" style={{ width: `${prog.pct}%` }} />
        </div>
        <p className="text-fg-dim text-sm m-0">Progression : {prog.pct} % ({prog.done}/{prog.total} tâches)</p>
        <ThisWeek cur={cur} start={start} />
        <button type="button" onClick={onReset} className="bg-transparent border border-line text-fg-dim rounded-lg px-3 py-1.5 text-sm cursor-pointer">
          ↺ Réinitialiser ma progression
        </button>
      </div>

      {/* What to master */}
      <section>
        <h2 className={H2}>Ce qu'il faut maîtriser au N3</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {[["~650", "kanji"], ["~3 700", "mots de vocabulaire"], ["~150", "points de grammaire"], ["95 / 180", "score visé (sécurité)"]].map(([n, l]) => (
            <div key={l} className="bg-surface-2 border border-line rounded-xl p-4">
              <div className="text-xl font-bold text-accent">{n}</div>
              <div className="text-fg-dim text-meta">{l}</div>
            </div>
          ))}
        </div>
        <div className={`${CARD} text-fg-dim text-sm mt-3`}>
          <b className="text-fg">Structure de l'examen :</b> 言語知識 (vocabulaire/kanji 30 min) · 言語知識・読解 (grammaire + compréhension écrite 70 min) · 聴解 (compréhension orale 40 min).
          Il faut <b className="text-fg">≥ 19/60 par section</b> ET un total <b className="text-fg">≥ 95/180</b>. Ne néglige aucune section.
        </div>
      </section>

      {/* 4 phases */}
      <section>
        <h2 className={H2}>Les 4 phases</h2>
        <div className={`${CARD} mt-3 overflow-x-auto`}>
          <table className="w-full text-sm border-collapse">
            <thead><tr className="text-fg-dim">{["Phase", "Semaines", "Focus", "But"].map((h) => <th key={h} className="text-left py-2 px-2 border-b border-line font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {([
                ["p1", "1–5", "Fondations", "Réviser N4, démarrer kanji & grammaire N3, routine quotidienne"],
                ["p2", "6–11", "Construction", "Gros volume vocab/kanji, grammaire N3 complète, écoute"],
                ["p3", "12–16", "Consolidation", "Compréhension écrite/orale intensive, révisions espacées"],
                ["p4", "17–20", "Examen blanc", "Tests chronométrés, points faibles, conditions réelles"],
              ] as [Phase, string, string, string][]).map(([p, wk, focus, but]) => (
                <tr key={p} className="align-top">
                  <td className="py-2 px-2 border-b border-line"><span className={`${PHASE_CLS[p]} text-meta font-bold rounded-full px-2 py-0.5 whitespace-nowrap`}>{PHASE_NAME[p]}</span></td>
                  <td className="py-2 px-2 border-b border-line text-fg-dim">{wk}</td>
                  <td className="py-2 px-2 border-b border-line text-fg">{focus}</td>
                  <td className="py-2 px-2 border-b border-line text-fg-dim">{but}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Daily routine */}
      <section>
        <h2 className={H2}>Routine quotidienne (≈ 60–90 min/jour)</h2>
        <div className={`${CARD} mt-3 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-sm`}>
          <b className="text-accent">15 min</b><span className="text-fg-dim"><Link to="/entrainement" className="text-accent">Entraînement</Link> — un quiz du jour (kanji + vocabulaire), puis « Réviser mes erreurs ».</span>
          <b className="text-accent">20 min</b><span className="text-fg-dim"><a href="cours-n3.html#gram" className="text-accent">Cours de grammaire</a> : 1 à 2 nouveaux points + écris 2 phrases à toi avec chacun.</span>
          <b className="text-accent">20 min</b><span className="text-fg-dim">Compréhension écrite : relis les exemples du cours à voix haute, puis quiz « 読解 » de l'app.</span>
          <b className="text-accent">15 min</b><span className="text-fg-dim">Écoute : écoute du japonais autour de toi (audio, vidéos sans sous-titres FR), même en passif.</span>
          <b className="text-accent">+ week-end</b><span className="text-fg-dim">Bilan : un <b className="text-fg">diagnostic complet</b> dans l'app + écris un court journal en japonais.</span>
        </div>
        <p className="text-fg-dim text-sm mt-2">Règle d'or : <b className="text-fg">la régularité bat l'intensité</b>. 60 min/jour valent mieux que 7 h le dimanche.</p>
      </section>

      {/* Week-by-week accordion */}
      <section>
        <h2 className={H2}>Planning semaine par semaine</h2>
        <p className="text-fg-dim text-sm mt-1">Coche au fur et à mesure — ta progression est sauvegardée automatiquement dans ce navigateur.</p>
        <div className="flex flex-col gap-3 mt-2">
          {WEEKS.map((w, i) => {
            const wk = i + 1;
            const done = weekDone(state, wk, w.items.length);
            const all = done === w.items.length;
            const isNow = i === cur;
            return (
              <details key={wk} open={isNow} className={`bg-panel border rounded-xl overflow-hidden shadow-card ${isNow ? "border-accent" : "border-line"}`}>
                <summary className={`cursor-pointer px-4 py-3 flex items-center gap-3 font-semibold list-none ${all ? "opacity-60" : ""}`}>
                  <span className={`${PHASE_CLS[w.p]} text-meta font-bold rounded-full px-2 py-0.5 whitespace-nowrap`}>{PHASE_NAME[w.p]}</span>
                  <span className="text-fg text-sm">
                    S{wk} — {w.t}{isNow && <span className="ml-1.5 text-meta font-bold bg-accent text-fg-on-accent rounded-full px-2 py-0.5">cette semaine</span>}
                    <br /><span className="text-fg-muted text-meta font-medium">{weekRange(start, i)}</span>
                  </span>
                  <span className="ml-auto text-fg-dim text-meta">{done}/{w.items.length}{all ? " ✓" : ""}</span>
                </summary>
                <div className="px-4 pb-3.5 pt-1.5 border-t border-line">
                  {w.items.map((it, j) => (
                    <label key={j} className="flex gap-2.5 items-start cursor-pointer py-1 text-sm text-fg">
                      <input type="checkbox" checked={!!state[`${wk}_${j}`]} onChange={() => toggle(wk, j)} className="mt-1 w-4 h-4 accent-[var(--color-accent)] shrink-0" />
                      <span>{it}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
