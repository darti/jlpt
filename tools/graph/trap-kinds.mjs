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
// ⚠ Troisième revue — deux défauts trouvés par relecture manuelle, plus deux collisions
// révélées PAR le correctif lui-même (mesurées, pas devinées) :
// - `kanji-confondu` : le mot-clé nu `autre kanji` capturait des notes de SENS, pas de
//   confusion VISUELLE — gabarit auteur « erreur : « X » est le sens d'un autre kanji » /
//   « erreur : « X » correspond à un autre kanji ». Mesuré : 238 notes uniques (724
//   occurrences, les deux apostrophes ' et ’ confondues) sur q-kanji, 100 % mal classées.
//   Exclu via lookbehind sur l'alternative `autre kanji` (même technique que
//   `lecture-erronee` ci-dessus, mais en lookbehind car le motif disqualifiant précède
//   « autre kanji » alors que celui de `lecture-erronee` le suit).
//   Une fois exclues de `kanji-confondu`, ces 238 notes retombent par défaut sur
//   `erreur ?:` (lecture-erronee) : FAUX type aussi, puisque ce sont des confusions de
//   sens, pas de lecture. Même garde ajoutée là, avec les deux gabarits complets cette
//   fois (« … autre kanji » entier, pas seulement « autre kanji »).
//   Deux collisions supplémentaires sont apparues UNE FOIS ces deux gardes posées — pas
//   avant, puisque `kanji-confondu`/`lecture-erronee` les interceptaient jusque-là : la
//   glose française citée entre guillemets sert aussi de mot-clé à un AUTRE motif plus
//   loin dans la liste, comme pour `registre` v2 (bug de même famille, gabarit différent) :
//   « erreur : « valeur » est le sens d'un autre kanji » matchait `valeur ` (nuance-
//   grammaticale) et « Erreur : « registre » est le sens d'un autre kanji » matchait
//   `registre` (le garde de parenthèse/deux-points de la seconde revue ne s'applique pas
//   ici : rien ne suit la glose par un deux-points, juste « est le sens… »). Gardées au cas
//   par cas, sur les deux seules occurrences mesurées — pas de garde générique ajoutée aux
//   autres mots-clés (poli/neutre/familier/honorifique) sans cas réel, même principe que le
//   bug `\bbut\b` de la seconde revue. Résultat final : les 238 notes retombent toutes en
//   `autre` (aucune ne matche `sens-different`, faute de mot-clé commun — « autre » reste un
//   résultat acceptable, seul un type FAUX ne l'est pas).
// - `nuance-grammaticale` : le mot-clé nu `nuance` capturait des notes de VOCABULAIRE parlant
//   d'une nuance de SENS, pas d'un point de grammaire — 5 notes uniques sur q-vocabulaire,
//   toutes mal classées (« ニュアンス « nuance » : début identique », « nuance différente »,
//   « autre nuance », etc.). Resserré en `nuance grammaticale` (phrase explicite requise) :
//   mesuré, aucune note du corpus n'emploie encore cette phrase exacte pour un vrai point de
//   grammaire (7 notes totales tombaient sur ce motif avant correctif, seules 5 le faisaient
//   via le mot-clé nu `nuance` — les 2 autres via `exprime`/`but`, non affectées). Les 5
//   retombent en `autre`, aucune ne matchant un autre motif (mesuré : aucune ne contient
//   « graphie proche », seulement « graphie voisine », un mot différent — donc pas de filet
//   de rattrapage sur `forme-proche` ; c'est mesuré, pas un oubli à corriger ici, hors
//   périmètre de cette revue).
//
// ⚠ Portée du resserrement `nuance grammaticale` — mesurée UNIQUEMENT sur `q-kanji` et
// `q-vocabulaire`, le périmètre du lot (`docs/superpowers/plans/2026-07-21-graphe-confusion.md`,
// « Périmètre : q-kanji.jsonld et q-vocabulaire.jsonld et eux seuls »). `trapKind` n'est PAS
// mesuré sur `q-grammaire.jsonld` : ce shard contient ~94 notes qui matchaient l'ancien mot-clé
// nu `nuance` de façon LÉGITIME (« です : affirmation neutre, sans nuance de confirmation »,
// « そう = apparence, nuance différente » — de vrais points de grammaire, pas des confusions de
// vocabulaire) et qui retomberaient en `autre` avec le motif resserré, faute de la phrase exacte
// « nuance grammaticale ». Ce n'est pas une régression DE CE LOT : `jlpt:trapKind` ne sera jamais
// posé sur `q-grammaire` (hors périmètre), donc ce chemin n'est jamais exécuté en production —
// mais si le périmètre s'étend un jour à la grammaire, ce motif devra être remesuré avant, pas
// après, un tel changement.
//
// ⚠ Le gabarit « erreur : « X » est le sens d'un autre kanji » / « … correspond à un autre
// kanji » (défaut 1 ci-dessus) est exclu à TROIS endroits : `kanji-confondu` (en lookbehind),
// `nuance-grammaticale` et `registre` (en lookahead). Il ne l'est plus dans `lecture-erronee`
// depuis la correction de cause racine ci-dessous : ce motif n'utilise plus l'attrape-tout que
// ce gabarit visait à exclure. Une future variante du gabarit (nouvelle apostrophe,
// reformulation) doit être mesurée puis répercutée aux trois restants.
//
// ⚠ CORRECTION DE CAUSE RACINE (quatrième revue) — `lecture-erronee` contenait encore
// l'attrape-tout `erreur ?:`, colmaté lookahead après lookahead depuis trois revues (défaut 1,
// « registre » v1/v2, défaut C…). Le préfixe « erreur : » est GÉNÉRIQUE dans le corpus : l'auteur
// s'en sert pour des erreurs de lecture, MAIS AUSSI de sens et de longueur de voyelle — aucun
// nombre de lookaheads ne referme cette classe de bug, seul le retrait de l'attrape-tout la
// referme. Remplacé par un motif POSITIF : `erreur ?:` ne matche plus que s'il est suivi (dans le
// reste de la note, ordre indifférent) de `lecture` ou `se lit` — sinon la note est classée par
// CE QU'ELLE DIT, via les motifs spécifiques plus loin dans la liste, pas par son préfixe. Un
// garde `(?!.*voyelle)` évite que 3 notes doublement thématiques (« voyelle courte ; la lecture
// est ヒョウ (longue) ») ne soient captées ici plutôt que par `longueur-voyelle`, plus spécifique
// pour elles.
//
// Balayage SYSTÉMATIQUE (obligatoire, pas seulement les deux gabarits déjà nommés) sur les
// 27 147 occurrences de q-kanji + q-vocabulaire, avant/après retrait de l'attrape-tout :
// - `lecture-erronee → autre` : 2336 notes / 3105 occurrences, **100 % sur q-kanji**. Bien plus
//   large que les deux gabarits mesurés au départ (signifie/sens : 53 notes ; voyelle/gémination :
//   19 notes) : l'attrape-tout absorbait AUSSI des confusions de kanji-pour-contexte
//   (« erreur : le kanji « X » ne convient pas ici », « « X » n'est pas le bon kanji ici » — 933
//   notes/1264 occ, questions à trou du type jours de la semaine/compteurs), des confusions
//   on/kun formulées sans les mots-clés littéraux de `lecture-on-kun` (« サン est le on de 三 »,
//   « なな est un kun de 七 » — ~90 occurrences), des gloses françaises en égalité
//   (« erreur : deux = 二 » — 167 notes) et une longue traîne hétéroclite. AUCUN motif existant
//   ne les décrit correctement : elles retombent en `autre`, ce qui est le résultat honnête (un
//   type ABSENT vaut mieux qu'un type FAUX) — pas une régression, puisqu'aucune n'était
//   « lecture-erronee » à raison. Non repris dans ce lot : étendre `lecture-on-kun` pour la
//   confusion on/kun serait légitime (même principe « type perdu = perte ») mais déborde le
//   périmètre de cette correction ; laissé comme piste pour une revue future, documentée ici
//   plutôt que devinée en silence.
// - `lecture-erronee → sens-different` : 406 notes / 563 occurrences. Le gabarit nommé
//   (« signifie »/« est le sens d'un autre mot », 48 notes/133 occ mesurées avec le mot-clé exact)
//   plus une famille sœur bien plus large que le même défaut cachait : « erreur : sens de 丈 »,
//   « erreur : « X » n'est pas le sens de Y » (358 notes) — mesurée non couverte par les mots-clés
//   existants de `sens-different` (aucun ne matche « sens de » nu). Ajouté `\bsens d[eu]\b` au
//   motif : mesuré sûr sur les DEUX shards (zéro collision avec un autre type, y compris les 61
//   notes `autre → sens-different` indépendantes de l'attrape-tout, capturées par le même
//   mot-clé ailleurs dans le corpus).
// - `lecture-erronee → longueur-voyelle` : 21 notes / 43 occurrences — le gabarit nommé
//   (« voyelle longue … manquante », « gémination manquante X→Y ») plus les 3 notes à double
//   thème protégées par le garde `(?!.*voyelle)` ci-dessus.
// - `autre → longueur-voyelle` : 36 notes / 36 occurrences (q-vocabulaire) — jamais dépendantes de
//   l'attrape-tout : des notes « gémination fautive/attendue/oubliée/erronée » qui ne contenaient
//   jamais `manquant` et n'étaient donc atteintes par AUCUNE branche du motif. Le commentaire de
//   la revue post-Task 1 (ligne 38 ci-dessus) documentait déjà la gémination comme cousine
//   légitime de la longueur vocalique sans jamais l'ajouter comme mot-clé littéral — fait ici
//   (`g[ée]mination` ajouté au motif).
// - `nuance-grammaticale → sens-different` : 1 note / 1 occurrence — le défaut nommé : le mot-clé
//   nu `exprime` matchait aussi « exprimer » (glose française citée entre guillemets,
//   « 表す（あらわす）« exprimer » : sens proche, lecture différente », SEULE occurrence de
//   « exprim » dans les deux shards). Corrigé par une frontière de mot finale, `\bexprime\b` :
//   bloque le match dans « exprimer » (le « r » qui suit est un caractère de mot, donc pas de
//   frontière) sans affecter le seul vrai cas du corpus (« exprime un but », suivi d'un espace).
// - Collision RÉVÉLÉE par le retrait lui-même, corrigée avant qu'elle n'atteigne le classifieur
//   final (transitoire lors de la mesure, jamais commitée telle quelle) : une fois l'attrape-tout
//   retiré, « erreur : 値 « valeur » (ne) » (q/9212, un distracteur de compteur d'objets, sens
//   pur — voir l'en-tête ci-dessus, pas une lecture) est tombée sur `nuance-grammaticale` via le
//   mot-clé `valeur `, MASQUÉE jusque-là par l'attrape-tout — même famille de bug que
//   `valeur`/`registre` (défaut 1, troisième revue), gabarit différent : une citation
//   « X » suivie d'une PARENTHÈSE courte, pas de « est le sens d'un autre kanji ». Corrigé en
//   excluant `valeur` quand il est immédiatement suivi (espace inclus, convention typographique
//   française) d'un guillemet fermant `»` — mesuré : aucune occurrence légitime de `valeur` (mot-
//   clé de nuance grammaticale) n'existe dans le corpus hors citations de glose, donc rien à
//   casser.
//
// Effet sur les cliquets de couverture (mesuré, voir trap-kinds.test.ts) : **q-kanji s'effondre
// de 81,80 % à 54,11 %** (7725/9444 → 5110/9444) — mouvement bien plus large que les « ~1 point »
// anticipés, parce que l'attrape-tout gonflait la couverture kanji de bien plus que les deux
// défauts nommés (cf. le détail des 2336 notes ci-dessus). Ce n'est pas une régression : les
// 3105 occurrences perdues n'avaient JAMAIS leur place sous `lecture-erronee`, seule leur
// disparition d'un cliquet qui ne mesure que « type ≠ autre » les rendait invisibles. q-vocabulaire
// bouge à peine (74,54 % → 74,75 %, 13196/17703 → 13233/17703) : tous les changements côté
// vocabulaire viennent des extensions `sens de`/`gémination`, l'attrape-tout n'y ayant jamais
// pesé (100 % du mouvement `lecture-erronee → autre` est sur q-kanji, zéro sur q-vocabulaire).
//
// Garde permanent (voir trap-kinds.test.ts) : les revues précédentes dépendaient d'un relecteur
// humain pour repérer une collision — `couverture()` ne peut pas la voir, elle ne mesure que
// « type ≠ autre ». Le test « aucun motif ne matche sa propre contre-marque » balaie tout le
// corpus réel et échoue si un motif capture une note portant une sous-chaîne qui prouve que son
// type est faux (contre-marques dérivées de tous les défauts ci-dessus, étendues à la correction
// de cause racine : `signifie`, `est le sens` nu, `autre mot` — gardé pour les 2 notes qui
// portent EXPLICITEMENT « lecture erronée » en toutes lettres, résolution de l'auteur lui-même,
// pas une collision —, `voyelle longue`, `gémination`, `allongement` pour `lecture-erronee` ; une
// glose « exprimer » citée pour `nuance-grammaticale`). C'est ce garde-là qui doit attraper la
// PROCHAINE collision de cette classe, pas une cinquième revue manuelle.
//
// Zéro dépendance, exécuté par `bun`.

