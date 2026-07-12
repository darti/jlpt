import { Settings } from "../entrainement/Settings.tsx";
import { SyncSection } from "../sync/SyncSection.tsx";
import { useThemeContext } from "../../hooks/useThemeContext.tsx";

/** Paramétrage route: font scale + theme + data (Settings) and multi-device Gist sync.
 *  Theme comes from the shared ThemeContext; sync's `onProgressChanged` is a no-op here —
 *  this route shows no progress UI, and Accueil/Entraînement re-read progress on mount. */
export function Parametrage() {
  const { theme, toggle } = useThemeContext();
  return (
    <div className="flex flex-col gap-6">
      <Settings theme={theme} onToggleTheme={toggle} />
      <SyncSection onProgressChanged={() => {}} />
    </div>
  );
}
