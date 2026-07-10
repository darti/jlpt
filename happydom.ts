// Registers a happy-dom window/document/localStorage for tests that mount live
// React components (createRoot) and exercise DOM side effects. Loaded via bunfig
// `[test] preload`. SSR tests (renderToStaticMarkup) and pure-logic tests are
// unaffected — they never touch these globals.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
