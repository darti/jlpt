/**
 * Kana : test de pureté, normalisation de lecture, comparaison, éligibilité à la production.
 *
 * Le rappel actif compare une saisie libre à la lecture attendue (la bonne réponse de la
 * question). La normalisation neutralise katakana↔hiragana, espaces et point médian pour
 * qu'une saisie légitime ne soit pas refusée sur un détail de casse kana.
 */
import type { Question } from "../types/quiz.ts";

/** Kana purs : hiragana (ぁ..ゖ), katakana (ァ..ヶ), prolongation ー. La plage couvre EXACTEMENT
 *  le bloc que `normalizeKana` convertit (ヴ/ゔ, ヵ/ゕ, ヶ/ゖ compris), pour que les deux
 *  s'accordent : une lecture jugée « pure » ici est toujours normalisable, sans trou. */
const PURE_KANA_RE = /^[ぁ-ゖァ-ヶー]+$/;

/** true ssi `s` n'est fait que de kana (hiragana/katakana/ー). Chaîne vide → false. */
export function isPureKana(s: string): boolean {
  return PURE_KANA_RE.test(s);
}

/** Normalise une lecture pour comparaison : trim → NFC → katakana→hiragana → retrait des
 *  espaces (` `, U+3000) et du point médian `・`. `ー` (prolongation) est conservé. */
export function normalizeKana(s: string): string {
  const t = s.trim().normalize("NFC");
  let out = "";
  for (const ch of t) {
    const code = ch.codePointAt(0) ?? 0;
    // Bloc katakana ァ(U+30A1)..ヶ(U+30F6) → hiragana (décalage 0x60). ー(U+30FC) hors plage.
    if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60);
    else if (ch === " " || ch === "　" || ch === "・") continue;
    else out += ch;
  }
  return out;
}

/** true ssi la saisie, normalisée, égale la réponse normalisée (non vide). */
export function checkReading(input: string, answer: string): boolean {
  const a = normalizeKana(answer);
  return a.length > 0 && normalizeKana(input) === a;
}

/** Éligible à la production : vocabulaire ou kanji dont la bonne réponse est une lecture kana. */
export function isProductionEligible(q: Question): boolean {
  if (q.cat !== "vocabulaire" && q.cat !== "kanji") return false;
  const answer = q.o[q.a];
  return typeof answer === "string" && isPureKana(answer);
}
