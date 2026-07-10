// Splits data/bank.json into per-category files, preserving each question's
// GLOBAL index as a stable `id` (wrong[]/resume.ids depend on it). Also emits
// bank-index.json (id -> cat) so any id resolves to its category file.
//   bun tools/split-bank.mjs            → (re)write data/bank-*.json + index
//   bun tools/split-bank.mjs --check    → exit 1 if out of sync
import { readFileSync, writeFileSync } from "node:fs";

const CATS = ["grammaire", "vocabulaire", "kanji", "lecture", "ecoute"];
const check = process.argv.includes("--check");
const bank = JSON.parse(readFileSync("data/bank.json", "utf8"));

const byCat = Object.fromEntries(CATS.map((c) => [c, []]));
const index = {};
bank.forEach((q, id) => {
  if (!byCat[q.cat]) return; // ignore unknown cats defensively
  byCat[q.cat].push({ ...q, id });
  index[id] = q.cat;
});

let stale = false;
function emit(path, data) {
  const next = JSON.stringify(data);
  let cur = null;
  try { cur = readFileSync(path, "utf8"); } catch {}
  if (cur !== next) { stale = true; if (!check) writeFileSync(path, next); }
}
for (const c of CATS) emit(`data/bank-${c}.json`, byCat[c]);
emit("data/bank-index.json", index);

if (check && stale) { console.error("✗ data/bank-*.json out of sync — run: bun tools/split-bank.mjs"); process.exit(1); }
console.log(CATS.map((c) => `${c}:${byCat[c].length}`).join("  ") + `  total:${bank.length}`);
