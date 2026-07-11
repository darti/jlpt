import { createContext, useContext } from "react";
import type { ThemeName } from "../lib/theme.ts";

export interface ThemeCtx { theme: ThemeName; toggle: () => void }

/** App-wide theme + toggle, provided by AppShell so TopNav and the hub Settings share
 *  one `useTheme` instance. */
export const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });
export const useThemeContext = (): ThemeCtx => useContext(ThemeContext);
