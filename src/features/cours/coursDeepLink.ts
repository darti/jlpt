/** Deep-link helpers between the quiz corrigé and the cours master-detail.
 *
 *  A grammar point lives at `/cours/gram/<group>` with its item marked by
 *  `data-item-id="<id>"` (see GroupDetail). `grammarPointHref` builds the hash URL that
 *  scrolls to + highlights that exact point; `from=quiz` tells GroupDetail to surface a
 *  « Revenir à la question » back-link (`quizResumeHref`) that re-opens the corrigé the user
 *  left (the quiz persists its phase in the resume state — see useQuiz). Pure string logic,
 *  SSR-safe, so both the corrigé leaf and the cours page can import it. */
import type { Rappel } from "../quiz/rappel.ts";

/** Hash URL to a specific cours item (group + item id), optionally flagged as coming from the
 *  quiz so the destination shows a return link. Item ids carry `:`/kana, so `focus` is encoded. */
export function coursItemHref(
  category: string,
  group: string,
  itemId: string,
  opts?: { fromQuiz?: boolean },
): string {
  const q = new URLSearchParams();
  q.set("focus", itemId);
  if (opts?.fromQuiz) q.set("from", "quiz");
  return `#/cours/${category}/${group}?${q.toString()}`;
}

/** Lien profond vers l'entité d'un rappel résolu, en venant du quiz.
 *
 *  `null` quand aucune leçon ne couvre l'entité : mieux vaut pas de lien qu'un lien mort vers
 *  `/cours/<cat>/` — 45 % des questions testent une notion que le cours n'enseigne pas. */
export function rappelHref(rappel: Rappel): string | null {
  if (!rappel.group || !rappel.coursCat) return null;
  return coursItemHref(rappel.coursCat, rappel.group, rappel.iri, { fromQuiz: true });
}

/** URL that re-enters the Entraînement route and resumes the interrupted session, restoring the
 *  corrigé the user was reading (matches useQuiz's `?resume=1` auto-resume handoff). */
export const quizResumeHref = "#/entrainement?resume=1";
