import { useEffect, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";
import { applyFuri, readFuri, writeFuri } from "../lib/furigana.ts";
import { IconHome, IconDumbbell, IconBookOpen, IconGear, IconMoon, IconSun } from "./icons.tsx";

// ONE frosted box for the iOS notch strip AND the tab row. `pt` clears the notch so the tabs
// sit below it; the matching negative `mt` hands that space straight back to the flow, so the
// tab row's position, the space consumed and even the scroll offset at which it pins are all
// identical to a plain `top: env(safe-area-inset-top)` nav — only the *painted* surface now
// reaches the top of the screen. Wherever there is no inset both values are 0, so this is a
// no-op on desktop.
// Why one box and not a strip + the nav:
//   · two adjacent blurred layers show a SEAM — each blur clamps its kernel at its own edge,
//     so the tint steps at the boundary (visible on iPhone);
//   · an element with `backdrop-filter` is the *backdrop root* of its descendants, so a
//     blurred child lying outside its parent's box has an empty backdrop: it paints its
//     colour and blurs nothing (measured in Blink — that was the original notch bug).
// `pointer-events-none` keeps the notch strip tappable through to whatever is below; the nav
// itself takes them back.
const CHROME =
  "sticky top-0 z-10 pt-[env(safe-area-inset-top)] mt-[calc(env(safe-area-inset-top)*-1)] pointer-events-none";

// Panel background + border + blur — applied only while the chrome is pinned to the top.
const STUCK_BG = "bg-panel border-b border-line surface-blur";

// Tabs show a monochrome icon; `label` stays as the accessible name (aria-label + tooltip).
const ROUTES: { to: string; label: string; Icon: ComponentType; end?: boolean }[] = [
  { to: "/", label: "Accueil", Icon: IconHome, end: true },
  { to: "/entrainement", label: "Entraînement", Icon: IconDumbbell },
  { to: "/cours", label: "Cours", Icon: IconBookOpen },
  { to: "/parametrage", label: "Paramétrage", Icon: IconGear },
];
const ON = "text-fg text-lg";
const OFF = "text-fg-dim text-lg";

export function TopNav() {
  const { theme, toggle } = useThemeContext();
  const [furiOn, setFuriOn] = useState(() => readFuri());
  const [stuck, setStuck] = useState(false);
  const chromeRef = useRef<HTMLDivElement>(null);
  const toggleFuri = () => { const on = writeFuri(!furiOn); setFuriOn(on); applyFuri(); };

  // The chrome is `position: sticky`; show its frosted surface only once it's pinned.
  useEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const stickyTop = parseFloat(getComputedStyle(el).top) || 0; // 0 here, read for robustness
    let raf = 0;
    const update = () => { raf = 0; setStuck(el.getBoundingClientRect().top <= stickyTop + 0.5); };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div data-chrome ref={chromeRef} className={`${CHROME} ${stuck ? STUCK_BG : ""}`}>
      <nav
        className="flex gap-6 flex-wrap justify-center items-center px-3 py-2.5 pointer-events-auto"
      >
        {ROUTES.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label}
            title={label}
            className={({ isActive }) => (isActive ? ON : OFF)}
          >
            <Icon />
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggleFuri}
          aria-pressed={furiOn}
          aria-label={furiOn ? "Masquer les furigana" : "Afficher les furigana"}
          className={`${furiOn ? "text-accent" : "text-fg-dim"} rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent text-sm font-bold`}
        >
          ふ
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label="Basculer le thème"
          title="Basculer le thème"
          className="text-fg-dim rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent inline-flex items-center justify-center text-lg"
        >
          {theme === "light" ? <IconMoon /> : <IconSun />}
        </button>
      </nav>
    </div>
  );
}
