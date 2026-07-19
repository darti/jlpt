import { useState, type ChangeEvent } from "react";
import { readFs, bumpFs, applyFontScale, type FsKind } from "../../lib/fontscale.ts";
import { exportJson, importJson, resetProgress } from "../../lib/datajson.ts";
import type { ThemeName } from "../../lib/theme.ts";
import { PANEL, H2_TIGHT } from "../../ui/styles.ts";

const CHIP_BASE = "bg-surface-2 border border-line rounded-lg px-3 h-9 text-sm cursor-pointer";
const CHIP = CHIP_BASE + " text-fg";
const CHIP_DANGER = CHIP_BASE + " text-status-failed";

/** One font-scale row (UI or Japanese): A− / current % / A+. Each bump persists via
 *  `bumpFs` and re-applies `--fs-ui`/`--fs-jp` live through `applyFontScale`. */
function FontRow({ kind, label }: { kind: FsKind; label: string }) {
  const [v, setV] = useState(() => readFs(kind)); // SSR-safe: readFs swallows a missing store → 1
  const bump = (dir: number) => { const nv = bumpFs(kind, dir); applyFontScale(); setV(nv); };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-dim text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => bump(-1)} aria-label={`Réduire ${label}`} className={CHIP}>A−</button>
        <span className="text-fg text-sm w-12 text-center tabular-nums">{Math.round(v * 100)}%</span>
        <button type="button" onClick={() => bump(1)} aria-label={`Agrandir ${label}`} className={CHIP}>A+</button>
      </div>
    </div>
  );
}

/** Settings panel: font scale (UI/JP), theme toggle, and data (export / import / reset).
 *  All side effects live in handlers — the render is SSR-safe. Data ops go through the
 *  tested `datajson.ts` helpers, each gated by a `confirm`. */
export function Settings({ theme, onToggleTheme }: { theme: ThemeName; onToggleTheme: () => void }) {
  const onExport = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jlpt-n3-backup.json";
    document.body.appendChild(a); // some browsers require the anchor be in the DOM to trigger a download
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0); // defer so the download stream isn't cut short
  };

  const onImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // `undefined` store = default localStorage; importJson strips any jlptN3_gh (M1) and confirm-gates the write.
      const confirmReplace = () => confirm("Remplacer la progression actuelle ?");
      if (importJson(String(reader.result ?? ""), undefined, confirmReplace)) location.reload();
    };
    reader.readAsText(file);
  };

  const onReset = () => {
    if (confirm("Effacer toute la progression ? Cette action est irréversible.")) {
      resetProgress();
      location.reload();
    }
  };

  return (
    <div className={`${PANEL} flex flex-col gap-4`}>
      <h2 className={H2_TIGHT}>Réglages</h2>

      <section className="flex flex-col gap-2">
        <h3 className="text-fg text-sm font-bold m-0">Police</h3>
        <FontRow kind="Ui" label="Interface" />
        <FontRow kind="Jp" label="Japonais" />
      </section>

      <section className="flex items-center justify-between gap-3">
        <h3 className="text-fg text-sm font-bold m-0">Thème</h3>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={theme === "dark"}
          aria-label={`Thème actuel : ${theme === "dark" ? "sombre" : "clair"} — basculer`}
          className={CHIP}
        >
          {theme === "dark" ? "☾ Sombre" : "☀ Clair"}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-fg text-sm font-bold m-0">Données</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className={CHIP}>Exporter</button>
          <label className={CHIP + " inline-flex items-center"}>
            Importer
            <input type="file" accept="application/json" onChange={onImport} className="hidden" />
          </label>
          <button type="button" onClick={onReset} className={CHIP_DANGER}>
            Réinitialiser
          </button>
        </div>
      </section>
    </div>
  );
}
