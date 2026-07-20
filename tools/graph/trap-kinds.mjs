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
//   « erreur : « école » ne correspond pas à 高校 ») qui ne parlent pas de lecture — mesuré à
//   535 occurrences de note de distracteur (482 notes UNIQUES) sur les 9 444 occurrences que
//   compte q-kanji, 100 % mal classées avant garde. Exclu désormais via lookahead : `erreur ?:`
//   ne matche plus si la note contient aussi « ne signifie pas », « ne correspond pas » ou
//   « est un sens ». Les notes « ne signifie pas » retombent sur `sens-different` (le mot
//   « signifie » y matche déjà) ; les notes « ne correspond pas » retombent sur `autre` (aucun
//   motif ne les couvre spécifiquement) — les deux sont des corrections valides, seul le FAUX
//   type (lecture-erronee) était un défaut.
// - `registre` (v1, remplacée en seconde revue — voir plus bas) : `poli` et `registre`
//   n'avaient pas de limite de mot, d'où des faux positifs par sous-chaîne (« politique » →
//   poli, « enregistreur » → registre) ET par glose française citée entre guillemets/
//   parenthèses (« 帳（ちょう）« registre » : confusion visuelle 張/帳 » — « registre » y est la
//   TRADUCTION du kanji, pas le type de piège). Un garde par parenthèse/guillemet fermants
//   avait été ajouté ici, puis retiré : il excluait AUSSI l'annotation de registre elle-même
//   quand elle est le signal du piège — régression corrigée en seconde revue, cf. plus bas.
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
// ⚠ Seconde revue — trois défauts supplémentaires trouvés et mesurés sur le corpus réel :
// - `registre` (v2) : le garde v1 ci-dessus — exclure quand le mot-clé est immédiatement suivi
//   d'une parenthèse/d'un guillemet fermants — était TROP LARGE. Il visait la glose de kanji
//   (« 帳（ちょう）« registre » : … ») mais écartait aussi l'annotation de registre quand elle
//   EST le signal du piège, au format « « X (neutre/poli/honorifique) » = distracteur »
//   (mesuré : « « où (neutre) » = どこ » et « « j'ai compris (neutre) » = わかりました »,
//   bonnes réponses どちら « lequel, où (poli) » et かしこまりました « bien compris (poli) » —
//   7 notes uniques concernées au total). Les deux usages partagent la même syntaxe locale
//   (mot-clé suivi d'un crochet fermant) ; ce qui les distingue est ce qui suit ENSUITE : la
//   glose fautive continue toujours par « : raison » (« … » : confusion visuelle 張/帳 »),
//   l'annotation de registre par « = distracteur ». Le garde ne regarde donc plus le caractère
//   immédiatement après le mot-clé, mais si le(s) crochet(s) fermant(s) qui suivent mènent à un
//   DEUX-POINTS — auquel cas c'est une glose, à exclure — jamais s'ils mènent à un signe égal.
//   Mesuré avant/après sur les deux shards : les 3 gloses fautives connues du corpus (帳, 籍, et
//   un « registre » seul déjà intercepté par kanji-confondu) restent hors du type `registre`,
//   et les 7 notes citées y basculent bien, sans perte ailleurs.
// - `nuance-grammaticale` : le motif `but\b` matchait aussi « début » et « tribut » — en
//   JavaScript, `\b` est une frontière `\w`/non-`\w`, et `\w` = `[A-Za-z0-9_]` ne couvre PAS les
//   lettres accentuées : `é` compte comme non-mot, donc `\bbut\b` voit une frontière fictive
//   juste avant le « but » de « début ». Passer les regex en flag `u` NE CORRIGE RIEN (`u` ne
//   redéfinit pas `\w`) — le correctif est une garde explicite sur les lettres accentuées :
//   `(?<![A-Za-zÀ-ÿ])but(?![A-Za-zÀ-ÿ])`. Mesuré : 7 notes de vocabulaire captées à tort
//   (« カレー « curry » : début identique », « ノック « toc-toc, frapper » : début identique »,
//   etc.) retombent en `autre` (6) ou `sens-different` (1, « カーペット … : début カー- proche,
//   sens différent » — le motif sens-different y matchait déjà, simplement masqué par l'ordre
//   des motifs) ; le seul vrai « but » du corpus (« « but, arrivée » = ゴール ») continue de
//   matcher, de même que le « tribut » qui matchait par le même bug. Défaut systémique en
//   principe — les autres mots-clés `\b`-délimités (`poli`, `neutre`, `familier`,
//   `honorifique(s)`) ont la même faiblesse théorique — mais mesuré SANS AUCUN CAS RÉEL dans le
//   corpus (aucun « dépoli », « déneutre » ou équivalent) : aucune garde ajoutée là où rien ne
//   le justifie, conformément au principe « mesuré, jamais deviné ».
// - `graphie-inexistante` : le mot-clé nu `inexistant` (sans `graphie`/`mot`/`forme` devant)
//   capturait aussi des notes de LECTURE inexistante (« lecture inexistante ici »,
//   « lecture on inexistante pour 愛 ») — une lecture qui n'existe pas n'est pas une graphie
//   qui n'existe pas. Mesuré : 9 notes concernées, TOUTES mal classées avant correctif. Exclu
//   via un lookbehind à longueur variable (`lecture[\s\S]*` avant `inexistant`) : sur ces 9,
//   une (« erreur : さん lecture inexistante ici ») retombe sur `lecture-erronee` (« erreur ?: »
//   y matche), une (« あん : lecture on inexistante pour 愛 ») sur `lecture-on-kun`
//   (« lecture on » y matche), les 7 autres sur `autre` faute de motif dédié. Les 121 autres
//   notes du corpus qui s'appuient sur le mot-clé nu (confusions de kanji, formes/conjugaisons
//   inexistantes) ne mentionnent jamais « lecture » et restent inchangées.
//
// Zéro dépendance, exécuté par `bun`.

