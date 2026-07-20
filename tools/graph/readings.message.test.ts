import { test, expect } from "bun:test";
import { messageAbsence } from "./readings.mjs";

test("sans proposition : renvoie vers fetch + propose", () => {
  const m = messageAbsence({ propositionsMots: false, propositionsKanji: false }).join("\n");
  expect(m).toContain("fetch.mjs");
  expect(m).toContain("propose.mjs");
});

test("AVEC les propositions déjà produites : ne renvoie PAS les relancer", () => {
  // Régression : le message envoyait régénérer un document déjà présent, alors que
  // l'étape manquante est l'ARBITRAGE — une saisie à la main, que propose.mjs ne fait pas.
  const m = messageAbsence({ propositionsMots: false, propositionsKanji: true }).join("\n");
  expect(m).not.toContain("bun tools/kanjidic/fetch.mjs");
  expect(m).toContain("kanji-a-arbitrer.md");
  expect(m).toContain("data/lectures-kanji-arbitrees.json");
});

test("le message nomme l'étape humaine, pas seulement le fichier", () => {
  const m = messageAbsence({ propositionsMots: true, propositionsKanji: true }).join("\n");
  expect(m.toLowerCase()).toContain("relire");
  expect(m).toContain("TES décisions");
  // Ne promet PAS un « bloc prêt à coller » : le document des mots n en a pas, seulement
  // un tableau. Un message qui décrit une section inexistante renvoie chercher dans le vide.
  expect(m).not.toContain("prêt à coller");
});
