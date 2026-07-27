/**
 * Fabrique de préférence persistée : une clé, un codec, un défaut.
 *
 * Les cinq préférences de l'app (thème, furigana, échelle de police, débit d'écoute, mode
 * rappel) sont le MÊME objet : un scalaire dans `localStorage`, lu avec un défaut, écrit en
 * best-effort. Chacune retapait ce corps — et trois d'entre elles avaient perdu une ligne en
 * route : `writeFuri`, `writeRate` et `writeProduction` n'appelaient pas `stampUpdated`.
 *
 * ⚠ Ce n'était pas cosmétique. `gist.ts#collectData` prend `UPDATED_KEY` pour `updatedAt` et
 * `cloudPull` n'applique le distant que si `remoteT > localT` : changer SEULEMENT le furigana,
 * le débit ou le mode rappel laissait l'horodatage périmé, et la synchro suivante restaurait
 * l'ancienne valeur — sans erreur, sans trace. La duplication est ce qui rendait l'écart
 * invisible ; la fabrique le rend **irreprésentable** : il n'y a plus qu'un `write`.
 *
 * Les fonctions d'application au DOM (`applyTheme`, `applyFuri`, `applyFontScale`) restent
 * dans leur module : elles touchent au document, pas au stockage.
 */

import { stampUpdated } from "./keys.ts";

/** Lecture seule — la surface minimale qu'un appelant doit fournir. */
export type ReadStore = Pick<Storage, "getItem">;
/** Lecture + écriture : `stampUpdated` écrit une seconde clé, d'où `setItem`. */
export type WriteStore = Pick<Storage, "setItem">;

/** Traduction valeur ↔ chaîne stockée. `decode` reçoit `null` quand la clé est absente et
 *  doit TOUJOURS rendre une valeur : c'est là que vit le défaut de la préférence. */
export interface PrefCodec<T> {
  decode(raw: string | null): T;
  encode(value: T): string;
}

export interface Pref<T> {
  /** La clé `localStorage` — exposée pour les tests et l'inventaire de `keys.ts`. */
  readonly key: string;
  /** Valeur persistée, ou le défaut du codec. Ne jette jamais (store en échec → défaut). */
  read(store?: ReadStore): T;
  /** Persiste + horodate, best-effort ; rend la valeur écrite (pour `setState(write(v))`). */
  write(value: T, store?: WriteStore): T;
}

/** Construit une préférence à partir de sa clé et de son codec. */
export function pref<T>(key: string, codec: PrefCodec<T>): Pref<T> {
  return {
    key,
    read(store: ReadStore = globalThis.localStorage): T {
      // Le décodage lui-même est dans le `try` : un codec qui jette sur une valeur corrompue
      // doit dégrader vers le défaut comme le fait un store en échec.
      try { return codec.decode(store.getItem(key)); } catch { return codec.decode(null); }
    },
    write(value: T, store: WriteStore = globalThis.localStorage): T {
      try {
        store.setItem(key, codec.encode(value));
        stampUpdated(store);
      } catch { /* best-effort : une écriture impossible ne casse pas l'UI */ }
      return value;
    },
  };
}

/** Booléen stocké sous deux littéraux explicites (`"on"`/`"off"`, `"1"`/`"0"`…).
 *  Toute autre valeur lit `false` — c'est le défaut historique des trois booléens. */
export function boolPref(key: string, vrai: string, faux: string): Pref<boolean> {
  return pref(key, {
    decode: (raw) => raw === vrai,
    encode: (v) => (v ? vrai : faux),
  });
}

/** Valeur contrainte à une énumération de nombres ; tout le reste est rabattu sur `defaut`.
 *  `Number(null)` vaut 0 — hors énumération, donc l'absence tombe bien sur le défaut. */
export function enumPref<T extends number>(
  key: string, valeurs: readonly T[], defaut: T,
): Pref<T> {
  return pref(key, {
    decode: (raw) => {
      const n = Number(raw);
      return (valeurs as readonly number[]).includes(n) ? (n as T) : defaut;
    },
    encode: (v) => String(v),
  });
}

/** Nombre accepté dans `[min, max]` ; hors bornes, absent ou illisible → `defaut`. */
export function numberPref(
  key: string, min: number, max: number, defaut: number,
): Pref<number> {
  return pref(key, {
    decode: (raw) => {
      const v = parseFloat(raw ?? "");
      return v >= min && v <= max ? v : defaut;
    },
    encode: (v) => String(v),
  });
}
