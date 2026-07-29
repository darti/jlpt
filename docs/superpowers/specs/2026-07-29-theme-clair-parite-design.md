# Thème clair — parité de finition avec le thème sombre

**Date** : 2026-07-29
**Statut** : conçu, prêt à planifier

## 1. Problème

Le thème clair paraît inachevé à côté du sombre : l'effet d'aurores boréales y est à peine
visible et les surfaces translucides ne se lisent pas comme du verre. Ce n'est pas une
impression — c'est mesurable dans `src/styles/themes.css`, et la cause est **une seule
valeur**.

### (a) Du verre blanc posé sur un fond blanc n'a nulle part où se décoller

| | fond | panneau | composite du panneau | écart |
|---|---|---|---|---|
| sombre | `#2e3440` | `rgba(59,66,82,.48)` | assombrit un fond **éclairé par l'aurore** | fort |
| clair | `#eceff4` | `rgba(255,255,255,.55)` | `≈ #f6f7f9` | **≈ 4 %** |

Le sombre fonctionne parce que le panneau **assombrit** un fond que l'aurore a éclairé :
la différence panneau ↔ gouttière vient du halo, pas de la couleur de base. Le clair fait
l'inverse — il éclaircit un fond déjà quasi blanc — et l'effet s'annule. Sur les captures de
l'accueil en clair, on ne distingue pas où une carte finit.

### (b) L'aurore est deux fois trop faible, sur un canevas qui l'écrase

Alphas `.22–.26` en clair contre `.42–.58` en sombre, à hues Nord identiques. Rapporté au
canevas, l'écart de luminance du halo tombe de **~28 points** (sombre) à **~5 points** (clair).
Le calque est bien peint — il se voit dans les zones vides de `/entrainement` — mais il ne
survit ni au voisinage des cartes ni à leur traversée.

### (c) Le liseré interne, qui « vend » le verre, a disparu du bloc clair

`--elevation-card` porte en sombre un `0 1px 0 rgba(236,239,244,0.05) inset` : la lumière de
bord haute qui fait lire une surface comme du verre. Le bloc clair ne le redéfinit pas.

### (d) L'ombre portée du clair est un halo bleu clair, pas une ombre

`rgba(96, 150, 225, .15)` — une couleur *claire*, diffusée à 20 px sur un fond clair. Elle
teinte, elle ne détache pas.

### (e) Quatre tokens que le bloc clair a oubliés

Classe de bug unique — « le clair n'override pas ce que le sombre définit » — et elle est
invisible tant qu'on ne regarde pas le bon écran :

| token | valeur subie en clair | conséquence |
|---|---|---|
| `--color-skill-grammaire` / `-vocabulaire` | **tous deux `#5e81ac`** | deux anneaux de `CoverageRings` confondus (le sombre en a 4 distincts) |
| `--color-danger-bg` / `-line` / `-fg` | `#2a1a1a` / `#713030` / `#f87171` (`@theme`) | bloc rouge quasi noir dans `InstallPrompt` |
| `--elevation-hover` | `rgba(0,0,0,.38)` (`@theme`) | ombre noire dure sous `UpdateBanner` |

### Hors périmètre

`--color-accent-hi` est défini trois fois (`@theme`, `dark`, `light`) et **consommé par aucun
composant** : aucun `bg-accent-hi` ni `hover:` ne le lit. Le clair y vaut `#5e81ac`, identique
à `--color-accent` — mais comme les deux thèmes sont également dépourvus de survol sur les
boutons, ce n'est pas un écart de parité. Le câbler serait ajouter une fonctionnalité.

## 2. Direction retenue

**Verre sur toile teintée.** Le canevas descend d'un cran pour que le verre blanc ait de quoi
se décoller ; l'aurore devient chromatique ; le liseré et l'ombre reviennent. C'est le
fonctionnement du verre clair réel (macOS, iOS) : le fond n'est jamais blanc.

Deux directions écartées :

- **Aurore franche sur canevas blanc, cartes plus transparentes** (`.55 → .40`) : plus
  spectaculaire, mais le texte secondaire tombe alors sur des zones colorées, et `fg-dim` est
  déjà sous le seuil AA (cf. §3.4).
