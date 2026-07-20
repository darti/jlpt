/**
 * Énumération canonique des clés localStorage de l'app.
 *
 * Elles étaient déclarées en constantes privées, module par module : `jlptN3_updatedAt`
 * dans cinq fichiers, `jlptN3adapt_v2` dans deux, `jlptN3_gh` en constante ici et en
 * littéral nu là-bas. Une clé retapée à un caractère près, c'est une donnée utilisateur
 * qui disparaît sans erreur — d'où une seule source, ici.
 *
 * Toutes partagent le préfixe `jlptN3` : `gist.ts#collectData` balaie le store sur ce
 * préfixe pour construire la sauvegarde, donc **une clé applicative nouvelle doit le
 * porter**, sinon elle n'est jamais synchronisée.
 */

/** Préfixe commun — critère de balayage du store pour l'export / la synchro Gist. */
export const KEY_PREFIX = "jlptN3";

/** Blob de progression : Elo par compétence, erreurs, bitsets vu/appris, historique. */
export const PROGRESS_KEY = "jlptN3adapt_v2";

/** Horodatage ISO de la dernière écriture locale — arbitre local vs distant à la synchro. */
export const UPDATED_KEY = "jlptN3_updatedAt";

/** Session de quiz en cours (purgée au-delà de 2 jours). Volontairement distincte du
 *  `jlptN3_resume` du vanilla `app-n3` : les deux applications ne doivent jamais écraser
 *  la session en cours l'une de l'autre, la reprise interne fonctionnant par ailleurs. */
export const RESUME_KEY = "jlptN3quiz_resume";

/** Avancement du cours (état par item). */
// v2 : les ids d items sont devenus des IRIs du graphe (jlpt:gram/X) quand les cours y sont
// entrés. Relire une progression v1 (clés « gram:X ») afficherait 0 % partout, sans erreur.
export const COURS_KEY = "jlptN3_cours_v2";

export const THEME_KEY = "jlptN3_theme";

export const FURI_KEY = "jlptN3_furi";

/** Échelle de police : `jlptN3_fsUi` / `jlptN3_fsJp`. */
export function fsKey(kind: "Ui" | "Jp"): string {
  return `jlptN3_fs${kind}`;
}

/** Config Gist (jeton GitHub) — JAMAIS incluse dans un export ni dans un backup importé. */
export const GH_CFG_KEY = "jlptN3_gh";

/** Marqueur de push différé (hors ligne ou échec). */
export const PENDING_KEY = "jlptN3_pending";

/** Horodate la dernière écriture locale. Best-effort : une erreur de stockage est ignorée. */
export function stampUpdated(
  store: Pick<Storage, "setItem">,
  nowIso: string = new Date().toISOString(),
): void {
  try { store.setItem(UPDATED_KEY, nowIso); } catch { /* best-effort */ }
}
