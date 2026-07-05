// Régénère le bloc DICT embarqué dans dict.js à partir de la source de vérité
// data/dict.json. Runtime inchangé : dict.js reste un <script> synchrone ;
// seul son bloc DICT (entre marqueurs) est (re)généré.
//   node tools/sync-dict.mjs           → réécrit dict.js depuis data/dict.json
//   node tools/sync-dict.mjs --check   → échoue (exit 1) si dict.js est désynchronisé
import { readFileSync, writeFileSync } from 'node:fs';

const START = '/*DICT-DATA-START*/', END = '/*DICT-DATA-END*/';
const data = JSON.parse(readFileSync('data/dict.json', 'utf8'));
const block = START + 'var DICT = ' + JSON.stringify(data) + ';' + END;

const js = readFileSync('dict.js', 'utf8');
const s = js.indexOf(START), e = js.indexOf(END);
if (s < 0 || e < 0) { console.error('✗ marqueurs DICT introuvables dans dict.js'); process.exit(2); }
const current = js.slice(s, e + END.length);

if (process.argv.includes('--check')) {
  if (current !== block) {
    console.error('✗ dict.js est DÉSYNCHRONISÉ de data/dict.json — lance : node tools/sync-dict.mjs');
    process.exit(1);
  }
  console.log('✓ dict.js synchronisé avec data/dict.json (' + Object.keys(data).length + ' entrées)');
  process.exit(0);
}
writeFileSync('dict.js', js.slice(0, s) + block + js.slice(e + END.length));
console.log('✓ dict.js régénéré depuis data/dict.json (' + Object.keys(data).length + ' entrées)');
