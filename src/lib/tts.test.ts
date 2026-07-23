import { test, expect } from "bun:test";
import { sentenceFromG, speak, speakQuestion, speechTextFor, stopSpeaking } from "./tts.ts";
import type { Question } from "../types/quiz.ts";

// Stub de la Web Speech API (absente de happy-dom) qui capture le débit de chaque utterance —
// même patron que SpeakButton.test.tsx, étendu pour vérifier la PROPAGATION du débit (une
// inversion d'argument speakQuestion→speak passerait sinon inaperçue, cf. revue Task 2).
type SpeechStub = { spoken: { text: string; rate: number }[]; cancels: number };
function installSpeech(): SpeechStub {
  const stub: SpeechStub = { spoken: [], cancels: 0 };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    class { text: string; lang = ""; rate = 1; voice: unknown = null; constructor(t: string) { this.text = t; } };
  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    cancel() { stub.cancels += 1; },
    speak(u: { text: string; rate: number }) { stub.spoken.push({ text: u.text, rate: u.rate }); },
    getVoices() { return []; },
  };
  return stub;
}
function uninstallSpeech() {
  delete (globalThis as unknown as Record<string, unknown>).speechSynthesis;
  delete (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
}

test("sentenceFromG strips French glosses «…», keeps the post-→ form, drops furigana (…)", () => {
  // one segment: "帰る（かえる）→帰ったら «conditionnel»" → "帰ったら"
  expect(sentenceFromG("帰る（かえる）→帰ったら «conditionnel»")).toBe("帰ったら");
});

test("sentenceFromG joins ' · '-separated segments", () => {
  expect(sentenceFromG("音楽（おんがく）«musique» · を «COD»")).toBe("音楽を");
});

test("sentenceFromG on empty input returns empty string", () => {
  expect(sentenceFromG("")).toBe("");
});

test("speechTextFor uses the listening script for ecoute questions", () => {
  const q: Question = { id: 1, cat: "ecoute", d: 1, q: "stem", o: [], a: 0, script: "きいてください" };
  expect(speechTextFor(q)).toBe("きいてください");
});
test("speechTextFor falls back to the stem for ecoute without a script", () => {
  const q: Question = { id: 1, cat: "ecoute", d: 1, q: "stem", o: [], a: 0 };
  expect(speechTextFor(q)).toBe("stem");
});
test("speechTextFor rebuilds the sentence from g for non-ecoute questions", () => {
  const q: Question = { id: 1, cat: "grammaire", d: 1, q: "stem", o: [], a: 0, g: "帰る→帰ったら «cond»" };
  expect(speechTextFor(q)).toBe("帰ったら");
});
test("speechTextFor uses the stem (via sentenceFromG) when g is absent, non-ecoute", () => {
  const q: Question = { id: 1, cat: "vocabulaire", d: 1, q: "音楽（おんがく）«musique»", o: [], a: 0 };
  expect(speechTextFor(q)).toBe("音楽");
});

test("speak avec un débit ne jette pas quand speechSynthesis est absent", () => {
  expect(() => speak("こんにちは", 0.7)).not.toThrow();
  expect(() => speak("こんにちは")).not.toThrow(); // défaut
});

test("stopSpeaking ne jette pas quand speechSynthesis est absent", () => {
  expect(() => stopSpeaking()).not.toThrow();
});

test("speechTextFor (écoute) rend le script, inchangé", () => {
  const q = { id: 1, cat: "ecoute", d: 1, q: "?", o: ["a"], a: 0, script: "駅はどこ" } as Question;
  expect(speechTextFor(q)).toBe("駅はどこ");
});

test("speak PROPAGE le débit à l'utterance (défaut 0.9)", () => {
  const stub = installSpeech();
  try {
    speak("x", 0.7);
    speak("y"); // défaut
    expect(stub.spoken).toEqual([{ text: "x", rate: 0.7 }, { text: "y", rate: 0.9 }]);
  } finally { uninstallSpeech(); }
});

test("speakQuestion (écoute) propage le débit ET prononce le script", () => {
  const stub = installSpeech();
  try {
    const q = { id: 1, cat: "ecoute", d: 1, q: "?", o: ["a"], a: 0, script: "駅はどこ" } as Question;
    speakQuestion(q, 1.0);
    expect(stub.spoken).toEqual([{ text: "駅はどこ", rate: 1.0 }]);
  } finally { uninstallSpeech(); }
});

test("stopSpeaking appelle bien speechSynthesis.cancel()", () => {
  const stub = installSpeech();
  try {
    stopSpeaking();
    expect(stub.cancels).toBeGreaterThanOrEqual(1);
  } finally { uninstallSpeech(); }
});
