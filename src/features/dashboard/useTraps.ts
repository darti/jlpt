import { useEffect, useState } from "react";
import { loadSkill } from "../../lib/graph.ts";
import { readRawProgress } from "../../lib/storage.ts";
import { asConfusions, dayNumber, kindIndex, trapModel, type TrapModel } from "../quiz/traps.ts";

/**
 * Le modèle des pièges, chargé PARESSEUSEMENT.
 *
 * ⚠ Les deux shards typés sont les plus gros du corpus : les charger sur l'Accueil pour n'y
 * rien afficher coûterait plusieurs secondes au démarrage. On ne les demande donc que si des
 * confusions existent — le cas d'un nouvel arrivant ne coûte rien. `loadSkill` est mémoïsé :
 * un utilisateur qui a déjà fait un quiz dans la session ne repaye pas le fetch.
 */
export function useTraps(): TrapModel | null {
  const [model, setModel] = useState<TrapModel | null>(null);
  useEffect(() => {
    const confusions = asConfusions(readRawProgress());
    if (!confusions.length) return;
    let vivant = true;
    Promise.all([loadSkill("kanji"), loadSkill("vocabulaire")])
      .then(([k, v]) => {
        if (!vivant) return;
        setModel(trapModel(confusions, kindIndex([...k, ...v]), dayNumber(new Date())));
      })
      .catch(() => { /* hors ligne : le panneau reste sur son état vide */ });
    return () => { vivant = false; };
  }, []);
  return model;
}
