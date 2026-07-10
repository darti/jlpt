import { test, expect, beforeEach, afterEach } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Settings } from "./Settings.tsx";

// Behavioral coverage of the side-effecting handlers (needs a live DOM — happy-dom via
// bunfig preload). The underlying bumpFs/applyFontScale/importJson/resetProgress logic
// is unit-tested elsewhere; these assert the component actually wires to it.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty("--fs-ui");
  document.documentElement.style.removeProperty("--fs-jp");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function render() {
  act(() => { root.render(<Settings theme="dark" onToggleTheme={() => {}} />); });
}

function click(el: Element | null | undefined) {
  if (!el) throw new Error("element not found");
  act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

function byLabel(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
}

test("font-scale A+ persists jlptN3_fsUi and applies --fs-ui live", () => {
  render();
  click(byLabel("Agrandir Interface"));
  expect(localStorage.getItem("jlptN3_fsUi")).toBe("1.1");
  expect(document.documentElement.style.getPropertyValue("--fs-ui")).toBe("1.1");
});

test("font-scale A− on Japanese persists jlptN3_fsJp and applies --fs-jp live", () => {
  render();
  click(byLabel("Réduire Japonais"));
  expect(localStorage.getItem("jlptN3_fsJp")).toBe("0.9");
  expect(document.documentElement.style.getPropertyValue("--fs-jp")).toBe("0.9");
});

test("Réinitialiser is gated by confirm — a declined confirm leaves progress intact", () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 42 }));
  const orig = globalThis.confirm;
  globalThis.confirm = () => false;
  try {
    render();
    click([...container.querySelectorAll("button")].find((b) => b.textContent === "Réinitialiser"));
    expect(JSON.parse(localStorage.getItem("jlptN3adapt_v2") as string).total).toBe(42);
  } finally {
    globalThis.confirm = orig;
  }
});

test("Importer is gated by confirm — a declined confirm writes nothing", async () => {
  localStorage.setItem("jlptN3adapt_v2", JSON.stringify({ total: 7 }));
  const orig = globalThis.confirm;
  globalThis.confirm = () => false;
  try {
    render();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ store: { jlptN3adapt_v2: JSON.stringify({ total: 999 }) } })],
      "backup.json",
      { type: "application/json" },
    );
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 25)); // let FileReader.onload resolve
    expect(JSON.parse(localStorage.getItem("jlptN3adapt_v2") as string).total).toBe(7); // unchanged
  } finally {
    globalThis.confirm = orig;
  }
});
