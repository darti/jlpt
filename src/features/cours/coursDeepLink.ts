/** Deep-link helpers between the quiz corrigé and the cours master-detail.
 *
 *  A grammar point lives at `/cours/gram/<group>` with its item marked by
 *  `data-item-id="<id>"` (see GroupDetail). `grammarPointHref` builds the hash URL that
 *  scrolls to + highlights that exact point; `from=quiz` tells GroupDetail to surface a
 *  « Revenir à la question » back-link (`quizResumeHref`) that re-opens the corrigé the user
 *  left (the quiz persists its phase in the resume state — see useQuiz). Pure string logic,
 *  SSR-safe, so both the corrigé leaf and the cours page can import it. */
import type { GrammarRappel } from "./coursGramIndex.ts";

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

/** Deep link to the grammar point of a resolved « Rappel de cours », coming from the quiz. */
export function grammarPointHref(rappel: GrammarRappel): string {
  return coursItemHref("gram", rappel.group, rappel.id, { fromQuiz: true });
}

/** URL that re-enters the Entraînement route and resumes the interrupted session, restoring the
 *  corrigé the user was reading (matches useQuiz's `?resume=1` auto-resume handoff). */
export const quizResumeHref = "#/entrainement?resume=1";
