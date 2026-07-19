import { visualBreak } from "../lib/dict.ts";

/**
 * Analyse en blocs de couleur d'une phrase (décomposition « · »-séparée : mot « sens » · …).
 *
 * Rendu UNIQUE partagé par le corrigé du quiz (`Corrige`) et l'apprentissage du cours
 * (`GroupDetail`/`Example`) : avant, chacun appelait `visualBreak` à sa façon (le corrigé via un
 * global legacy avec repli texte brut, le cours par import direct), avec une taille et une légende
 * divergentes. On unifie ici : import direct du module, jamais de légende, taille `text-lg`.
 *
 * `visualBreak` est une fonction pure (utilise le DICT chargé au runtime dans le même module) —
 * sûre en SSR (`renderToStaticMarkup`) : sans dico, les furigana inline restent, les autres sont
 * simplement absents.
 */
export function SentenceAnalysis({ source, className }: { source: string; className?: string }) {
  if (!source) return null;
  return (
    <div
      className={className ? "text-lg " + className : "text-lg"}
      dangerouslySetInnerHTML={{ __html: visualBreak(source, { legend: false }) }}
    />
  );
}
