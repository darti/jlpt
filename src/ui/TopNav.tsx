import type { ThemeName } from "../lib/theme.ts";

const LINKS = [
  { href: "index.html", label: "Accueil", active: true },
  { href: "app-n3.html", label: "Entraînement", active: false },
  { href: "cours-n3.html", label: "Cours", active: false },
  { href: "planning-n3.html", label: "Planning", active: false },
];

export function TopNav({ theme, onToggleTheme }: { theme: ThemeName; onToggleTheme: () => void }) {
  return (
    <nav className="sticky top-0 z-10 flex gap-4 flex-wrap justify-center items-center px-3 py-2.5">
      {LINKS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className={l.active ? "text-fg font-semibold text-sm" : "text-fg-dim font-semibold text-sm"}
        >
          {l.label}
        </a>
      ))}
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Basculer le thème"
        className="text-fg-dim rounded-full min-w-8 h-8 cursor-pointer border-none bg-transparent"
      >
        {theme === "light" ? "☾" : "☀"}
      </button>
    </nav>
  );
}
