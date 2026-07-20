// Découpage d'une lecture de kanji telle que l'écrit le cours : « イ・くらい ».
//
// La convention japonaise sépare on (katakana) et kun (hiragana) ; le cours les met dans un
// seul champ, séparés par « ・ ». Le graphe les veut distincts (jlpt:onReading / kunReading,
// déjà déclarés dans KanjiShape mais jamais alimentés jusqu'ici).
//
// Node pur : la CI exécute `node`, jamais `bun`.

// L'okurigana est écrit entre parenthèses — « やさ(しい) » — et appartient à la lecture kun,
// donc le test porte sur le segment ENTIER : une lecture on est du katakana pur.
const KATAKANA = /^[ァ-ヶー]+$/;

/** Sépare une lecture « on・kun » en deux listes, par script. */
export function splitOnKun(lecture) {
  const on = [];
  const kun = [];
  for (const brut of String(lecture ?? "").split("・")) {
    const seg = brut.trim();
    if (!seg) continue;
    if (KATAKANA.test(seg)) on.push(seg);
    else kun.push(seg);
  }
  return { on, kun };
}
