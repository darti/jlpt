import type { Question } from "../types/quiz.ts";

/** Rebuild the full Japanese sentence from a grammar decomposition `g`
 *  (mirrors legacy sentenceFromG): drop French glosses «…», keep the form
 *  after →, and remove （furigana）. */
export function sentenceFromG(g: string): string {
  if (!g) return "";
  return String(g).split(" · ").map((seg) => {
    let jp = seg.replace(/«[^»]*»/g, "").trim();
    if (jp.indexOf("→") >= 0) { const p = jp.split("→"); jp = p[p.length - 1]; }
    return jp.replace(/（[^）]*）/g, "").trim();
  }).join("");
}

let jaVoice: SpeechSynthesisVoice | null = null;
export function pickJaVoice(): void {
  if (typeof speechSynthesis === "undefined") return;
  try {
    const vs = speechSynthesis.getVoices() || [];
    jaVoice = vs.find((v) => /ja[-_]?jp/i.test(v.lang)) || vs.find((v) => /^ja/i.test(v.lang)) || null;
  } catch { /* ignore */ }
}
export function speak(text: string, rate = 0.9): void {
  if (typeof speechSynthesis === "undefined") return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = rate; if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

/** Interrompt toute lecture en cours (garde le composant à distance de speechSynthesis brut). */
export function stopSpeaking(): void {
  if (typeof speechSynthesis === "undefined") return;
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}
/** The Japanese text to speak for a question: the listening script (or the stem) for ecoute,
 *  else the sentence rebuilt from the grammar decomposition `g`. Pure. */
export function speechTextFor(question: Question): string {
  if (question.cat === "ecoute") {
    return typeof question.script === "string" && question.script ? question.script : question.q;
  }
  return sentenceFromG(question.g ?? question.q);
}

/** Speak a question's Japanese aloud (no-op when speech synthesis is unavailable). */
export function speakQuestion(question: Question, rate = 0.9): void {
  speak(speechTextFor(question), rate);
}
