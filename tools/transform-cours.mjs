// Convertit data/cours-*.json (ancien schéma imbriqué lessons/table/points) vers le schéma
// unifié Category › Group › Item. JETABLE : les plans 2-4 ré-assignent les groupes par-dessus
// ce schéma. Grammaire : fusionne l'aide-mémoire (Forme/Niv./Sens) avec les points
// (struct/examples) par forme.
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const normForm = (s) => {
  const c = s.lastIndexOf(":");
  return (c >= 0 ? s.slice(c + 1) : s).replace(/〜/g, "").replace(/\s+/g, "");
};

// --- VOCAB : items = lignes des tables Mot/…/Sens, dédupliquées par mot ; groupes =
//     leçons/sous-leçons ---
function transformVocab() {
  const src = read("data/cours-vocab.json");
  const groups = [];
  const seen = new Set();
  const pushGroup = (title, table) => {
    if (!table) return;
    const hi = table.headers, iMot = 0;
    const iLec = hi.findIndex((h) => /Lecture/i.test(h));
    const iSens = hi.findIndex((h) => /Sens/i.test(h));
    const iNiv = hi.findIndex((h) => /Niv/i.test(h));
    const items = [];
    for (const r of table.rows) {
      const mot = r[iMot];
      const id = "vocab:" + mot;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        mot,
        lecture: iLec >= 0 ? r[iLec] : "",
        sens: iSens >= 0 ? r[iSens] : "",
        ...(iNiv >= 0 ? { niv: r[iNiv] } : {}),
      });
    }
    if (items.length) groups.push({ id: "g" + (groups.length + 1), title, items });
  };
  const walk = (lessons) => {
    for (const l of lessons ?? []) {
      if (l.table) pushGroup(l.title, l.table);
      walk(l.lessons);
    }
  };
  walk(src.lessons);
  return { id: "vocab", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- KANJI : items = lignes Kanji/Lecture/Sens/(Mot exemple), dédup par kanji ; groupes =
//     leçons/sous-leçons ---
function transformKanji() {
  const src = read("data/cours-kanji.json");
  const groups = [];
  const seen = new Set();
  const pushGroup = (title, table) => {
    if (!table) return;
    const hi = table.headers;
    const iLec = hi.findIndex((h) => /Lecture/i.test(h));
    const iSens = hi.findIndex((h) => /Sens/i.test(h));
    const iEx = hi.findIndex((h) => /exemple/i.test(h));
    const items = [];
    for (const r of table.rows) {
      const kanji = r[0];
      const id = "kanji:" + kanji;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        kanji,
        lecture: iLec >= 0 ? r[iLec] : "",
        sens: iSens >= 0 ? r[iSens] : "",
        ...(iEx >= 0 && r[iEx] ? { exemple: r[iEx] } : {}),
      });
    }
    if (items.length) groups.push({ id: "g" + (groups.length + 1), title, items });
  };
  const walk = (lessons) => {
    for (const l of lessons ?? []) {
      if (l.table) pushGroup(l.title, l.table);
      walk(l.lessons);
    }
  };
  walk(src.lessons);
  return { id: "kanji", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- GRAMMAIRE : merge aide-mémoire (niv/sens) + points (struct/examples) par forme
//     normalisée. 3 passes ordonnées : le groupe d'ENSEIGNEMENT (points) gagne toujours
//     l'assignation de groupe. ---
function transformGram() {
  const src = read("data/cours-gram.json");
  const flat = [];
  const flatten = (lessons) => {
    for (const l of lessons ?? []) {
      flat.push(l);
      flatten(l.lessons);
    }
  };
  flatten(src.lessons);

  const byKey = new Map(); // key normForm → item
  const groupOf = new Map(); // key normForm → titre de groupe (fixé une seule fois)
  const order = [];
  const ensure = (title) => {
    if (!order.includes(title)) order.push(title);
  };
  const place = (key, title) => {
    if (!groupOf.has(key)) {
      groupOf.set(key, title);
      ensure(title);
    }
  };

  // Pass A — points (struct + examples). C'est la leçon d'enseignement qui définit le groupe.
  for (const l of flat) {
    for (const pt of l.points ?? []) {
      if (!pt.form) continue;
      const key = normForm(pt.form);
      if (!key) continue;
      const item = byKey.get(key) ?? { id: "gram:" + key, form: pt.form };
      if (pt.struct) item.struct = pt.struct;
      if (pt.mean) item.mean = pt.mean;
      if (pt.examples?.length) item.examples = pt.examples;
      byKey.set(key, item);
      place(key, l.title);
    }
  }
  // Pass B — aide-mémoire (Forme/Niv./Sens) : back-fill niv + sens ; crée l'item si absent.
  for (const l of flat) {
    const t = l.table;
    const isAideMemoire =
      t && t.headers[0] === "Forme" && t.headers.includes("Niv.") && t.headers.includes("Sens");
    if (!isAideMemoire) continue;
    const iNiv = t.headers.indexOf("Niv.");
    const iSens = t.headers.indexOf("Sens");
    for (const r of t.rows) {
      for (const alt of String(r[0]).split(" / ")) {
        const key = normForm(alt);
        if (!key) continue;
        const item = byKey.get(key) ?? { id: "gram:" + key, form: alt.trim() };
        if (!item.niv && r[iNiv]) item.niv = r[iNiv];
        if (!item.mean && r[iSens]) item.mean = r[iSens];
        byKey.set(key, item);
        place(key, l.title);
      }
    }
  }
  // Pass C — autres tables (conjugaison, keigo) : un item par ligne si la clé est neuve.
  for (const l of flat) {
    const t = l.table;
    if (!t || t.headers[0] === "Forme") continue;
    for (const r of t.rows) {
      const key = normForm(String(r[0]));
      if (!key || byKey.has(key)) continue;
      const mean = r.slice(1).filter(Boolean).join(" · ");
      byKey.set(key, { id: "gram:" + key, form: r[0], mean });
      place(key, l.title);
    }
  }

  const groups = order
    .map((title, i) => ({
      id: "g" + (i + 1),
      title,
      items: [...byKey.keys()]
        .filter((k) => groupOf.get(k) === title)
        .map((k) => byKey.get(k)),
    }))
    .filter((g) => g.items.length);
  return { id: "gram", title: src.title, kind: "learn", intro: src.intro, groups };
}

// --- MÉTHODE : fusion lecture + écoute (tips) ---
function transformMethod() {
  const dk = read("data/cours-dokkai.json");
  const ck = read("data/cours-choukai.json");
  return {
    id: "method",
    title: "読解・聴解 — Méthode",
    kind: "method",
    sections: [
      { title: dk.title, tips: dk.tips },
      { title: ck.title, tips: ck.tips },
    ],
  };
}

const assertUnique = (cat) => {
  if (cat.kind !== "learn") return;
  const seen = new Set();
  for (const g of cat.groups) {
    for (const it of g.items) {
      if (seen.has(it.id)) throw new Error(cat.id + " : id dupliqué " + it.id);
      seen.add(it.id);
    }
  }
};

const write = (name, cat) => {
  assertUnique(cat);
  writeFileSync("data/" + name, JSON.stringify(cat, null, 1));
};
write("cours-vocab.json", transformVocab());
write("cours-kanji.json", transformKanji());
write("cours-gram.json", transformGram());
write("cours-method.json", transformMethod());
for (const f of ["data/cours-dokkai.json", "data/cours-choukai.json"]) {
  if (existsSync(f)) rmSync(f);
}
console.log("✓ transform terminé");
