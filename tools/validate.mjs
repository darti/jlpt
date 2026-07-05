// Valide data/dict.json — attrape la classe de bugs vue en production
// (niveau JLPT stocké comme définition, clés dupliquées, champs manquants…).
// Zéro dépendance. Sort en erreur (exit 1) si le contenu est invalide.
import { readFileSync } from 'node:fs';

const raw = readFileSync('data/dict.json', 'utf8');
let data;
try { data = JSON.parse(raw); }
catch (e) { console.error('✗ data/dict.json : JSON invalide — ' + e.message); process.exit(1); }

const errors = [];

// 1) clés dupliquées (JSON.parse les fusionne silencieusement → scan du texte brut)
const keyRe = /^\s*"((?:[^"\\]|\\.)*)"\s*:\s*\{/gm;
const seen = new Set();
let m;
while ((m = keyRe.exec(raw))) {
  const k = m[1];
  if (seen.has(k)) errors.push('Clé dupliquée : "' + k + '"');
  seen.add(k);
}

// 2) règles par entrée
let emptyBoth = 0;
for (const [k, v] of Object.entries(data)) {
  if (!k) { errors.push('Clé vide'); continue; }
  if (k.length > 14) errors.push('"' + k + '" : clé trop longue (' + k.length + ' > 14)');
  if (typeof v !== 'object' || v === null) { errors.push('"' + k + '" : valeur non-objet'); continue; }
  if (typeof v.r !== 'string') errors.push('"' + k + '" : champ r manquant ou non-string');
  if (typeof v.m !== 'string') errors.push('"' + k + '" : champ m manquant ou non-string');
  if (/^\s*N[1-5]\s*$/.test(v.m || '')) errors.push('"' + k + '" : m est un niveau JLPT ("' + v.m + '"), pas une définition');
  for (const kk of Object.keys(v)) if (kk !== 'r' && kk !== 'm') errors.push('"' + k + '" : champ inattendu "' + kk + '"');
  if (!v.r && !v.m) emptyBoth++;
}

if (emptyBoth) console.log('ℹ ' + emptyBoth + ' entrée(s) sans lecture ni définition (toléré, à surveiller)');

if (errors.length) {
  console.error('✗ ' + errors.length + ' erreur(s) dans data/dict.json :');
  errors.slice(0, 60).forEach(e => console.error('   - ' + e));
  if (errors.length > 60) console.error('   … +' + (errors.length - 60) + ' autre(s)');
  process.exit(1);
}
console.log('✓ data/dict.json valide (' + Object.keys(data).length + ' entrées)');
