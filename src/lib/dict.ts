/**
 * Furigana + tap-to-define, ported from the vanilla `dict.js` for React pages.
 *
 * Two differences from `dict.js`: (1) the dictionary DATA is NOT inlined — it is
 * fetched from `data/graph/word.jsonld` at runtime via `setupDict()` (migration principle:
 * data from JSON, not bundled), so this module bundles only the ~logic; (2) the
 * definition-popup CSS uses the oku design tokens (`--color-*`) instead of the
 * vanilla `theme.css` vars. Behaviour is otherwise faithful to the original.
 *
 * The strangler migration is complete: the vanilla `dict.js`/pages are gone, so this
 * module is now the sole furigana + tap-to-define implementation for the app.
 */

export interface DictEntry { r?: string; m?: string }
export type Dict = Record<string, DictEntry>;

let DICT: Dict = {};
let READ: Record<string, string> = {}; // mot -> lecture (furigana glouton)

function rebuildRead(): void {
  READ = {};
  for (const w in DICT) { const r = DICT[w].r; if (r) READ[w] = r; }
}

/** Replace the runtime dictionary (from a fetch or a test). Rebuilds the furigana index. */
export function applyDictData(data: Dict): void {
  DICT = data || {};
  rebuildRead();
}

/**
 * Projette les sujets `jlpt:Word` du graphe vers la `Dict` interne (`{mot: {r, m}}`).
 *
 * `word.jsonld` absorbe `dict.json` : la contradiction dict ↔ vocab n'a plus de support,
 * il n'y a qu'UN nœud par mot. Un sujet sans `schema:name` est ignoré — sans clé, il ne
 * pourrait de toute façon jamais être retrouvé.
 */
export function wordsToDict(subjects: Record<string, unknown>[]): Dict {
  const out: Dict = {};
  for (const s of subjects) {
    const w = s["schema:name"];
    if (typeof w !== "string" || !w) continue;
    const entry: DictEntry = {};
    const r = s["jlpt:reading"];
    if (typeof r === "string") entry.r = r;
    const m = s["schema:description"];
    if (typeof m === "string") entry.m = m;
    out[w] = entry;
  }
  return out;
}

// ---------- furigana (recherche gloutonne du plus long mot) ----------
const KANJI_RE = /[一-鿿々]/;
const READING_RE = /^[ぁ-んァ-ンー・]+$/;
/** Une lecture *utilisable en furigana* est une suite de kana « propre » : pas de « · »
 *  (qui sépare plusieurs lectures on/kun dans les entrées mono-kanji du dico) ni de
 *  parenthèses d'okurigana (ex. « ユウ・やさ(しい)・すぐ(れる) »). Ces vidages de dico ne
 *  sont pas des lectures contextuelles : les afficher en ruby donne un texte absurde ET
 *  déforme la base (annotation très large → gros espaces intra-mot sur WebKit/iOS). */
const CLEAN_FURI_RE = /^[ぁ-んァ-ンー]+$/;

/** Classe de l'enveloppe furigana, et de l'annotation. Les deux servent aussi au CSS
 *  (`src/styles/tailwind.css`) et au tap-pour-définir (`jpRunAt`). */
export const FURI_CLASS = "furi";
export const FURI_RT_CLASS = "furi-rt";

