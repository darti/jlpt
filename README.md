# JLPT N3 — Préparation (déc. 2026)

Application web (React + TypeScript, bundlée par Bun ; PWA installable, 100 % locale) pour
préparer le JLPT N3 en 5 mois. Single-page app à routage par hash — ouvre **`index.html`**.
Les anciennes URL `app-n3.html` / `quiz.html` restent des redirections vers les routes hash.

## Contenu

| Route | Description |
|---|---|
| `#/` | Tableau de bord : progression et accès aux modules |
| `#/entrainement` | **Hub d'entraînement** : lanceur de session, reprise, statistiques |
| `#/quiz` | **Entraînement adaptatif** : QCM corrigés, difficulté ajustée au niveau (modèle type Elo par compétence), diagnostics périodiques, courbe de progression, **probabilité de réussite** et score estimé /180 |
| `#/cours` | **Cours** : grammaire N3 (formation + sens + exemples traduits), kanji par thèmes, vocabulaire, méthodes lecture (読解) & écoute (聴解) |
| `#/planning` | **Planning 20 semaines** en 4 phases, checklist sauvegardée, compte à rebours, ressources |

## Fonctionnement

- 100 % local : la progression et le niveau sont sauvegardés dans le navigateur (`localStorage`).
- Le moteur adaptatif augmente/diminue la difficulté des questions selon tes réponses.
- Un diagnostic complet est conseillé chaque semaine pour mesurer l'évolution.
- La probabilité de réussite est une **estimation pédagogique** fondée sur ta maîtrise par section ; elle se précise avec le nombre de réponses.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` publie automatiquement le site à chaque push
sur `main` ou la branche de préparation.

**Activation :** rendre le dépôt **public** (Settings → General → Danger Zone → *Change
repository visibility*) — Pages depuis un dépôt privé nécessite un plan payant. Le workflow
tente ensuite d'activer Pages automatiquement (`enablement: true`). Si besoin, force la source
via **Settings → Pages → Source = « GitHub Actions »** puis relance le workflow. Le site est
servi à l'URL affichée dans le job *Déployer sur GitHub Pages*.

> ⚠️ **« Page privée » :** sur un compte gratuit/Pro, une page issue d'un dépôt privé reste
> **accessible publiquement** via son URL (juste non indexée). Le contrôle d'accès réservé aux
> membres n'est disponible qu'avec **GitHub Enterprise Cloud**.

## Persistance & synchronisation

- **Local :** progression, niveau, erreurs et checklist sont sauvegardés dans le navigateur
  (`localStorage`), partagés entre toutes les pages du site (même origine).
- **Multi-appareils (☁️ Gist) :** dans l'appli, section *Synchronisation*, colle un
  **Personal Access Token classic** GitHub avec le scope **`gist`** coché
  (le plus fiable ; les tokens *fine-grained* échouent souvent en 403 à la création du Gist).
  Au premier usage, un **Gist privé** est créé ; ensuite la
  progression est **poussée automatiquement** après chaque quiz et **récupérée** au chargement
  (résolution par horodatage, la version la plus récente gagne).
  Le token reste stocké uniquement dans ton navigateur.

がんばって！
