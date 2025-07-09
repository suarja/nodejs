1. Le metaprompting comme révolution
   • Metaprompting = utiliser des prompts pour améliorer/générer d’autres prompts. Ça devient un outil fondamental, presque comme du “code” dans les années 90.
   • Sentiment de “frontière” : les outils sont encore jeunes, il faut savoir communiquer clairement avec l’IA comme avec une personne.

2. Les meilleures pratiques chez les startups
   • Les prompts complexes (exemple : Parahelp pour le support client de Perplexity/Replit) sont souvent :
   • Très détaillés (plusieurs pages)
   • Structurés en sections : rôle de l’agent, étapes précises, contraintes, format de sortie, exemples, etc.
   • Souvent en style markdown ou XML-like pour la lisibilité et la clarté.
   • Séparation systématique :
   • systemPrompt : logique et API centrale de l’entreprise.
   • developerPrompt : logique ou variations propres au client/produit.
   • userPrompt : pour les produits exposés à l’utilisateur final.

3. Prompt versionning et architecture
   • Architecture émergente : prompts principaux pour la logique commune, forks pour les spécificités client, merge possible.
   • Challenge : garder un produit scalable sans finir en boîte de consulting qui refait tout à chaque client.
   • Automatisation recherchée : idéalement, des agents qui sélectionnent ou génèrent automatiquement les meilleurs exemples depuis les données clients.

4. Stratégies d’amélioration continue
   • Prompt folding : utiliser un prompt pour améliorer ou spécialiser automatiquement un autre prompt (ex: classifier qui génère des prompts plus ciblés).
   • Unit tests/TDL pour prompts : on donne des exemples où le prompt échoue, l’IA propose des corrections.
   • Donner un “escape hatch” à l’IA : l’IA doit pouvoir dire “je ne sais pas, il manque des infos”, sinon elle hallucine des réponses.

5. Outils et process pour évaluer et versionner
   • Traces de raisonnement (“thinking traces”) : observer la “pensée” de l’IA sur un prompt pour mieux comprendre/diagnostiquer.
   • Evals = atout stratégique (plus que les prompts eux-mêmes) : les vrais “crown jewels” sont les jeux d’évaluation et les feedbacks utilisateur, qui expliquent pourquoi un prompt fonctionne.
   • Process d’amélioration continue (kaizen) : ceux qui font le prompt (fondateurs, forward deployed engineers) sont ceux qui doivent l’améliorer en continu.

6. Personnalité et robustesse des modèles
   • Les LLMs réagissent différemment aux rubriques : certains (GPT-3.5) sont rigides, d’autres (Gemini 2.5) sont plus nuancés, capables de raisonner autour de règles/exceptions.

7. Forward deployed engineer = le nouveau founder
   • Le fondateur doit être “forward deployed engineer” : sur le terrain, comprendre à fond les workflows métier, construire la solution au plus près des utilisateurs et revenir en itérant très vite (plutôt que déléguer à une équipe sales/consulting).

⸻

TL;DR (résumé ultime)
• Metaprompting et prompt engineering sont devenus des disciplines à part entière, à mi-chemin entre le code, la conception produit et la gestion humaine.
• Le prompt idéal est structuré, versionné, testé, forké et évolue grâce à l’observation et aux retours directs du terrain/utilisateur.
• Le vrai “moat” des startups AI aujourd’hui : la capacité à comprendre et capturer le workflow métier pour traduire ce savoir en prompts ET en évaluation (evals).
• Le fondateur doit rester au contact du terrain, à la fois technicien, designer, et ethnographe.
