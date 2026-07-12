export function Header() {
  return (
    <header className="px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-3 text-center">
      <h1 className="text-xl text-fg m-0">
        Préparation <span className="text-accent">JLPT N3</span>
      </h1>
      <p className="text-fg-dim text-sm mt-1">
        Objectif : session de décembre 2026 · 5 mois de préparation
      </p>
    </header>
  );
}
