/** Schéma unifié du contenu de cours : Category › Group › Item. Zéro logique — juste les types
 *  partagés par la vue master-detail, la progression et le loader. */

export interface CoursExample {
  jp: string;
  ro: string;
  fr: string;
  an?: string[];
}

export interface VocabItem {
  id: string;
  mot: string;
  lecture: string;
  sens: string;
  niv?: string;
}

export interface KanjiItem {
  id: string;
  kanji: string;
  lecture: string;
  sens: string;
  exemple?: string;
}

export interface GramItem {
  id: string;
  form: string;
  struct?: string;
  mean?: string;
  niv?: string;
  examples?: CoursExample[];
}

export type CoursItem = VocabItem | KanjiItem | GramItem;

export interface CoursGroup {
  id: string;
  title: string;
  subtitle?: string;
  note?: string;
  items: CoursItem[];
}

export interface LearnCategory {
  id: "gram" | "vocab" | "kanji";
  title: string;
  kind: "learn";
  intro?: string[];
  groups: CoursGroup[];
}

export interface MethodSection {
  title: string;
  tips: string[];
}

export interface MethodCategory {
  id: "method";
  title: string;
  kind: "method";
  sections: MethodSection[];
}

export type CoursCategory = LearnCategory | MethodCategory;
export type CoursCategoryId = CoursCategory["id"]; // "gram" | "vocab" | "kanji" | "method"
