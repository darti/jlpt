import { useEffect, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";
import { applyFuri, readFuri, writeFuri } from "../lib/furigana.ts";
import { IconHome, IconDumbbell, IconBookOpen, IconGear, IconMoon, IconSun } from "./icons.tsx";

// Panel background + border + blur — applied only while the nav is pinned to the top.
const STUCK_BG = "bg-panel border-b border-line surface-blur";

// iOS notch fill. The pinned nav sits at `top: env(safe-area-inset-top)` to clear the notch,
// leaving the status-bar strip above it unglassed; this overlay carries the same frosted
// surface up to the screen top. It MUST stay a sibling of the nav, never a child: an element
// with `backdrop-filter` is the *backdrop root* of its descendants, so a descendant lying
// outside its box has an empty backdrop — it paints its colour but blurs nothing (measured in
// Blink, and the shape of the reported iOS bug). `pointer-events-none` keeps the strip tappable
// through to whatever is below; the height collapses to 0 wherever there is no inset.
const NOTCH_FILL =
  "fixed left-0 right-0 top-0 z-10 h-[env(safe-area-inset-top)] bg-panel surface-blur pointer-events-none";

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
  const navRef = useRef<HTMLElement>(null);
  const toggleFuri = () => { const on = writeFuri(!furiOn); setFuriOn(on); applyFuri(); };

  // The nav is `position: sticky`; show its background only once it's pinned at the top.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const stickyTop = parseFloat(getComputedStyle(el).top) || 0; // resolves env(safe-area-inset-top)
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
    <>
      {stuck && <div data-notch-fill aria-hidden="true" className={NOTCH_FILL} />}
      <nav
        ref={navRef}
        className={`sticky top-[env(safe-area-inset-top)] z-10 flex gap-6 flex-wrap justify-center items-center px-3 py-2.5 ${stuck ? STUCK_BG : ""}`}
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
    </>
  );
}