/**
 * Une base annotée de sa lecture, en `<span>` — **jamais** en `<ruby>`/`<rt>`.
 *
 * ⚠ Ce n'est pas un choix esthétique, c'est le seul rendu qui marche dans les deux moteurs.
 * Mesuré (WebKit 26.5 vs Chromium 143), sur les trois exigences « masquable · au-dessus de la
 * base · base non élargie » :
 *
 *   - **WebKit IGNORE `position:absolute` sur un `<rt>`** (position calculée = `static`) :
 *     l'annotation retombe dans le flux et se superpose au kanji — c'est le bug qui a motivé
 *     cette réécriture ;
 *   - en ruby **natif**, c'est **Chromium** qui élargit la base (16 → 72 px, le fameux
 *     « 優　　　勝 ») ; WebKit, lui, laisse déborder proprement ;
 *   - masquer puis restaurer par `display:` échoue partout : `ruby-text` reste invisible en
 *     WebKit, `revert` élargit la base des deux côtés, et toutes les autres valeurs rendent
 *     l'annotation EN LIGNE au lieu de la poser au-dessus.
 *
 * Aucune des huit valeurs de `display` testées n'est verte des deux côtés. Un `<span>`, lui,
 * honore `position:relative`/`absolute` dans tous les moteurs.
 *
 * La lecture précède la base dans le DOM : elle est en `position:absolute`, donc l'ordre
 * n'affecte pas le rendu, mais la base reste ainsi le dernier nœud texte — ce dont `jpRunAt`
 * tire le mot tapé.
 *
 * Accessibilité : on perd la sémantique `ruby` (un lecteur d'écran lira « えいきょう影響 » là
 * où il lisait le mot seul). Pas d'`aria-hidden` sur l'annotation pour autant, délibérément :
 * masquée — l'état par DÉFAUT — elle est en `display:none`, donc déjà hors de l'arbre
 * d'accessibilité ; révélée, c'est que l'utilisateur a demandé les lectures. Sur une app
 * d'apprentissage du japonais, les annoncer est alors une aide, pas du bruit.
 */
function annote(base: string, lecture: string): string {
  return `<span class="${FURI_CLASS}"><span class="${FURI_RT_CLASS}">${lecture}</span>${base}</span>`;
}

export function furi(s: string | null | undefined): string {
  if (s == null) return "";
  let out = "", i = 0;
  while (i < s.length) {
    const c = s[i];
    if (KANJI_RE.test(c)) {
      // Extent of the kanji run starting at i.
      let end = i;
      while (end < s.length && KANJI_RE.test(s[end])) end++;

      // Explicit inline reading right after the run — 漢字（かな） — becomes furigana : the
      // parentheses disappear from view and the reading devient une vraie annotation (masquée
      // par défaut, révélée par la bascule ふ). Les données portent ces lectures inline ; on
      // retire l'encombrement en gardant la lecture.
      if (s[end] === "（") {
        const close = s.indexOf("）", end + 1);
        if (close > end && READING_RE.test(s.slice(end + 1, close))) {
          out += annote(s.slice(i, end), s.slice(end + 1, close));
          i = close + 1;
          continue;
        }
      }

      // Otherwise, greedy dictionary lookup over the run (original behaviour).
      let k = i;
      while (k < end) {
        let m: string | null = null;
        for (let L = Math.min(12, end - k); L >= 1; L--) {
          const sub = s.substr(k, L);
          if (READ[sub] && CLEAN_FURI_RE.test(READ[sub])) { m = sub; break; }
        }
        if (m) { out += annote(m, READ[m]); k += m.length; }
        else { out += s[k]; k++; }
      }
      i = end;
    } else { out += c; i++; }
  }
  return out;
}

