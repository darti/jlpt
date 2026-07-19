/**
 * Chaînes d'utilitaires Tailwind partagées par plusieurs écrans — une seule définition par
 * concept visuel. Avant ce module, le squelette de carte était retapé sur 15 sites et le
 * bouton d'action principal sur 5, avec des dérives silencieuses (p-3/p-4/p-5/p-6/px-6 py-5).
 *
 * Règle : un token porte le CONCEPT (surface, tuile, titre, action) ; un écart de taille
 * restant sur un site est alors un choix explicite, pas une dérive. Les conteneurs en
 * `flex gap-*` prennent les variantes `_TIGHT` (une marge y doublerait l'espacement).
 */

const CARD_BASE = "bg-panel border border-line rounded-xl shadow-card";

/** Surface de contenu pleine largeur (accueil, quiz, réglages, synchro…). */
export const PANEL = `${CARD_BASE} p-5 surface-blur`;

/** `PANEL` sans padding — pour les surfaces qui découpent elles-mêmes leur intérieur (`<details>`). */
export const PANEL_BARE = `${CARD_BASE} surface-blur`;

/** Tuile de navigation compacte (grilles du Cours) — volontairement plus dense que `PANEL`. */
export const TILE = `${CARD_BASE} p-4`;

const H2_BASE = "text-fg text-lg font-bold";

/** Titre de section, marges comprises. */
export const H2 = `${H2_BASE} mt-0 mb-3`;

/** Titre de section sans marge — dans un conteneur `flex flex-col gap-*`. */
export const H2_TIGHT = `${H2_BASE} m-0`;

/** Titre de section avec barre d'accent (hub Cours, méthode N3). */
export const H2_ACCENT = `${H2_BASE} border-l-4 border-accent pl-2.5`;

/** Action principale. Préfixer par `w-full ` pour la version pleine largeur. */
export const BTN_PRIMARY =
  "bg-accent text-fg-on-accent border-none rounded-xl px-4 py-3 font-bold text-base cursor-pointer";

/** Action secondaire, en contour discret — se pose sous un `BTN_PRIMARY`. */
export const BTN_GHOST =
  "bg-transparent border border-line text-fg-dim rounded-xl px-4 py-2.5 text-sm cursor-pointer";
