// Extraction des lectures on/kun d'un caractère depuis le XML KANJIDIC2.
//
// Sous-ensemble volontaire : on ne lit que `literal`, les `reading` japonaises et un sens.
// Le reste de KANJIDIC2 — radicaux, traits, fréquences, codepoints, index de manuels — ne
// nous sert pas : on ne cherche que des lectures à PROPOSER.
//
// ⚠ Rien de ce qui sort d'ici ne doit être redistribué (CC BY-SA 4.0, cf. fetch.mjs).
// La sortie est un document d'arbitrage lu par un humain, pas une donnée livrée.
//
// Node pur : la CI exécute `node`, jamais `bun`.

const textOf = (bloc, tag) => {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(bloc);
  return m ? m[1].trim() : "";
};

/** Lectures d'un `r_type` donné, dans l'ordre du fichier — KANJIDIC les classe par usage. */
function readingsOfType(bloc, type) {
  return [...bloc.matchAll(new RegExp(`<reading r_type="${type}">([^<]*)</reading>`, "g"))]
    .map((m) => m[1].trim())
    .filter(Boolean);
}

/**
 * `{ literal, on, kun, sens }` d'un bloc `<character>`.
 *
 * ⚠ Seuls `ja_on` et `ja_kun` sont retenus : KANJIDIC porte aussi le pinyin et le coréen
 * dans les MÊMES balises `<reading>`, distingués par le seul `r_type`. Les prendre en vrac
 * verserait « ba1 » et « phal » dans les furigana d'une app japonaise.
 */
export function readingsOfCharacter(bloc) {
  const fr = /<meaning m_lang="fr">([^<]*)<\/meaning>/.exec(bloc);
  const en = /<meaning>([^<]*)<\/meaning>/.exec(bloc);
  return {
    literal: textOf(bloc, "literal"),
    on: readingsOfType(bloc, "ja_on"),
    kun: readingsOfType(bloc, "ja_kun"),
    sens: (fr ? fr[1] : en ? en[1] : "").trim(),
  };
}

/** `やさ.しい` → `やさ(しい)`. KANJIDIC marque l'okurigana par un point, le projet par des
 *  parenthèses (cf. `cours-kanji.json` et `tools/graph/kana.mjs`). Un tiret final marque un
 *  préfixe, pas un okurigana : on n'y touche pas. */
export function okuriganaEnParentheses(lecture) {
  const i = String(lecture ?? "").indexOf(".");
  if (i < 0) return String(lecture ?? "");
  return `${lecture.slice(0, i)}(${lecture.slice(i + 1)})`;
}

/** Assemble on et kun dans la forme unique attendue par le graphe : `ハチ・や・や(つ)`. */
export function formatLecture(on, kun) {
  return [...on, ...kun.map(okuriganaEnParentheses)].join("・");
}

/**
 * Réduit la liste exhaustive de KANJIDIC à une proposition utilisable.
 *
 * KANJIDIC recense TOUTES les lectures attestées, y compris rares : 一 en porte quatre
 * (`イチ・イツ・ひと-・ひと(つ)`) là où le cours en écrit deux. La règle retenue, volontairement
 * simple et donc prévisible :
 *
 *  - **une seule lecture on**, la première — KANJIDIC les classe par usage ;
 *  - **une seule lecture kun**, la première qui ne soit pas un affixe.
 *
 * Un tiret marque un préfixe (« ひと- ») ou un suffixe (« -づけ ») : ce n'est pas une lecture
 * autonome, et le cours ne l'écrirait pas. Si toutes les formes kun sont des affixes, on ne
 * propose rien plutôt qu'une lecture douteuse — la colonne complète reste sous les yeux de
 * l'auteur, à qui la décision revient.
 *
 * ⚠ C'est une AIDE À LA SAISIE, pas une décision. Rien de ce qui sort d'ici n'entre dans le
 * graphe sans passer par data/lectures-kanji-arbitrees.json, écrit à la main.
 */
export function elaguer(on, kun) {
  const autonome = kun.find((k) => !k.includes("-"));
  return {
    on: on.length ? [on[0]] : [],
    kun: autonome ? [okuriganaEnParentheses(autonome)] : [],
  };
}
