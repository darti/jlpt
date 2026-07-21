# Lot 1 — graphe JSON-LD (feat/data-graph)

Plan : docs/superpowers/plans/2026-07-20-graphe-lot1-socle.md (11 tâches)
Pré-vol : 4 défauts du plan corrigés avant exécution (commit ci-dessous).

Task 1: complete (commits c42241d..e928b7f, 14 tests, revue traitée)
Task 1: complete (c42241d..d2ac56c, 19 tests, 4 defauts de revue corriges)
Task 2: complete (5daf48e, 8 tests)
Task 3: complete (12f5f50, 19 tests)
Task 4: complete (1e0ac41, 27 tests shacl+shapes, bug alias corrige)
Tasks 5-6: complete (8898e27, 17 tests, verifies sur bank.json reel)
Task 7: complete (1b77d52, 3 tests exit-code, CI cablee)
Task 8: complete (e2e9945, entites generees, 280 conflits a arbitrer)
JMdict: propositions generees (137/180 du trou reel), rien de redistribue
Tasks 9+11: complete (612735b, 10307 questions, 59.1% aretes, graphe valide)
Task 10: complete (1d3eaea) — LOT 1 TERMINE, 16072 sujets, graphe valide

# Lot confusion — feat/graphe-confusion

Plan : docs/superpowers/plans/2026-07-21-graphe-confusion.md (7 taches)
Pre-vol : tsconfig ne couvre que src+scripts (import .mjs sur tools OK). Task 5 etape 2 = garde-fou, peut passer d emblee.
Base de branche : 47f02ed
Task 1: revue = 1 Critique (erreur ?: avalait 427 notes de SENS en lecture-erronee), 1 Important (poli/registre sans limite de mot), 1 Mineur = DEFAUT DU PLAN (le cliquet mesure "pas autre", pas "bien classe" -> aveugle au Critique). Correctifs dispatches.
A FAIRE EN FIN DE LOT : corriger les chiffres de couverture de la spec (1 et 3.2) une fois les cliquets re-etalonnes.
Task 1 revue 2 (sur 5c62a58) : defauts 1 et 3 OK. Regression sur le garde `registre` (2 cas justes perdus), `but\b` matche "debut" (8 notes), `inexistant` capture des LECTURES inexistantes (8 notes), chiffre 427 faux (reel 535 occ / 482 notes). Correctifs 2 dispatches.
NOTE : la reco du relecteur "flag u pour \b unicode" est FAUSSE en JS (\w reste [A-Za-z0-9_]) — corrigee avant transmission.
SEUIL : si une 3e ronde trouve encore des collisions, arreter et remonter a l auteur (approche par regex peut-etre a sa limite).
Task 1 revue 3 (sur a58177a) : defauts A/B/C/D confirmes corriges. MAIS balayage SYSTEMATIQUE (13 motifs x 27147 notes) trouve 2 collisions residuelles : kanji-confondu <- "autre kanji" attrape des confusions de SENS (242 notes/756 occ), nuance-grammaticale <- "nuance" (5 notes vocab). Seuil d arret atteint -> escalade utilisateur en cours.
NUANCE : le balayage etait EXHAUSTIF cette fois (pas incident), et le set est BORNE (2 motifs). Recommandation : 1 ronde ciblee + integrer le balayage par-motif comme test permanent.
Task 1 corrections finales : defauts 1 (kanji-confondu, 238 notes/724 occ mesure exacte) et 2 (nuance-grammaticale, 5 notes) corriges + 2 collisions revelees par le correctif (valeur/registre glose citee). Garde permanent ajoute (table de contre-marques, teste rouge->vert). Seuil kanji baisse 88->80 (couverture reelle 81.80%), vocab inchange (73%, reel 74.54%). TASK 1 CLOSE.
Task 1 revue FINALE (sur 2150d4b) : defauts 1/2 OK, garde permanent MECANISME ok mais table incomplete. RESTE ~73 notes/180 occ : cause racine identifiee = attrape-tout `erreur ?:` dans lecture-erronee (capture sens ET longueur phrases en "erreur : ..."). + "exprime" nu matche glose "exprimer".
DECISION : 1 correction RACINE (retirer erreur ?: attrape-tout) + etendre contre-marques, verif par balayage systematique MOI-MEME. Si converge -> clore. Sinon -> arbitrage (option B, pre-autorisee).
Correction de cause racine appliquee : attrape-tout retire de lecture-erronee (gate positif lecture|se lit + exclusion voyelle), gemination ajoute a longueur-voyelle, \bexprime\b + garde valeur(?!») a nuance-grammaticale, \bsens d[eu]\b ajoute a sens-different. BALAYAGE SYSTEMATIQUE (13 motifs x 27147 notes, table CONTRE_MARQUES etendue) = 0 COLLISION. Effet bien plus large que prevu : couverture kanji 81.80%->54.11% (attrape-tout gonflait bien au-dela des 2 gabarits nommes, cf rapport), vocab quasi stable (74.54%->74.75%). Seuils reetalonnes 80->52 (kanji) / 73 inchange (vocab). TASK 1 CLOSE (convergence prouvee).
Task 1: complete (698e192..fc6b52e, 5 commits, 14 tests, balayage systematique = 0 collision, revue clean). Couverture kanji 54%, vocab 75% (chute = retrait faux positifs, pas regression).
A FAIRE EN FIN DE LOT : (1) MAJ chiffres couverture spec 1 et 3.2 (93.6/74.8 -> 54/75). (2) SIGNALER a l auteur le manque de taxonomie "mauvais kanji pour contexte" (892 notes kanji en autre) — decision d ajout d un 15e type, recuperable sans migration.

