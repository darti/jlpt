#!/usr/bin/env node
// Classe une note d'option (`jlpt:optionNote`) en TYPE DE PIÈGE.
//
// Les motifs ne devinent rien : chacun reprend une formule que l'auteur emploie réellement
// dans le corpus. Ce qu'aucun motif ne couvre tombe en `autre` — un type faux vaut moins
// qu'un type absent, parce qu'il s'affiche à l'apprenant comme un diagnostic.
//
// ⚠ L'ordre compte : premier motif qui matche gagne, donc du plus spécifique au plus général.
// `sens-different` et `registre` sont volontairement en fin de liste, leurs mots-clés étant
// les plus larges. `lecture-erronee` précède `lecture-autre-mot` : une note du type
// « erreur : 議 se lit ぎ, pas ご » matche aussi « se lit …, pas » (lecture-autre-mot) — sans
// cet ordre, l'erreur de lecture serait classée comme confusion avec un autre mot.
//
// Zéro dépendance, exécuté par `bun`.

/** Motifs, du plus spécifique au plus général. */
const MOTIFS = [
  ["kanji-partage", /partage(nt)? [一-鿿]|partage le kanji|même kanji|contient [一-鿿]/],
  ["voisement", /voisement|dakuten|handakuten|sonoris|assimilation phonétique|devient .{1,3} devant/i],
  ["graphie-inexistante", /graphie inexistante|n'existe pas|mot inexistant|forme inexistante|inexistant|parasite|fausse\)/i],
  ["kanji-confondu", /confond avec|se confond|confusion avec|autre kanji/i],
  ["forme-proche", /forme proche|ressemble|graphie proche|se ressemble|proche graphiquement/i],
  ["homophone", /homophone|m[êe]me lecture|même son/i],
  ["lecture-on-kun", /lecture on|on.?yomi|lecture kun|kun.?yomi|on\/kun/i],
  ["lecture-erronee", /lecture erron|lecture fausse|mauvaise lecture|lecture approximative|erreur ?:/i],
  ["lecture-autre-mot", /lecture de |est la lecture d|lecture du mot|se lit .{1,6}, pas/i],
  ["longueur-voyelle", /voyelle|son long|allong|contraction|manquant/i],
  ["nuance-grammaticale", /exprime|valeur |conditionnel|simultanéité|but\b|énumération|hypothét|nuance/i],
  ["sens-different", /sens différent|sens voisin|autre sens|signifie|sens proche|autre mot|hors sujet|hors contexte/i],
  ["registre", /registre|poli|neutre|familier|honorif/i],
];

/** La taxonomie complète — `autre` compris. Sert au contrôle d'intégrité et aux libellés. */
export const KINDS = [...MOTIFS.map(([k]) => k), "autre"];

/** Le type de piège d'une note. `autre` si aucun motif ne matche. Pur. */
export function trapKind(note) {
  const t = typeof note === "string" ? note : "";
  if (!t) return "autre";
  const hit = MOTIFS.find(([, re]) => re.test(t));
  return hit ? hit[0] : "autre";
}
