import { speak } from "../../lib/tts.ts";

/** Petit bouton 🔊 : prononce `text` en japonais via la synthèse vocale (src/lib/tts.ts).
 *  Ne rend rien si la TTS n'est pas supportée ou si `text` est vide (pas de bouton mort). */
export function SpeakButton({
  text,
  label = "Prononcer",
}: {
  text: string;
  label?: string;
}) {
  if (!text || typeof speechSynthesis === "undefined") return null;
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      title={label}
      aria-label={label}
      className={
        "shrink-0 w-7 h-7 rounded-full border border-line bg-surface-2 " +
        "text-accent cursor-pointer inline-flex items-center justify-center"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 5L6 9H2v6h4l5 4z" />
        <path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
      </svg>
    </button>
  );
}
