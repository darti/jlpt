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
 *  corpus (`corpus.jsonld`). Les ordinaux étant groupés par compétence, un intervalle suffit
 *  là où il fallait parcourir les 10 307 entrées de `bank-index.json`. */
export function coverageBySkill(
  seen: Uint8Array,
  mastered: Uint8Array,
  ranges: SkillRange[],
): Record<Skill, SkillCoverage> {
  const out = {} as Record<Skill, SkillCoverage>;
  for (const r of ranges) {
    let seenN = 0, masteredN = 0;
    for (let ord = r.from; ord < r.from + r.count; ord++) {
      if (hasBit(seen, ord)) seenN++;
      if (hasBit(mastered, ord)) masteredN++;
    }
    const pct = (n: number) => (r.count ? Math.round((n / r.count) * 100) : 0);
    out[r.skill] = { seen: pct(seenN), mastered: pct(masteredN), seenN, masteredN, total: r.count };
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
