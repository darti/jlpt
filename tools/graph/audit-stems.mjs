// Détecte les énoncés qui admettent plusieurs réponses correctes.
//
// TROIS classes, et la distinction entre elles est tout l'intérêt du module : deux sont
// des PREUVES tirées du graphe, la troisième n'est qu'un soupçon tiré de la prose.
//
//   contradictions — PROUVÉ. Deux questions portent le même énoncé et se corrigent
//     mutuellement à tort (#2569 vs #4609 sur 「あける」 : 開ける d'un côté, 明ける de
//     l'autre). Aucun jugement requis, le corpus se contredit lui-même.
//
//   memeLecture — PROUVÉ. Un distracteur porte la MÊME jlpt:reading que la réponse
//     (開ける et 明ける se lisent tous deux あける, cf. word.jsonld). Demander « écrivez
//     あける en kanji » admet alors les deux. C'est le graphe qui l'établit, pas nous.
//
//   suspects — HEURISTIQUE, jamais un verrou. Un distracteur non-réponse est annoté
//     « homophone » par l'auteur du corrigé. ⚠ Le mot n'a pas le même sens selon le SENS
//     de la question, et c'est un piège coûteux :
//       · 「X」を漢字で書くと？  (lecture → kanji) : « homophone » = graphie concurrente
//         de la MÊME lecture, donc seconde bonne réponse. Signal utile.
//       · 「X」の読み方は？      (kanji → lecture) : « homophone » = lecture d'un AUTRE
//         mot (いっぱん = 一般, distracteur de 一番). La question est saine.
//     Restreindre au sens écriture élimine 36 faux positifs constatés. Le reste alimente
//     un rapport de relecture — jamais la CI : word.jsonld ne couvre que ~4166 mots, donc
//     la preuve établit la présence d'ambiguïté, jamais son absence.
//
// Node pur : la CI exécute `node`, jamais `bun`.

const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const isQuestion = (s) => arr(s["@type"]).includes("jlpt:Question");

/** Questions demandant d'ÉCRIRE une lecture en kanji. Seul sens où deux graphies d'une
 *  même lecture sont deux bonnes réponses. */
const DEMANDE_ECRITURE = /を漢字で書くと/;

/** Le corpus écrit ses trous de DEUX façons, et il faut lire les deux :
 *    · `___` — souligné ASCII, au moins trois : 1529 énoncés (q-grammaire, q-kanji, et
 *      les questions de vocabulaire réécrites ici). C'est la forme dominante, la seule
 *      que `stems.mjs` accepte d'écrire — inutile de propager la minoritaire.
 *    · `＿` / `＿＿` — souligné pleine chasse U+FF3F : 256 énoncés, tous en grammaire.
 *  Ne reconnaître que l'ASCII ferait réclamer l'arbitrage de 256 questions DÉJÀ à trou. */
const TROU = /_{3,}|＿+/;

/** Une lecture est du kana, point. `word.jsonld` porte pourtant des PLACEHOLDERS dans ce
 *  champ : « — » (4 entrées), « さ / ちがい », « ことし（特別な読み） ». Sans ce filtre,
 *  deux mots qui partagent le placeholder « — » passent pour homophones — c'est ainsi que
 *  しっかり et すっかり ont été déclarés de même lecture. Un placeholder n'est pas une
 *  donnée : mieux vaut n'en rien conclure. */
const EST_KANA = /^[ぁ-ゖァ-ヺー゛゜]+$/;

/** Un énoncé est désambiguïsé s'il porte un trou ou la glose de sens 「…の意味」.
 *  Les deux formes préexistent dans le corpus ; on reconnaît les deux pour ne pas
 *  redemander l'arbitrage de ce qui est déjà arbitré. */
export function isDisambiguated(stem) {
  const s = String(stem ?? "");
  return TROU.test(s) || /の意味/.test(s);
}

/** Index mot → lecture, bâti sur les `jlpt:Word` ATTESTÉS du graphe — ceux qui portent
 *  une glose. `validate-graph.mjs` charge tous les shards dans un seul tableau, donc
 *  `word.jsonld` est là quand on en a besoin.
 *
 *  ⚠ La restriction aux mots glosés n'est pas cosmétique. `word.jsonld` contient des
 *  entrées FABRIQUÉES : des distracteurs de quiz importés jadis comme mots, dotés de la
 *  lecture de la bonne réponse et d'aucune glose (約速、役束、約則 tous « やくそく »).
 *  Sans ce filtre, 「やくそく」の漢字は？ passe pour ambiguë alors que ses quatre options
 *  n'ont qu'une graphie réelle. La glose est le seul marqueur d'attestation disponible.
 *
 *  Le compromis est assumé et dissymétrique : le filtre écarte 19 fabrications au prix de
 *  3 vrais mots dont l'entrée est incomplète (始め、始めて、謝り). Pour un verrou de CI
 *  c'est le bon sens de l'erreur — un faux positif bloque du travail légitime, un faux
 *  négatif laisse un cas à rattraper à la main. Ce n'est donc PAS une preuve exhaustive. */
