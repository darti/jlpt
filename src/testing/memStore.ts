/**
 * Double de test pour `localStorage` : store en mémoire à la surface complète de `Storage`
 * (getItem / setItem / removeItem / key / length) plus deux accesseurs d'inspection.
 *
 * Il était recopié dans cinq fichiers de test, en quatre variantes divergentes — chacune
 * rognée à ce dont son fichier avait besoin, si bien qu'ajouter une assertion imposait
 * d'aller ré-enrichir la copie locale. Tous les modules de persistance prennent un store
 * injectable (`storage.ts`, `theme.ts`, `fontscale.ts`, `gist.ts`, `coursProgress.ts`…),
 * donc un seul double les sert tous.
 *
 * Vit sous `src/testing/` et non `src/lib/` : ce n'est pas du code applicatif, et rien du
 * bundle ne doit l'importer par mégarde.
 */
export function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    /** Valeur brute (`undefined` si absente) — asserter sans repasser par `getItem`. */
    _get: (k: string) => m.get(k),
    /** Instantané complet du store. */
    _dump: () => Object.fromEntries(m),
  };
}
