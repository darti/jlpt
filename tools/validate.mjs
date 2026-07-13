// Valide toutes les sources de vérité du contenu (data/*.json).
// Attrape la classe de bugs vue en production : niveau JLPT comme définition,
// clés dupliquées, décomposition `g` manquante, `od` désaligné, réponse hors
// bornes, options vides… Zéro dépendance. Exit 1 si invalide.
import { readFileSync } from 'node:fs';

const errors = [];
const info = [];

function load(path) {
  try { return { raw: readFileSync(path, 'utf8') }; }
  catch (e) { errors.push(path + ' : illisible — ' + e.message); return null; }
}

// ---------- dictionnaire ----------
(function validateDict() {
  const f = load('data/dict.json'); if (!f) return;
  let data;
  try { data = JSON.parse(f.raw); } catch (e) { errors.push('data/dict.json : JSON invalide — ' + e.message); return; }
  const keyRe = /^\s*"((?:[^"\\]|\\.)*)"\s*:\s*\{/gm; const seen = new Set(); let m;
  while ((m = keyRe.exec(f.raw))) { if (seen.has(m[1])) errors.push('dict: clé dupliquée "' + m[1] + '"'); seen.add(m[1]); }
  for (const [k, v] of Object.entries(data)) {
    if (k.length > 14) errors.push('dict "' + k + '" : clé trop longue');
    if (typeof v !== 'object' || v === null) { errors.push('dict "' + k + '" : valeur non-objet'); continue; }
    if (typeof v.r !== 'string') errors.push('dict "' + k + '" : r manquant/non-string');
    if (typeof v.m !== 'string') errors.push('dict "' + k + '" : m manquant/non-string');
    if (/^\s*N[1-5]\s*$/.test(v.m || '')) errors.push('dict "' + k + '" : m est un niveau JLPT, pas une définition');
    for (const kk of Object.keys(v)) if (kk !== 'r' && kk !== 'm') errors.push('dict "' + k + '" : champ inattendu "' + kk + '"');
  }
  info.push('dict.json : ' + Object.keys(data).length + ' entrées');
})();

// ---------- contenu (quiz + leçons) ----------
const CATS = ['grammaire', 'vocabulaire', 'kanji', 'lecture', 'ecoute'];
for (const [file, kind] of [['bank', 'quiz'], ['grammar', 'leçon'], ['kanji', 'leçon'], ['vocab', 'leçon']]) {
  const f = load('data/' + file + '.json'); if (!f) continue;
  let arr;
  try { arr = JSON.parse(f.raw); } catch (e) { errors.push('data/' + file + '.json : JSON invalide — ' + e.message); continue; }
  if (!Array.isArray(arr)) { errors.push('data/' + file + '.json : doit être un tableau'); continue; }
  arr.forEach((o, i) => {
    const at = file + '[' + i + ']';
    if (o == null || typeof o !== 'object') { errors.push(at + ' : élément vide/non-objet'); return; }
    if (o.cat !== undefined && !CATS.includes(o.cat)) errors.push(at + ' : cat inconnue "' + o.cat + '"');
    // objet-quiz (a une question)
    if (o.q !== undefined) {
      if (!Array.isArray(o.o) || o.o.length < 2) errors.push(at + ' : o doit être un tableau ≥ 2 options');
      else {
        if (o.o.some(x => typeof x !== 'string' || x === '')) errors.push(at + ' : option vide ou non-string');
        if (!Number.isInteger(o.a) || o.a < 0 || o.a >= o.o.length) errors.push(at + ' : a hors bornes (' + o.a + ')');
        if (Array.isArray(o.od) && o.od.length !== o.o.length) errors.push(at + ' : od.length (' + o.od.length + ') ≠ o.length (' + o.o.length + ')');
      }
      if (typeof o.e !== 'string' || o.e === '') errors.push(at + ' : explication e manquante');
      if (typeof o.g !== 'string' || o.g === '') errors.push(at + ' : décomposition g manquante');
    }
    // objet-leçon (a une entrée k)
    if (o.k !== undefined) {
      if (typeof o.k !== 'string' || o.k === '') errors.push(at + ' : k (entrée) vide');
      if (typeof o.sens !== 'string' || o.sens === '') errors.push(at + ' : sens manquant');
    }
  });
  info.push(file + '.json : ' + arr.length + ' objets');
}

// (data/examples.json supprimé : les exemples du cours vivent maintenant inline dans
//  data/cours-gram.json — extraits de cours-n3.html avant sa suppression, tranche SPA.)

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
      nItems++;
    });
  });
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
