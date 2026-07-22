/**
 * Requêtes du modèle de mémoire : lecture de l'état FSRS du blob, entités dues, index inverse.
 *
 * Le pont ord ↔ IRI : l'état FSRS est indexé par IRI d'entité (`jlpt:word/影響`), le quiz par
 * `ord`. `q.tests` donne ord → IRIs ; `fsrsIndex` en construit l'inverse pour retrouver une
 * question qui teste une entité due. Module PUR (date injectée).
 */
import { isDue, retrievability, type Fsrs } from "../../lib/fsrs.ts";
import type { Question } from "../../types/quiz.ts";

export type FsrsMap = Record<string, Fsrs>;

/** L'état FSRS du blob, ou `{}` si absent/malformé. Un blob antérieur au champ n'a pas besoin
 *  de migration. Validation superficielle : un tuple à 3 nombres. */
export function asFsrs(raw: Record<string, unknown> | null): FsrsMap {
  const m = raw?.fsrs;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const out: FsrsMap = {};
  for (const [iri, v] of Object.entries(m as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")) {
      out[iri] = v as Fsrs;
    }
  }
  return out;
}

/** Entités dues (R < 0,9), triées de la plus en retard (R le plus bas) à la moins. */
export function dueEntities(map: FsrsMap, today: number): { iri: string; r: number }[] {
  const due: { iri: string; r: number }[] = [];
  for (const [iri, st] of Object.entries(map)) {
    if (isDue(st, today)) due.push({ iri, r: retrievability(st, today) });
  }
  return due.sort((a, b) => a.r - b.r);
}

/** Compétence d'une entité d'après son préfixe d'IRI. */
function skillOfIri(iri: string): "vocab" | "kanji" | "gram" | "autre" {
  if (iri.startsWith("jlpt:word/")) return "vocab";
  if (iri.startsWith("jlpt:kanji/")) return "kanji";
  if (iri.startsWith("jlpt:gram/")) return "gram";
  return "autre";
}

/** Décompte des entités dues par compétence (pour le panneau Accueil). */
export function dueBySkill(map: FsrsMap, today: number) {
  const by = { kanji: 0, vocab: 0, gram: 0, autre: 0, total: 0 };
  for (const { iri } of dueEntities(map, today)) { by[skillOfIri(iri)]++; by.total++; }
  return by;
}

let indexCache: { key: Question[]; index: Map<string, number[]> } | null = null;

/** Vide la mémoïsation de l'index inverse (isolation des tests, cf. clearGraphCache). */
export function clearRevisionCache(): void { indexCache = null; }

/** Index inverse IRI → ords, mémoïsé sur l'identité du tableau de questions. */
export function fsrsIndex(questions: Question[]): Map<string, number[]> {
  if (indexCache && indexCache.key === questions) return indexCache.index;
  const index = new Map<string, number[]>();
  for (const q of questions) {
    for (const iri of q.tests ?? []) {
      const arr = index.get(iri);
      if (arr) arr.push(q.id); else index.set(iri, [q.id]);
    }
  }
  indexCache = { key: questions, index };
  return index;
}

/** Jusqu'à `limit` questions de révision : pour chaque entité due (la plus en retard d'abord),
 *  la première question (ord croissant) qui la teste et n'est pas déjà exclue. Pure. */
export function selectRevision(
  map: FsrsMap, today: number, questions: Question[], exclude: Set<number>, limit: number,
): Question[] {
  if (limit <= 0) return [];
  const index = fsrsIndex(questions);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const taken = new Set(exclude);
  const out: Question[] = [];
  for (const { iri } of dueEntities(map, today)) {
    if (out.length >= limit) break;
    const ords = (index.get(iri) ?? []).slice().sort((a, b) => a - b);
    for (const ord of ords) {
      if (!taken.has(ord)) { const q = byId.get(ord); if (q) { out.push(q); taken.add(ord); break; } }
    }
  }
  return out;
}
