const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const EXAM_ISO = "2026-12-06T09:00:00";
const PLAN_START_KEY = "jlptN3_planStart";

/** Monday (00:00) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x;
}
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function fmtDay(d: Date): string { return d.getDate() + " " + MONTHS[d.getMonth()]; }

/** Monday of the week the plan was first opened — persisted once, then stable. */
export function readPlanStart(store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage, now: Date = new Date()): Date {
  let s: string | null = null;
  try { s = store.getItem(PLAN_START_KEY); } catch { /* ignore */ }
  if (!s) { s = mondayOf(now).toISOString().slice(0, 10); try { store.setItem(PLAN_START_KEY, s); } catch { /* ignore */ } }
  return new Date(s + "T00:00:00");
}

/** 0-based index of the current plan week; negative before the start, ≥nWeeks once finished. */
export function currentWeekIdx(nWeeks: number, store: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage, now: Date = new Date()): number {
  const start = readPlanStart(store, now);
  return Math.round((mondayOf(now).getTime() - start.getTime()) / (7 * 864e5));
}

/** «6 juil. → 12 juil.» span for week `i` (0-based) from `start`. */
export function weekRange(start: Date, i: number): string {
  const mon = addDays(start, i * 7);
  return fmtDay(mon) + " → " + fmtDay(addDays(mon, 6));
}

export function daysUntilExam(now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(EXAM_ISO).getTime() - now.getTime()) / 86400000));
}
