import { test, expect } from "bun:test";
import { isCoursCategory } from "./coursValidate.ts";

test("isCoursCategory accepte une catégorie learn du schéma courant", () => {
  expect(isCoursCategory({ id: "gram", title: "G", kind: "learn", groups: [] })).toBe(true);
});

test("isCoursCategory accepte une catégorie method du schéma courant", () => {
  expect(isCoursCategory({ id: "method", title: "M", kind: "method", sections: [] })).toBe(true);
});

test("isCoursCategory rejette l'ancien schéma (lessons, sans kind ni groups)", () => {
  // Forme périmée servie par un cache SW d'avant la migration lessons→groups :
  // c'est exactement l'objet qui faisait planter CategoryIndex (category.groups.map).
  const stale = { id: "vocab", title: "V", intro: ["…"], lessons: [] };
  expect(isCoursCategory(stale)).toBe(false);
});

test("isCoursCategory rejette une catégorie learn sans groups", () => {
  expect(isCoursCategory({ id: "gram", title: "G", kind: "learn" })).toBe(false);
});

test("isCoursCategory rejette une catégorie method sans sections", () => {
  expect(isCoursCategory({ id: "method", title: "M", kind: "method" })).toBe(false);
});

test("isCoursCategory rejette les non-objets", () => {
  expect(isCoursCategory(null)).toBe(false);
  expect(isCoursCategory(undefined)).toBe(false);
  expect(isCoursCategory("gram")).toBe(false);
  expect(isCoursCategory(42)).toBe(false);
});
