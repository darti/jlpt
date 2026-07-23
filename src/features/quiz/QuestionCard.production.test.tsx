import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestionCard } from "./QuestionCard.tsx";
import { applyDictData } from "../../lib/dict.ts";
import type { Question } from "../../types/quiz.ts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const vocab: Question = { id: 1, cat: "vocabulaire", d: 1, q: "約束", o: ["やくそく", "やくそぐ", "やくぞく", "やくそ"], a: 0 };
const kanjiAns: Question = { id: 2, cat: "vocabulaire", d: 1, q: "えいきょう", o: ["影響", "映像", "反響", "影像"], a: 0 };

test("SSR : production + éligible rend un champ, pas les boutons d'option", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />,
  );
  expect(html).toContain("Tapez la lecture");
  expect(html).not.toContain("やくそぐ"); // aucun distracteur affiché
});

test("SSR : production mais réponse en kanji (non éligible) → QCM classique", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={kanjiAns} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />,
  );
  expect(html).not.toContain("Tapez la lecture"); // pas de champ de saisie
  expect(html).not.toContain("<input");           // aucun input texte → mode QCM
  // Options rendues comme boutons. Assertion INVARIANTE au furigana : `furi()` scinde un mot
  // kanji absent du DICT en spans par kanji (映像 → 映 + 像) selon l'état du DICT partagé entre
  // fichiers de test — ne JAMAIS asserter le kanji brut d'une option rendue par furi (flake CI).
  expect(html).toContain('type="button"');
});

test("régression flake CI : DICT peuplé scinde une option kanji, le mode QCM tient", () => {
  // Reproduit l'état exact qui a cassé la CI : lectures mono-kanji propres, mot 映像 ABSENT du
  // DICT → furi rend 映像 en deux spans (映 + 像). Le DICT est un état de module PARTAGÉ entre
  // fichiers de test ; l'ordre d'exécution décide s'il est peuplé → l'ancien toContain("映像")
  // flakait. On peuple explicitement, on vérifie que la scission a lieu ET que les assertions
  // structurelles (mode QCM) tiennent malgré elle, puis on RÉINITIALISE pour isoler les autres.
  applyDictData({ "影響": { r: "えいきょう" }, "映": { r: "えい" }, "像": { r: "ぞう" } });
  try {
    const html = renderToStaticMarkup(
      <QuestionCard question={kanjiAns} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />,
    );
    expect(html).not.toContain("映像");        // furi a bien scindé → l'ancienne assertion aurait échoué
    expect(html).not.toContain("<input");       // structurel : mode QCM, pas de champ
    expect(html).toContain('type="button"');    // structurel : options rendues
  } finally {
    applyDictData({}); // isole l'état partagé (cf. gotcha CLAUDE.md « isoler l'état partagé »)
  }
});

test("SSR : sans production (QCM) l'éligible affiche quand même les options", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} />,
  );
  expect(html).not.toContain("Tapez la lecture");
  expect(html).toContain("やくそぐ");
});

test("SSR corrigé production JUSTE : « Votre réponse » + saisie + ✓", () => {
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={0} answered={true} onChoose={() => {}} onSpeak={() => {}} production={true} typed="やくそく" />,
  );
  expect(html).toContain("Votre réponse");
  expect(html).toContain("✓");
});

test("SSR corrigé production FAUSSE : la saisie distincte est affichée + ✗", () => {
  // typed="ばつ" n'est AUCUNE option → prouve que c'est bien le span de saisie, pas une option.
  const html = renderToStaticMarkup(
    <QuestionCard question={vocab} chosen={null} answered={true} onChoose={() => {}} onSpeak={() => {}} production={true} typed="ばつ" />,
  );
  expect(html).toContain("Votre réponse");
  expect(html).toContain("ばつ");
  expect(html).toContain("✗");
});

test("submit à vide n'appelle PAS onSubmitTyped", () => {
  const calls: string[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={(t) => calls.push(t)} />);
  });
  const form = div.querySelector("form") as HTMLFormElement;
  act(() => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(calls).toEqual([]); // champ vide → bloqué
  act(() => root.unmount());
  div.remove();
});

test("le champ se vide au changement de question", () => {
  const other: Question = { id: 3, cat: "kanji", d: 1, q: "海", o: ["うみ", "やま", "かわ", "そら"], a: 0 };
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    root.render(<QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />);
  });
  const input = () => div.querySelector("input") as HTMLInputElement;
  act(() => {
    nativeSetter?.call(input(), "やくそく");
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input().value).toBe("やくそく");
  act(() => {
    root.render(<QuestionCard question={other} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={() => {}} />);
  });
  expect(input().value).toBe(""); // effet [question.id] → remise à zéro
  act(() => root.unmount());
  div.remove();
});

test("saisie + submit appelle onSubmitTyped avec le texte", () => {
  const calls: string[] = [];
  const div = document.createElement("div"); document.body.appendChild(div);
  const root = createRoot(div);
  act(() => {
    root.render(<QuestionCard question={vocab} chosen={null} answered={false} onChoose={() => {}} onSpeak={() => {}} production={true} onSubmitTyped={(t) => calls.push(t)} />);
  });
  const input = div.querySelector("input") as HTMLInputElement;
  const form = div.querySelector("form") as HTMLFormElement;
  // React piste la valeur via `_valueTracker` : régler `.value` directement le laisse croire
  // que rien n'a changé → onChange muet. Passer par le setter natif du prototype le réveille.
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    nativeSetter?.call(input, "やくそく");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(calls).toEqual(["やくそく"]);
  act(() => root.unmount());
  div.remove();
});
