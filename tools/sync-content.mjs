// Régénère les tableaux de contenu embarqués dans app-n3.html à partir des
// sources de vérité data/{bank,grammar,kanji,vocab}.json. Runtime inchangé :
// le JSON est du JS valide, donc les tableaux restent synchrones.
//   node tools/sync-content.mjs           → réécrit app-n3.html depuis data/*.json
//   node tools/sync-content.mjs --check   → échoue (exit 1) si désynchronisé
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app-n3.html';
const MAP = [['BANK', 'bank'], ['GRAMMAR_LESSONS', 'grammar'], ['KANJI_LESSONS', 'kanji'], ['VOCAB_LESSONS', 'vocab']];
const check = process.argv.includes('--check');

let js = readFileSync(FILE, 'utf8');
let changed = false;
const outOfSync = [];

for (const [name, file] of MAP) {
  const data = JSON.parse(readFileSync('data/' + file + '.json', 'utf8'));
  const S = '/*' + name + '-START*/', E = '/*' + name + '-END*/';
  const s = js.indexOf(S), e = js.indexOf(E);
  if (s < 0 || e < 0) { console.error('✗ marqueurs ' + name + ' introuvables dans ' + FILE); process.exit(2); }
  const block = S + 'const ' + name + '=' + JSON.stringify(data) + ';' + E;
  if (js.slice(s, e + E.length) !== block) {
    outOfSync.push(name);
    if (!check) { js = js.slice(0, s) + block + js.slice(e + E.length); changed = true; }
  }
}

if (check) {
  if (outOfSync.length) {
    console.error('✗ app-n3.html désynchronisé pour : ' + outOfSync.join(', ') + ' — lance : node tools/sync-content.mjs');
    process.exit(1);
  }
  console.log('✓ app-n3.html synchronisé avec data/{bank,grammar,kanji,vocab}.json');
  process.exit(0);
}
if (changed) writeFileSync(FILE, js);
console.log('✓ app-n3.html régénéré (' + MAP.map(m => m[0]).join(', ') + ')');
