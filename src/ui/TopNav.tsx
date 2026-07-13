import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";
import { applyFuri, readFuri, writeFuri } from "../lib/furigana.ts";

// Panel background + border + blur — applied only while the nav is pinned to the top.
// `notch-fill` extends that frosted background up through the iOS safe-area strip so the
// blur reaches the very top of the screen instead of stopping at the notch (see tailwind.css).
const STUCK_BG = "bg-panel border-b border-line surface-blur notch-fill";

const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/cours", label: "Cours" },
  { to: "/parametrage", label: "Paramétrage" },
];
const ON = "text-fg font-semibold text-sm";
const OFF = "text-fg-dim font-semibold text-sm";

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
      className={`sticky top-[env(safe-area-inset-top)] z-10 flex gap-4 flex-wrap justify-center items-center px-3 py-2.5 ${stuck ? STUCK_BG : ""}`}
    >
      {ROUTES.map((r) => (
        <NavLink key={r.to} to={r.to} end={r.end} className={({ isActive }) => (isActive ? ON : OFF)}>
          {r.label}
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
        className="text-fg-dim rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>
    </nav>
  );
}
