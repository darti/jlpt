# Graphe de confusion — conception

**But.** Dire à l'apprenant *par quel type de piège* il se fait avoir, à partir des erreurs qu'il
commet réellement, en s'appuyant sur les notes d'option déjà écrites dans le corpus.

**Périmètre du premier lot.** Constater seulement : stocker l'option choisie, typer le corpus,
afficher le diagnostic. Le moteur de sélection (`pickAdaptive`) n'est **pas** touché.

---

## 1. Ce que la mesure a établi

Trois mesures sur le corpus réel (`data/graph/q-*.jsonld`, 10 307 questions), qui commandent
toute la conception :

| Mesure | Valeur |
|---|---|
| Questions portant `jlpt:optionNote`, **une note par option** | 10 307 / 10 307 — **100 %** |
| Distracteurs se résolvant en une entité du graphe | 5 057 / 30 921 — **16,4 %** |
| Distracteurs de même lecture que la réponse | 331 — **1,1 %** |

**Conséquence 1 — l'explication existe déjà.** Chaque distracteur porte sa note d'auteur
(« 影像（えいぞう）« image » : partage 影, lecture différente »). Il n'y a rien à dériver du
graphe : il faut *classer* ce qui est écrit.

**Conséquence 2 — les distracteurs ne sont pas dans le référentiel, et c'est voulu.** Les 16,4 %
sont le corollaire de la purge des mots fabriqués (`約速`、`役束`、`約則`). Une explication par
résolution d'entité serait muette cinq fois sur six. Ce n'est pas une lacune à combler.

Couverture d'un typage déterministe des notes. ⚠ Ces chiffres ont été **révisés à la baisse à
l'implémentation** : les premières mesures (93,6 % kanji, 74,8 % vocabulaire) comptaient comme
« typées » des notes en réalité mal classées — l'attrape-tout `erreur ?:` du motif
`lecture-erronee` avalait des confusions de *sens* et de *longueur*. Après correction de cette
cause racine (0 faux positif prouvé par balayage systématique), la couverture RÉELLEMENT juste
est plus basse mais honnête :

| Compétence | Notes de distracteur | Typées (mesuré, sans faux positif) |
|---|---:|---:|
| kanji | 9 444 | **≈ 54 %** |
| vocabulaire | 17 703 | **≈ 75 %** |
| grammaire | 3 522 | *hors périmètre (non typée)* |
| écoute + lecture | 252 | *hors périmètre par nature* |

La chute côté kanji n'est pas une régression : ~46 % des distracteurs de kanji sont des
« mauvais kanji pour le contexte » (« le kanji « X » ne convient pas ici », ~892 notes) — un type
de piège fréquent et cohérent que la taxonomie figée à 14 valeurs ne nomme pas. Ils tombent
honnêtement en `autre`. **Décision d'auteur en suspens** : ajouter un 15ᵉ type
« mauvais-kanji-contexte » les récupérerait, sans migration (le type est dérivé à l'affichage,
cf. § 2).

**Conséquence 3 — la typologie ne porte pas d'information en grammaire.** Un distracteur de
grammaire est presque toujours « un autre point, de valeur différente » : le type est constant,
donc muet. Et l'alternative — nommer la paire de points confondus — est impossible : **6,5 %**
seulement des distracteurs de grammaire se résolvent dans `gram.jsonld`.

→ **La grammaire n'est pas typée du tout, et le panneau le dit.** Un diagnostic absent vaut mieux
qu'un diagnostic inventé.

---

## 2. Principe directeur : on ne stocke aucun dérivé

Un enregistrement de confusion est l'**événement brut** : quelle question, quelle option choisie,
quel jour. Le type de piège est calculé **à l'affichage**, depuis le corpus.

C'est le principe qui a motivé la migration vers le graphe — *« rien ne le régénère, donc rien ne
peut s'en désynchroniser »*. Écrire le type dans le blob utilisateur recréerait le dérivé qui se
désynchronise, cette fois dans la donnée utilisateur, **où c'est irréparable**.

