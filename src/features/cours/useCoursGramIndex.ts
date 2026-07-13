import { useEffect, useState } from "react";
import { loadCoursGramIndex, type CoursGramIndex } from "./coursGramIndex.ts";

/** Loads the memoized cours-gram index once; `null` until it resolves. */
export function useCoursGramIndex(): CoursGramIndex | null {
  const [index, setIndex] = useState<CoursGramIndex | null>(null);
  useEffect(() => {
    let alive = true;
    loadCoursGramIndex().then((idx) => { if (alive) setIndex(idx); });
    return () => { alive = false; };
  }, []);
  return index;
}
