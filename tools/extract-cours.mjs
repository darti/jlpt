// One-shot migration tool: parse cours-n3.html into structured JSON per section, so the
// React /cours route can render lessons from data instead of inlined HTML.
//   bun tools/extract-cours.mjs        → writes data/cours-<id>.json (+ prints a summary)
// Uses happy-dom (already a devDependency). cours-n3.html stays the source until the
// /cours route is ported (slice 3), then it's deleted.
import { Window } from "happy-dom";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("cours-n3.html", "utf8");
const doc = new (new Window().DOMParser)().parseFromString(html, "text/html");

const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const kids = (el, sel) => [...el.children].filter((c) => c.matches(sel));

function extractEx(ex) {
  return {
    jp: txt(ex.querySelector(".jp")),
    ro: txt(ex.querySelector(".ro")),
    fr: txt(ex.querySelector(".fr")),
    an: [...ex.querySelectorAll(".an .anl")].map(txt),
  };
}

function extractPoint(g) {
  const p = {};
  const form = txt(g.querySelector(".form"));
  const struct = txt(g.querySelector(".struct"));
  const mean = txt(g.querySelector(".mean"));
  if (form) p.form = form;
  if (struct) p.struct = struct;
  if (mean) p.mean = mean;
  const ex = kids(g, ".ex").map(extractEx);
  if (ex.length) p.examples = ex;
  return p;
}

function extractTable(table) {
  const rows = [...table.querySelectorAll("tr")];
  const headers = [...rows[0].querySelectorAll("th")].map(txt);
  const body = rows.slice(1).map((tr) => [...tr.querySelectorAll("td")].map(txt)).filter((r) => r.length);
  return { headers, rows: body };
}

function extractLesson(details) {
  const summary = kids(details, "summary")[0];
  const tagEl = summary?.querySelector(".wk");
  const tag = txt(tagEl);
  // title = summary text without the .wk tag prefix
  let title = txt(summary);
  if (tag && title.startsWith(tag)) title = title.slice(tag.length).trim();
  const lesson = { title };
  if (tag) lesson.tag = tag;

  const body = kids(details, ".body")[0];
  if (!body) return lesson;

  const intro = kids(body, "p").map((p) => p.innerHTML.trim()).filter(Boolean);
  if (intro.length) lesson.intro = intro;

  const subs = kids(body, "details.lesson");
  if (subs.length) lesson.lessons = subs.map(extractLesson);

  const table = kids(body, "table")[0];
  if (table) lesson.table = extractTable(table);

  const points = kids(body, ".g").map(extractPoint);
  if (points.length) lesson.points = points;

  const tip = kids(body, ".tip")[0];
  if (tip) lesson.tip = tip.innerHTML.trim();

  return lesson;
}

// Sections = each <h2> and the top-level <details class="lesson"> (or prose) until the next <h2>.
const h2s = [...doc.querySelectorAll("h2")];
const summary = [];
for (const h2 of h2s) {
  const id = h2.id || txt(h2).split(" ")[0];
  const title = txt(h2);
  const lessons = [];
  const intro = [];   // section intro paragraphs (inline markup only)
  const tips = [];    // bullet-list method tips (読解/聴解)
  for (let n = h2.nextElementSibling; n && n.tagName !== "H2"; n = n.nextElementSibling) {
    if (n.tagName === "DETAILS" && n.classList.contains("lesson")) { lessons.push(extractLesson(n)); continue; }
    const ul = n.tagName === "UL" ? n : n.querySelector("ul");
    if (ul) { tips.push(...[...ul.children].filter((c) => c.tagName === "LI").map((li) => li.innerHTML.trim())); continue; }
    if (n.tagName === "P") { const h = n.innerHTML.trim(); if (h) intro.push(h); continue; }
    const t = txt(n); if (t) intro.push(t); // fallback: plain text, never raw block HTML
  }
  const out = { id, title };
  if (intro.length) out.intro = intro;
  if (lessons.length) out.lessons = lessons;
  if (tips.length) out.tips = tips;
  const file = `data/cours-${id}.json`;
  writeFileSync(file, JSON.stringify(out, null, 1));
  summary.push(`${file}: ${lessons.length} leçons${tips.length ? `, ${tips.length} astuces` : ""}${intro.length ? `, ${intro.length} intro` : ""}`);
}
console.log(summary.join("\n"));
