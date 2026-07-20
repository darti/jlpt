import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupDict, applyDictData, initDefs, furi, wordsToDict, visualBreak } from "./dict.ts";

type W = Record<string, unknown>;
const origFetch = globalThis.fetch;

beforeEach(() => {
  const w = window as unknown as W;
  for (const k of ["furi", "visualBreak", "initDefs", "hideDef", "jlptSay"]) delete w[k];
});
afterEach(() => { globalThis.fetch = origFetch; });

test("setupDict alimente furi() depuis word.jsonld", async () => {
  applyDictData({});
  globalThis.fetch = (async () => new Response(JSON.stringify({
    "@graph": [{ "@id": "jlpt:word/本", "@type": "jlpt:Word",
                 "schema:name": "本", "jlpt:reading": "ほん", "schema:description": "livre" }],
  }))) as unknown as typeof fetch;
  await setupDict("data/graph/word.jsonld");
  expect(furi("本")).toContain(">ほん</span>"); // data came from the fetch
});

test("wordsToDict projette les sujets jlpt:Word vers la Dict interne", () => {
  const d = wordsToDict([
    { "schema:name": "本", "jlpt:reading": "ほん", "schema:description": "livre" },
    { "schema:name": "謎" },                                    // ni lecture ni sens
    { "jlpt:reading": "orpheline" },                            // sans nom → ignorée
  ]);
  expect(d["本"]).toEqual({ r: "ほん", m: "livre" });
  expect(d["謎"]).toEqual({});
  expect(Object.keys(d)).toHaveLength(2);
});

test("setupDict n'expose en globales que les handlers inline du popup", async () => {
  globalThis.fetch = (async () => new Response("{}")) as unknown as typeof fetch;
  await setupDict("data/graph/word.jsonld");
  const w = window as unknown as W;
  // Le popup de définition est du HTML brut avec des `onclick="hideDef()"` / `jlptSay()`.
  expect(typeof w.hideDef).toBe("function");
  expect(typeof w.jlptSay).toBe("function");
  // furi/visualBreak/initDefs sont importés directement par les composants — plus de globale.
  expect(w.furi).toBeUndefined();
  expect(w.visualBreak).toBeUndefined();
  expect(w.initDefs).toBeUndefined();
});

test("initDefs attaches gesture handlers without throwing and creates the popup", () => {
  applyDictData({ "本": { r: "ほん", m: "livre" } });
  expect(() => initDefs({ singleTap: true })).not.toThrow();
  expect(document.getElementById("defPop")).not.toBeNull();
});

test("setupDict degrades gracefully when the fetch fails (handlers still installed)", async () => {
  applyDictData({}); // le DICT est un état de module partagé par tout le fichier — l'isoler
  globalThis.fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  await setupDict("data/graph/word.jsonld");
  expect(typeof (window as unknown as W).hideDef).toBe("function");
  expect(furi("本")).toBe("本"); // hors ligne : dico vide → texte brut, sans planter
});

// --- tap-pour-définir sur la nouvelle enveloppe --------------------------------

test("jpRunAt prend le MOT entier quand on tape dans une annotation", () => {
  // Régression 16ca9cc : sur WebKit le caret résout au kanji sous le doigt, donc taper
  // 優勝 rendait 優 seul. La garde cherchait `closest("ruby")` ; l'enveloppe est désormais
  // `.furi`. Sans ce suivi, la régression revient à l'identique.
  applyDictData({ "優勝": { r: "ゆうしょう", m: "victoire" } });
  document.body.innerHTML = `<p id="p">${furi("優勝")}</p>`;
  const enveloppe = document.querySelector(".furi");
  expect(enveloppe).not.toBeNull();
  // La base est le dernier nœud texte de l'enveloppe — c'est d'elle que le mot est tiré.
  const base = [...enveloppe!.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
  expect(base).toBe("優勝");
  // Et l'annotation n'en fait pas partie.
  expect(base).not.toContain("ゆうしょう");
});

test("visualBreak rubifie l'analyse avec la même enveloppe", () => {
  applyDictData({ "影響": { r: "えいきょう", m: "influence" } });
  const html = visualBreak("影響 «influence» · を «COD»");
  expect(html).toContain('class="furi"');
  expect(html).not.toContain("<ruby>");
  expect(html).not.toContain("<rt>");
});

test("visualBreak convertit AUSSI les lectures inline de l analyse", () => {
  // Chemin distinct de furi() : rubifyAnalyse a sa propre regex pour « 健康（けんこう） »,
  // y compris sur les mots à okurigana (少しずつ, 良い) que furi() ne couvre pas.
  applyDictData({});
  const html = visualBreak("健康（けんこう） «santé» · 走る（はしる） «courir»");
  expect(html).toContain(">けんこう</span>");
  expect(html).toContain(">はしる</span>");
  expect(html).not.toContain("<ruby>");
  expect(html).not.toContain("<rt>");
  expect(html).not.toContain("（けんこう）"); // les parenthèses disparaissent de la vue
});
