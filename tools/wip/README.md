# Reprise reconstruction vocabulaire officiel (bloquée limite hebdo, reset 9 juil. 14h UTC)

- `vocab_official_list.json` : liste JLPT officielle consolidée (2959 mots {k,r,m,lvl}),
  N5:652 · N4:595 · N3:1712 (source Tanos/jlptsensei).
- État : `data/vocab.json` contient 1562 de ces mots (20 lots générés). Il en manque ~1397 (surtout N3).
- Reprise : recalculer les mots manquants = (liste officielle) − (data/vocab.json par clé `k`),
  découper en lots de 45, générer via VOCAB_SPEC (1 fiche + 2 questions écriture/lecture par mot,
  recopier le `lvl` officiel), merger avec tools/… (filtre mots à sens réel), sync, valider, déployer.
- NE PAS déployer tant que la base n'est pas complète (l'app cible le N3 ; lacunes N3 = régression).
