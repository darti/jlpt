# Rendre la confusion visible (lot 2 — surface)

**Date** : 2026-07-23
**Statut** : conçu, prêt à planifier

## 1. Problème

Le lot 2 (`selectConfusion`) reserre des questions exerçant les types de pièges que l'apprenant
confond encore. **Mais rien ne le lui dit.** Le pilotage est invisible : la session contient des
questions de renforcement, l'apprenant les prend pour des questions ordinaires.

Ce qui existe DÉJÀ (lot 1), à NE PAS dupliquer :
- **`TrapPanel`** (Accueil, via `useTraps`) : liste les types de pièges actifs/résolus avec une
  barre de récence, plus les compteurs non-typé/hors-périmètre.
- **Corrigé** (`Corrige.tsx`) : ligne « Type de piège : X » sur une réponse FAUSSE.

Le manque propre au lot 2 : **relier la SÉLECTION à l'affichage** — dire à l'apprenant qu'une
question a été *choisie* pour retravailler une confusion, et que ses pièges pilotent ses sessions.

## 2. Périmètre

Deux surfaces, aucun contenu nouveau, aucune modification du graphe, aucun asset livré
(**pas de bump `sw.js`**) :

1. **Badge de corrigé** sur une question **réservée par la tranche confusion** : « 🎯 Renforcement
   — une de tes confusions récentes ». En contexte, au moment où la question de renforcement
   apparaît.
2. **Note dans `TrapPanel`** quand des types sont actifs : « Ces confusions sont retravaillées en
   priorité dans tes sessions. » Relie le panneau de stats au comportement du lot 2.

**Hors périmètre** : bandeau sur le hub (ferait doublon avec `TrapPanel` de l'Accueil) ; recalcul
du type ciblé au corrigé (le badge suit la **décision de sélection** réelle, pas une heuristique).

## 3. Architecture

### 3.1 `useQuiz.ts` — exposer `confusionIds`

La tranche confusion est déjà construite dans `start()` (`confusionQs`). On enregistre ses ids :

    const [confusionIds, setConfusionIds] = useState<Set<number>>(new Set());

- Dans `start()`, après avoir bâti `confusionQs` : `setConfusionIds(new Set(confusionQs.map((q) => q.id)));`
  (chemin composé uniquement ; le diagnostic n'a pas de tranche confusion → `new Set()`).
- Remis à zéro là où l'état de session est réinitialisé : `restart()` et au début de `start()`
  (avant le calcul), pour ne pas garder les ids d'une session précédente.
- Exposé dans le retour du hook : `confusionIds`.

C'est la **source de vérité** : « quelles questions ont été réservées pour drill une confusion ».
Pur côté donnée (un `Set` d'ids), pas d'effet nouveau.

### 3.2 `Corrige.tsx` — badge « Renforcement »

Nouvelle prop **optionnelle** `targeted?: boolean` (défaut `false`). Quand `true`, un badge court
juste après la bannière correct/faux (donc visible que la réponse soit juste OU fausse — le badge
concerne le POURQUOI de la sélection, pas l'issue) :

    {targeted && (
      <p className="text-meta text-accent font-bold mt-0 mb-3">
        🎯 Renforcement — une de tes confusions récentes
      </p>
    )}

La ligne « Type de piège : X » existante (sur réponse fausse) nomme déjà le kind ; le badge ajoute
seulement l'intention (« on te l'a reservie exprès »).

### 3.3 `EntrainementApp.tsx` — câblage

- `EntrainementAppView` gagne une prop `confusionIds?: Set<number>` (défaut `new Set()`).
- Branche `phase === "corrige"` : `<Corrige … targeted={(props.confusionIds ?? EMPTY).has(question.id)} />`.
- Le conteneur passe `confusionIds={quiz.confusionIds}`.

### 3.4 `TrapPanel.tsx` — note de priorité

Quand `model.active.length > 0`, sous la liste `<ul>` (avant les compteurs non-typé/hors-périmètre) :

    {model.active.length > 0 && (
      <p className="text-meta text-fg-dim mt-3 mb-0">
        Ces confusions sont retravaillées en priorité dans tes sessions.
      </p>
    )}

Uniquement quand il y a des types actifs — sinon rien (le panneau « pas assez d'erreurs » et
« aucun type récurrent » restent inchangés).

## 4. Graceful zero (invariant)

Aucune confusion active ⇒ `confusionIds` vide ⇒ aucun badge ; `model.active` vide ⇒ pas de note.
L'UI est **identique à aujourd'hui** tant qu'il n'y a pas de signal de confusion — comme la
tranche confusion elle-même est inerte sans signal.

## 5. Tests

- **`Corrige.tsx`** (SSR) : `targeted={true}` → le badge « Renforcement » est présent ;
  `targeted={false}` (défaut) → absent. Asserter sur « Renforcement » (sans apostrophe).
- **`TrapPanel.tsx`** (SSR) : un modèle avec `active` non vide → la note « priorité dans tes
  sessions » est présente ; un modèle `active` vide (mais resolved/untyped présents) → absente ;
  modèle `null` → panneau « pas assez d'erreurs », pas de note.
- **`useQuiz`** : `confusionIds` exposé et de type `Set` ; le peuplement (depuis `confusionQs`) et
  le passage `.has(question.id)` sont de la glue d'affichage, couverts par le typecheck et les
  tests SSR ci-dessus (pas de règle nouvelle testable hors des couches déjà couvertes).

## 6. Invariants

- Aucune écriture `data/graph/`, aucun asset livré → **pas de bump `sw.js`**.
- Aucune dépendance nouvelle ; réutilise `KIND_LABELS`/`TrapModel`/`trapModel` (lot 1) et
  `confusionQs` (lot 2).
- Graceful zero : UI inchangée sans confusion active.
- Le badge suit la **sélection réelle** (`confusionIds`), jamais une heuristique recalculée.
