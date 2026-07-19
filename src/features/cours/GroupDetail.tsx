import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  LearnCategory,
  CoursGroup,
  VocabItem,
  KanjiItem,
  GramItem,
  CoursExample,
} from "./coursSchema.ts";
import { type CoursProgress, type ItemState } from "./coursProgress.ts";
import { quizResumeHref } from "./coursDeepLink.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";
import { SpeakButton } from "./SpeakButton.tsx";
import { SentenceAnalysis } from "../../ui/SentenceAnalysis.tsx";
import { kanjiExempleJa } from "./coursSpeech.ts";
import { H2_TIGHT } from "../../ui/styles.ts";

/** Wrapper props shared by every item row so a deep-linked item can be anchored + highlighted. */
type RowFocus = { focused?: boolean };

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

/** Ring + soft background applied to the deep-linked item (`?focus=<id>`). */
const FOCUS_RING = "ring-2 ring-accent rounded-lg bg-surface-2/60";

declare const furi: ((s: string) => string) | undefined;
const furiOrPlain = (t: string): string =>
  typeof furi === "function" ? furi(t) : t;

const STATE_LABEL: Record<"new" | ItemState, string> = {
  new: "○",
  known: "●",
  review: "◐",
};

function StateToggle({
  id,
  state,
  onToggle,
}: {
  id: string;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
}) {
  const key = state ?? "new";
  return (
    <button
      type="button"
      data-item-id={id}
      onClick={() => onToggle(id)}
      title="neuf → appris → à revoir"
      aria-label={`état : ${key}`}
      className={
        "shrink-0 w-7 h-7 rounded-full border border-line bg-surface-2 " +
        "text-accent text-sm cursor-pointer"
      }
    >
      {STATE_LABEL[key]}
    </button>
  );
}

function Example({ ex }: { ex: CoursExample }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-3 text-sm flex flex-col gap-0.5">
      <div className="flex items-start gap-2">
        <div
          className="text-fg text-xl flex-1 min-w-0"
          dangerouslySetInnerHTML={{ __html: furiOrPlain(ex.jp) }}
        />
        <SpeakButton text={ex.jp} />
      </div>
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {ex.an && ex.an.length > 0 && (
        <SentenceAnalysis source={ex.an.join(" · ")} />
      )}
    </div>
  );
}

function VocabRow({
  it,
  state,
  onToggle,
  focused,
}: {
  it: VocabItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
} & RowFocus) {
  return (
    <div
      data-cours-item={it.id}
      className={`flex items-center gap-3 border-b border-line py-2${focused ? ` ${FOCUS_RING}` : ""}`}
    >
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <div className="flex-1 min-w-0">
        <span
          className="text-fg text-xl"
          dangerouslySetInnerHTML={{ __html: furiOrPlain(it.mot) }}
        />
        <span className="text-fg-muted text-base ml-2">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
      </div>
      {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
      <SpeakButton text={it.mot} />
    </div>
  );
}

function KanjiRow({
  it,
  state,
  onToggle,
  focused,
}: {
  it: KanjiItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
} & RowFocus) {
  return (
    <div
      data-cours-item={it.id}
      className={`flex items-center gap-3 border-b border-line py-2${focused ? ` ${FOCUS_RING}` : ""}`}
    >
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <span className="text-fg text-4xl font-light w-10 text-center">{it.kanji}</span>
      <div className="flex-1 min-w-0">
        <span className="text-fg-muted text-base">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
        {it.exemple && (
          <div
            className="text-fg-muted text-base"
            dangerouslySetInnerHTML={{ __html: furiOrPlain(it.exemple) }}
          />
        )}
      </div>
      {it.exemple && <SpeakButton text={kanjiExempleJa(it.exemple)} />}
    </div>
  );
}

function GramPoint({
  it,
  state,
  onToggle,
  focused,
}: {
  it: GramItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
} & RowFocus) {
  return (
    <div
      data-cours-item={it.id}
      className={`border-l-2 border-accent pl-3 py-1 flex flex-col gap-1.5${focused ? ` ${FOCUS_RING}` : ""}`}
    >
      <div className="flex items-center gap-2">
        <StateToggle id={it.id} state={state} onToggle={onToggle} />
        <span className="text-fg text-xl font-bold">{it.form}</span>
        {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
      </div>
      {it.struct && (
        <div className="text-fg-muted text-base font-mono flex flex-col">
          {splitStruct(it.struct).map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      )}
      {it.mean && <div className="text-fg-dim text-sm">{it.mean}</div>}
      {it.examples?.map((ex, i) => (
        <Example key={i} ex={ex} />
      ))}
    </div>
  );
}

/** Niveau 2 : le contenu d'un thème, rendu selon la catégorie. Un `?focus=<id>` (deep link,
 *  typ. depuis un corrigé de quiz) fait défiler vers l'item et le surligne ; `?from=quiz`
 *  affiche en plus une flèche « Revenir à la question » qui rouvre le corrigé quitté. */
export function GroupDetail({
  category,
  group,
  progress,
  onToggle,
}: {
  category: LearnCategory;
  group: CoursGroup;
  progress: CoursProgress;
  onToggle: (id: string) => void;
}) {
  const [params] = useSearchParams();
  const focus = params.get("focus");
  const fromQuiz = params.get("from") === "quiz";
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Scroll the deep-linked item into view once the group is rendered. Item ids carry `:`/kana,
  // so escape them for the attribute selector; scoped to this group's container so a stale id
  // from another group is a harmless no-op.
  useEffect(() => {
    if (!focus || typeof CSS === "undefined" || !CSS.escape) return;
    const el = containerRef.current?.querySelector(`[data-cours-item="${CSS.escape(focus)}"]`);
    el?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [focus, group.id]);

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>
      <Breadcrumb
        crumbs={[
          { label: "Cours", to: "/cours" },
          {
            label: category.title.split(" ")[0],
            to: `/cours/${category.id}`,
          },
          { label: group.title },
        ]}
      />
      {fromQuiz && (
        <a
          href={quizResumeHref}
          className="self-start inline-flex items-center gap-1 text-accent text-sm font-bold no-underline"
        >
          <span aria-hidden="true">←</span> Revenir à la question
        </a>
      )}
      <h2 className={H2_TIGHT}>{group.title}</h2>
      {group.note && (
        <p className="text-fg-dim text-sm bg-surface-2 border border-line rounded-lg p-2.5">
          {group.note}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {category.id === "vocab" &&
          group.items.map((it) => (
            <VocabRow
              key={it.id}
              it={it as VocabItem}
              state={progress[it.id]}
              onToggle={onToggle}
              focused={it.id === focus}
            />
          ))}
        {category.id === "kanji" &&
          group.items.map((it) => (
            <KanjiRow
              key={it.id}
              it={it as KanjiItem}
              state={progress[it.id]}
              onToggle={onToggle}
              focused={it.id === focus}
            />
          ))}
        {category.id === "gram" &&
          group.items.map((it) => (
            <GramPoint
              key={it.id}
              it={it as GramItem}
              state={progress[it.id]}
              onToggle={onToggle}
              focused={it.id === focus}
            />
          ))}
      </div>
    </div>
  );
}
