# Écoute audio-first — conception

**But.** Faire des questions d'écoute une vraie pratique d'écoute : l'audio devient **central**
(lecture au chargement, réécoute, vitesse variable) au lieu d'un bouton optionnel à débit fixe.

**Contexte (état actuel, vérifié).** Le dialogue (`jlpt:script`, présent sur les **32/32**
questions d'écoute) est **déjà masqué** — il n'apparaît qu'au corrigé — et le bouton « ▶ Écouter »
le **prononce** déjà via `speechTextFor` (`tts.ts`). La partie « masquer + faire entendre » est donc
faite. Le manque réel : l'audio est **optionnel** (un bouton qu'on peut sauter), à **débit fixe
0,9**, **sans réécoute**. Ce lot n'ajoute AUCUN contenu (32 questions, borne dure) — il enrichit
seulement l'ergonomie audio.

---

## 1. Décisions de cadrage (arbitrées au brainstorming)

| Décision | Choix |
|---|---|
| Ampleur | **Enrichir les contrôles audio**, PAS verrouiller les options ni refondre le flux |
| Ce qui reste visible | l'**énoncé‑question** et les **options** (lire les options en écoutant est une stratégie JLPT légitime) |
| Débit | trois crans **0,7 / 0,9 / 1,0**, **persisté** (préférence, comme thème/furi/police) |
| Auto‑play | tenté au chargement d'une question d'écoute, avec **repli** sur le bouton |

---

## 2. Interaction

Pour une question de compétence `ecoute` (et elle seule) :
- **Lecture au chargement** (auto‑play) du dialogue. Après le clic « Commencer » (un geste
  utilisateur), `speechSynthesis` est débloqué pour la session ; l'auto‑play fonctionne donc en
  pratique — mais on **ne s'y fie pas** : le bouton reste le déclencheur garanti si le navigateur
  bloque.
