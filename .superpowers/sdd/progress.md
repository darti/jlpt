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
