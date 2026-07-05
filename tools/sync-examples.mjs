// Source de vérité des phrases d'exemple de cours-n3.html → data/examples.json.
// cours-n3.html reste du HTML statique : ses 138 blocs <div class="ex"> sont
// (re)générés en place depuis data/examples.json (aucun rendu runtime ajouté).
//   node tools/sync-examples.mjs --extract  → bootstrap data/examples.json depuis le HTML
//   node tools/sync-examples.mjs            → réécrit cours-n3.html depuis data/examples.json
//   node tools/sync-examples.mjs --check    → échoue (exit 1) si désynchronisé
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'cours-n3.html';
const OPEN = '<div class="ex">';

function findExBlocks(html) {
  const blocks = []; let idx = 0;
  for (;;) {
    const start = html.indexOf(OPEN, idx);
    if (start < 0) break;
    let i = start, depth = 0;
    while (i < html.length) {
      if (html.startsWith('<div', i)) { depth++; i = html.indexOf('>', i) + 1; continue; }
      if (html.startsWith('</div>', i)) { depth--; i += 6; if (depth === 0) break; continue; }
      i++;
    }
    blocks.push({ start, end: i, html: html.slice(start, i) });
    idx = i;
  }
  return blocks;
}
function parseBlock(h) {
  const jp = (h.match(/<div class="jp">([\s\S]*?)<\/div>/) || [])[1] || '';
  const ro = (h.match(/<div class="ro">([\s\S]*?)<\/div>/) || [])[1] || '';
  const fr = (h.match(/<div class="fr">([\s\S]*?)<\/div>/) || [])[1] || '';
  const anStart = h.indexOf('<div class="an">');
  const anInner = anStart < 0 ? '' : h.slice(anStart + 16, h.length - 12); // retire </div></div> final
  const an = [...anInner.matchAll(/<div class="anl">([\s\S]*?)<\/div>/g)].map(m => m[1]);
  return { jp, ro, fr, an };
}
function render(e) {
  return OPEN + '<div class="jp">' + e.jp + '</div><div class="ro">' + e.ro + '</div><div class="fr">' + e.fr +
    '</div><div class="an">' + e.an.map(l => '<div class="anl">' + l + '</div>').join('') + '</div></div>';
}

const html = readFileSync(FILE, 'utf8');
const blocks = findExBlocks(html);

if (process.argv.includes('--extract')) {
  const data = blocks.map(b => parseBlock(b.html));
  // garantie zéro-perte : chaque bloc régénéré doit être IDENTIQUE à l'original
  let bad = 0;
  blocks.forEach((b, i) => { if (render(data[i]) !== b.html) { bad++; if (bad <= 3) console.error('  ✗ bloc ' + i + ' non réversible'); } });
  if (bad) { console.error('✗ ' + bad + ' bloc(s) non réversibles — extraction annulée'); process.exit(1); }
  const out = '[\n' + data.map(o => JSON.stringify(o)).join(',\n') + '\n]\n';
  writeFileSync('data/examples.json', out);
  console.log('✓ data/examples.json écrit (' + data.length + ' exemples, round-trip byte-identique)');
  process.exit(0);
}

const data = JSON.parse(readFileSync('data/examples.json', 'utf8'));
if (blocks.length !== data.length) {
  console.error('✗ ' + blocks.length + ' blocs .ex dans le HTML ≠ ' + data.length + ' dans data/examples.json');
  process.exit(1);
}
if (process.argv.includes('--check')) {
  const diff = blocks.findIndex((b, i) => render(data[i]) !== b.html);
  if (diff >= 0) { console.error('✗ cours-n3.html désynchronisé (bloc ' + diff + ') — lance : node tools/sync-examples.mjs'); process.exit(1); }
  console.log('✓ cours-n3.html synchronisé avec data/examples.json (' + data.length + ' exemples)');
  process.exit(0);
}
// régénère de la fin vers le début pour préserver les offsets
let out = html;
for (let i = blocks.length - 1; i >= 0; i--) out = out.slice(0, blocks[i].start) + render(data[i]) + out.slice(blocks[i].end);
writeFileSync(FILE, out);
console.log('✓ cours-n3.html régénéré depuis data/examples.json (' + data.length + ' exemples)');
