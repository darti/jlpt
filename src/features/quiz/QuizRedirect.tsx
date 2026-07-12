import { Navigate, useSearchParams } from "react-router-dom";

/** Pure target for the retired /quiz route → the merged Entraînement tab, preserving the
 *  query string so /quiz?resume=1 and /quiz?min=N still auto-resume / auto-start. */
export function quizRedirectTarget(search: string): string {
  const s = new URLSearchParams(search).toString();
  return `/entrainement${s ? "?" + s : ""}`;
}

/** Redirects /quiz (and old bookmarks) to /entrainement, keeping any query string. */
export function QuizRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={quizRedirectTarget("?" + params.toString())} replace />;
}
