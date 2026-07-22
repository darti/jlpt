# Modèle de mémoire par entité (révision espacée FSRS) — conception

**But.** Donner au moteur une dimension temporelle : à ~4,5 mois de l'examen (2026-12-06),
l'oubli domine, et le modèle de l'apprenant n'en a aucune trace (`mastered` = « juste une fois,
pour toujours »). Un état de mémoire FSRS par entité du graphe décide *quoi réviser aujourd'hui*,
injecté dans le quiz adaptatif existant.

**Périmètre du lot 1 : collecter ET injecter.** État FSRS mis à jour à chaque réponse, plus une
tranche « révision » dans la composition de session. Pas de nouveau moteur : l'oubli pilote le
moteur adaptatif existant.

---

## 1. Décisions de cadrage (arbitrées au brainstorming)

| Décision | Choix |
|---|---|
| Forme | **Injection** dans le quiz adaptatif (tranche « révision »), pas de mode dédié |
| Algorithme | **FSRS-4.5** (mode binaire), poids par défaut publiés |
| Événement | juste/faux → **Again/Good**, sur l'**entité de la réponse** (arête `tests`) |
| Stockage | **état FSRS matérialisé, épars** (pas de journal brut) |
| Portée v1 | collecter **et** injecter, d'un bloc |
| Intégration | **tranche dédiée** dans `composeSession`/`allocate` (pas de bonus dans `pickAdaptive`) |

**Risque principal identifié : la fidélité numérique de FSRS.** Les formules (17 poids, courbe de
rétrievabilité, mise à jour stabilité/difficulté) doivent être conformes à la référence publiée,
pas « à peu près ». La couche pure est validée contre des **vecteurs de référence**, pas contre
« ça a l'air de croître ». C'est le seul endroit du lot où une erreur numérique passe tous les
tests « ça semble juste ».

---

## 2. Architecture

Quatre étages, calqués sur le graphe de confusion :

| Étage | Fichier | Nature | Rôle |
|---|---|---|---|
| Algorithme | `src/lib/fsrs.ts` | **pur** | init / révision d'un état, retrievabilité, seuil « dû » |
| Requêtes | `src/features/quiz/revision.ts` | **pur** | état ↔ blob, entités dues, index inverse IRI→ords |
| Écriture | `src/features/quiz/useQuiz.ts` (`choose`) | à effets | met à jour l'état à chaque réponse |
| Sélection | tranche « révision » dans `src/lib/bank.ts` + `src/features/entrainement/sessionPlan.ts` | pur | compose la session |
| Affichage | `src/features/dashboard/RevisionPanel.tsx` + `useRevision.ts` | composant + hook | panneau « À réviser » sur l'Accueil |

**Le pont ord ↔ IRI.** L'état FSRS est indexé par **IRI d'entité** (`jlpt:word/影響`), le quiz par
**`ord`**. `q.tests` donne ord→IRIs (posé depuis la réponse, 95,7 % des questions) ; son inverse
(IRI→ords), mémoïsé comme les pools, retrouve une question qui teste une entité due.

---

## 3. Modèle de données

### 3.1 Le champ `fsrs` du blob de progression

Carte **éparse** — seulement les entités touchées, jamais les 6 000 — dans le blob `PROGRESS_KEY`
(`jlptN3adapt_v2`, donc préfixe `jlptN3`, synchronisé par Gist sans rien ajouter) :

```json
"fsrs": {
  "jlpt:word/影響": [12.4, 5.2, 203],
  "jlpt:kanji/火":  [3.1, 6.8, 201]
}
```

Valeur = `[stabilité, difficulté, dernierJour]`. Le **jour** réutilise l'époque du graphe de
confusion (`EPOCH_MS = 2026-01-01T00:00:00Z`, `dayNumber`) — une seule origine temporelle dans
l'app.