Corollaire : affiner la taxonomie plus tard re-type tout l'historique, sans migration.

---

## 3. Formes de données

### 3.1 Corpus — `jlpt:trapKind`

Tableau parallèle à `opts` et `jlpt:optionNote`, comme la convention déjà en place :

```json
{
  "opts":          ["影像",          "映像",         "影響", "反響"],
  "jlpt:answer":   2,
  "jlpt:trapKind": ["kanji-partage", "forme-proche", "",     "kanji-partage"]
}
```

- `""` à l'index de la réponse — ce n'est pas un piège.
- `"autre"` quand le classifieur ne sait pas. **Jamais de devinette.**
- **Posé sur `q-kanji.jsonld` et `q-vocabulaire.jsonld`, et sur eux seuls.**

Ce dernier point est structurant : *la présence du champ définit le périmètre*. `q-ecoute` et
`q-lecture` en sont exclus par nature (erreurs de compréhension, pas de forme) ; `q-grammaire`
l'est parce que le typage n'y atteint que 20,4 % — poser le champ y ajouterait ~2 800 `"autre"`
qui alourdiraient les shards sans rien apprendre. Une seule règle partout : *pas de champ = hors
périmètre*, à distinguer de *`"autre"` = dans le périmètre, mais non classé*.

### 3.2 Taxonomie

Treize types, tous issus des formules réellement employées par l'auteur dans les notes :

| Type | Formule d'origine | Part mesurée |
|---|---|---:|
| `lecture-erronee` | « lecture erronée », « erreur : » | 18,9 % |
| `lecture-on-kun` | « lecture on », « on'yomi », « kun » | 10,2 % |
| `graphie-inexistante` | « graphie inexistante », « n'existe pas » | 7,6 % |
| `kanji-partage` | « partage 響 », « même kanji » | 7,2 % |
| `voisement` | « voisement erroné », « assimilation phonétique » | 7,1 % |
| `lecture-autre-mot` | « lecture de 自由, pas de 理由 » | 6,6 % |
| `forme-proche` | « forme proche », « ressemble » | 4,0 % |
| `kanji-confondu` | « confond avec 幹 » | 3,4 % |
| `longueur-voyelle` | « voyelle manquante », « son long » | 2,9 % |
| `sens-different` | « sens différent », « autre mot » | 2,8 % |
| `homophone` | « homophone », « même lecture » | 2,6 % |
| `nuance-grammaticale` | « exprime un but, pas la simultanéité » | 0,8 % |
| `registre` | « registre », « poli / neutre » | 0,3 % |
| `autre` | *aucun motif ne matche* | reste |

### 3.3 Stockage — champ `confusions` du blob de progression

```json
"confusions": [[1174, 0, 201], [4609, 3, 203]]
```

Triplet `[ord, indexChoisi, jour]`. Le **jour** est le nombre de jours écoulés depuis l'époque
fixe `2026-01-01T00:00:00Z` — un entier à trois chiffres plutôt qu'un horodatage à treize.
**Anneau borné aux 300 derniers événements** : ~4 Ko, négligeable en localStorage comme dans la
sauvegarde Gist.

Le champ vit dans le blob `PROGRESS_KEY` existant, donc sous le préfixe `jlptN3` — il est
synchronisé par `gist.ts#collectData` sans rien ajouter.

**Champ distinct de `wrong[]`**, qui garde sa sémantique d'ensemble courant (dédupliqué, vidé à la
réussite) et reste porteur pour `pickAdaptive`.

**On n'enregistre que les erreurs.** Décrémenter sur les réussites obligerait à enregistrer aussi
les bonnes réponses — volume multiplié pour un effet que la récence produit gratuitement : un
piège qu'on ne déclenche plus sort de la fenêtre de lui-même.

---

## 4. Architecture