// ---------- analyse visuelle : jetons colorés par rôle ----------
interface Tok { jp: string; gloss: string; role: string }
const PARTGLOSS: Record<string, string> = { "は": "thème", "が": "sujet", "を": "COD", "に": "à / lieu", "へ": "direction", "で": "moyen / lieu", "と": "et / avec", "も": "aussi", "の": "de", "から": "depuis", "まで": "jusqu’à", "より": "que (comp.)", "ね": "n’est-ce pas", "よ": "emphase", "か": "question" };
function _pg(p: string): string { return PARTGLOSS[p] || "particule"; }
const ADV: Record<string, number> = { "とても": 1, "まだ": 1, "もう": 1, "ずっと": 1, "よく": 1, "また": 1, "すぐ": 1, "すぐに": 1, "ちょっと": 1, "たくさん": 1, "あまり": 1, "いつも": 1, "きっと": 1, "たぶん": 1, "ほとんど": 1, "かなり": 1, "やはり": 1, "やっぱり": 1, "ぜひ": 1, "もっと": 1, "少し": 1, "すこし": 1, "けっこう": 1, "だいたい": 1, "しっかり": 1, "はっきり": 1, "ゆっくり": 1, "だんだん": 1, "どんどん": 1, "なかなか": 1, "わざわざ": 1, "ますます": 1 };
function splitParticles(jp: string, gloss: string): Tok[] {
  const out: Tok[] = [], lead = "のはがをにへでとも";
  while (jp.length > 1 && lead.indexOf(jp.charAt(0)) >= 0 && /^[一-鿿]/.test(jp.slice(1))) { out.push({ jp: jp.charAt(0), gloss: _pg(jp.charAt(0)), role: "part" }); jp = jp.slice(1); }
  const TRAIL = ["からは", "までは", "には", "では", "とは", "へは", "のは", "をば", "から", "まで", "より", "は", "が", "を", "に", "へ", "で", "と", "も", "の", "ね", "よ", "か"];
  let trail: Tok[] = [], m: string | null = null;
  for (let i = 0; i < TRAIL.length; i++) { const p = TRAIL[i]; if (jp.length > p.length && jp.slice(-p.length) === p) { const b = jp.charAt(jp.length - p.length - 1); if (b === "）" || /[一-鿿]/.test(b)) { m = p; break; } } }
  if (m) {
    if (m === "から" || m === "まで" || m === "より") trail = [{ jp: m, gloss: _pg(m), role: "part" }];
    else trail = m.split("").map((c) => ({ jp: c, gloss: _pg(c), role: "part" }));
    jp = jp.slice(0, jp.length - m.length);
  }
  const g2 = gloss.replace(/\s*\((?:th[eè]me|sujet|COD|objet|compl[eé]ment|lieu|temps|direction|moyen)[^)]*\)\s*$/i, "").trim();
  out.push({ jp, gloss: g2 || gloss, role: "noun" });
  return out.concat(trail);
}
function splitVerbLead(jp: string, gloss: string): Tok[] {
  const out: Tok[] = [], lead = "にを";
  while (jp.length > 2 && lead.indexOf(jp.charAt(0)) >= 0) { out.push({ jp: jp.charAt(0), gloss: _pg(jp.charAt(0)), role: "part" }); jp = jp.slice(1); }
  out.push({ jp, gloss, role: "verb" });
  return out;
}
/** Rubification d'un jeton d'analyse : furigana SYSTÉMATIQUES. Toute lecture inline « mot（かな） »
 *  — y compris les mots à okurigana (少しずつ, 良い), pas seulement les runs de kanji purs — devient
 *  une annotation sur le mot entier ; les kanji restants sans lecture inline reçoivent le furigana
 *  du dico (`furi()`), sans jamais retoucher une enveloppe déjà posée. Avant, seuls les mots à
 *  finale kanji étaient annotés → les autres restaient en « （かな） » littéral (incohérent). */
