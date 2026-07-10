import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import QuizApp from "../QuizApp.tsx";
import "../styles/styles.gen.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><QuizApp /></StrictMode>);
