import type {
  LearnCategory,
  CoursGroup,
  VocabItem,
  KanjiItem,
  GramItem,
  CoursExample,
} from "./coursSchema.ts";
import { type CoursProgress, type ItemState } from "./coursProgress.ts";
import { visualBreak } from "../../lib/dict.ts";
import { Breadcrumb } from "./Breadcrumb.tsx";

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
      <div
        className="text-fg text-lg"
        dangerouslySetInnerHTML={{ __html: furiOrPlain(ex.jp) }}
      />
      <div className="text-fg-muted text-meta">{ex.ro}</div>
      <div className="text-fg-dim">{ex.fr}</div>
      {ex.an && ex.an.length > 0 && (
        <div
          className="text-base"
          dangerouslySetInnerHTML={{
            __html: visualBreak(ex.an.join(" · "), { legend: false }),
          }}
        />
      )}
    </div>
  );
}

function VocabRow({
  it,
  state,
  onToggle,
}: {
  it: VocabItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2">
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <div className="flex-1 min-w-0">
        <span
          className="text-fg text-lg"
          dangerouslySetInnerHTML={{ __html: furiOrPlain(it.mot) }}
        />
        <span className="text-fg-muted text-sm ml-2">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
      </div>
      {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
    </div>
  );
}

function KanjiRow({
  it,
  state,
  onToggle,
}: {
  it: KanjiItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-2">
      <StateToggle id={it.id} state={state} onToggle={onToggle} />
      <span className="text-fg text-3xl w-10 text-center">{it.kanji}</span>
      <div className="flex-1 min-w-0">
        <span className="text-fg-muted text-sm">{it.lecture}</span>
        <div className="text-fg-dim text-sm">{it.sens}</div>
        {it.exemple && (
          <div
            className="text-fg-muted text-sm"
            dangerouslySetInnerHTML={{ __html: furiOrPlain(it.exemple) }}
          />
        )}
      </div>
    </div>
  );
}

function GramPoint({
  it,
  state,
  onToggle,
}: {
  it: GramItem;
  state: ItemState | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="border-l-2 border-accent pl-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <StateToggle id={it.id} state={state} onToggle={onToggle} />
        <span className="text-fg text-lg font-bold">{it.form}</span>
        {it.niv && <span className="text-meta text-fg-muted">{it.niv}</span>}
      </div>
      {it.struct && (
        <div className="text-fg-muted text-sm font-mono">{it.struct}</div>
      )}
      {it.mean && <div className="text-fg-dim text-sm">{it.mean}</div>}
      {it.examples?.map((ex, i) => (
        <Example key={i} ex={ex} />
      ))}
    </div>
  );
}

/** Niveau 2 : le contenu d'un thème, rendu selon la catégorie. */
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
  return (
    <div className="flex flex-col gap-3">
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
      <h2 className="text-fg text-lg font-bold">{group.title}</h2>
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
            />
          ))}
        {category.id === "kanji" &&
          group.items.map((it) => (
            <KanjiRow
              key={it.id}
              it={it as KanjiItem}
              state={progress[it.id]}
              onToggle={onToggle}
            />
          ))}
        {category.id === "gram" &&
          group.items.map((it) => (
            <GramPoint
              key={it.id}
              it={it as GramItem}
              state={progress[it.id]}
              onToggle={onToggle}
            />
          ))}
      </div>
    </div>
  );
}
