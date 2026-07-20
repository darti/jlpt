// Valide le contenu de cours (data/cours-*.json) — le seul contenu hors graphe encore
// servi au runtime, par la route /cours. Zéro dépendance. Exit 1 si invalide.
//
// Ce validateur couvrait aussi dict/bank/grammar/kanji/vocab.json : ces fichiers ont été
// supprimés au lot 4 et leur contenu vit dans data/graph/, validé par validate-graph.mjs
// (shapes SHACL + contrôles impératifs). Les règles perdues ici n'ont pas disparu — bornes
// de `answer`, alignement de `optionNote`, options dupliquées y sont exprimées, et plus
// finement (ordinaux denses, IRIs pendantes, réponses contradictoires).
import { readFileSync } from 'node:fs';

const errors = [];
const info = [];

function load(path) {
  try { return { raw: readFileSync(path, 'utf8') }; }
  catch (e) { errors.push(path + ' : illisible — ' + e.message); return null; }
}

// Normalise une forme de grammaire comme coursGramIndex.normalizeForm : garde l'après-":",
// retire 〜 et espaces. Sert à détecter les stubs qui doublent une fiche combinée « 〜A / 〜B ».
const normGram = (s) => { const c = s.lastIndexOf(':'); return (c >= 0 ? s.slice(c + 1) : s).replace(/〜/g, '').replace(/\s+/g, ''); };

// ---------- cours (schéma unifié Category › Group › Item) ----------
for (const id of ['gram', 'vocab', 'kanji', 'method']) {
  const f = load('data/cours-' + id + '.json'); if (!f) continue;
  let cat;
  try { cat = JSON.parse(f.raw); } catch (e) { errors.push('data/cours-' + id + '.json : JSON invalide — ' + e.message); continue; }
  if (cat.id !== id) errors.push('cours-' + id + ' : id="' + cat.id + '" ≠ "' + id + '"');
  if (cat.kind !== 'learn' && cat.kind !== 'method') errors.push('cours-' + id + ' : kind invalide "' + cat.kind + '"');
  if (cat.kind === 'method') {
    if (!Array.isArray(cat.sections)) errors.push('cours-' + id + ' : sections doit être un tableau');
    else cat.sections.forEach((s, i) => { if (!Array.isArray(s.tips)) errors.push('cours-' + id + '.sections[' + i + '] : tips manquant'); });
    info.push('cours-' + id + '.json : ' + (cat.sections?.length ?? 0) + ' sections (méthode)');
    continue;
  }
  if (!Array.isArray(cat.groups)) { errors.push('cours-' + id + ' : groups doit être un tableau'); continue; }
  const seenId = new Set(); let nItems = 0;
  const gramForms = []; // grammaire : { alts:[normalisées], combined:bool, at, form } par item
  cat.groups.forEach((g, gi) => {
    if (typeof g.title !== 'string' || !g.title) errors.push('cours-' + id + '.groups[' + gi + '] : title manquant');
    if (!Array.isArray(g.items)) { errors.push('cours-' + id + '.groups[' + gi + '] : items doit être un tableau'); return; }
    g.items.forEach((it, ii) => {
      const at = 'cours-' + id + '.groups[' + gi + '].items[' + ii + ']';
      if (typeof it.id !== 'string' || !it.id) errors.push(at + ' : id manquant');
      else if (seenId.has(it.id)) errors.push(at + ' : id dupliqué "' + it.id + '"');
      else seenId.add(it.id);
      if (id === 'vocab' && (!it.mot || typeof it.sens !== 'string')) errors.push(at + ' : mot/sens manquant');
      if (id === 'kanji' && (!it.kanji || typeof it.sens !== 'string')) errors.push(at + ' : kanji/sens manquant');
      if (id === 'gram' && !it.form) errors.push(at + ' : form manquant');
      if (id === 'gram' && it.form) {
        const alts = it.form.split(' / ').map(normGram).filter(Boolean);
        gramForms.push({ alts, combined: alts.length > 1, at, form: it.form, hasEx: (it.examples?.length || 0) > 0 });
      }
      nItems++;
    });
  });
  // Régression « points de grammaire doublés » : un item mono-forme ne doit pas répéter une
  // variante déjà couverte par une fiche combinée « 〜A / 〜B » (sinon coursGramIndex, qui
  // splitte sur " / ", écrase la fiche riche par le stub).
  if (id === 'gram') {
    const combinedAlts = new Map(); // forme normalisée → form de la fiche combinée
    for (const gf of gramForms) if (gf.combined) for (const a of gf.alts) combinedAlts.set(a, gf.form);
    for (const gf of gramForms) {
      if (gf.combined) continue;
      const a = gf.alts[0];
      if (a && combinedAlts.has(a)) errors.push(gf.at + ' : forme "' + gf.form + '" double une variante de la fiche combinée "' + combinedAlts.get(a) + '"');
    }
  }
  // Régression « stub de grammaire » : hors tables de référence (conjugaison de base g1,
  // verbes keigo g12 dont le `mean` EST le contenu), chaque point doit porter au moins un
  // exemple. Empêche de ré-introduire des cartes sans struct/examples.
  if (id === 'gram') {
    const REF_STUBS = new Set(['動詞 verbe', 'い-adj', 'な-adj', '名 nom', 'する', '行く・来る・いる', '言う', '食べる・飲む', '見る', '知っている']);
    for (const gf of gramForms) {
      if (!gf.hasEx && !REF_STUBS.has(gf.form)) errors.push(gf.at + ' : point de grammaire « ' + gf.form + ' » sans exemple (stub) — ajouter struct + examples');
    }
  }
  info.push('cours-' + id + '.json : ' + cat.groups.length + ' groupes, ' + nItems + ' items');
}

// ---------- rapport ----------
info.forEach(l => console.log('  · ' + l));
if (errors.length) {
  console.error('✗ ' + errors.length + ' erreur(s) :');
  errors.slice(0, 80).forEach(e => console.error('   - ' + e));
  if (errors.length > 80) console.error('   … +' + (errors.length - 80));
  process.exit(1);
}
console.log('✓ Tout le contenu est valide');
