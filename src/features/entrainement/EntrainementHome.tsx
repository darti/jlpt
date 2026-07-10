import { Dashboard } from "../dashboard/Dashboard.tsx";
import { SyncSection } from "../sync/SyncSection.tsx";
import { ProgressChart } from "./ProgressChart.tsx";
import { ResumeBanner } from "./ResumeBanner.tsx";
import { SessionLauncher } from "./SessionLauncher.tsx";
import { Settings } from "./Settings.tsx";
import type { DashboardModel } from "../../lib/scoring.ts";
import type { ThemeName } from "../../lib/theme.ts";

// Diagnostic/SRS are deferred to a later strangler slice (their vanilla code drops from
// the tree, recoverable from git) — shown as disabled «bientôt disponible» cards so the
// hub's shape matches the eventual full app.
const STUBS = [
  { key: "diagnostic", label: "Diagnostic", desc: "Évalue ton niveau réel" },
  { key: "apprendre", label: "Apprendre", desc: "Cours et nouveaux points" },
  { key: "erreurs", label: "Réviser les erreurs", desc: "Reprends tes fautes" },
];

/** Entraînement hub content: progress overview (reused `Dashboard`) + session-score chart
 *  + resume banner + «J'ai xx minutes» launcher + deferred stubs + settings + Gist sync.
 *  Pure/prop-driven for the overview; the leaf components own their SSR-guarded effects. */
export function EntrainementHome(props: {
  model: DashboardModel | null;
  days: number;
  scores: number[];
  theme: ThemeName;
  onToggleTheme: () => void;
  onProgressChanged: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ResumeBanner />
      <Dashboard model={props.model} days={props.days} />
      <section className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
        <h2 className="text-fg text-lg font-bold mt-0 mb-3">Progression</h2>
        <ProgressChart scores={props.scores} />
      </section>
      <SessionLauncher />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STUBS.map((s) => (
          <div
            key={s.key}
            aria-disabled="true"
            className="bg-panel border border-line rounded-xl p-4 shadow-card surface-blur opacity-60"
          >
            <h3 className="text-fg text-sm font-bold m-0">{s.label}</h3>
            <p className="text-fg-dim text-xs mt-1 mb-2">{s.desc}</p>
            <span className="text-meta text-fg-muted">bientôt disponible</span>
          </div>
        ))}
      </section>
      <Settings theme={props.theme} onToggleTheme={props.onToggleTheme} />
      <SyncSection onProgressChanged={props.onProgressChanged} />
    </div>
  );
}
