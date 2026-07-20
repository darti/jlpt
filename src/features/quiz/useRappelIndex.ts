import { useAsyncOnce } from "../../hooks/useAsyncOnce.ts";
import { loadRappelIndex, type RappelIndex } from "./rappel.ts";

/** Charge l'index des rappels une fois ; `null` tant qu'il n'a pas résolu (ou s'il échoue).
 *  Nomme le concept côté feature : la vue n'a pas à connaître le chargeur sous-jacent. */
export function useRappelIndex(): RappelIndex | null {
  return useAsyncOnce(loadRappelIndex);
}
