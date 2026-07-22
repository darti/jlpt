# Allocation prescriptive par valeur marginale — conception

**But.** Piloter la répartition des questions entre compétences par la **valeur marginale**
∂P(réussite)/∂question, dérivée analytiquement du `successModel`, au lieu de la simple faiblesse
(`1 − maîtrise`). Une compétence au bord de son minimum sectionnel compte bien plus que sa seule
faiblesse ne le dit — c'est ce que le score /180 ne montre pas.

**Périmètre.** Le prescriptif **pilote la sélection directement** : on remplace le signal de
pondération de `allocateCount`. **Aucune UI, aucun asset livré, aucun changement de `data/graph/`
ni de `sw.js`.** Changement de modèle invisible sinon par une meilleure allocation.

---

## 1. Décisions de cadrage (arbitrées au brainstorming)

| Décision | Choix |
|---|---|
| Finalité | **Pilote** la sélection (pondération de `allocateCount`), pas un panneau de conseil |
| Taux d'apprentissage | **Analytique**, pas d'estimation empirique par compétence (pas de trajectoire `(t,R)`) |
| Forme du poids | **A** : `plancher + valeur_normalisée`, réutilise les constantes actuelles (0,2 / 1,3) |
| `∂maîtrise/∂R` | **Conservé** (poids = « gain de P par question » réel) |

---

## 2. Le modèle de valeur marginale

Tout est fonction du seul **état courant** (`R` par compétence). Notations :
`σ(x) = 1/(1+e^−x)` ; `σ10(x) = 1/(1+10^−x)` ; `PASS_RATING = 1600`.

### 2.1 Rappel du `successModel` (existant, `scoring.ts`)

```
masteryOf(c)   = σ10((R_c − 1600)/400)
m_langage      = (masteryOf(vocabulaire) + masteryOf(kanji)) / 2
m_grammLect    = (masteryOf(grammaire) + masteryOf(lecture)) / 2
m_listening    = t_ecoute ≥ 3 ? masteryOf(ecoute) : 0.85·((m_langage + m_grammLect)/2)
secScore_i     = 60·m_i         (chaque section /60)
total          = Σ secScore_i   (/180)
pSec(v)        = σ((v − 22)/4)   (minimum sectionnel, ~22/60)
pTotal         = σ((total − 95)/12)  (seuil global, 95/180)
P              = pTotal · pSec(secScore_langage) · pSec(secScore_grammLect) · pSec(secScore_listening)
```

### 2.2 Valeur marginale d'une section

En dérivant `P` (produit de sigmoïdes) et en divisant par le facteur commun `P` :

```
marginalSection_i = (1 − pTotal)/12  +  (1 − pSec(secScore_i))/4
```

- `(1 − pTotal)/12` : marge sur le **seuil global**, commune à toutes les sections.
- `(1 − pSec_i)/4` : marge sur le **minimum sectionnel** de `i` — le terme qui **différencie**.

Simplification assumée : on traite les sections comme **indépendantes** pour la dérivée. Quand
l'écoute est estimée (`t<3`), `m_listening` dépend en réalité de langage/grammaire, ce qui
sous-crédite très légèrement ces deux sections — erreur petite et transitoire (jusqu'à `t_ecoute ≥ 3`).

### 2.3 De la section à la compétence

```
sectionOf(c)     : vocabulaire,kanji → langage ; grammaire,lecture → grammLect ; ecoute → listening
sectionFactor(c) : 0.5 pour vocabulaire/kanji/grammaire/lecture ;
                   ecoute → 1.0 si t_ecoute ≥ 3, sinon 0   (∂m_listening/∂m_ecoute)
dMasteryDR(c)    = masteryOf(c)·(1 − masteryOf(c))·ln(10)/400     (pente logistique, max à R=1600)

value(c) = marginalSection_{sectionOf(c)} · sectionFactor(c) · dMasteryDR(c)
```

⚠ **Le piège de l'écoute est dans `sectionFactor`** : quand `t_ecoute < 3`, la section listening
ne dépend pas de la maîtrise d'écoute → `sectionFactor(ecoute)=0` → `value(ecoute)=0`. L'écoute
n'est alors pas pilotée par sa valeur (qui serait fausse) mais retombe au **plancher** (§ 3) — elle
garde une allocation de fond et se fait mesurer (plancher + diagnostic), puis sa vraie valeur
s'enclenche à `t ≥ 3`.

`dMasteryDR` (conservé) : une question sur une compétence près de R=1600 (le seuil) fait bouger la
maîtrise plus vite qu'une sur une compétence saturée (haut ou bas). `value` est donc le **gain de P
par question** réel. Effet secondaire connu : une compétence très faible (R bas, loin sous son
minimum) est *atténuée* car on y progresse lentement — mais `marginalSection` (le minimum
sectionnel) reste dominant, donc elle garde une priorité haute.

---

## 3. La fonction de poids (`prescriptiveWeights`)

```
maxVal    = max_c value(c)
valueNorm(c) = maxVal > 0 ? value(c)/maxVal : 0
poids(c)  = 0.2 + 1.3 · valueNorm(c)
```

`0.2` (plancher) et `1.3` (échelle) sont **exactement** les constantes actuelles de
`allocateCount` — on ne change que le signal (`1 − maîtrise` → `valueNorm`). Chaque compétence
garde donc au moins `0.2` (couverture garantie), le max monte à `1.5`.

Vit dans `scoring.ts` : `export function prescriptiveWeights(p: Progress): Record<Skill, number>`.
Pur.

**Démarrage à froid** (n=0, tous R=1450) : les 4 compétences hors écoute ont une `value` égale →
poids `1.5` chacune ; l'écoute (non mesurée) → plancher `0.2`. Le diagnostic (première session,
`daysSinceDiagnostic=null`) mesure toutes les compétences avant qu'une session composée n'emploie
ces poids, donc `t_ecoute ≥ 3` est atteint tôt.