| Étage | Fichier | Nature | Analogue existant |
|---|---|---|---|
| Corpus, hors ligne | `tools/graph/traps.mjs` | déterministe, idempotent | `link-answers.mjs` |
| Classifieur | `tools/graph/trap-kinds.mjs` | pur, `note → type` | — |
| Projection, runtime | `src/features/quiz/traps.ts` | **pure** | `rappel.ts` |
| Écriture | `useQuiz#choose` | seule couche à effets | — |
| Affichage | `src/features/dashboard/TrapPanel.tsx`, `Corrige.tsx` | composants | — |

### 4.1 `tools/graph/traps.mjs`

Idempotent, et **n'écrit que là où `jlpt:trapKind` est absent** — même invariant que
`readings.mjs`. Une correction de type faite à la main dans le graphe survit donc à un rejeu ;
pour re-dériver une option, on supprime son champ.

Ne traite que `q-kanji.jsonld` et `q-vocabulaire.jsonld` (§ 3.1).

### 4.2 `src/features/quiz/traps.ts`

Pure et injectable, sur le modèle de `rappel.ts` :

```ts
/** Un type de piège encore actif, avec son décompte sur la fenêtre récente. */
export interface TrapCount { kind: string; recent: number }

export interface TrapModel {
  active: TrapCount[];    // triés par `recent` décroissant
  resolved: string[];     // vus dans l'anneau, absents de la fenêtre récente
  untyped: number;        // DANS le périmètre, mais classés « autre »
  outOfScope: number;     // grammaire / écoute / lecture — pas un échec du typage
}

export function trapModel(
  confusions: [number, number, number][],
  kindByOrd: Map<number, string[]>,   // uniquement les ords kanji + vocabulaire
  today: number,
  windowDays = 30,
): TrapModel
```

`kindByOrd` est bâti une fois depuis les shards chargés — même mémoïsation que les pools de
`bank.ts`. Il ne contient **que** les questions porteuses du champ, ce qui fait de son absence le
critère de périmètre.

Règles, dans cet ordre :
1. `ord` absent de `kindByOrd` → `outOfScope` ;
2. type `"autre"` (ou index hors bornes) → `untyped` ;
3. jour dans les `windowDays` derniers → compte dans `recent` du type ;
4. type présent dans l'anneau mais absent de la fenêtre récente → `resolved`.

`untyped` et `outOfScope` sont **deux compteurs distincts** : le premier mesure une limite du
classifieur, le second une exclusion assumée. Les confondre ferait passer une décision de
conception pour une défaillance.

---

## 5. Flux

```
choose(i)  ──erreur──▶  writeProgress({ confusions: [...anneau, [ord, i, jour]].slice(-300) })

Accueil ──▶ trapModel(confusions, kindByOrd, aujourdHui)
                 │
                 ├─ fenêtre 30 j      → « pièges actifs »
                 ├─ reste anneau      → « ✓ résolu »
                 ├─ type « autre »    → « n non typées »
                 └─ hors périmètre    → « grammaire / écoute / lecture non couvertes »
```

---

## 6. Affichage

**Accueil** — panneau « Tes pièges », à côté du tableau de bord, dans la même famille visuelle que
le radar de compétences. Utilise `PANEL` et `H2` de `src/ui/styles.ts` ; aucun squelette retapé.

```
TES PIÈGES ACTUELS

  Voisement erroné      ●●●●○○   8 récentes
  Forme proche          ●●○○○○   3
  Homophone             ●○○○○○   1

  Lecture on/kun        ✓ résolu (0 depuis 3 semaines)

  12 erreurs non typées · 34 hors périmètre (grammaire, écoute, lecture)
```

**Corrigé** — sous la note d'option déjà affichée quand la réponse est fausse, nommer le type.
C'est là que l'information porte le plus, et c'est quasi gratuit une fois `jlpt:trapKind` posé.

Les deux écrans affichent l'état vide comme le tableau de bord le fait sous 5 réponses.

---

## 7. Dégradations

| Cas | Comportement |
|---|---|
| `ord` absent du corpus chargé | compté dans `outOfScope`, jamais d'exception |
| `jlpt:trapKind` valant `"autre"` | compté dans « non typées », **pas** écarté en silence |
| shards pas encore chargés | placeholder, comme le tableau de bord sous 5 réponses |
| écriture localStorage en échec | déjà best-effort dans `writeProgress` |
| blob sans `confusions` (existant) | tableau vide, aucune migration nécessaire |

