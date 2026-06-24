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
  **Personal Access Token** GitHub avec la permission **Gists: Read and write** (fine-grained)
  ou le scope **`gist`** (classic). Au premier usage, un **Gist privé** est créé ; ensuite la
  progression est **poussée automatiquement** après chaque quiz et **récupérée** au chargement
  (résolution par horodatage, la version la plus récente gagne).
  Le token reste stocké uniquement dans ton navigateur.

がんばって！