- **Miroir numérique du sombre** (transposer les écarts en inversant la polarité) : un écart
  d'aurore de `−28 L` sur fond clair donne des halos **plus sombres** que le canevas, qui se
  lisent comme des salissures. La symétrie mathématique n'est pas une symétrie perceptuelle.

## 3. Ce qui change

Tout tient dans `src/styles/themes.css`, plus deux tokens rendus thémables dans
`src/styles/tailwind.css`. **Aucun composant n'est touché** : c'est ce que le système de
tokens en place doit permettre. `src/styles/styles.gen.css` est généré et non suivi par git
(`git ls-files src/styles/` ne rend que `tailwind.css` et `themes.css`).

### 3.1 Le canevas (le pivot)

`--color-bg` : `#eceff4` (nord6) → `#e3e8f0` (nord5 refroidi).

C'est la valeur qui fait exister les cartes. Composite du panneau à `.58` sur ce canevas :
`(243,245,249)` contre `(227,232,240)` — un écart de 16/13/9 par canal, que le liseré et
l'ombre achèvent de rendre net.

### 3.2 L'aurore

Alphas `.22–.26` → `.34–.40`, hues Nord **inchangées**. Le `filter` du calque partagé
`body::before` devient thémable :

```css
--aurora-filter: saturate(140%);   /* sombre — valeur en dur actuelle */
--aurora-filter: saturate(165%);   /* clair */
```

`body::before` lit `filter: var(--aurora-filter, saturate(140%))`.

### 3.3 La carte comme verre

- `--color-panel` / `--color-surface` : `.55` → `.58` ;
- `--color-panel-2` / `--color-surface-2` : `rgba(229,233,240,.60)` → `rgba(216,223,235,.62)`,
  pour que les puces internes se creusent sous un panneau devenu plus blanc ;
- `--color-line` `.08` → `.10`, `--color-line-hi` `.14` → `.16` ;
- `--elevation-card` : ombre re-teintée en bleu-gris **sombre** + liseré interne
  `0 1px 0 rgba(255,255,255,.75) inset` ;
- `--effect-backdrop` en clair : `blur(18px) saturate(180%)`. La saturation est ce qui fait que
  le halo **garde sa teinte en traversant le verre** — c'est-à-dire ce qui rend la
  transparence lisible.

### 3.4 Contreparties obligatoires du canevas assombri

Assombrir le canevas dégraderait le texte secondaire. `--color-fg-dim` / `-soft` : `.62` →
`.72` ; `--color-fg-muted` : `.45` → `.55`.

Contraste de `fg-dim` sur carte, calculé en luminance relative WCAG :

| | composite du texte | fond | ratio |
|---|---|---|---|
| avant (`.62` sur `#f6f7f9`) | `(118,123,132)` | `(246,247,249)` | **3,75:1** |
| après (`.72` sur `#f3f5f9`) | `(101,106,116)` | `(243,245,249)` | **4,84:1** |

Le seuil AA du texte courant est 4,5:1 : le clair y **entre**, alors qu'il en était sorti.
Ce gain est indépendant de l'aurore.

### 3.5 Les quatre tokens oubliés

Compétences — quatre hues distinctes, chacune vérifiée ≥ 3:1 (seuil AA des éléments
graphiques) sur carte blanche :

| compétence | clair | ratio |
|---|---|---|
| grammaire | `#5e81ac` (nord10) | 3,72:1 |
| vocabulaire | `#37879b` (nord8 assombri) | 3,89:1 |
| kanji | `#a9882f` | 3,13:1 |
| lecture (= écoute) | `#5e8c4f` | 3,58:1 |

`ecoute` partage délibérément le token de `lecture` (`CoverageRings.tsx:7`).

Danger — `--color-danger-bg: rgba(191,97,106,.12)`, `-line: rgba(191,97,106,.38)`,
`-fg: #b04a52` (4,84:1 sur ce fond, au-dessus du seuil texte).

`--elevation-hover` clair : ombre bleu-gris + liseré, au lieu du noir `.38`.

## 4. Non-régression du thème sombre

Le bloc `dark` ne reçoit qu'**un ajout** : `--aurora-filter: saturate(140%)`, strictement la
valeur qui était en dur dans `body::before`. Le rendu sombre est donc inchangé, et c'est le
**diff CSS qui le prouve** — pas une capture. L'aurore est animée (`aurora-drift`, 42 s) :
deux captures du même écran ne sont jamais comparables au pixel, et s'y fier donnerait une
preuve fausse dans les deux sens.

