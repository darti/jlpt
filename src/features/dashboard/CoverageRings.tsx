import { BAR_SKILLS, type Skill } from "../../types/progress.ts";
import type { SkillCoverage } from "../../lib/coverage.ts";

const LABELS: Record<Skill, string> = {
  grammaire: "Grammaire", vocabulaire: "Vocab", kanji: "Kanji", lecture: "Lecture", ecoute: "Écoute",
};
// Outer ring hue = per-skill identity token; inner ring = accent (mastered).
const SKILL_VAR: Record<Skill, string> = {
  grammaire: "--color-skill-grammaire", vocabulaire: "--color-skill-vocabulaire",
  kanji: "--color-skill-kanji", lecture: "--color-skill-lecture", ecoute: "--color-skill-lecture",
};

const R_OUT = 20, R_IN = 13;
const C_OUT = 2 * Math.PI * R_OUT, C_IN = 2 * Math.PI * R_IN;
const TRACK = "var(--color-line, rgba(236,239,244,0.14))";
const EMPTY: SkillCoverage = { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 };

/** Dual-ring coverage per BAR_SKILL: outer = vu %, inner = appris %. Numeric labels below
 *  carry exact values (dataviz: never color alone) + are the accessible/offline fallback. */
export function CoverageRings({ coverage }: { coverage: Record<Skill, SkillCoverage> }) {
  return (
    <div className="flex flex-wrap justify-center gap-5 mt-3">
      {BAR_SKILLS.map((s) => {
        const cov = coverage[s] ?? EMPTY;
        return (
          <div key={s} className="flex flex-col items-center gap-1 text-center">
            <svg
              width="52" height="52" viewBox="0 0 52 52"
              role="img" aria-label={`${LABELS[s]} : vu ${cov.seen} %, appris ${cov.mastered} %`}
            >
              <circle cx="26" cy="26" r={R_OUT} fill="none" strokeWidth="4" style={{ stroke: TRACK }} />
              <circle
                cx="26" cy="26" r={R_OUT} fill="none" strokeWidth="4" strokeLinecap="round"
                transform="rotate(-90 26 26)"
                strokeDasharray={C_OUT} strokeDashoffset={C_OUT * (1 - cov.seen / 100)}
                style={{ stroke: `var(${SKILL_VAR[s]}, var(--color-accent))` }}
              />
              <circle cx="26" cy="26" r={R_IN} fill="none" strokeWidth="4" style={{ stroke: TRACK }} />
              <circle
                cx="26" cy="26" r={R_IN} fill="none" strokeWidth="4" strokeLinecap="round"
                transform="rotate(-90 26 26)"
                strokeDasharray={C_IN} strokeDashoffset={C_IN * (1 - cov.mastered / 100)}
                style={{ stroke: "var(--color-accent)" }}
              />
            </svg>
            <span className="text-meta text-fg-dim">{LABELS[s]}</span>
            <span className="text-meta text-fg-dim">
              vu <b className="text-fg">{cov.seen}%</b> · appris <b className="text-fg">{cov.mastered}%</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}
