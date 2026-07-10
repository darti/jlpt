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
export function speak(text: string): void {
  if (typeof speechSynthesis === "undefined") return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP"; u.rate = 0.9; if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}
export function stopSpeak(): void {
  try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch { /* ignore */ }
}