## 5. Test

### 5.0 Écart assumé — extraction des tokens de forme

Le test de parité écrit tel quel a **échoué pour une raison non anticipée** : `--radius-lg`,
`--radius-xl`, `--radius-2xl` et `--effect-backdrop` sont déclarés par le bloc sombre et pas par
le clair. Pour les rayons, c'est correct — une forme n'a pas de polarité claire/sombre, et le
clair les hérite par la branche `:root` du sélecteur. Mais tant que des tokens **volontairement
partagés** cohabitent avec des tokens **thème-dépendants** dans le même bloc, l'invariant est
indémontrable : il ne distingue pas « partagé à dessein » de « le clair a oublié d'override ».

Correctif retenu, hors du périmètre initialement décrit : les trois rayons sortent dans leur
propre bloc `:root`. Le bloc sombre ne contient alors plus que du thème-dépendant, et la parité
devient exacte. ⚠ `@theme` (tailwind.css) déclare aussi `--radius-*` avec d'autres valeurs
(`--radius-xl: 0.75rem`) : la primauté du nouveau bloc a été **mesurée au navigateur**
(`--radius-xl` calculé = `1.125rem` dans les deux thèmes), pas déduite de l'ordre des `@import`.

### 5.1 Assertions

Un test de mesure sur `themes.css`, dans l'idiom du projet (`src/styles/themes.test.ts`) :

1. **Parité de couverture des tokens** — tout token défini par le bloc `dark` est défini par le
   bloc `light`. Cette assertion fige la classe de bug §1(e) **entière**, pas les trois
   occurrences trouvées : le prochain token ajouté au sombre et oublié au clair échoue ici.
2. **Quatre couleurs de compétence deux à deux distinctes**, dans chaque thème.
3. **`--aurora-filter` défini par les deux thèmes** — le calque partagé le lit sans repli utile.

Le point 1 est la vraie valeur : les points 2 et 3 seraient impliqués par lui si la parité
suffisait, mais elle ne dit rien de l'*égalité* de deux valeurs.

