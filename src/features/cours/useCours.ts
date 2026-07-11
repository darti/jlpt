import { useEffect, useState } from "react";

export interface CoursExample { jp: string; ro: string; fr: string; an: string[] }
export interface CoursPoint { form?: string; struct?: string; mean?: string; examples?: CoursExample[] }
export interface CoursTable { headers: string[]; rows: string[][] }
export interface CoursLesson {
  title: string; tag?: string; intro?: string[];
  lessons?: CoursLesson[]; table?: CoursTable; points?: CoursPoint[]; tip?: string;
}
export interface CoursSection { id: string; title: string; intro?: string[]; lessons?: CoursLesson[]; tips?: string[] }

// The 5 course sections, in display order, from tools/extract-cours.mjs.
const SECTION_IDS = ["gram", "kanji", "vocab", "dokkai", "choukai"];

/** Loads the course content (data/cours-*.json) at runtime. `null` = loading, `[]` = failed. */
export function useCours(): CoursSection[] | null {
  const [sections, setSections] = useState<CoursSection[] | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(SECTION_IDS.map((id) => fetch(`data/cours-${id}.json`).then((r) => r.json() as Promise<CoursSection>)))
      .then((s) => { if (alive) setSections(s); })
      .catch(() => { if (alive) setSections([]); });
    return () => { alive = false; };
  }, []);
  return sections;
}
