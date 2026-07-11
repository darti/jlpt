export type Phase = "p1" | "p2" | "p3" | "p4";
export interface Week { p: Phase; t: string; items: string[] }

export const PHASE_NAME: Record<Phase, string> = { p1: "Phase 1", p2: "Phase 2", p3: "Phase 3", p4: "Phase 4" };

/** The 20-week study plan — transcribed verbatim from the vanilla planning-n3.html. */
export const WEEKS: Week[] = [
  { p: "p1", t: "Mise en route", items: ["Faire un 1ᵉʳ diagnostic dans l'app pour situer son niveau", "Parcourir le Cours : leçons 1–2 de grammaire", "Définir un créneau quotidien fixe (même heure)", "Activer la synchro (facultatif) pour suivre sa progression"] },
  { p: "p1", t: "Kanji & rythme", items: ["Cours : kanji « Temps » + « Émotions »", "Entraînement : 1 quiz Kanji + 1 quiz Vocab / jour", "Grammaire (Cours) : 5 points (ば・たら・なら・と)", "« Réviser mes erreurs » à chaque fin de journée"] },
  { p: "p1", t: "Bases grammaire", items: ["Grammaire : leçons 2–3 (apparence, passif/causatif)", "Entraînement : quiz Grammaire ciblé", "Écrire 2 phrases à soi avec chaque point vu", "Lecture : relire les exemples du cours à voix haute"] },
  { p: "p1", t: "Volume vocab", items: ["Cours : vocab (verbes composés, adverbes)", "Entraînement : quiz Vocab + Kanji", "Grammaire : leçon 4–5", "Refaire les questions ratées de la semaine"] },
  { p: "p1", t: "Bilan phase 1", items: ["Diagnostic complet : noter score et points faibles", "Réviser toutes les erreurs accumulées", "Relire les leçons de grammaire 1–5", "Auto-évaluation : où en suis-je ?"] },
  { p: "p2", t: "Construction 1", items: ["Grammaire : keigo (leçon 4) + leçons 6–7", "Entraînement : quiz mixtes", "Cours : kanji « Travail & société »", "Écoute : du japonais chaque jour, même en passif"] },
  { p: "p2", t: "Construction 2", items: ["Grammaire : leçons 8–9 (cause, opposition)", "Entraînement : focus catégorie la plus faible", "Kanji « Nature & science »", "Lecture : 1 texte court / jour"] },
  { p: "p2", t: "Construction 3", items: ["Grammaire : leçons 10–11", "Entraînement quotidien + révision des erreurs", "Vocab : katakana & onomatopées", "Tenir un journal : 3 phrases/jour en japonais"] },
  { p: "p2", t: "Construction 4", items: ["Grammaire : leçons 12–14 (て-formes, 授受)", "Entraînement : quiz Grammaire", "Kanji : nouveau lot", "1 diagnostic court pour mesurer"] },
  { p: "p2", t: "Construction 5", items: ["Grammaire : leçons 15–17", "Entraînement : viser >70% par catégorie", "Vocab : combler les trous", "Compréhension écrite : quiz 読解"] },
  { p: "p2", t: "Bilan phase 2", items: ["Diagnostic complet", "Lister les points de grammaire encore fragiles", "Réviser tous les kanji vus", "Repartir des erreurs récurrentes"] },
  { p: "p3", t: "Consolidation 1", items: ["Grammaire : leçons 18–20 (révision active)", "Entraînement adaptatif quotidien", "Lecture (読解) : entraînement chronométré mental", "Écoute : shadowing à voix haute"] },
  { p: "p3", t: "Consolidation 2", items: ["Grammaire : leçons 21–23", "« Réviser mes erreurs » en priorité", "Lecture : repérage d'info (情報検索)", "Diagnostic court en milieu de semaine"] },
  { p: "p3", t: "Consolidation 3", items: ["Grammaire : leçons 24–26 (jugement, registre)", "Entraînement : toutes catégories mélangées", "Vocab : expressions fréquentes", "聴解 : compréhension globale (概要理解)"] },
  { p: "p3", t: "Consolidation 4", items: ["Révision ciblée de la section la plus faible", "Entraînement : diminuer le taux d'erreurs", "Relire les méthodes 読解 & 聴解 du Cours", "Gérer le temps : réponds plus vite"] },
  { p: "p3", t: "Bilan phase 3", items: ["Diagnostic complet en conditions réelles", "Noter le score estimé /180 par section", "Identifier la section la plus faible", "Plan d'attaque pour les 4 dernières semaines"] },
  { p: "p4", t: "Examen blanc 1", items: ["Diagnostic complet chronométré", "Analyse fine des erreurs (pourquoi ?)", "Re-réviser la section la plus faible", "Entretenir les acquis, ne plus surcharger"] },
  { p: "p4", t: "Examen blanc 2", items: ["2ᵉ diagnostic complet", "Travailler la VITESSE en lecture", "Révision finale de la grammaire (Cours)", "Écoute quotidienne maintenue"] },
  { p: "p4", t: "Derniers réglages", items: ["3ᵉ diagnostic (viser ≥ 95/180)", "Revoir uniquement les erreurs récurrentes", "Préparer logistique : convocation, pièce d'identité, trajet", "Vérifier crayons 2B, gomme, montre"] },
  { p: "p4", t: "Semaine de l'examen", items: ["Révisions légères : erreurs récurrentes seulement", "Écoute + lecture détente, pas de bachotage tardif", "Dormir +++ , surtout l'avant-veille", "JOUR J : reste calme, gère ton temps. 頑張って！"] },
];