/** Motifs, du plus spécifique au plus général. */
const MOTIFS = [
  ["kanji-partage", /partage(nt)? [一-鿿]|partage le kanji|même kanji|contient [一-鿿]/],
  ["voisement", /voisement|dakuten|handakuten|sonoris|assimilation phonétique|devient .{1,3} devant/i],
  ["graphie-inexistante", /graphie inexistante|n'existe pas|mot inexistant|forme inexistante|(?<!lecture[\s\S]*)inexistant|parasite|fausse\)/i],
  ["kanji-confondu", /confond avec|se confond|confusion avec|(?<!est le sens d['’]un )(?<!correspond à un )autre kanji/i],
  // Mauvais kanji pour le contexte : « erreur : le kanji « 火 » ne convient pas ici ». Le kanji
  // existe et se lit bien, mais ne correspond PAS au sens de la phrase — distinct de la confusion
  // visuelle (kanji-confondu) et de la graphie inexistante. Mesuré : 1222 notes sur q-kanji,
  // TOUTES en `autre` avant ce type (aucun vol), aucune coexistant avec un marqueur lecture/sens.
  ["kanji-hors-contexte", /ne convient pas/i],
  ["forme-proche", /forme proche|ressemble|graphie proche|se ressemble|proche graphiquement/i],
  ["homophone", /homophone|m[êe]me lecture|même son/i],
  ["lecture-on-kun", /lecture on|on.?yomi|lecture kun|kun.?yomi|on\/kun/i],
  ["lecture-erronee", /lecture erron|lecture fausse|mauvaise lecture|lecture approximative|erreur ?:(?=[\s\S]*(?:lecture|se lit))(?!.*voyelle)/i],
  ["lecture-autre-mot", /lecture de |est la lecture d|lecture du mot|se lit .{1,6}, pas/i],
  ["longueur-voyelle", /voyelle|g[ée]mination|son long|allong|contraction|^(?!.*okurigana)(?!.*honorifi).*manquant/i],
  ["nuance-grammaticale", /\bexprime\b|valeur (?!»)(?!.*(?:est le sens d['’]un autre kanji|correspond à un autre kanji))|conditionnel|simultanéité|(?<![A-Za-zÀ-ÿ])but(?![A-Za-zÀ-ÿ])|énumération|hypothét|nuance grammaticale/i],
  ["sens-different", /sens différent|sens voisin|autre sens|signifie|sens proche|autre mot|hors sujet|hors contexte|\bsens d[eu]\b/i],
  ["registre", /\bregistre\b(?!(?:\s*[)）»])+\s*:)(?!.*(?:est le sens d['’]un autre kanji|correspond à un autre kanji))|\bpoli\b(?!(?:\s*[)）»])+\s*:)|\bneutre\b(?!(?:\s*[)）»])+\s*:)|\bfamilier\b(?!(?:\s*[)）»])+\s*:)|\bhonorifiques?\b(?!(?:\s*[)）»])+\s*:)/i],
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
