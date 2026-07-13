import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { SpeakButton } from "./SpeakButton.tsx";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SpeechStub = { spoken: string[]; cancels: number };

function installSpeech(): SpeechStub {
  const stub: SpeechStub = { spoken: [], cancels: 0 };
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    class { text: string; lang = ""; rate = 1; voice: unknown = null; constructor(t: string) { this.text = t; } };
  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    cancel() { stub.cancels += 1; },
    speak(u: { text: string }) { stub.spoken.push(u.text); },
    getVoices() { return []; },
  };
  return stub;
}
function uninstallSpeech() {
  delete (globalThis as unknown as Record<string, unknown>).speechSynthesis;
  delete (globalThis as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
}

test("SpeakButton (SSR) rend un bouton avec aria-label quand la TTS est supportée", () => {
  installSpeech();
  const html = renderToStaticMarkup(<SpeakButton text="味" />);
  expect(html).toContain("<button");
  expect(html).toContain('aria-label="Prononcer"');
  uninstallSpeech();
});

test("SpeakButton (SSR) ne rend rien si la TTS n'est pas supportée", () => {
  uninstallSpeech();
  expect(renderToStaticMarkup(<SpeakButton text="味" />)).toBe("");
});

test("SpeakButton (SSR) ne rend rien pour un texte vide", () => {
  installSpeech();
  expect(renderToStaticMarkup(<SpeakButton text="" />)).toBe("");
  uninstallSpeech();
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  uninstallSpeech();
});

test("cliquer sur SpeakButton prononce le texte fourni", () => {
  const stub = installSpeech();
  act(() => { root.render(<SpeakButton text="安ければ買います。" />); });
  const b = container.querySelector("button");
  if (!b) throw new Error("bouton SpeakButton introuvable");
  act(() => { b.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(stub.spoken).toEqual(["安ければ買います。"]);
});
