/**
 * Lecture de l'état dérivé des entités du cours, et unique geste d'écriture (« je connais »).
 *
 * Remplace `useCoursProgress` : plus de cochage cyclique persisté, l'état se calcule depuis la
 * carte FSRS (`entityState.ts`). Le seul geste offert écrit dans la MÉMOIRE au lieu de poser un
 * drapeau — une affirmation devient une hypothèse testable au lieu d'un angle mort : l'entité est
 * classée acquise, et le planificateur la ramènera une fois pour vérifier la déclaration.
 */
import { useCallback, useEffect, useState } from "react";
import { readRawProgress, writeProgress } from "../../lib/storage.ts";
import { asFsrs, type FsrsMap } from "../quiz/revision.ts";
import { dayNumber } from "../quiz/traps.ts";
import { declaredKnownCard, entityState, type EntityState } from "./entityState.ts";
import { loadCoursProgress, migrateCoursProgress } from "./coursProgress.ts";

export interface EntityStates {
  fsrs: FsrsMap;
  today: number;
  stateOf: (iri: string) => EntityState;
  markKnown: (iri: string) => void;
}

export function useEntityStates(): EntityStates {
  const [today] = useState(() => dayNumber(new Date()));
  const [fsrs, setFsrs] = useState<FsrsMap>(() => asFsrs(readRawProgress()));

  // Migration du cochage manuel (COURS_KEY) vers la carte FSRS, à CHAQUE montage — sans drapeau.
  // `migrateCoursProgress` est idempotente PAR CONSTRUCTION (elle n'écrase jamais une carte
  // existante et rend `null` quand il n'y a rien à faire) : la rejouer est un no-op
  // auto-cicatrisant. Un drapeau posé après une écriture `writeProgress` best-effort échouée
  // (quota) aurait marqué la migration faite sans qu'elle le soit, sans jamais la rejouer ; et
  // `gist.ts#applyData` ne fait que `setItem` (jamais `removeItem`), donc un `pull` d'une
  // sauvegarde antérieure à la migration aurait laissé le drapeau à "1" avec un blob non migré.
  useEffect(() => {
    const suivant = migrateCoursProgress(loadCoursProgress(), asFsrs(readRawProgress()), today);
    if (suivant) {
      writeProgress({ fsrs: suivant });
      setFsrs(suivant);
    }
  }, [today]);

  const stateOf = useCallback(
    (iri: string) => entityState(fsrs[iri], today),
    [fsrs, today],
  );

  // ⚠ `writeProgress` ne deep-merge QUE `skill` : le champ `fsrs` est remplacé en entier, il
  // faut donc toujours réécrire la carte complète (même contrainte que `fsrsPatch`).
  //
  // ⚠ On relit `readRawProgress()` au moment du clic plutôt que de partir de `cur` (l'état React,
  // figé au montage) : un autre onglet — ou un `cloudPull` Gist — a pu écrire des cartes depuis
  // le montage de CE hook. Partir de `cur` les aurait écrasées en entier, sans erreur. L'effet
  // de bord (`writeProgress`) est aussi sorti de l'updater de `setState` : React peut rejouer un
  // updater plusieurs fois (StrictMode, concurrent), ce qui aurait pu écrire deux fois.
  // ⚠ `declaredKnownCard` plutôt que `fsrsInit(3)` : une DÉCLARATION pose le seuil d'acquisition,
  // là où une note de révision repartait de 3,7 j — donc ramenait le point quatre jours plus tard
  // au lieu de l'évacuer. Le geste n'a plus de grade : « je sais déjà » n'est pas une réponse.
  const markKnown = useCallback((iri: string) => {
    const base = asFsrs(readRawProgress());
    const suivant: FsrsMap = { ...base, [iri]: declaredKnownCard(base[iri], today) };
    writeProgress({ fsrs: suivant });
    setFsrs(suivant);
  }, [today]);

  return { fsrs, today, stateOf, markKnown };
}
