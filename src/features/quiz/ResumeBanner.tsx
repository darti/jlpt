import type { ResumeState } from "./useQuiz.ts";

/** Resumable-session banner — port of legacy `renderResume` (app-n3.html:449-458).
 * Legacy has no dismiss action (the banner just goes stale after 2 days); the
 * explicit `onDismiss` here lets the user clear it immediately. */
export function ResumeBanner({
  resume, onResume, onDismiss,
}: {
  resume: ResumeState | null;
  onResume: () => void;
  onDismiss: () => void;
}) {
  if (!resume) return null;
  const pos = `${Math.min(resume.qi + 1, resume.ids.length)}/${resume.ids.length}`;

  return (
    <div className="bg-panel border border-line rounded-xl px-4 py-3 mb-4 shadow-card surface-blur flex items-center justify-between gap-3 flex-wrap">
      <p className="text-fg text-sm m-0">
        Reprendre ma session <span className="text-fg-dim">({pos} · {resume.right} bonne(s) réponse(s))</span>
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onResume}
          className="bg-accent text-fg-on-accent border-none rounded-lg px-3 py-2 text-sm font-bold cursor-pointer"
        >
          Reprendre la session
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="bg-transparent border border-line text-fg-dim rounded-lg px-3 py-2 text-sm cursor-pointer"
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}
