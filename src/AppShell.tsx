import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./ui/Header.tsx";
import { TopNav } from "./ui/TopNav.tsx";
import { Footer } from "./ui/Footer.tsx";
import { UpdateBanner } from "./ui/UpdateBanner.tsx";
import { ThemeContext } from "./hooks/useThemeContext.tsx";
import { useTheme } from "./hooks/useTheme.ts";
import { useServiceWorker } from "./hooks/usePwa.ts";
import { setupDict } from "./lib/dict.ts";
import { pickJaVoice } from "./lib/tts.ts";
import { applyFontScale } from "./lib/fontscale.ts";
import { applyFuri } from "./lib/furigana.ts";

/** Single shared layout for every route: shell chrome + theme/SW state (once) + a
 *  one-time dict-data load + persisted font scale. Route content renders in `<Outlet/>`. */
export function AppShell() {
  const { theme, toggle } = useTheme();
  const { updateReady, apply, forceRefresh, version } = useServiceWorker();

  useEffect(() => {
    void setupDict();       // expose hideDef/jlptSay + charge data/graph/word.jsonld
    applyFontScale();       // apply persisted --fs-ui/--fs-jp
    applyFuri();            // apply persisted global furigana visibility (data-furi)
    if (typeof speechSynthesis !== "undefined") {
      pickJaVoice();        // pré-charge la voix ja-JP pour la TTS (Cours + quiz)
      // addEventListener (pas onvoiceschanged=) pour ne pas écraser le handler de dict.ts
      try { speechSynthesis.addEventListener("voiceschanged", pickJaVoice); } catch { /* ignore */ }
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <Header />
      <TopNav />
      <div className="max-w-[680px] mx-auto px-5 pt-6 pb-10">
        <Outlet />
      </div>
      <Footer onForceRefresh={forceRefresh} version={version} />
      <UpdateBanner show={updateReady} onApply={apply} />
    </ThemeContext.Provider>
  );
}
