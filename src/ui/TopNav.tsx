import { useEffect, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";
import { applyFuri, readFuri, writeFuri } from "../lib/furigana.ts";
import { IconHome, IconDumbbell, IconBookOpen, IconGear, IconMoon, IconSun } from "./icons.tsx";

// Panel background + border + blur — applied only while the nav is pinned to the top.
// `notch-fill` extends that frosted background up through the iOS safe-area strip so the
// blur reaches the very top of the screen instead of stopping at the notch (see tailwind.css).
const STUCK_BG = "bg-panel border-b border-line surface-blur notch-fill";

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
  );
}
