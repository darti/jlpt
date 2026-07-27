import { useEffect, useState } from "react";

/**
 * Calcule un modèle **une seule fois, après le montage**, côté client.
 *
 * Sert aux panneaux d'accueil dont le modèle se dérive du seul `localStorage` (cadence,
 * révision) : le calcul est synchrone, mais il ne peut pas se faire au rendu.
 *
 * ⚠ La raison du `useEffect` n'est PAS le coût du calcul, c'est le SSR. Les composants sont
 * fumés au `renderToStaticMarkup` (cf. CLAUDE.md) : lire le store pendant le rendu ferait
 * diverger la sortie serveur de la sortie client. Différer au montage laisse le premier rendu
 * à `null` — l'état que les panneaux savent déjà afficher (invite / squelette).
 *
 * `compute` rend `null` quand il n'y a rien à montrer ; cet état est indiscernable de « pas
 * encore calculé », et c'est voulu — l'appelant n'affiche rien dans les deux cas.
 *
 * ⚠ `compute` n'est volontairement pas une dépendance de l'effet : le contrat est « une fois »,
 * et les appelants passent des lambdas recréées à chaque rendu, qui relanceraient le calcul en
 * boucle. Même parti pris que `useAsyncOnce`, pour la version synchrone.
 */
export function useClientOnce<T>(compute: () => T | null): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => { setValue(compute()); }, []);
  return value;
}