const INLINE_READ_RE = /([一-鿿々ぁ-ゖァ-ヺー]*[一-鿿々][一-鿿々ぁ-ゖァ-ヺー]*)（([ぁ-んァ-ンー・]+)）/g;
function rubifyAnalyse(jp: string): string {
  const withInline = jp.replace(INLINE_READ_RE, (_m, w, r) => annote(w, r));
  // On découpe sur les enveloppes déjà posées pour ne PAS les repasser dans furi() — sinon
  // la base serait ré-annotée depuis le dico, par-dessus la lecture inline qui fait autorité.
  return withInline
    .split(new RegExp(`(<span class="${FURI_CLASS}">[\\s\\S]*?</span></span>)`, "g"))
    .map((seg) => (seg.startsWith(`<span class="${FURI_CLASS}">`) ? seg : furi(seg)))
    .join("");
}
export function visualBreak(str: string, opts?: { legend?: boolean }): string {
  if (!str) return "";
  const parts = String(str).split(" · ");
  let hasPart = false, hasVerb = false, hasNoun = false, hasAdj = false, hasAdjNa = false, hasAdv = false;
  let pills = "";
  parts.forEach((seg) => {
    seg = seg.trim(); if (!seg) return;
    let gloss = "", jp = seg;
    const mg = seg.match(/«\s*([^»]*?)\s*»/);
    if (mg) { gloss = mg[1]; jp = seg.slice(0, mg.index); }
    jp = jp.replace(/^[→\s]+/, "").replace(/[。、・\s→]+$/, "").replace(/（[^）]*$/, "").trim();
    if (!jp) return;
    if (!/[一-鿿ぁ-んァ-ンー々]/.test(jp) || (!gloss && /[A-Za-zÀ-ÿ]{2,}/.test(jp) && !/[一-鿿]/.test(jp))) {
      pills += '<span class="tok tok-note"><span class="tok-g">' + (gloss || jp) + "</span></span>"; return;
    }
    const jpPlain = jp.replace(/（[^）]*）/g, "").replace(/[（）]/g, "");
    let role = "noun";
    if (/[→＋]/.test(jp)) role = "verb";
    else if (/^[はがをにへでとやかもねよのばらでもへ〜～ずば・／/]+$/.test(jpPlain)) role = "part";
    else if (ADV[jpPlain] === 1) role = "adv";
    else if ((jpPlain.length >= 3 && jpPlain.charAt(jpPlain.length - 1) === "的" && jpPlain !== "目的") || /な-?adj|adjectif nominal/i.test(gloss)) role = "adjna";
    else if (/しい$/.test(jpPlain) || /\bい-?adj|adjectif/i.test(gloss)) role = "adj";
    else if (/particule|th[eè]me|\bCOD\b|sujet|direction|marque|emphase/i.test(gloss) && jpPlain.length <= 3 && !/[一-鿿]/.test(jpPlain)) role = "part";
    const toks = (role === "noun" && /[一-鿿]/.test(jpPlain)) ? splitParticles(jp, gloss) : (role === "verb" ? splitVerbLead(jp, gloss) : [{ jp, gloss, role }]);
    toks.forEach((t) => {
      if (!t.jp) return;
      if (t.role === "part") hasPart = true; else if (t.role === "verb") hasVerb = true; else if (t.role === "adj") hasAdj = true; else if (t.role === "adjna") hasAdjNa = true; else if (t.role === "adv") hasAdv = true; else hasNoun = true;
      const jpHtml = rubifyAnalyse(t.jp);
      pills += '<span class="tok tok-' + t.role + '"><span class="tok-jp">' + jpHtml + "</span>" + (t.gloss ? '<span class="tok-g">' + t.gloss + "</span>" : "") + "</span>";
    });
  });
  const leg: string[] = [];
  if (hasNoun) leg.push('<span><i class="tok-noun"></i>nom / groupe</span>');
  if (hasPart) leg.push('<span><i class="tok-part"></i>particule</span>');
  if (hasVerb) leg.push('<span><i class="tok-verb"></i>verbe / forme</span>');
  if (hasAdj) leg.push('<span><i class="tok-adj"></i>adjectif い</span>');
  if (hasAdjNa) leg.push('<span><i class="tok-adjna"></i>adjectif な</span>');
  if (hasAdv) leg.push('<span><i class="tok-adv"></i>adverbe</span>');
  const showLeg = !(opts && opts.legend === false);
  return '<div class="vbreak">' + pills + "</div>" + (showLeg && leg.length > 1 ? '<div class="vbleg">' + leg.join("") + "</div>" : "");
}

// ---------- lookup ----------
interface Def { w: string; r?: string; m: string }
function _cleanM(m: string | undefined): string { return /^\s*N[1-5]\s*$/.test(m || "") ? "" : (m || ""); } // un niveau JLPT n'est pas une définition
export function lookupDef(sel: string): Def | null {
  sel = (sel || "").replace(/[\s。、！？「」（）()]/g, "").trim();
  if (!sel || sel.length > 14) return null;
  if (DICT[sel]) return { w: sel, r: DICT[sel].r, m: _cleanM(DICT[sel].m) };
  for (let L = Math.min(sel.length, 12); L >= 1; L--) {
    const sub = sel.slice(0, L);
    if (DICT[sub]) return { w: sub, r: DICT[sub].r, m: _cleanM(DICT[sub].m) };
  }
  return null;
}

