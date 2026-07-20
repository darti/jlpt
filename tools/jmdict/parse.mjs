// Extraction des paires forme-kanji → lecture depuis le XML JMdict.
//
// Sous-ensemble volontaire : on ne lit que k_ele/keb et r_ele/reb, plus les deux
// qualificateurs qui changent l'appariement (re_restr, re_nokanji) et la priorité
// (ke_pri/re_pri). Le reste de JMdict — sens, parties du discours, références
// croisées — ne nous sert pas : on ne cherche que des lectures à PROPOSER.
//
// ⚠ Rien de ce qui sort d'ici ne doit être redistribué (CC BY-SA 4.0, cf. fetch.mjs).
// La sortie est un document d'arbitrage lu par un humain, pas une donnée livrée.
//
// Zéro dépendance, exécuté par `bun` comme tout le reste du dépôt.

const KANA_ONLY = /^[ぁ-んァ-ヴー]+$/;

/** Priorité d'une forme : nombre de marqueurs `*_pri`. Plus il y en a, plus la forme
 *  est courante dans les corpus de référence de JMdict. */
const priOf = (bloc) => (bloc.match(/<(?:ke|re)_pri>/g) ?? []).length;

const textOf = (bloc, tag) => {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(bloc);
  return m ? m[1].trim() : null;
};

const allOf = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))]
  .map((m) => m[1]);

/**
 * Paires `{ keb, reb, pri }` d'une entrée.
 *
 * Deux règles de JMdict qu'il faut respecter sous peine de fabriquer de fausses
 * lectures :
 *  - `re_restr` : la lecture ne vaut QUE pour les formes listées. Sans ça, on ferait
 *    le produit croisé et on attribuerait « シーディープレイヤー » à « ＣＤプレーヤー ».
 *  - `re_nokanji` : la lecture ne correspond à aucune forme kanji (transcription
 *    alternative). L'associer produirait un furigana faux.
 */
export function readingsOfEntry(entryXml) {
  const kebs = allOf(entryXml, "k_ele")
    .map((b) => ({ keb: textOf(b, "keb"), pri: priOf(b) }))
    .filter((k) => k.keb);
  if (!kebs.length) return [];

  const out = [];
  for (const bloc of allOf(entryXml, "r_ele")) {
    if (/<re_nokanji\s*\/?>/.test(bloc)) continue;
    const reb = textOf(bloc, "reb");
    if (!reb || !KANA_ONLY.test(reb)) continue;
    const rpri = priOf(bloc);
    const restr = [...bloc.matchAll(/<re_restr>([^<]*)<\/re_restr>/g)].map((m) => m[1].trim());
    const cibles = restr.length ? kebs.filter((k) => restr.includes(k.keb)) : kebs;
    for (const k of cibles) out.push({ keb: k.keb, reb, pri: Math.max(k.pri, rpri) });
  }
  return out;
}

const EST_HIRAGANA = /^[ぁ-んー]+$/;

/** Meilleure lecture d'une liste. Ordre de préférence :
 *   1. hiragana plutôt que katakana — une lecture de mot sert de furigana, et une lecture
 *      en katakana signale presque toujours un emploi spécialisé ou un emprunt
 *      (JMdict propose « ロン » pour 栄, terme de mahjong, avant « えい ») ;
 *   2. la plus fréquente selon les marqueurs *_pri de JMdict ;
 *   3. la plus courte.
 *  À égalité stricte, l'ordre de JMdict tranche (ses entrées sont déjà ordonnées). */
export function bestReading(paires) {
  if (!paires.length) return null;
  const trie = [...paires].sort((a, b) =>
    (Number(EST_HIRAGANA.test(b.reb)) - Number(EST_HIRAGANA.test(a.reb)))
    || (b.pri - a.pri)
    || (a.reb.length - b.reb.length));
  return trie[0].reb;
}
