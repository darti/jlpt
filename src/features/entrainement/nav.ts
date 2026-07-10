/** URL for launching a fresh quiz session of `minutes` (clamped 1–45, default 10). */
export function sessionHref(minutes: number): string {
  const m = Math.min(45, Math.max(1, Math.round(minutes) || 10));
  return "quiz.html?min=" + m;
}

/** URL for resuming the in-progress quiz session. */
export function resumeHref(): string {
  return "quiz.html?resume=1";
}
