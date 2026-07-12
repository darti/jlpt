import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useThemeContext } from "../hooks/useThemeContext.tsx";
import { applyFuri, readFuri, writeFuri } from "../lib/furigana.ts";

const ROUTES = [
  { to: "/", label: "Accueil", end: true },
  { to: "/entrainement", label: "Entraînement" },
  { to: "/cours", label: "Cours" },
  { to: "/planning", label: "Planning" },
  { to: "/parametrage", label: "Paramétrage" },
];
const ON = "text-fg font-semibold text-sm";
const OFF = "text-fg-dim font-semibold text-sm";

export function TopNav() {
  const { theme, toggle } = useThemeContext();
  const [furiOn, setFuriOn] = useState(() => readFuri());
  const toggleFuri = () => { const on = writeFuri(!furiOn); setFuriOn(on); applyFuri(); };
  return (
    <nav className="sticky top-0 z-10 flex gap-4 flex-wrap justify-center items-center px-3 py-2.5 bg-panel border-b border-line surface-blur">
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
