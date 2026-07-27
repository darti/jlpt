import { loadSkill } from "../../lib/graph.ts";
import { readRawProgress } from "../../lib/storage.ts";
import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";
import { asConfusions, dayNumber, kindIndex, trapModel, type TrapModel } from "../quiz/traps.ts";

/**
 * Le modèle des pièges, chargé PARESSEUSEMENT.
 *
 * ⚠ Les deux shards typés sont les plus gros du corpus : les charger sur l'Accueil pour n'y
 * rien afficher coûterait plusieurs secondes au démarrage. Le court-circuit est AVANT le
 * `await` — un nouvel arrivant ne paie donc aucun fetch. `loadSkill` est mémoïsé : un
 * utilisateur qui a déjà fait un quiz dans la session ne repaye pas non plus.
 *
 * Le cycle de vie (drapeau de démontage, échec réseau avalé → reste `null` hors ligne) vient
 * de `useAsyncOnce`. Il était retapé ici à la main, alors que le hook existait déjà.
 */
export function useTraps(): TrapModel | null {
  return useAsyncOnce(async () => {
    const confusions = asConfusions(readRawProgress());
    if (!confusions.length) return null; // avant tout fetch
    const [k, v] = await Promise.all([loadSkill("kanji"), loadSkill("vocabulaire")]);
    return trapModel(confusions, kindIndex([...k, ...v]), dayNumber(new Date()));
  });
}