---

## 8. Tests

- **Classifieur** : pur, table de cas — une entrée par type, plus les cas qui doivent tomber en
  `autre`.
- **Test de mesure avec cliquet**, sur le vrai corpus : `kanji ≥ 52 %`, `vocabulaire ≥ 73 %`
  (seuils ré-étalonnés après la correction de cause racine — cf. § 1). ⚠ À **remonter** dès
  qu'on dépasse le seuil, sinon il cesse de garder quoi que ce soit.
- **Garde permanent anti-faux-positif**, sur le vrai corpus : pour chaque motif, une table de
  « contre-marques » (sous-chaînes qui prouveraient un type faux) ; le test échoue si un motif
  capture une note portant sa contre-marque. C'est LUI qui garde la justesse — le cliquet de
  couverture ne mesure que « type ≠ autre », pas « type juste ».
- **`tools/validate-graph.mjs`** : si `jlpt:trapKind` est présent, il est parallèle à `opts`, vaut
  `""` exactement à l'index de `jlpt:answer`, n'emploie que des types de la taxonomie, et
  n'apparaît que sur les shards kanji / vocabulaire. C'est le second étage impératif, à côté du
  SHACL.
- **Idempotence** : rejouer `traps.mjs` sur un graphe à jour ne change aucun octet ; un type posé
  à la main n'est pas écrasé.
- **`choose`** en happy-dom : une erreur ajoute exactement un événement, une réussite aucun,
  l'anneau reste borné à 300.
- **`trapModel`** : pur, table-driven — fenêtre, résolution, non typées.
- **`TrapPanel`** : SSR smoke (`renderToStaticMarkup`), en évitant d'asserter sur des
  sous-chaînes contenant une apostrophe.

---

## 9. Poids du corpus — mesuré, décision d'auteur prise

`jlpt:trapKind` couvre les 9 049 questions de kanji et de vocabulaire, soit environ **36 000
entrées** (les quatre options de chacune) : de l'ordre de **600 Ko bruts** sur ces deux shards.

**Delta gzippé mesuré à l'implémentation** : q-kanji +4,1 %, q-vocabulaire +5,9 %, combiné
**+5,4 %** — au-dessus du seuil de 5 %. La mesure a aussi confirmé qu'un code court d'une lettre
ramènerait le surcoût à ~+2,4 %, la projection absorbant la correspondance.

**Décision d'auteur : noms lisibles, +5,4 % accepté.** Le code court a été écarté malgré son gain :
`"jlpt:trapKind": ["kanji-partage", …]` reste éditable à la main — un correcteur lit le type sans
table de correspondance —, ce qui est la valeur fondatrice du projet (« le graphe est la source,
corrigé à la main »). Le surcoût (~50 Ko gzip) est téléchargé UNE fois puis mis en cache par le
service worker (PWA hors ligne) : un one-shot, pas un coût par requête.

⚠ Cette décision **prime sur la formulation antérieure** de cette section, qui prescrivait le
basculement automatique sur un code court au-delà de 5 %. Le seuil déclenche un ARBITRAGE, pas une
bascule mécanique : mesurer, puis choisir en connaissance de cause (la lisibilité l'a emporté).

---

## 10. Hors périmètre, explicitement

- **Piloter la sélection** des questions depuis les pièges actifs — lot suivant, une fois qu'on
  aura constaté que la typologie dit quelque chose de vrai.
- **La grammaire**, l'**écoute** et la **lecture** dans le panneau (§ 1).
- **L'arbitrage à la main** des notes ambiguës : un type mal deviné dégrade un diagnostic, il ne
  corrompt pas le référentiel. L'arbitrage reste réservé aux outils qui écrivent du contenu ou
  qui suppriment.
- **Le modèle de mémoire par entité** (révision espacée), qui fait l'objet d'une conception
  distincte.
