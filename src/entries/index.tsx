import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "../AppShell.tsx";
import App from "../App.tsx";
import QuizApp from "../QuizApp.tsx";
import EntrainementApp from "../EntrainementApp.tsx";
import { Planning } from "../features/planning/Planning.tsx";
import "../styles/styles.gen.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<App />} />
          <Route path="quiz" element={<QuizApp />} />
          <Route path="entrainement" element={<EntrainementApp />} />
          <Route path="planning" element={<Planning />} />
          <Route path="*" element={<App />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