export function readingIndex(sujets) {
  const idx = new Map();
  for (const s of sujets) {
    if (!arr(s["@type"]).includes("jlpt:Word")) continue;
    const nom = s["schema:name"];
    const lecture = s["jlpt:reading"];
    const glose = String(s["schema:description"] ?? "").trim();
    if (typeof nom === "string" && EST_KANA.test(String(lecture ?? "")) && glose) {
      idx.set(nom, lecture);
    }
  }
  return idx;
}

/** Questions dont un distracteur partage la lecture de la réponse. Rend les `@id`.
 *  Un mot absent de l'index ne prouve rien — il est ignoré, jamais présumé distinct. */
export function sameReadingConflicts(sujets, lectures) {
  const out = [];
  for (const q of sujets) {
    if (!isQuestion(q)) continue;
    const opts = arr(q.opts);
    const reponse = opts[q["jlpt:answer"]];
    const lectureReponse = lectures.get(reponse);
    if (!lectureReponse) continue;
    const jumeaux = opts.filter((o, i) => i !== q["jlpt:answer"] && lectures.get(o) === lectureReponse);
    if (jumeaux.length) out.push({ id: q["@id"], ord: q["jlpt:ord"], answer: reponse, jumeaux, lecture: lectureReponse });
  }
  return out;
}

/** Rend les trois classes d'énoncés à arbitrer. Fonction pure : aucune lecture disque. */
export function auditStems(sujets) {
  const questions = sujets.filter(isQuestion);
  const lectures = readingIndex(sujets);

  // --- contradictions : clé = énoncé SEUL ---
  const parEnonce = new Map();
  for (const q of questions) {
    const k = norm(q["jlpt:stem"]);
    if (!parEnonce.has(k)) parEnonce.set(k, []);
    parEnonce.get(k).push(q);
  }
  const contradictions = [];
  for (const [stem, groupe] of parEnonce) {
    if (groupe.length < 2) continue;
    const reponses = new Set(groupe.map((q) => norm(arr(q.opts)[q["jlpt:answer"]])));
    if (reponses.size < 2) continue;
    contradictions.push({
      stem,
      questions: groupe.map((q) => ({
        id: q["@id"], ord: q["jlpt:ord"], answer: norm(arr(q.opts)[q["jlpt:answer"]]),
      })),
    });
  }

  // --- même lecture : preuve tirée de word.jsonld ---
  const memeLecture = sameReadingConflicts(questions, lectures)
    .filter((c) => !isDisambiguated(questions.find((q) => q["@id"] === c.id)?.["jlpt:stem"]));

  // --- suspects : note de prose, restreinte au sens écriture ---
  const prouves = new Set(memeLecture.map((c) => c.id));
  const suspects = questions
    .filter((q) => DEMANDE_ECRITURE.test(String(q["jlpt:stem"] ?? "")))
    .filter((q) => !isDisambiguated(q["jlpt:stem"]))
    .filter((q) => !prouves.has(q["@id"]))
    .filter((q) => arr(q["jlpt:optionNote"])
      .some((n, i) => i !== q["jlpt:answer"] && /homophone/i.test(String(n))))
    .map((q) => ({
      id: q["@id"], ord: q["jlpt:ord"], stem: norm(q["jlpt:stem"]),
      opts: arr(q.opts), answer: norm(arr(q.opts)[q["jlpt:answer"]]),
      notes: arr(q["jlpt:optionNote"]),
      description: q["schema:description"] ?? "",
    }));

  return { contradictions, memeLecture, suspects };
}

