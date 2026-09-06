#!/usr/bin/env node
// Compose une bande « ordre des traits » par kanji, dans .kanjivg/traits/ — GITIGNORÉ.
//
// Une image par kanji, une case par trait : la case i montre les traits 1..i, le dernier
// en noir, les précédents en gris pâle. C'est la seule forme qui apprend quelque chose —
// un caractère annoté de numéros se lit une fois qu'on connaît déjà l'ordre.
//
// ⚠ Licence : cf. l'en-tête de tools/kanjivg/fetch.mjs. Ces tracés viennent de KanjiVG
// (CC BY-SA 3.0). Ils ne vont PAS dans data/graph/ : ils restent hors dépôt et ne sont
// incorporés qu'au PDF, qui porte la page de crédits correspondante.
//
// Les traits sont partagés par `<defs>` + `<use>` : sans ça, un caractère de 22 traits
// répéterait ses tracés 253 fois et la bande pèserait dix fois plus lourd.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { XML } from "./fetch.mjs";

const SORTIE = ".kanjivg/traits";
const GRAPHE = "data/graph/kanji.jsonld";

// Le canevas KanjiVG fait 109 x 109 ; on garde ses unités et on juxtapose les cases.
const COTE = 109;
// ⚠ Calés pour l'e-ink : la dalle écrase vers le blanc tout ce qui dépasse ~75 %
// de luminance. Les traits déjà posés étaient à 79 % et le cadre à 89 % —
// lisibles à la relecture sur écran, invisibles sur l'appareil.
const ENCRE = "#000000";
const PASSE = "#9a9a9a";
const CADRE = "#b4b4b4";

export function cle(caractere) {
  return caractere.codePointAt(0).toString(16).padStart(5, "0");
}

// Les tracés d'UN kanji, dans l'ordre du document — qui EST l'ordre des traits.
export function traits(xml, id) {
  const debut = xml.indexOf(`<kanji id="kvg:kanji_${id}"`);
  if (debut < 0) return [];
  const fin = xml.indexOf("</kanji>", debut);
  const bloc = xml.slice(debut, fin);
  return [...bloc.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
}

export function bande(ds) {
  const n = ds.length;
  const defs = ds.map((d, i) => `<path id="s${i}" d="${d}"/>`).join("");
  const cases = ds.map((_, i) => {
    const x = i * COTE;
    const passes = ds
      .slice(0, i)
      .map((_, j) => `<use href="#s${j}" stroke="${PASSE}"/>`)
      .join("");
    return (
      `<g transform="translate(${x},0)">` +
      `<rect x="1.5" y="1.5" width="${COTE - 3}" height="${COTE - 3}" fill="none" stroke="${CADRE}" stroke-width="1.5"/>` +
      passes +
      `<use href="#s${i}" stroke="${ENCRE}"/>` +
      `</g>`
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"` +
    ` width="${n * COTE}" height="${COTE}" viewBox="0 0 ${n * COTE} ${COTE}">` +
    `<!-- Tracés : KanjiVG (c) Ulrich Apel, CC BY-SA 3.0 — https://kanjivg.tagaini.net/ -->` +
    `<defs><g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${defs}</g></defs>` +
    `<g fill="none" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${cases.join("")}</g>` +
    `</svg>`
  );
}

function main() {
  if (!existsSync(XML)) {
    console.error(`✗ ${XML} absent — lancer d'abord : bun tools/kanjivg/fetch.mjs`);
    return 1;
  }
  const xml = readFileSync(XML, "utf8");
  const kanji = JSON.parse(readFileSync(GRAPHE, "utf8"))["@graph"]
    .filter((k) => k["@type"] === "jlpt:Kanji")
    .map((k) => k["schema:name"]);

  mkdirSync(SORTIE, { recursive: true });
  const absents = [];
  const faits = [];
  let octets = 0;
  let maxi = 0;
  for (const c of kanji) {
    const ds = traits(xml, cle(c));
    if (ds.length === 0) {
      absents.push(c);
      continue;
    }
    // Le nombre de traits sert au livre à dimensionner la bande : c'est lui qui
    // décide de la largeur d'une case, et le relire depuis le SVG serait absurde.
    faits.push([c, { f: cle(c), n: ds.length }]);
    maxi = Math.max(maxi, ds.length);
    const svg = bande(ds);
    octets += svg.length;
    writeFileSync(`${SORTIE}/${cle(c)}.svg`, svg);
  }
  // Un index, parce que Typst ne sait pas demander si un fichier existe : le livre lit
  // cette liste et ne compose un diagramme que pour les caractères qui y figurent.
  writeFileSync(
    `${SORTIE}/index.json`,
    JSON.stringify(Object.fromEntries(faits), null, 1) + "\n",
  );
  console.log(`✓ ${faits.length} bandes dans ${SORTIE}/ (${(octets / 1048576).toFixed(1)} Mo, max ${maxi} traits)`);
  if (absents.length > 0) console.log(`  ${absents.length} kanji sans tracé : ${absents.join("")}`);
  console.log("  Tracés : KanjiVG, Ulrich Apel, CC BY-SA 3.0 — hors dépôt, non commités.");
  return 0;
}

if (process.argv[1]?.endsWith("strips.mjs")) process.exit(await main());
