import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallPrompt, IosGuideModal } from "./InstallPrompt.tsx";

test("InstallPrompt renders the install button without throwing under SSR (no window)", () => {
  const html = renderToStaticMarkup(<InstallPrompt />);
  expect(html).toContain("Installer");
  expect(html).toContain("application");
});

test("InstallPrompt does not render the iOS guide until it is opened", () => {
  const html = renderToStaticMarkup(<InstallPrompt />);
  expect(html).not.toContain("écran d");
});

test("IosGuideModal renders the French step-by-step instructions", () => {
  const html = renderToStaticMarkup(
    <IosGuideModal nonSafariIOS={false} onCopy={() => {}} onClose={() => {}} copyStatus="idle" />,
  );
  expect(html).toContain("Ajouter à l");
  expect(html).toContain("écran d");
  expect(html).toContain("accueil");
  expect(html).toContain("Ouvre la page dans");
  expect(html).toContain("Safari");
  expect(html).toContain("Partager");
  expect(html).toContain("Fais défiler la liste");
  expect(html).toContain("Modifier les actions");
  expect(html).toContain("🔗 Copier le lien");
  expect(html).toContain("Fermer");
});

test("IosGuideModal shows the non-Safari warning only when flagged", () => {
  const withWarning = renderToStaticMarkup(
    <IosGuideModal nonSafariIOS={true} onCopy={() => {}} onClose={() => {}} copyStatus="idle" />,
  );
  expect(withWarning).toContain("pas ouverte dans");
  expect(withWarning).toContain("Safari");

  const withoutWarning = renderToStaticMarkup(
    <IosGuideModal nonSafariIOS={false} onCopy={() => {}} onClose={() => {}} copyStatus="idle" />,
  );
  expect(withoutWarning).not.toContain("pas ouverte dans");
});

test("IosGuideModal reflects copy status in the copy button label", () => {
  const copied = renderToStaticMarkup(
    <IosGuideModal nonSafariIOS={false} onCopy={() => {}} onClose={() => {}} copyStatus="copied" />,
  );
  expect(copied).toContain("✅ Lien copié !");
});

test("IosGuideModal shows the manual-copy link when clipboard access fails", () => {
  const manual = renderToStaticMarkup(
    <IosGuideModal nonSafariIOS={false} onCopy={() => {}} onClose={() => {}} copyStatus="manual" />,
  );
  expect(manual).toContain("Copie ce lien et ouvre-le dans Safari");
  expect(manual).toContain("https://darti.github.io/jlpt/");
});
