# Cours — synthèse vocale (TTS) sur les contenus japonais

**Date** : 2026-07-13 · **Statut** : validé (design approuvé)

## Objectif

Permettre à l'apprenant d'entendre la prononciation japonaise des contenus de
l'onglet **Cours** via un bouton 🔊 par ligne. 100 % local (Web Speech API),
cohérent avec la PWA offline.

## Réutilisation

Le moteur existe déjà : `speak(text)` de `src/lib/tts.ts` (Web Speech API,
voix `ja-JP`, débit 0.9, `speechSynthesis.cancel()` avant chaque lecture).
Aujourd'hui utilisé uniquement par le quiz — on l'étend au Cours. **Rien à
écrire côté moteur.**

## Composants

### `src/features/cours/SpeakButton.tsx` (nouveau)
Bouton icône haut-parleur (SVG repris de `_SPK` dans `dict.ts`).
- Props : `text: string`, `label?: string` (défaut `"Prononcer"`).
- `onClick` → `speak(text)`.
- **Détection de support** : si `!("speechSynthesis" in window)`, rend `null`
  (pas de bouton mort).
- Style : icône `text-accent`, taille alignée sur `StateToggle` (~w-7 h-7),
  `aria-label={label}`.

### `kanjiExempleJa(exemple: string): string` (helper pur, nouveau)
Extrait la tête japonaise du champ `exemple` des kanjis, au format
`"過去 (kako) passé"` → `"過去"`. Découpe sur le premier espace ou parenthèse.
Placé dans un petit module cours testable (`coursSpeech.ts`).
- Vocab `mot` (« 味 ») et grammaire `ex.jp` (« 安ければ買います。 ») sont déjà
  propres → vocalisés tels quels, sans passer par ce helper.

## Câblage — `GroupDetail.tsx`

Colonne 🔊 **dédiée, alignée à droite** de chaque ligne (choix UX validé) :

| Vue | Texte vocalisé |
|---|---|
| `VocabRow` | `it.mot` |
| `KanjiRow` | `kanjiExempleJa(it.exemple)` — seulement si `it.exemple` présent |
| `Example` (grammaire) | `ex.jp` |

Interaction : un clic = lecture ; reclic = relance (cancel intégré dans
`speak`). Pas de bouton stop (YAGNI).

## Initialisation de la voix

`speak()` fonctionne déjà via `u.lang="ja-JP"`. On ajoute au montage de
`AppShell` un appel unique `pickJaVoice()` + abonnement `onvoiceschanged`
(les voix se chargent en asynchrone) pour un choix de voix plus fiable —
profite aussi au quiz.

## Tests (TDD)

- `kanjiExempleJa` — unitaire : avec parenthèses, sans parenthèses, kana pur,
  chaîne vide.
- `SpeakButton` — SSR smoke (rend le `<button aria-label>`), happy-dom
  (clic → `speak` appelé, `tts` mocké ; non supporté → rend `null`).

## Hors périmètre (YAGNI)

- Réglage de vitesse / voix dans le Cours.
- Bouton stop, file d'attente, surlignage synchronisé.
- TTS ailleurs que dans le Cours (le quiz l'a déjà).

## Notes

- SW/cache : que du `.tsx`/`.ts` → **pas** de bump `sw.js` (HTML network-first).
- Promotion possible de `SpeakButton` vers un module partagé si un 2ᵉ
  consommateur apparaît (règle « extraire à la 2ᵉ occurrence »).
