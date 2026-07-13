import type { Skill } from "../types/progress.ts";

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

/** Per-skill coverage % from the seen/mastered bitsets, bucketed via bank-index. One O(N) pass. */
export function coverageBySkill(
  seen: Uint8Array,
  mastered: Uint8Array,
  bankIndex: Record<number, Skill>,
): Record<Skill, SkillCoverage> {
  const acc = {} as Record<Skill, SkillCoverage>;
  for (const key in bankIndex) {
    const id = Number(key);
    const c = bankIndex[id];
    const s = (acc[c] ??= { seen: 0, mastered: 0, seenN: 0, masteredN: 0, total: 0 });
    s.total++;
    if (hasBit(seen, id)) s.seenN++;
    if (hasBit(mastered, id)) s.masteredN++;
  }
  for (const c in acc) {
    const s = acc[c as Skill];
    s.seen = s.total ? Math.round((s.seenN / s.total) * 100) : 0;
    s.mastered = s.total ? Math.round((s.masteredN / s.total) * 100) : 0;
  }
  return acc;
}

/** Count of bank-index ids whose `seen` bit is unset (never-encountered items). Pure. */
export function countUnseen(seen: Uint8Array, bankIndex: Record<number, Skill>): number {
  let n = 0;
  for (const key in bankIndex) {
    if (!hasBit(seen, Number(key))) n++;
  }
  return n;
}
