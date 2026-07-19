import { useEffect, useState } from "react";

/**
 * Charge une ressource asynchrone **une seule fois**, au montage.
 *
 * Vaut `null` tant qu'elle n'a pas résolu — et aussi si elle échoue (première visite hors
 * ligne), pour que l'appelant dégrade proprement au lieu de planter. Le drapeau `alive`
 * évite un `setState` après démontage.
 *
 * ⚠ `load` n'est volontairement PAS une dépendance de l'effet : le contrat est « une fois »,
 * et les appelants passent des lambdas recréées à chaque rendu, qui relanceraient le
 * chargement en boucle. Pour recharger quand une clé change, il faut un autre hook.
 */
export function useAsyncOnce<T>(load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((v) => { if (alive) setValue(v); }).catch(() => { /* hors ligne → reste null */ });
    return () => { alive = false; };
  }, []);
  return value;
}