// --- CLI ---------------------------------------------------------------------------
// Ne produit QUE des documents de relecture. Aucune écriture dans data/graph/ : la
// décision appartient à l'auteur, l'application est le travail de stems.mjs.
if (process.argv[1]?.endsWith("audit-stems.mjs")) {
  const { readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { readdirSync } = await import("node:fs");

  const DIR = "data/graph";
  const fichiers = readdirSync(DIR)
    .filter((f) => f.endsWith(".jsonld") && f !== "context.jsonld" && f !== "shapes.jsonld")
    .sort();
  const sujets = fichiers.flatMap(
    (f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))["@graph"] ?? [],
  );
  const parId = new Map(sujets.filter((s) => s["@id"]).map((s) => [s["@id"], s]));
  const { contradictions, memeLecture, suspects } = auditStems(sujets);

  const prouves = new Set([
    ...contradictions.flatMap((g) => g.questions.map((q) => q.id)),
    ...memeLecture.map((c) => c.id),
  ]);
  const detail = (id) => {
    const q = parId.get(id) ?? {};
    const opts = arr(q.opts);
    const rep = opts[q["jlpt:answer"]];
    return { stem: norm(q["jlpt:stem"]), opts, rep, desc: String(q["schema:description"] ?? "").replace(/<[^>]+>/g, "") };
  };

  const L = [
    "# Énoncés à arbitrer",
    "",
    "Généré par `node tools/graph/audit-stems.mjs`. **Ne pas éditer** : consigner les",
    "décisions dans `data/enonces-arbitres.json`, puis lancer `node tools/graph/stems.mjs`.",
    "",
    "## Résumé",
    "",
    "| classe | questions | verrou CI |",
    "|---|---|---|",
    `| énoncés contradictoires | ${new Set(contradictions.flatMap((g) => g.questions.map((q) => q.id))).size} | oui |`,
    `| distracteur de même lecture | ${memeLecture.length} | oui |`,
    `| **union prouvée** | **${prouves.size}** | **oui** |`,
    `| suspects (note « homophone ») | ${suspects.length} | non — heuristique |`,
    `| **total à arbitrer** | **${new Set([...prouves, ...suspects.map((s) => s.id)]).size}** | |`,
    "",
    "## Contradictions — le corpus se contredit",
    "",
  ];
  for (const g of contradictions) {
    L.push(`### ${g.stem}`, "");
    for (const q of g.questions) {
      const d = detail(q.id);
      L.push(`- \`${q.id}\` (ord ${q.ord}) → **${q.answer}** — options : ${d.opts.join(" / ")}`);
    }
    L.push("");
  }
  L.push("## Distracteur de même lecture — prouvé par word.jsonld", "");
  for (const c of memeLecture) {
    const d = detail(c.id);
    L.push(
      `### \`${c.id}\` (ord ${c.ord})`, "",
      `- énoncé : ${d.stem}`,
      `- options : ${d.opts.map((o) => (o === c.answer ? `**${o}**` : o)).join(" / ")}`,
      `- se lisent toutes ${c.lecture} : ${[c.answer, ...c.jumeaux].join("、")}`,
      `- sens attendu : ${d.desc}`, "",
    );
  }
  L.push("## Suspects — note « homophone », à confirmer à la main", "");
  for (const s of suspects) {
    L.push(
      `### \`${s.id}\` (ord ${s.ord})`, "",
      `- énoncé : ${s.stem}`,
      `- options : ${s.opts.map((o) => (o === s.answer ? `**${o}**` : o)).join(" / ")}`,
      `- sens attendu : ${String(s.description).replace(/<[^>]+>/g, "")}`, "",
    );
  }
  mkdirSync("docs/superpowers", { recursive: true });
  writeFileSync("docs/superpowers/enonces-a-arbitrer.md", L.join("\n") + "\n");

  // Squelette : un objet par question, `stem` et `gloss` à REMPLIR par l'auteur. `from`
  // est l'énoncé actuel — c'est lui qui permettra à stems.mjs de détecter un désaccord
  // plutôt que d'écraser une correction déjà faite à la main.
  const aArbitrer = [...new Set([...prouves, ...suspects.map((s) => s.id)])].sort();
  const skel = Object.fromEntries(
    aArbitrer.map((id) => [id, { from: detail(id).stem, stem: "", gloss: "" }]),
  );
  writeFileSync("data/enonces-arbitres.skel.json", JSON.stringify(skel, null, 1) + "\n");

  console.log(`prouvé : ${prouves.size} question(s) — ${contradictions.length} énoncé(s) contradictoire(s), ${memeLecture.length} de même lecture`);
  console.log(`suspect : ${suspects.length} question(s) (heuristique, hors CI)`);
  console.log(`total à arbitrer : ${aArbitrer.length}`);
  console.log("→ docs/superpowers/enonces-a-arbitrer.md");
  console.log("→ data/enonces-arbitres.skel.json (à compléter, puis renommer sans .skel)");
}
