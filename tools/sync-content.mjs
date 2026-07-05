// Régénère les tableaux de contenu embarqués dans app-n3.html à partir des
// sources de vérité data/{bank,grammar,kanji,vocab}.json. Runtime inchangé :
// le JSON est du JS valide, donc les tableaux restent synchrones.
//
// Le VOCABULAIRE est externalisé dans vocab-data.js (chargé à part) pour garder
// app-n3.html léger : les questions cat:"vocabulaire" ne sont PAS embarquées dans
// BANK, et VOCAB_LESSONS est vide dans le HTML ; app-n3.html fusionne au runtime
// window.__VOCAB_BANK / window.__VOCAB_LESSONS fournis par vocab-data.js.
//
//   node tools/sync-content.mjs           → réécrit app-n3.html + vocab-data.js
//   node tools/sync-content.mjs --check   → échoue (exit 1) si désynchronisé
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app-n3.html';
const VOCAB_FILE = 'vocab-data.js';
const check = process.argv.includes('--check');

const bank = JSON.parse(readFileSync('data/bank.json', 'utf8'));
const grammar = JSON.parse(readFileSync('data/grammar.json', 'utf8'));
const kanji = JSON.parse(readFileSync('data/kanji.json', 'utf8'));
const vocab = JSON.parse(readFileSync('data/vocab.json', 'utf8'));

// Le vocabulaire part dans vocab-data.js ; le reste reste embarqué.
const bankEmbedded = bank.filter(q => q.cat !== 'vocabulaire');
const vocabBank = bank.filter(q => q.cat === 'vocabulaire');

// Tableaux embarqués dans app-n3.html (VOCAB_LESSONS volontairement vide)
const MAP = [
  ['BANK', bankEmbedded],
  ['GRAMMAR_LESSONS', grammar],
  ['KANJI_LESSONS', kanji],
  ['VOCAB_LESSONS', []],
];

let js = readFileSync(FILE, 'utf8');
let changed = false;
const outOfSync = [];

for (const [name, data] of MAP) {
  const S = '/*' + name + '-START*/', E = '/*' + name + '-END*/';
  const s = js.indexOf(S), e = js.indexOf(E);
  if (s < 0 || e < 0) { console.error('✗ marqueurs ' + name + ' introuvables dans ' + FILE); process.exit(2); }
  const block = S + 'const ' + name + '=' + JSON.stringify(data) + ';' + E;
  if (js.slice(s, e + E.length) !== block) {
    outOfSync.push(name);
    if (!check) { js = js.slice(0, s) + block + js.slice(e + E.length); changed = true; }
  }
}

// vocab-data.js : window.__VOCAB_BANK (questions) + window.__VOCAB_LESSONS (fiches)
const vocabJs = '/* Généré par tools/sync-content.mjs — NE PAS éditer à la main.\n'
  + '   Vocabulaire externalisé pour alléger app-n3.html. */\n'
  + 'window.__VOCAB_BANK=' + JSON.stringify(vocabBank) + ';\n'
  + 'window.__VOCAB_LESSONS=' + JSON.stringify(vocab) + ';\n';
let vocabOut = '';
try { vocabOut = readFileSync(VOCAB_FILE, 'utf8'); } catch (e) { vocabOut = ''; }
const vocabChanged = vocabOut !== vocabJs;
if (vocabChanged) outOfSync.push(VOCAB_FILE);

if (check) {
  if (outOfSync.length) {
    console.error('✗ désynchronisé pour : ' + outOfSync.join(', ') + ' — lance : node tools/sync-content.mjs');
    process.exit(1);
  }
  console.log('✓ app-n3.html + vocab-data.js synchronisés avec data/{bank,grammar,kanji,vocab}.json');
  process.exit(0);
}
if (changed) writeFileSync(FILE, js);
if (vocabChanged) writeFileSync(VOCAB_FILE, vocabJs);
console.log('✓ app-n3.html régénéré (BANK hors-vocab, GRAMMAR_LESSONS, KANJI_LESSONS) + vocab-data.js ('
  + vocabBank.length + ' questions, ' + vocab.length + ' fiches)');