**Clé = IRI complet.** Pas d'ordinal d'entité ajouté au graphe : la carte est éparse et petite
(centaines à quelques milliers d'entrées), l'IRI verbeux mais lisible, et on évite un changement de
graphe avec son propre invariant de stabilité. La compacité (raccourcir la clé) reste un réglage
différé si le poids Gist le justifie un jour — mesuré, pas supposé.

⚠ **Piège `writeProgress`.** Il ne deep-merge que `skill` ; tout le reste est remplacé tel quel.
Patcher `{fsrs: {une_entité}}` **écraserait toute la carte**. On lit donc la carte complète, on met
à jour la clé touchée, et on réécrit `{fsrs: carteComplète}` — exactement le patron de `wrong[]` /
`confusions[]`. C'est le risque cross-feature n°1 (perte silencieuse de données utilisateur), gardé
par un test dédié (§ 8).

### 3.2 Pas de journal brut

On ne stocke que l'état matérialisé, pas la séquence des révisions. FSRS est **markovien** : le
prochain état ne dépend que de l'état courant + le temps écoulé + le grade. L'état courant est donc
une statistique suffisante pour piloter la sélection. Contrairement au type de piège (fonction pure
du corpus, recalculable à tout moment), l'état FSRS est une accumulation en ligne — le
matérialiser est le choix idiomatique. Conséquence assumée : optimiser un jour les 17 poids sur
l'historique personnel (qui exigerait le journal) est **hors périmètre** ; les poids par défaut
suffisent.

---

## 4. L'algorithme FSRS (`src/lib/fsrs.ts`)

Trois fonctions pures :

```ts
export type Fsrs = [stability: number, difficulty: number, lastDay: number];

export function fsrsInit(grade: Grade, today: number): Fsrs;
export function fsrsReview(state: Fsrs, grade: Grade, today: number): Fsrs;
export function retrievability(state: Fsrs, today: number): number; // 0..1
export function isDue(state: Fsrs, today: number, retention?: number): boolean;
```

`Grade` est `1 | 3` en pratique (mode binaire), `2 | 4` restant définis mais jamais émis.

**Modèle FSRS-4.5** (courbe de puissance) :
- Rétrievabilité après `t` jours de stabilité `S` : `R = (1 + FACTOR·t/S)^DECAY`, avec
  `DECAY = -0.5`, `FACTOR = 19/81`.
- Grade binaire : faux → `Again(1)`, juste → `Good(3)`. Les branches Hard (`w15`) / Easy (`w16`)
  ne se déclenchent jamais — surface morte conservée pour rester fidèle aux 17 poids publiés.
- Difficulté initiale, réversion à la moyenne, stabilité de succès (croît avec `R` bas et `D` bas)
  et stabilité post-lapse : selon les formules FSRS-4.5 **verbatim**.
  ⚠ La formule officielle de lapse n'impose PAS `stabilité ≤ avant` : sur un item très fragile
  (petite stabilité) revu très en retard, un échec peut légèrement *augmenter* la stabilité
  (ex. `s=1, d=3, t=365j → ≈2,0`). C'est le comportement calibré des auteurs FSRS, conservé tel
  quel — pas de plafond `min(., s)` ad hoc, non validé. (Décision d'auteur, revue Task 1 : la
  fidélité au modèle prime sur l'intuition « une force de mémoire ne remonte jamais après un
  échec », qui n'est pas un invariant du vrai FSRS.)
- `isDue` : `retrievability(state, today) < retention`, `retention = 0.9` par défaut (défaut Anki),
  **codée en dur au lot 1** ; l'exposer en réglage est différé (YAGNI).
- Temps écoulé borné : `max(0, today - lastDay)` (horloge décalée / import → révision « même jour »).

⚠ **Les 17 poids par défaut proviennent de la référence FSRS-4.5 publiée** (Open Spaced Repetition
/ `ts-fsrs`), cités en commentaire avec leur source, **jamais retapés de mémoire**. Le plan
d'implémentation récupère les valeurs exactes depuis la référence et fige des **vecteurs de test**
(état + grade + Δjours → S/D attendus). Sans ces vecteurs, une transposition erronée d'une formule
passerait toute la suite.

---

## 5. Enregistrement (`useQuiz#choose`)

Après le calcul de `correct`, dans la portée « mesure » partagée (celle qui écrit déjà
`skill`/`wrong`/`seen`/`mastered`/`confusions`) :

```ts
const iris = q.tests ?? [];              // l'entité de la réponse (~1)
if (iris.length) {
  const map = asFsrs(raw);               // carte COMPLÈTE, lue du blob
  const g: Grade = correct ? 3 : 1;
  const today = dayNumber(new Date());
  for (const iri of iris)
    map[iri] = map[iri] ? fsrsReview(map[iri], g, today) : fsrsInit(g, today);
  patch.fsrs = map;                      // carte complète réécrite
}
```

- Une question **sans** arête `tests` (lecture / écoute) ne produit **aucun** événement mémoire —
  elle n'a pas d'entité. La collecte démarre à la première réponse.
- S'applique aux deux modes (diagnostic **et** normal) : l'écriture est dans la portée partagée,
  avant le branchement — cohérent avec `confusions`.
- `asFsrs(raw)` (dans `revision.ts`) rend la carte du blob, ou `{}` si absente/malformée — aucune
  migration d'un blob antérieur.

---

## 6. Sélection — la tranche « révision »

### 6.1 Requêtes pures (`revision.ts`)

```ts
export function fsrsIndex(questions: Question[]): Map<string, number[]>; // IRI → ords, mémoïsé
export function dueEntities(map: FsrsMap, today: number): { iri: string; r: number }[]; // R<0.9, triées R↑
```

`fsrsIndex` inverse `q.tests` sur les pools chargés, mémoïsé comme `bank.ts` (avec un
`clearRevisionCache()` pour l'isolation des tests, cf. `clearGraphCache`). `dueEntities` rend les
entités dues, **triées par R croissant** (plus en retard d'abord).

### 6.2 Intégration dans `allocate` / `composeSession`

Quatre tranches, dédupliquées par `ord` (patron existant de `composeSession`) :

| Tranche | Source | Priorité |
|---|---|---|
| erreurs | `wrong[]` récents | haute |
| **révision** | entités dues → une question qui les teste (index inverse) | **haute** |
| apprentissage | points de cours neufs (jamais vus) | remplit après |
| adaptatif | `pickAdaptive` (Elo) | remplit le reste |

- Budget révision : **constante nommée `REVISION_CAP = 0.4`** (jusqu'à 40 % de la session, comme le
  cap apprentissage), réglable en un point. À 4,5 mois de l'examen, l'oubli prime — d'où la
  priorité haute, à égalité avec les erreurs.
- **Ordre de remplissage, le total de la session étant la borne dure** : erreurs (≤ cap), puis
  révision (≤ cap), puis apprentissage (≤ cap), puis l'adaptatif remplit le **reste**. Chaque
  tranche est bornée par son cap ET par les slots encore libres — si erreurs + révision saturent
  déjà la session, apprentissage et adaptatif reçoivent zéro. C'est l'extension directe de la
  compétition que `allocate` arbitre déjà entre erreurs / apprentissage.
- **Choix de la question pour une entité due** : parmi les ords que l'index inverse associe à
  l'entité, prendre le **premier disponible en ordre stable (`ord` croissant)** non déjà dans la
  session. Déterministe (donc testable), et suffisant au lot 1 ; un choix plus fin (moins vue
  récemment, proche de l'Elo) est différé.
- `pickAdaptive` reste **intact et pur** — la révision est une tranche en amont, pas un terme dans
  sa formule.

---

## 7. UI — minimal au lot 1

**Panneau Accueil « À réviser »** (`RevisionPanel.tsx` + `useRevision.ts`), même famille que « Tes
pièges » : nombre d'entités dues aujourd'hui, ventilé kanji / vocab / grammaire. Chargement
paresseux — ne charge les pools que si le blob porte des entités `fsrs` (un nouvel arrivant ne paie
rien), même patron que `useTraps`.

**En session** : les questions de révision passent par le quiz normal, **sans marquage visuel**.
Un badge « révision » ou une note dans le corrigé sont différés. YAGNI aussi sur les prévisions
(courbe de charge future) et le réglage de rétention.

Les deux écrans affichent l'état vide comme le tableau de bord sous 5 réponses.

---

## 8. Dégradations

| Cas | Comportement |
|---|---|
| entité due sans question qui la teste (index inverse vide) | sautée (irrévisable par quiz), jamais d'exception |
| `today < lastDay` (horloge / import) | temps écoulé borné à 0 → révision « même jour » |
| blob sans `fsrs` (nouvel arrivant) | aucune entité due → tranche révision vide → **session composée comme aujourd'hui**, zéro changement de comportement |
| entité `fsrs` dont l'IRI a disparu du graphe | inoffensif — aucune question trouvée, état ignoré (pas de purge au lot 1) |
| lecture / écoute (pas d'arête `tests`) | aucun événement mémoire |
| écriture localStorage en échec | déjà best-effort dans `writeProgress` |
| `fsrs` malformé dans un blob importé | `asFsrs` rend `{}` — aucune exception |

---

## 9. Tests

- **`fsrs.ts`** : **vecteurs de référence** (état + grade + Δjours → S/D attendus, tirés de la
  référence FSRS-4.5) ; décroissance monotone de `R` avec le temps ; les grades binaires n'exercent
  que Again/Good ; `isDue` au seuil 0,9 ; temps écoulé négatif borné à 0.
- **`revision.ts`** : inversion de l'index (`q.tests` → IRI→ords) ; `dueEntities` filtre + tri ;
  entité due sans question dans l'index ; `asFsrs` sur blob absent/malformé.
- **`allocate` / `composeSession`** : la tranche révision respecte `REVISION_CAP` ; dédup par `ord`
  avec erreurs / apprentissage ; **`fsrs` vide ⇒ session identique à aujourd'hui** (non-régression
  du moteur).
- **`choose` (garde-fou, comme `confusions.test`)** : une réponse à arête `tests` écrit/màj `fsrs` ;
  sans arête n'écrit rien ; la réécriture de carte complète **ne perd pas les autres entités** ni
  les autres champs du blob (`skill`/`wrong`/`confusions`) — le piège `writeProgress`.
- **`RevisionPanel`** : SSR smoke (`renderToStaticMarkup`), assertions sans apostrophe.
- **`data/graph/*.jsonld` livré ?** Non — ce lot ne touche PAS le corpus (aucune pose de champ).
  Donc **pas de bump `sw.js`** requis, sauf si un asset livré change (ne devrait pas).

---

## 10. Hors périmètre (explicitement)

- **Journal brut des révisions** et **optimisation des 17 poids FSRS** sur l'historique personnel
  (les poids par défaut suffisent ; le journal serait la seule voie, différé).
- **Grade enrichi** (Hard/Easy dérivés de la difficulté ou du temps de réponse) — le temps de
  réponse n'est pas collecté aujourd'hui, gain incertain.
- **Événement sur toutes les entités testées** plutôt que la seule réponse — en pratique
  `q.tests` n'a qu'une arête, gain quasi nul.
- **Marquage visuel** des questions de révision, **prévisions de charge**, **réglage de rétention**.
- **Ordinal d'entité** dans le graphe (la carte éparse par IRI suffit).
- **Purge** des entités `fsrs` dont l'IRI a disparu du graphe (inoffensives).
- **Fusion multi-appareils** fine de deux cartes `fsrs` : le blob entier reste en dernier-écrit-
  gagne à l'import Gist, limite préexistante non aggravée par ce lot.
