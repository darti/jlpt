import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";
import { loadCoursGramIndex, type CoursGramIndex } from "./coursGramIndex.ts";

/** Loads the memoized grammar index once; `null` until it resolves (ou s'il échoue).
 *  Nomme le concept côté feature : la route n'a pas à connaître le chargeur sous-jacent. */
export function useCoursGramIndex(): CoursGramIndex | null {
  return useAsyncOnce(loadCoursGramIndex);
}
