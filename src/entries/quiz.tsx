import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuizApp from "../QuizApp.tsx";
import { setupDict } from "../lib/dict.ts";
import "../styles/styles.gen.css";

// Expose window.furi/visualBreak/initDefs + load dict data (data/dict.json) BEFORE the
// first render, so furigana/analysis are ready when QuestionCard/Corrige render and
// tap-to-define is wired on mount. Best-effort: on failure the UI degrades to plain text.
await setupDict();
const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><QuizApp /></StrictMode>);
