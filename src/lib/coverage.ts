import type { Skill } from "../types/progress.ts";
import type { SkillRange } from "./graph.ts";

/** Empty bitset — grows on demand via setBit. */
export function emptyBits(): Uint8Array {
  return new Uint8Array(0);
}

/** Set bit `id`, growing the backing array if needed. Returns the (possibly new) array. */
export function setBit(bits: Uint8Array, id: number): Uint8Array {
  const byte = id >> 3;
  let out = bits;
  if (byte >= bits.length) {
    out = new Uint8Array(byte + 1);
    out.set(bits);
  }
  out[byte] |= 1 << (id & 7);
  return out;
}

/** True if bit `id` is set. Out-of-range ids read as false. */
export function hasBit(bits: Uint8Array, id: number): boolean {
  const byte = id >> 3;
  if (byte < 0 || byte >= bits.length) return false;
  return (bits[byte] & (1 << (id & 7))) !== 0;
}

/** Encode a bitset to base64. Chunked so large arrays don't overflow the call stack. */
export function encodeBits(bits: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bits.length; i += CHUNK) {
    bin += String.fromCharCode(...bits.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** Decode base64 → bitset. Best-effort: "" or invalid base64 → empty. Never throws. */
export function decodeBits(b64: string): Uint8Array {
  if (!b64) return emptyBits();
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return emptyBits();
  }
}

export interface SkillCoverage {
  seen: number;      // 0..100
  mastered: number;  // 0..100
  seenN: number;
  masteredN: number;
  total: number;
}

/** Couverture par compétence depuis les bitsets vu/appris, bucketée par les intervalles du
 *  corpus (`corpus.jsonld`).
 *
 *  ⚠ Une compétence peut occuper PLUSIEURS intervalles : le corpus n'est extensible qu'à sa
 *  fin (renuméroter corromprait les bitsets persistés), donc toute question ajoutée à une
 *  compétence qui n'est pas la dernière ouvre un second intervalle. Les compteurs s'ACCUMULENT
 *  et les pourcentages ne se calculent qu'une fois tous les intervalles vus. */
export function coverageBySkill(
  seen: Uint8Array,
  mastered: Uint8Array,
  ranges: SkillRange[],
): Record<Skill, SkillCoverage> {
  const out = {} as Record<Skill, SkillCoverage>;
  for (const r of ranges) {
    const acc = out[r.skill] ?? { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 };
    for (let ord = r.from; ord < r.from + r.count; ord++) {
      if (hasBit(seen, ord)) acc.seenN++;
      if (hasBit(mastered, ord)) acc.masteredN++;
    }
    acc.total += r.count;
    out[r.skill] = acc;
  }
  for (const c of Object.keys(out) as Skill[]) {
    const a = out[c];
    const pct = (n: number) => (a.total ? Math.round((n / a.total) * 100) : 0);
    a.seen = pct(a.seenN);
    a.mastered = pct(a.masteredN);
  }
  return out;
}

/** Nombre d'ordinaux du corpus dont le bit `seen` est absent (jamais rencontrés). Pur. */
export function countUnseen(seen: Uint8Array, ranges: SkillRange[]): number {
  let n = 0;
  for (const r of ranges) {
    for (let ord = r.from; ord < r.from + r.count; ord++) if (!hasBit(seen, ord)) n++;
  }
  return n;
}

/** Nombre de bits à 1 (questions apprises). Pur. */
export function masteredCount(bits: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < bits.length; i++) {
    let b = bits[i];
    while (b) { b &= b - 1; n++; } // Kernighan : efface le bit bas à chaque tour
  }
  return n;
}