Task 2 : applicateur traps.mjs cree et teste (5 tests, idempotence verifiee sur le corpus reel : 3148 kanji + 5901 vocabulaire types, 0 a la seconde passe, graphe valide apres pose). BLOQUE au controle gzip de l etape 7 : surcout mesure q-kanji +4.11% (OK), q-vocabulaire +5.94% (> 5%), combine +5.41% (> 5%). Regle absolue du plan (paragraphe 9) : au-dela de 5% on n improvise pas un encodage court, on s arrete et on signale a l auteur. Pose donc NON committee (data/graph/q-kanji.jsonld et q-vocabulaire.jsonld revertes a l etat d avant Task 2, sw.js non touche, CACHE reste v115) ; seul l outil (traps.mjs + traps.test.ts) est livre. ESCALADE : l auteur doit trancher entre accepter le surcout (~50 Ko gzip supplementaires sur les deux shards, ~5.4% combine) ou demander un encodage plus court pour jlpt:trapKind (ex. codes courts au lieu des 14 libelles textuels) avant de rejouer `bun tools/graph/traps.mjs` et de commiter la pose + le bump CACHE.
Task 2 revue (10 agents, common:review) : spec-surveyor OK (code fidele au brief, arret au seuil gzip conforme au plan §7 — note une tension plan/spec §9 a signaler a l auteur : le plan dit "arreter et signaler", la spec §9 dirait "basculer sur un code court" — le plan a fait foi, correctement). dep-auditor/security/ts-security CLEAN. breaking-change : additif, schema SHACL ouvert (pas de sh:closed), aucun risque futur. Converge sur 1 MAJOR (test-auditor, stub-hunter, picky commun, ts-picky) : jlpt:answer absent/hors-bornes non garde -> toutes les options (dont la bonne reponse) auraient ete typees en silence. Mesure sur le corpus reel : 0/9049 occurrence (jamais declenche a ce jour), mais corrige quand meme par coherence avec la convention du depot (readings.mjs : signaler, pas resoudre en silence) : applyTrapKinds retourne desormais aussi `invalides` (ids ignores), le CLI les affiche en warning. 3 tests ajoutes (answer absent/hors-bornes + signalement, notes manquantes -> 'autre' sans planter, comptage partiel sur lot mixte) : 5 -> 8 tests. Reverifie sur le corpus reel apres durcissement : memes compteurs (3148/5901), idempotent, graphe valide, 0 invalide reel -> redonverti (pose toujours NON committee). devils-advocate (DEFERRED) : signale l absence de marqueur d escalade DANS le code (seule trace = ce fichier) — risque qu un futur agent relance l outil sans lire cette note ; retenu comme point de vigilance, pas bloquant (le futur agent qui lira ce fichier trouvera l etat exact). Verdict global : CHANGES REQUESTED -> applique -> APPROVED.