// ---------- bulle de définition (CSS = tokens oku) ----------
function ensurePopup(): HTMLElement {
  if (!document.getElementById("jlpt-defpop-css")) {
    const st = document.createElement("style"); st.id = "jlpt-defpop-css";
    st.textContent = "#defPop{position:fixed;z-index:95;max-width:280px;background:var(--color-panel,#3b4252);border:1px solid var(--color-line,rgba(236,239,244,.12));border-radius:14px;padding:12px 15px 13px;box-shadow:0 24px 64px rgba(18,27,54,.55);-webkit-backdrop-filter:blur(16px) saturate(140%);backdrop-filter:blur(16px) saturate(140%);font-size:.92rem;display:none;line-height:1.5}#defPop .w{font-size:1.2rem;font-weight:700;color:var(--color-fg,#eceff4)}#defPop .r{color:var(--color-accent,#88c0d0);font-size:.85rem;margin:1px 0 5px}#defPop .m{color:var(--color-fg,#eceff4)}#defPop .x{float:right;color:var(--color-fg-muted,rgba(236,239,244,.45));cursor:pointer;margin:-2px -4px 0 8px;font-size:.95rem}#defPop .sp{background:transparent;border:none;color:var(--color-accent,#88c0d0);cursor:pointer;vertical-align:-3px;padding:0 2px}#defPop .sp:active{transform:scale(.9)}";
    (document.head || document.documentElement).appendChild(st);
  }
  let pop = document.getElementById("defPop");
  if (!pop) { pop = document.createElement("div"); pop.id = "defPop"; (document.body || document.documentElement).appendChild(pop); }
  return pop;
}
export function hideDef(): void { const p = document.getElementById("defPop"); if (p) p.style.display = "none"; }

// ---------- prononciation (TTS, ja-JP) ----------
let _jaVoice: SpeechSynthesisVoice | null = null;
function _pickVoice(): void {
  try {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    _jaVoice = vs.filter((v) => /ja[-_]?jp/i.test(v.lang))[0] || vs.filter((v) => /^ja/i.test(v.lang))[0] || vs.filter((v) => /japanese|日本語/i.test(v.name))[0] || null;
  } catch { /* ignore */ }
}
function speakJa(t: string): void {
  if (!t || !("speechSynthesis" in window)) return;
  try { if (!_jaVoice) _pickVoice(); speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t)); u.lang = "ja-JP"; u.rate = 0.9; if (_jaVoice) u.voice = _jaVoice; speechSynthesis.speak(u); } catch { /* ignore */ }
}
export function jlptSay(): void { const p = document.getElementById("defPop"); if (p && p.dataset && p.dataset.say) speakJa(p.dataset.say); }
const _SPK = '<button class="sp" onclick="jlptSay()" title="Prononcer" aria-label="Prononcer"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg></button>';

function defShow(px: number, py: number, d: Def | null): boolean {
  const pop = ensurePopup(); if (!d) return false;
  pop.innerHTML = '<span class="x" onclick="hideDef()">✕</span><div class="w">' + furi(d.w) + " " + _SPK + "</div>" + (d.r ? '<div class="r">' + d.r + "</div>" : "") + '<div class="m">' + (d.m || "lecture seule") + "</div>";
  try { pop.dataset.say = (d.r || d.w); } catch { /* ignore */ }
  pop.style.display = "block";
  pop.style.left = Math.max(8, Math.min(px - 20, window.innerWidth - pop.offsetWidth - 12)) + "px";
  pop.style.top = Math.min(py + 16, window.innerHeight - pop.offsetHeight - 12) + "px";
  return true;
}
function jpRunAt(x: number, y: number): { run: string; rel: number } | null {
  const doc = document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
  else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); range.collapse(true); } }
  if (!range) return null;
  const node: Node | null = range.startContainer;
  // Un mot du dico est rendu en UNE seule enveloppe `.furi` (cf. `annote`). Dès que le tap
  // tombe quelque part dedans — base, annotation, ou l'élément lui-même — on prend TOUTE la
  // base comme unité de recherche. Sinon, selon le moteur (WebKit résout le caret au kanji
  // sous le doigt), on ne récupérait qu'un kanji isolé au lieu du mot entier (bug 16ca9cc).
  const startEl: Element | null = node ? (node.nodeType === 1 ? (node as Element) : (node.parentNode as Element | null)) : null;
  const enveloppe = startEl && startEl.closest ? startEl.closest(`.${FURI_CLASS}`) : null;
  if (enveloppe) {
    const baseNodes = ([] as Node[]).slice.call(enveloppe.childNodes)
      .filter((n) => !(n.nodeType === 1 && (n as Element).classList.contains(FURI_RT_CLASS)));
    const base = baseNodes.map((n) => n.textContent || "").join("");
    if (/[一-鿿]/.test(base)) {
      // Position du caractère tapé dans la base (0 si le tap a atterri sur l'annotation).
      let rel = 0;
      const dansAnnotation = node?.parentNode instanceof Element
        && (node.parentNode as Element).classList.contains(FURI_RT_CLASS);
      if (node && node.nodeType === 3 && node.parentNode && !dansAnnotation) {
        let acc = 0;
        for (const n of baseNodes) { if (n === node) { acc += range.startOffset; break; } acc += (n.textContent || "").length; }
        rel = Math.max(0, Math.min(acc, base.length - 1));
      }
      return { run: base, rel };
    }
  }
  if (!node || node.nodeType !== 3) return null;
  const t = node.textContent || ""; let i = range.startOffset;
  const isJ = (c: string) => /[一-鿿々〆ヶぁ-んァ-ンー]/.test(c || "");
  if (i >= t.length) i = t.length - 1; if (i < 0) return null;
  if (!isJ(t[i])) { if (i > 0 && isJ(t[i - 1])) i--; else return null; }
  let s = i; let e = i; while (s > 0 && isJ(t[s - 1])) s--; while (e < t.length - 1 && isJ(t[e + 1])) e++;
  return { run: t.slice(s, e + 1), rel: i - s };
}
function defAtPoint(x: number, y: number): boolean {
  const r = jpRunAt(x, y); if (!r) return false;
  const run = r.run, rel = r.rel;
  for (let st = 0; st <= rel && st < run.length; st++) {
    const d = lookupDef(run.slice(st, st + 14));
    if (d && (st + d.w.length) > rel) return defShow(x, y, d);
  }
  const d2 = lookupDef(run);
  return d2 ? defShow(x, y, d2) : false;
}

