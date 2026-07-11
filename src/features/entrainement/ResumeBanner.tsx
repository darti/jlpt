import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { readResumeState, type ResumeState } from "../quiz/useQuiz.ts";
import { resumeHref } from "./nav.ts";

/** Hub banner: if the React quiz left a resumable session (`jlptN3quiz_resume`, <2 days),
 *  offer to jump back in via quiz.html?resume=1. The session is read in a mount effect
 *  (guarded); the render returns nothing when there's no resume, so SSR needs no
 *  localStorage. Reuses `readResumeState` for the exact key + staleness rule. */
export function ResumeBanner() {
  const [resume, setResume] = useState<ResumeState | null>(null);
  useEffect(() => { setResume(readResumeState()); }, []);

  if (!resume) return null;
  const pos = `${Math.min(resume.qi + 1, resume.ids.length)}/${resume.ids.length}`;

  return (
    <div className="bg-panel border border-line rounded-xl px-4 py-3 shadow-card surface-blur flex items-center justify-between gap-3 flex-wrap">
      <p className="text-fg text-sm m-0">
        Session en cours <span className="text-fg-dim">({pos} · {resume.right} bonne(s) réponse(s))</span>
      </p>
      <Link
        to={resumeHref()}
        className="bg-accent text-fg-on-accent no-underline rounded-lg px-3 py-2 text-sm font-bold shrink-0"
      >
        Reprendre ma session
      </Link>
    </div>
  );
}
