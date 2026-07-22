/**
 * Le « graphe de confusion » : par quel TYPE de piège l'apprenant se fait avoir.
 *
 * Le blob de progression ne stocke que l'événement brut — quelle question, quelle option
 * choisie, quel jour. Le type est calculé ICI, à l'affichage, depuis le corpus. C'est le
 * principe qui a motivé la migration vers le graphe : un dérivé stocké finit par se
 * désynchroniser, et dans la donnée utilisateur c'est irréparable. Corollaire : affiner la
 * taxonomie re-type tout l'historique, sans migration.
 *
 * ⚠ `untyped` et `outOfScope` sont DEUX compteurs distincts. Le premier mesure une limite du
 * classifieur (« autre »), le second une exclusion assumée (grammaire, écoute, lecture, cf.
 * tools/graph/traps.mjs). Les additionner ferait passer une décision de conception pour une
 * défaillance, et pousserait à « corriger » ce qui marche comme prévu.
 *
 * Module PUR — aucun effet, aucun accès au store. Les effets vivent dans `useQuiz`/`useTraps`.
 */
import type { Question } from "../../types/quiz.ts";

/** Anneau des événements conservés dans le blob. 300 ≈ 4 Ko : négligeable en Gist. */
export const CONF_MAX = 300;

/** Époque du champ « jour » — un entier à trois chiffres plutôt qu'un horodatage à treize. */
export const EPOCH_MS = Date.UTC(2026, 0, 1);

/** `[ord, indexChoisi, jour]`. */
export type Confusion = [number, number, number];

/** Jours écoulés depuis l'époque. */
export function dayNumber(now: Date): number {
  return Math.floor((now.getTime() - EPOCH_MS) / 864e5);
}

/** Les confusions du blob, ou `[]`. Un blob antérieur au champ ne demande aucune migration. */
export function asConfusions(raw: Record<string, unknown> | null): Confusion[] {
  return Array.isArray(raw?.confusions) ? (raw.confusions as Confusion[]) : [];
}

/** Ajoute un événement à l'anneau borné. Pur — la date est injectée, jamais lue ici. */
export function appendConfusion(
  ring: Confusion[], ord: number, choix: number, jour: number,
): Confusion[] {
  return [...ring, [ord, choix, jour] as Confusion].slice(-CONF_MAX);
}

/**
 * Le patch `confusions` d'une réponse — `undefined` quand il n'y a rien à écrire.
 *
 * On n'enregistre QUE les erreurs : décrémenter sur les réussites obligerait à stocker aussi
 * les bonnes réponses, pour un effet que la récence produit gratuitement (un piège qu'on ne
 * déclenche plus sort de la fenêtre de lui-même). Rendre `undefined` plutôt que l'anneau
 * inchangé évite de réécrire un tableau de 300 entrées à chaque bonne réponse.
 */
export function confusionPatch(
  ring: Confusion[], ord: number, choix: number, correct: boolean, jour: number,
): Confusion[] | undefined {
  return correct ? undefined : appendConfusion(ring, ord, choix, jour);
}

/** Libellés d'affichage — une seule source, comme `SKILL_LABELS` : deux écrans qui retapent
 *  leur table finissent par diverger (« Vocab » contre « Vocabulaire »). */
export const KIND_LABELS: Record<string, string> = {
  "kanji-partage": "Kanji partagé",
  voisement: "Voisement erroné",
  "graphie-inexistante": "Graphie inexistante",
  "kanji-confondu": "Kanji confondu",
  "kanji-hors-contexte": "Mauvais kanji pour le contexte",
  "forme-proche": "Forme proche",
  homophone: "Homophone",
  "lecture-on-kun": "Lecture on / kun",
  "lecture-autre-mot": "Lecture d'un autre mot",
  "lecture-erronee": "Lecture erronée",
  "longueur-voyelle": "Longueur de voyelle",
  "nuance-grammaticale": "Nuance grammaticale",
  "sens-different": "Sens différent",
  registre: "Registre",
  autre: "Non classé",
};

export interface TrapCount { kind: string; recent: number }

export interface TrapModel {
  /** Types encore actifs, triés par fréquence récente décroissante. */
  active: TrapCount[];
  /** Types vus dans l'anneau mais absents de la fenêtre récente. */
  resolved: string[];
  /** Événements DANS le périmètre, classés « autre ». */
  untyped: number;
  /** Événements hors périmètre — grammaire, écoute, lecture. Pas un échec du typage. */
  outOfScope: number;
}

/** Index `ord → types des options`, bâti depuis les shards chargés. Ne contient que les
 *  questions PORTANT le champ : son absence EST le critère de périmètre. Pur. */
export function kindIndex(questions: Question[]): Map<number, string[]> {
  const idx = new Map<number, string[]>();
  for (const q of questions) if (Array.isArray(q.trap)) idx.set(q.id, q.trap);
  return idx;
}

/** Le modèle d'affichage. Pur : `today` et `windowDays` sont injectés, jamais lus d'une horloge. */
export function trapModel(
  confusions: Confusion[],
  kindByOrd: Map<number, string[]>,
  today: number,
  windowDays = 30,
): TrapModel {
  const recents = new Map<string, number>();
  const vus = new Set<string>();
  let untyped = 0, outOfScope = 0;

  for (const [ord, choix, jour] of confusions) {
    const kinds = kindByOrd.get(ord);
    if (!kinds) { outOfScope++; continue; }
    const kind = kinds[choix];
    if (!kind || kind === "autre") { untyped++; continue; }
    vus.add(kind);
    if (today - jour < windowDays) recents.set(kind, (recents.get(kind) ?? 0) + 1);
  }

  const active = [...recents]
    .map(([kind, recent]) => ({ kind, recent }))
    .sort((a, b) => b.recent - a.recent || a.kind.localeCompare(b.kind));

  return {
    active,
    resolved: [...vus].filter((k) => !recents.has(k)).sort(),
    untyped,
    outOfScope,
  };
}