---

## 4. Intégration — déplacement de responsabilité

- **`scoring.ts`** : gagne `prescriptiveWeights(p)` (le modèle de valeur, à côté de `successModel`).
- **`bank.ts` — `allocateCount`** : passe de `(masteryOf, total)` à `(weightOf: (c)=>number, total)`.
  Elle **ne connaît plus** la formule `0.2 + (1−maîtrise)·1.3` (déménagée dans `prescriptiveWeights`) :
  elle répartit proportionnellement à `weightOf(c)`, **reliquat aux compétences de plus haut poids**
  (au lieu de « plus faible maîtrise » — sémantique équivalente, `poids ∝ valeur` remplaçant
  `poids ∝ faiblesse`). `allocate(weightOf, minutes)` (le wrapper) suit le même renommage.
- **`useQuiz`** : les deux appels (tranche apprentissage l.294, tranche adaptatif l.304) passent
  `(c) => W[c]` où `W = prescriptiveWeights(progress)` (calculé une fois), au lieu de
  `(c) => masteryOf(progress, c)`.

`pickAdaptive` (choix **dans** une compétence, par proximité Elo) **intact** — on ne change que la
répartition **entre** compétences. La composition de session (erreurs/révision/apprentissage/
adaptatif, cf. lot mémoire) inchangée sauf cette pondération.

---

## 5. Dégradations

| Cas | Comportement |
|---|---|
| Démarrage à froid | 4 compétences à poids max égal, écoute au plancher (§ 3) |
| Compétence saturée (pSec≈1) | `value` ≈ terme global seul → petite → poids ≈ **plancher 0,2**, jamais 0. Rétention couverte par la tranche révision FSRS |
| Écoute `t<3` | `sectionFactor=0` → `value=0` → poids = plancher (bootstrap) |
| `maxVal = 0` (théorique) | `valueNorm=0` → tous au plancher → allocation uniforme, jamais de division par zéro |
| Blob de progression absent / R par défaut | `masteryOf` rend la valeur d'un skill vierge (R=1450) — aucune exception |

---

## 6. Tests

- **`prescriptiveWeights`** (pur, `scoring.test.ts`) :
  - une section **sous son minimum** reçoit un poids **strictement supérieur** à une section
    saturée (le cœur de la feature — un cas construit avec des `R` connus) ;
  - compétence saturée → poids ≈ **0,2** (plancher), jamais 0 ;
  - écoute `t<3` → poids = plancher (bootstrap) ; écoute `t≥3` → sa vraie valeur s'engage ;
  - démarrage à froid → 4 compétences égales à 1,5, écoute au plancher ;
  - **vecteur de référence** : des maîtrises `R` connues → poids relatifs attendus, calculés à la
    main depuis les formules du § 2 (ancre la transposition, comme les vecteurs FSRS) ;
  - `maxVal=0` → tous au plancher, aucune exception.
- **`allocateCount`** (`bank.test.ts`) : répartit proportionnellement au poids, somme = `total`,
  reliquat au plus haut poids. Les cas existants (`() => 0.5`) réinterprètent « 0,5 » comme un
  **poids** uniforme (allocation toujours uniforme, assertions inchangées) — adaptation mécanique.
- **Non-régression** : `bun test` complet au vert ; `pickAdaptive` et `composeSession` intacts
  (hors diff).

---

## 7. Hors périmètre (explicitement)

- **Panneau de conseil** sur l'Accueil (« aujourd'hui : 70 % écoute ») — le choix est de PILOTER,
  pas d'afficher. Un panneau reste un lot suivant possible, réutilisant `prescriptiveWeights`.
- **Taux d'apprentissage empirique** par compétence depuis la trajectoire `(t,R)` — écarté au
  cadrage (bruité, et il PILOTERAIT l'allocation).
- **Modélisation fine de l'écoute estimée** (dépendance croisée section→section dans la dérivée) —
  approximée (§ 2.2), erreur transitoire.
- **Réglage** du plancher / de l'échelle par l'utilisateur — constantes fixes (celles d'aujourd'hui).
