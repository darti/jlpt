import { useCours, type CoursSection, type CoursLesson, type CoursPoint, type CoursExample, type CoursTable } from "./useCours.ts";
import { visualBreak } from "../../lib/dict.ts";

// Furigana hook exposed by src/lib/dict.ts (via AppShell's setupDict); SSR-guarded.
declare const furi: ((s: string) => string) | undefined;
function furiOrPlain(text: string): string { return typeof furi === "function" ? furi(text) : text; }

function Example({ ex }: { ex: CoursExample }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-3 text-sm flex flex-col gap-0.5">
      <div className="text-fg text-base" dangerouslySetInnerHTML={{ __html: furiOrPlain(ex.jp) }} />
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {/* Analyse visuelle : les annotations mot-à-mot sont rendues en jetons colorés par rôle
          (visualBreak, pure — pas de dépendance runtime), comme sur la page vanilla d'origine. */}
      {ex.an && ex.an.length > 0 && (
        <div dangerouslySetInnerHTML={{ __html: visualBreak(ex.an.join(" · "), { legend: false }) }} />
      )}
    </div>
  );
}

function Point({ p }: { p: CoursPoint }) {
  return (
    <div className="border-l-2 border-accent pl-3 flex flex-col gap-1.5">
      {p.form && <div className="text-fg text-base font-bold">{p.form}</div>}
      {p.struct && <div className="text-fg-muted text-meta font-mono">{p.struct}</div>}
      {p.mean && <div className="text-fg-dim text-sm">{p.mean}</div>}
      {p.examples?.map((ex, i) => <Example key={i} ex={ex} />)}
    </div>
  );
}

function Table({ t }: { t: CoursTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead><tr>{t.headers.map((h) => <th key={h} className="text-left py-1.5 px-2 border-b border-line text-fg-dim font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="py-1.5 px-2 border-b border-line text-fg align-top break-words" dangerouslySetInnerHTML={{ __html: furiOrPlain(c) }} />)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Lesson({ l, nested = false }: { l: CoursLesson; nested?: boolean }) {
  return (
    <details className={`bg-panel border border-line rounded-xl overflow-hidden ${nested ? "" : "shadow-card"}`}>
      <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 font-semibold list-none text-fg text-sm">
        {l.tag && <span className="bg-surface-2 text-accent text-meta font-bold rounded-full px-2 py-0.5 whitespace-nowrap">{l.tag}</span>}
        {l.title}
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-line flex flex-col gap-3">
        {l.intro?.map((p, i) => <p key={i} className="text-fg-dim text-sm m-0" dangerouslySetInnerHTML={{ __html: p }} />)}
        {l.lessons?.map((sub, i) => <Lesson key={i} l={sub} nested />)}
        {l.table && <Table t={l.table} />}
        {l.points?.map((p, i) => <Point key={i} p={p} />)}
        {l.tip && <div className="bg-surface-2 border border-line rounded-lg p-2.5 text-fg-dim text-sm" dangerouslySetInnerHTML={{ __html: l.tip }} />}
      </div>
    </details>
  );
}

/** Pure course view — prop-driven, SSR-renderable. */
export function CoursView({ sections }: { sections: CoursSection[] }) {
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-2 flex-wrap justify-center text-sm">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`cours-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="bg-surface-2 border border-line text-fg-dim rounded-full px-3 py-1 cursor-pointer"
          >
            {s.title.split(" ")[0]}
          </button>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={`cours-${s.id}`} className="scroll-mt-4">
          <h2 className="text-fg text-lg font-bold border-l-4 border-accent pl-2.5 mb-2">{s.title}</h2>
          {s.intro?.map((p, i) => <p key={i} className="text-fg-dim text-sm mb-2" dangerouslySetInnerHTML={{ __html: p }} />)}
          {s.tips && (
            <div className="bg-panel border border-line rounded-xl p-5 shadow-card surface-blur">
              <ul className="list-disc pl-5 flex flex-col gap-1.5 text-fg-dim text-sm m-0">
                {s.tips.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-3 mt-1">
            {s.lessons?.map((l, i) => <Lesson key={i} l={l} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Route container: loads data/cours-*.json, renders the pure view. */
export function Cours() {
  const sections = useCours();
  if (!sections) return <p className="text-fg-dim text-sm">Chargement du cours…</p>;
  if (!sections.length) return <p className="text-fg-dim text-sm">Cours indisponible (hors ligne ?).</p>;
  return <CoursView sections={sections} />;
}