⚠ Le point 2 se lit sur les valeurs **effectives** (`@theme` comme socle, le bloc de thème
l'écrasant) : le sombre ne redéclare pas les couleurs de compétence, et les asserter sur son
seul bloc rendrait le test vide.

⚠ Le parseur du test ancre le sélecteur en **début de ligne** suivi de son `{`. Un `indexOf` nu
attrapait le sélecteur **cité dans les commentaires** de `themes.css`, puis lisait le bloc
suivant : le test passait alors sur le bloc des rayons, et ses trois échecs décrivaient un
défaut inexistant.

## 6. Vérification

- `bun test` complet (les cliquets de mesure vivent loin de `src/styles/`) et
  `bun run typecheck` ;
- captures des 4 routes (`/`, `/entrainement`, `/cours`, `/parametrage`) dans les deux thèmes,
  avant / après ;
- sonde des valeurs **calculées** au navigateur : les quatre couleurs de compétence ne se
  voient pas à l'écran sans progression enregistrée, donc leur distinction se mesure sur
  `getComputedStyle`, pas sur une capture. Elle a aussi confirmé que `backdrop-filter` est
  réellement appliqué (`blur(18px) saturate(1.8)`) et que `--radius-xl` reste à `1.125rem`
  malgré le `0.75rem` de `@theme` ;
- §4 prouvé au niveau des TOKENS, pas au diff textuel : extraction du bloc sombre depuis
  `HEAD` et depuis l'arbre de travail, comparaison clé par clé. Résultat — 0 modifié,
  3 déplacés (les rayons, dont la résolution est mesurée ci-dessus), 1 ajouté
  (`--aurora-filter`, à la valeur qui était en dur).

### Ce qui n'a PAS pu être vérifié

**WebKit.** Trois tentatives, le navigateur ne démarre pas de façon fiable dans cet
environnement (il se lance parfois hors bac à sable puis reste muet, sans naviguer). Chromium
fonctionne normalement.

Risque résiduel jugé faible, et pour une raison précise : le seul membre WebKit-sensible du
lot est `backdrop-filter`, qui exige le préfixe `-webkit-`. Or ce préfixe est émis par
l'utilitaire `surface-blur` (`tailwind.css`), **que ce lot ne touche pas** — la forme de la
déclaration est celle qui est déjà en production pour le thème sombre, seules les valeurs
numériques changent (`blur` 16 → 18 px, `saturate` 140 → 180 %). Le reste (couleurs,
`box-shadow`, `filter` sur un pseudo-élément) n'a pas d'écart connu entre moteurs. À rejouer
si l'environnement WebKit redevient exploitable.

## 7. Itération du 2026-07-30 — verre plus prononcé, fond plus vif et rosé

Retour d'usage : effet de verre trop discret, fond trop sage. Les §3.1–3.3 ci-dessus décrivent
donc l'état intermédiaire ; valeurs courantes ci-dessous.

**Les deux réglages sont couplés, et c'est le point à retenir.** L'écart visuel carte ↔ gouttière
vaut `opacité × (255 − fond)`. Baisser l'opacité du panneau (`.58 → .52`) laisse passer plus de
halo — le levier direct du « plus de verre » — mais réduit du même coup cet écart. Ne le faire
que si le fond gagne en vivacité en face : sinon la carte se **redissout** au lieu de devenir
translucide.

| | avant | après |
|---|---|---|
| `--color-bg` | `#e3e8f0` | `#e8e3ee` (tiré vers nord15) |
| `--color-panel` / `-surface` | `.58` | `.52` |
| `--effect-backdrop` | `blur(18px) saturate(180%)` | `blur(22px) saturate(210%)` |
| aurores (alphas) | `.34–.40` | `.36–.60` |
| `--aurora-filter` | `saturate(165%)` | `saturate(185%)` |

Trois choses font lire une surface comme du verre, et il faut **les trois** : le liseré interne
haut (monté à `.95`), un second liseré **bas** sombre qui donne son épaisseur à la dalle, et une
ombre portée franche qui la décolle.

⚠ Le flou reste à 22 px délibérément : chaque carte porte un `backdrop-filter` et il y en a une
quinzaine à l'écran — au-delà, le coût GPU se paie au défilement sur mobile.

⚠ La **géométrie** des halos (positions, rayons) vit dans `body::before`, partagée par les deux
thèmes. La dominante rose du clair se règle donc uniquement par les couleurs et les alphas : le
froid recule (nord7, nord14), le rose prend les deux positions de droite — nord15 au halo bas,
et un rose plus chaud entre nord15 et nord11 au halo médian, Nord n'ayant qu'un seul mauve (deux
nord15 côte à côte donneraient une tache plate).

### Contraste — mesuré sur les pixels rendus

Le fond d'une carte est un composite (canevas + aurore + `backdrop-filter` + blanc `.52`) que
seul le moteur sait calculer : le déduire des valeurs nominales donnerait un faux chiffre. Mesure
par échantillonnage du PNG (90ᵉ centile de luminance par zone = le fond, le texte étant écarté) :

| zone | `fg` | `fg-dim` |
|---|---|---|
| carte (vide) | 10,60:1 | **4,77:1** |
| carte (zone de texte) | 10,60:1 | **4,78:1** |
| gouttière | 10,51:1 | **4,76:1** |
| canevas | 9,88:1 | **4,60:1** |

Tous au-dessus du seuil AA de 4,5. À alpha constant, le passage de l'état intermédiaire à
celui-ci coûte `4,90 → 4,77` sur carte : marge conservée, mais **elle est mince** — un fond
encore plus soutenu ferait passer `fg-dim` sous AA. C'est la contrainte qui borne la vivacité.

### Dette ouverte — `--color-fg-muted`

`fg-muted` mesure **≈ 3,0:1**, sous le seuil AA du texte. Ce n'est pas une régression de ce lot
(3,14 → 3,06 à alpha constant, et l'original à `.45` valait ≈ 2,4:1), mais le token porte du
**contenu** : les lectures de mots à `text-base` dans `EntityCard.tsx:154,181`.

Le corriger n'est pas un réglage mais un arbitrage de typographie : atteindre 4,5:1 demande
`≈ .70`, soit la valeur de `fg-dim` (`.72`) — la hiérarchie à trois niveaux de gris
disparaîtrait. La vraie question est plutôt : une lecture de mot doit-elle être le tier le plus
effacé de l'interface ? À trancher séparément.
