/**
 * Rendu UNIQUE d'une entité du référentiel — point de grammaire, mot ou kanji.
 *
 * Quatre sites rendaient une entité chacun à sa façon : `GramPoint` / `VocabRow` / `KanjiRow`
 * (l'ancien `GroupDetail`) et `RappelCard` (le corrigé du quiz). Un seul composant désormais,
 * deux variantes : `carte` (le paquet, l'apprentissage) et `compacte` (le corrigé, sans
 * exemples dépliés).
 *
 * ⚠ `legende` par défaut à `false` : la clé des couleurs de `SentenceAnalysis` était réémise à
 * CHAQUE exemple, ce qui est la répétition la plus coûteuse en hauteur du rendu d'origine. Le
 * paquet l'affiche une fois, en pied.
 */
import type {
  CoursExample, CoursItem, GramItem, KanjiItem, VocabItem,
} from "./coursSchema.ts";
import type { EntityState } from "./entityState.ts";
import { SpeakButton } from "./SpeakButton.tsx";
import { SentenceAnalysis } from "../../ui/SentenceAnalysis.tsx";
import { kanjiExempleJa } from "./coursSpeech.ts";
import { furi } from "../../lib/dict.ts";

export type ItemKind = "gram" | "kanji" | "vocab";

/** Découpe une structure grammaticale sur les « ／ » de premier niveau (hors parenthèses)
 *  pour afficher chaque construction alternative sur sa propre ligne. Les « ／ » à
 *  l'intérieur de （…） restent intacts (ex. « （口語：〜ちゃう／〜じゃう） »). */
export function splitStruct(struct: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of struct) {
    if (ch === "（" || ch === "(") depth++;
    else if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "／" && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.filter((p) => p.length > 0);
}

/**
 * La nature d'un item, lue sur ses CHAMPS et non sur la piste qui le range.
 *
 * ⚠ Un motif grammatical rangé dans le cours de vocabulaire (« なかなか〜ない ») porte à la fois
 * `form` et `mot` — `coursFromGraph.ts` lui ajoute les champs de la vue vocabulaire. `form`
 * doit donc gagner, sinon la carte affiche une lecture vide.
 */
export function itemKind(it: CoursItem): ItemKind {
  if ("form" in it && typeof it.form === "string" && it.form.length > 0) return "gram";
  if ("kanji" in it) return "kanji";
  return "vocab";
}

export const STATE_MARK: Record<EntityState, string> = {
  neuf: "○", "en-cours": "◐", "a-revoir": "◑", acquis: "●",
};

export const STATE_TITRE: Record<EntityState, string> = {
  neuf: "jamais rencontré",
  "en-cours": "vu, pas encore consolidé",
  "a-revoir": "à revoir",
  acquis: "acquis",
};

const STATE_COULEUR: Record<EntityState, string> = {
  neuf: "text-fg-muted",
  "en-cours": "text-accent",
  "a-revoir": "text-status-failed",
  acquis: "text-status-completed",
};

function Badge({ state }: { state: EntityState }) {
  return (
    <span
      className={`shrink-0 text-lg ${STATE_COULEUR[state]}`}
      title={STATE_TITRE[state]}
      aria-label={`état : ${STATE_TITRE[state]}`}
    >
      {STATE_MARK[state]}
    </span>
  );
}

function Exemple({ ex, legende }: { ex: CoursExample; legende: boolean }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-3 text-sm flex flex-col gap-0.5">
      <div className="flex items-start gap-2">
        <div
          className="text-fg text-xl flex-1 min-w-0"
          dangerouslySetInnerHTML={{ __html: furi(ex.jp) }}
        />
        <SpeakButton text={ex.jp} />
      </div>
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {ex.an && ex.an.length > 0 && (
        <SentenceAnalysis source={ex.an.join(" · ")} legend={legende} />
      )}
    </div>
  );
}

export function EntityCard({
  item, state, variant = "carte", legende = false,
}: {
  item: CoursItem;
  state: EntityState;
  variant?: "carte" | "compacte";
  legende?: boolean;
}) {
  const kind = itemKind(item);
  const complet = variant === "carte";

  if (kind === "gram") {
    const it = item as GramItem;
    return (
      <div data-cours-item={it.id} data-kind="gram" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge state={state} />
          <span className="text-fg text-2xl font-bold">{it.form}</span>
          {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
        </div>
        {it.struct && (
          <div className="text-fg-muted text-base font-mono flex flex-col">
            {splitStruct(it.struct).map((line, i) => <span key={i}>{line}</span>)}
          </div>
        )}
        {it.mean && <div className="text-fg-dim text-sm">{it.mean}</div>}
        {complet && it.examples?.map((ex, i) => (
          <Exemple key={i} ex={ex} legende={legende && i === 0} />
        ))}
      </div>
    );
  }

  if (kind === "kanji") {
    const it = item as KanjiItem;
    return (
      <div data-cours-item={it.id} data-kind="kanji" className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Badge state={state} />
          <span className="text-fg text-5xl font-light">{it.kanji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-fg-muted text-base">{it.lecture}</div>
            <div className="text-fg-dim text-sm">{it.sens}</div>
          </div>
        </div>
        {complet && it.exemple && (
          <div className="flex items-center gap-2">
            <div
              className="text-fg text-xl flex-1 min-w-0"
              dangerouslySetInnerHTML={{ __html: furi(it.exemple) }}
            />
            <SpeakButton text={kanjiExempleJa(it.exemple)} />
          </div>
        )}
      </div>
    );
  }

  const it = item as VocabItem;
  return (
    <div data-cours-item={it.id} data-kind="vocab" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Badge state={state} />
        <div className="flex-1 min-w-0">
          <span
            className="text-fg text-2xl"
            dangerouslySetInnerHTML={{ __html: furi(it.mot) }}
          />
          <span className="text-fg-muted text-base ml-2">{it.lecture}</span>
          <div className="text-fg-dim text-sm">{it.sens}</div>
        </div>
        {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
        {complet && <SpeakButton text={it.mot} />}
      </div>
    </div>
  );
}
