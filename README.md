# JLPT N3 — Préparation (déc. 2026)

Application web autonome (HTML/JS, sans dépendance) pour préparer le JLPT N3 en 5 mois.
Ouvre **`index.html`** dans un navigateur.

## Contenu

| Fichier | Description |
|---|---|
| `index.html` | Page d'accueil reliant les 3 modules |
| `app-n3.html` | **Entraînement adaptatif** : QCM corrigés, difficulté ajustée au niveau (modèle type Elo par compétence), diagnostics périodiques, courbe de progression, **probabilité de réussite** et score estimé /180 |
| `cours-n3.html` | **Cours** : grammaire N3 (formation + sens + exemples traduits), kanji par thèmes, vocabulaire, méthodes lecture (読解) & écoute (聴解) |
| `planning-n3.html` | **Planning 20 semaines** en 4 phases, checklist sauvegardée, compte à rebours, ressources |

## Fonctionnement

- 100 % local : la progression et le niveau sont sauvegardés dans le navigateur (`localStorage`).
- Le moteur adaptatif augmente/diminue la difficulté des questions selon tes réponses.
- Un diagnostic complet est conseillé chaque semaine pour mesurer l'évolution.
- La probabilité de réussite est une **estimation pédagogique** fondée sur ta maîtrise par section ; elle se précise avec le nombre de réponses.

がんばって！
