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
// ⚠ Revue de fiabilité (post-Task 1) — trois motifs resserrés après mesure sur le corpus réel :
// - `lecture-erronee` : le motif `erreur ?:` est un attrape-tout. Sans garde, il capturait
//   aussi des notes de SENS de kanji (« erreur : 長 ne signifie pas « court » »,
//   « erreur : « école » ne correspond pas à 高校 ») qui ne parlent pas de lecture — 427 notes
//   sur 9 444 dans q-kanji, 100 % mal classées. Exclu désormais via lookahead : `erreur ?:` ne
//   matche plus si la note contient aussi « ne signifie pas », « ne correspond pas » ou
//   « est un sens ». Les notes « ne signifie pas » retombent sur `sens-different` (le mot
//   « signifie » y matche déjà) ; les notes « ne correspond pas » retombent sur `autre` (aucun
//   motif ne les couvre spécifiquement) — les deux sont des corrections valides, seul le FAUX
//   type (lecture-erronee) était un défaut.
// - `registre` : `poli` et `registre` n'avaient pas de limite de mot, d'où des faux positifs
//   par sous-chaîne (« politique » → poli, « enregistreur » → registre) ET par glose française
//   citée entre guillemets/parenthèses (« 帳（ちょう）« registre » : confusion visuelle 張/帳 » —
//   « registre » y est la TRADUCTION du kanji, pas le type de piège). Les cinq mots-clés
//   (`registre`, `poli`, `neutre`, `familier`, `honorifique(s)`) sont maintenant bornés par
//   `\b` et exclus quand ils sont immédiatement suivis d'une parenthèse ou d'un guillemet
//   fermants — la marque d'une glose citée, jamais d'une raison de piège dans ce corpus.
//   Un résidu documenté subsiste (ex. « suffixe familier (garçon) » = くん, sans « : raison »)
//   où le mot-clé apparaît hors de portée immédiate de la fermeture ; trop rare (1 note) pour
//   justifier une règle supplémentaire, et le pire qu'il produise est un type sur une glose
//   pure sans texte de raison — acceptable au regard du principe ci-dessus.
// - `longueur-voyelle` : `manquant` seul (sans `voyelle`/`allong`/`contraction`) capturait des
//   notes sans aucun rapport avec une longueur de voyelle : de l'okurigana manquant (une
//   question d'écriture, pas de lecture — « はじめ : okurigana る manquant ») et un préfixe
//   honorifique manquant (un registre, pas une longueur — « ちそう : forme tronquée (ご-
//   honorifique manquant) », qui aurait dû matcher `registre`). `manquant` est désormais exclu
//   quand la note mentionne `okurigana` ou une racine `honorifi` ailleurs dans la note. Les
//   notes de gémination/sokuon (« sokuon manquant ») restent en `longueur-voyelle` : la
//   gémination touche au compte de mores, cousine de la longueur vocalique, et la taxonomie ne
//   porte pas de type dédié — un jugement documenté, pas un oubli.
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
  ["lecture-erronee", /lecture erron|lecture fausse|mauvaise lecture|lecture approximative|erreur ?:(?!.*(?:ne signifie pas|ne correspond pas|est un sens))/i],
  ["lecture-autre-mot", /lecture de |est la lecture d|lecture du mot|se lit .{1,6}, pas/i],
  ["longueur-voyelle", /voyelle|son long|allong|contraction|^(?!.*okurigana)(?!.*honorifi).*manquant/i],
  ["nuance-grammaticale", /exprime|valeur |conditionnel|simultanéité|but\b|énumération|hypothét|nuance/i],
  ["sens-different", /sens différent|sens voisin|autre sens|signifie|sens proche|autre mot|hors sujet|hors contexte/i],
  ["registre", /\bregistre\b(?!\s*[)）»])|\bpoli\b(?!\s*[)）»])|\bneutre\b(?!\s*[)）»])|\bfamilier\b(?!\s*[)）»])|\bhonorifiques?\b(?!\s*[)）»])/i],
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