- **« ↻ Réécouter »** — rejoue le dialogue au débit courant, autant de fois que voulu.
- **Sélecteur de vitesse** : `Lent 0,7` / `Normal 0,9` / `Rapide 1,0` (0,9 = débit actuel ; 1,0 ≈
  vitesse d'examen). Le choix est **persisté** et rechargé d'une session à l'autre.

L'énoncé‑question et les options restent affichés (inchangé). Le **corrigé** continue d'afficher la
transcription (`script`) après réponse (inchangé).

---

## 3. Architecture — changements ciblés, la logique reste pure

| Fichier | Changement |
|---|---|
| `src/lib/tts.ts` | `speak(text, rate = 0.9)` gagne un paramètre de débit ; `speakQuestion(question, rate?)` le transmet ; `stopSpeaking()` **ajouté** (`speechSynthesis.cancel()` gardé) ; `speechTextFor` **inchangé** (déjà pur/testé) |
| `src/lib/keys.ts` | nouvelle clé `RATE_KEY = "jlptN3_ecouteRate"` (préfixe `jlptN3` obligatoire) |
| `src/lib/audioRate.ts` (**créé**) | `RATES = [0.7, 0.9, 1.0]`, `readRate(store?)`, `writeRate(rate, store?)` — purs, mêmes patrons que `src/lib/furigana.ts` |
| `src/features/quiz/QuestionCard.tsx` | branche `ecoute` : effet d'auto‑play au montage (no‑op en SSR), bouton **Réécouter**, sélecteur de vitesse ; la prop passe de `onSpeak: () => void` à `onSpeak: (rate?: number) => void` |
| `src/EntrainementApp.tsx` | `onSpeak = (rate) => speakQuestion(question, rate)` |

**Frontière.** `QuestionCard` **ne parle pas** directement à `speechSynthesis` : il gère l'**état de
vitesse** (local, initialisé depuis `readRate`, persisté par `writeRate` au changement), déclenche
`onSpeak(rate)` (auto‑play au montage + clic Réécouter), et son effet appelle `stopSpeaking()` (de
`tts.ts`, pas `speechSynthesis` brut) en **nettoyage** au démontage / changement de question. Le
`speak` réel vit dans `tts.ts`, appelé par le parent. `speechTextFor` (le QUOI prononcer) ne bouge pas.

Le flux du quiz (`useQuiz`, `composeSession`, l'allocation) est **intact**.

---

## 4. Dégradations

| Cas | Comportement |
|---|---|
| `speechSynthesis` absent (navigateur / happy‑dom) | `speak()` est déjà un no‑op ; les contrôles s'affichent, inertes, aucune exception |
| Auto‑play bloqué (aucun geste encore) | le bouton **Réécouter** reste le déclencheur ; en pratique le clic « Commencer » a déjà débloqué la session |
| Changement de question / démontage | l'effet appelle `stopSpeaking()` en nettoyage ; `speak()` fait déjà `speechSynthesis.cancel()` avant chaque utterance → pas de chevauchement, pas de double‑lecture même sous React StrictMode (cleanup annule, le second `speak` annule aussi) |
| Débit persisté invalide / absent | `readRate()` rabat sur **0,9** et n'accepte que `{0,7 ; 0,9 ; 1,0}` |
| Question **non‑écoute** | aucun auto‑play, aucun contrôle (inchangé — seule `ecoute` reçoit l'audio) |
| SSR (`renderToStaticMarkup`) | les effets ne tournent pas → pas d'auto‑play ; les contrôles rendus en statique |
| Écriture localStorage en échec | best‑effort (try/catch), comme `writeFuri` |

---

## 5. Tests

- **`audioRate.ts`** (pur) : `readRate` défaut 0,9 ; persiste puis relit ; rabat un débit inconnu
  ou hors `{0,7 ; 0,9 ; 1,0}` sur 0,9 ; `writeRate` best‑effort. Table de cas, store injecté.
- **`tts.ts`** : `speak(text, rate)` ne jette pas quand `speechSynthesis` est absent ;
  `speechTextFor` inchangé (tests existants intacts).
- **`QuestionCard`** :
  - **SSR smoke** (`renderToStaticMarkup`) : le sélecteur de vitesse + le bouton Réécouter sont
    rendus pour une question `ecoute`, **absents** pour une question `grammaire`/`lecture` ;
  - **happy‑dom (montage réel, `createRoot`+`act`)** : monter une question `ecoute` appelle
    `onSpeak` **une fois** (auto‑play) ; monter une non‑écoute ne l'appelle **pas** ; cliquer
    Réécouter rappelle `onSpeak` ; changer la vitesse persiste via `writeRate`. Assertions sur
    sous‑chaînes **sans apostrophe**.
- **Non‑régression** : la signature `onSpeak(rate?)` (argument optionnel) laisse valides le corrigé
  et le diagnostic qui l'ignorent ; `quiz.test.tsx` (QuestionCard SSR sur une question `grammaire`)
  reste vert ; suite complète à 0 échec.

---

## 6. Portée & invariants

- **Aucune touche à `data/graph/`, aucun contenu nouveau.** Les 32 questions d'écoute sont la borne.
- **Pas d'asset livré modifié → pas de bump `sw.js`.**
- ⚠ **`RATE_KEY` est le SEUL ajout à `keys.ts`** — préfixe `jlptN3` obligatoire (sinon jamais
  synchronisée par Gist). Elle rejoint la famille des préférences (thème/furi/police).
- `speechTextFor`, `useQuiz`, la composition de session, `pickAdaptive` : **intacts**.

---

## 7. Hors périmètre (explicitement)

- **Verrouiller les options** derrière la première écoute (débattu, intrusif, stratégie JLPT
  légitime de lire en écoutant).
- **Mode écoute dédié** (options révélées après écoute, énoncé aussi prononcé, refonte du flux).
- **Nouveau contenu d'écoute** (générer des dialogues) — hors sujet, et poserait la question de la
  licence des voix / de la génération.
- **Prononcer l'énoncé‑question** en plus du dialogue — le dialogue est le contenu d'écoute ; la
  question est un repère qu'on lit.
- **Bascule pour désactiver l'auto‑play** — YAGNI (une lecture par question, Réécouter à volonté).
