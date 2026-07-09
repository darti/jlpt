import { useState, useCallback } from "react";
import { readTheme, otherTheme, applyTheme, type ThemeName } from "../lib/theme.ts";

export function useTheme(): { theme: ThemeName; toggle: () => void } {
  const [theme, setTheme] = useState<ThemeName>(() => readTheme());
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next = otherTheme(cur);
      applyTheme(next);
      return next;
    });
  }, []);
  return { theme, toggle };
}
