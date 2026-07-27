#!/usr/bin/env node
// Migration ponctuelle : les textes de lecture embarqués en clair sur la question
// (`jlpt:passage`, 16 questions / 8 textes, hérités de la migration initiale du graphe)
// deviennent des sujets `jlpt:Passage` reliés par `readsPassage`.
//
// ⚠ Aucun `jlpt:ord` ne bouge, aucune question n'est ajoutée ni retirée : `corpus.jsonld` est
// inchangé et la progression persistée (bitsets indexés par ord) reste valide.
//
// ⚠ Idempotent : une question déjà porteuse de `readsPassage` est laissée telle quelle, et un
// texte déjà présent dans passage.jsonld n'est pas dupliqué.
//
// Zéro dépendance, exécuté par `bun`.
import { graphPath, readGraph, writeGraph } from "./jsonld.mjs";

/** Noms français des huit textes, rédigés à la lecture (clé = texte japonais intégral). */
export const NOMS = {
  "私は毎晩、寝る前に三十分だけ本を読むことにしている。最初はなかなか続かなかったが、「一日三十分だけ」と決めてからは、無理なく習慣になった。長い時間やろうとすると、かえって続かないものだ。大切なのは、少しでも毎日続けることだと思う。":
    "Essai : une habitude de lecture chaque soir",
  "みどり図書館からのお知らせ。来週の月曜日から水曜日まで、館内の工事のため休館します。本の返却は、入口の横にある返却ポストへお願いします。なお、インターネットでの予約や貸出期間の延長は、いつも通りご利用いただけます。":
    "Avis : fermeture de la bibliothèque Midori pour travaux",
  "山田さんへ。お疲れさまです。来週の打ち合わせの件ですが、火曜日の午後はどうしても都合がつかなくなってしまいました。申し訳ありませんが、水曜日の同じ時間に変更していただけないでしょうか。もし難しいようでしたら、ご都合のよい日をいくつか教えてください。田中":
    "Courriel à M. Yamada : report d'une réunion",
  "最近、自転車で通勤する人が増えている。電車のように混まず、運動にもなるからだ。ただし、雨の日は危ないので無理をしないほうがいい。私は、晴れた日は自転車、雨の日は電車、と決めている。天気に合わせて方法を変えると、続けやすい。":
    "Essai : le vélo comme moyen de se rendre au travail",
  "先週、家族で温泉に旅行に行った。電車で行く予定だったが、当日は朝から大雨で、電車が止まってしまった。仕方なく車で出発したが、道がとても込んでいて、着いたのは予定より三時間も遅かった。それでも、夜の温泉はとても気持ちがよく、疲れがすっかり取れた。次に行くときは、天気をよく調べてから出かけたいと思う。":
    "Récit : un voyage aux sources chaudes sous la pluie",
  "お客様各位　いつもご利用ありがとうございます。当店は店内の工事のため、七月一日から七月五日まで休業させていただきます。なお、七月六日からは新しくなった店内で営業を再開いたします。ご不便をおかけしますが、よろしくお願いいたします。インターネットでのご注文は休業中もご利用いただけます。":
    "Avis clientèle : fermeture du magasin pour travaux",
  "田中さんへ　明日の会議の資料ですが、人数が増えたので、二十部ではなく三十部用意してください。それから、会議室は三階から五階に変わりました。エアコンの調子が悪いので、上着を持って来たほうがいいかもしれません。準備をよろしくお願いします。何か分からないことがあれば、私の携帯に連絡してください。　佐藤":
    "Note de service : préparatifs pour la réunion de demain",
  "私は去年から週に二回、近くのジムに通っている。最初は体を動かすのがつらくて、行きたくない日も多かった。しかし、同じ時間に通う友人ができてから、楽しく続けられるようになった。一人だと休んでしまうが、待っている人がいると思うと、自然と足が向く。健康のためだけでなく、人とのつながりも大切だと感じている。":
    "Essai : la motivation retrouvée grâce à un ami de sport",
};

/** Migre les textes inline. Pure : les documents sont injectés, rien n'est lu ni écrit ici. */
export function migrateInline(passages, questions, noms) {
  const out = [...passages];
  const parTexte = new Map();
  for (const p of out) parTexte.set(p["jlpt:jp"], p["@id"]);
  let migres = 0;

  const suffixes = out
    .map((p) => /^jlpt:passage\/legacy-(\d+)$/.exec(p["@id"])?.[1])
    .filter(Boolean)
    .map(Number);
  // ⚠ Le compteur dérive du plus grand suffixe legacy-NN DÉJÀ posé, jamais de la longueur du
  // tableau : passage.jsonld accueillera bientôt des passages d'un autre préfixe, et l'indice
  // cesserait alors d'être déterministe.
  let compteur = suffixes.length ? Math.max(...suffixes) : 0;
  const nextIndex = () => ++compteur;
  const questionsOut = questions.map((q) => {
    const texte = q["jlpt:passage"];
    if (typeof texte !== "string") return q;
    let id = parTexte.get(texte);
    if (!id) {
      const n = String(nextIndex()).padStart(2, "0");
      id = `jlpt:passage/legacy-${n}`;
      out.push({
        "@id": id,
        "@type": "jlpt:Passage",
        "schema:name": noms[texte] ?? `Texte de lecture ${n}`,
        "jlpt:format": "tanbun",
        "jlpt:jp": texte,
      });
      parTexte.set(texte, id);
      migres++;
    }
    const { "jlpt:passage": _retire, ...reste } = q;
    return { ...reste, readsPassage: id };
  });

  return { passages: out, questions: questionsOut, migres };
}

function main() {
  const cheminP = graphPath("passage.jsonld"), cheminQ = graphPath("q-lecture.jsonld");
  const { doc: docP, subjects: sujetsP } = readGraph(cheminP);
  const { doc: docQ, subjects: sujetsQ } = readGraph(cheminQ);
  const r = migrateInline(sujetsP, sujetsQ, NOMS);
  if (!r.migres) {
    console.log("✓ rien à migrer — les textes sont déjà des sujets jlpt:Passage");
    return 0;
  }
  writeGraph(cheminP, docP, r.passages);
  writeGraph(cheminQ, docQ, r.questions);
  console.log(`✓ ${r.migres} textes migrés vers jlpt:Passage`);
  return 0;
}

if (import.meta.main) process.exit(main());