// ---------- gestes ----------
// Un seul geste : le tap/clic. `click` se déclenche pour la souris (desktop) comme pour le
// tap tactile (mobile) → comportement identique sur les deux. Pas d'appui long ni de double-clic.
// `opts` conservé pour compat d'appel (initDefs({ singleTap: true })) mais sans effet : le tap
// ouvre toujours la popup de définition.
export function initDefs(_opts?: { singleTap?: boolean }): void {
  ensurePopup();
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("defPop");
    const target = e.target as Element | null;
    if (pop && target && pop.contains(target)) return;
    if (target && target.closest && target.closest("button,a,input,textarea,select,label,.opt,.chip,.start,.navtoggle,.furibtn,.listenbtn,.topnav")) {
      if (pop && pop.style.display === "block") hideDef(); return;
    }
    if (defAtPoint(e.clientX, e.clientY)) return;
    if (pop && pop.style.display === "block") hideDef();
  });
  window.addEventListener("scroll", hideDef, true);
  try { document.body.style.setProperty("-webkit-touch-callout", "none"); } catch { /* ignore */ }
}

/**
 * Browser entry point: install the popup's inline handlers, then load the dictionary data
 * from JSON. Best-effort — if the fetch fails (offline first visit), furigana/lookups simply
 * return plain text.
 *
 * Seuls `hideDef`/`jlptSay` sont exposés en globales : le popup de définition est construit
 * en HTML brut (`_SPK`, `showDef`) avec des attributs `onclick=` qui les appellent par nom.
 * `furi`/`visualBreak`/`initDefs` ne le sont plus — les composants les importent directement
 * depuis ce module (une seule instance, donc le même DICT chargé au runtime).
 */
export async function setupDict(url = "data/graph/word.jsonld"): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  w.hideDef = hideDef; w.jlptSay = jlptSay;
  // Attach tap-to-define gestures app-wide: a single tap/click on a word opens the definition
  // popup (reading + meaning + TTS) — same gesture on mobile and desktop, no long-press/double-click.
  // Furigana are no longer toggled per-word; they are revealed only by the global menu (`[data-furi="on"]`).
  initDefs();
  if ("speechSynthesis" in window) { _pickVoice(); try { speechSynthesis.onvoiceschanged = _pickVoice; } catch { /* ignore */ } }
  try {
    const res = await fetch(url);
    if (res.ok) {
      const doc = await res.json() as { "@graph"?: Record<string, unknown>[] };
      applyDictData(wordsToDict(doc["@graph"] ?? []));
    }
  } catch { /* offline / missing → degrade to plain text */ }
}