/** Motifs, du plus spécifique au plus général. */
const MOTIFS = [
  ["kanji-partage", /partage(nt)? [一-鿿]|partage le kanji|même kanji|contient [一-鿿]/],
  ["voisement", /voisement|dakuten|handakuten|sonoris|assimilation phonétique|devient .{1,3} devant/i],
  ["graphie-inexistante", /graphie inexistante|n'existe pas|mot inexistant|forme inexistante|(?<!lecture[\s\S]*)inexistant|parasite|fausse\)/i],
  ["kanji-confondu", /confond avec|se confond|confusion avec|autre kanji/i],
  ["forme-proche", /forme proche|ressemble|graphie proche|se ressemble|proche graphiquement/i],
  ["homophone", /homophone|m[êe]me lecture|même son/i],
  ["lecture-on-kun", /lecture on|on.?yomi|lecture kun|kun.?yomi|on\/kun/i],
  ["lecture-erronee", /lecture erron|lecture fausse|mauvaise lecture|lecture approximative|erreur ?:(?!.*(?:ne signifie pas|ne correspond pas|est un sens))/i],
  ["lecture-autre-mot", /lecture de |est la lecture d|lecture du mot|se lit .{1,6}, pas/i],
  ["longueur-voyelle", /voyelle|son long|allong|contraction|^(?!.*okurigana)(?!.*honorifi).*manquant/i],
  ["nuance-grammaticale", /exprime|valeur |conditionnel|simultanéité|(?<![A-Za-zÀ-ÿ])but(?![A-Za-zÀ-ÿ])|énumération|hypothét|nuance/i],
  ["sens-different", /sens différent|sens voisin|autre sens|signifie|sens proche|autre mot|hors sujet|hors contexte/i],
  ["registre", /\bregistre\b(?!(?:\s*[)）»])+\s*:)|\bpoli\b(?!(?:\s*[)）»])+\s*:)|\bneutre\b(?!(?:\s*[)）»])+\s*:)|\bfamilier\b(?!(?:\s*[)）»])+\s*:)|\bhonorifiques?\b(?!(?:\s*[)）»])+\s*:)/i],
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
