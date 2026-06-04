# TI-30XS MultiView — Émulateur navigateur

Émulateur d'une calculatrice Texas Instruments TI-30XS MultiView, entièrement en HTML/CSS/JS vanilla, sans dépendance externe. L'évaluateur mathématique est implémenté from scratch (algorithme shunting-yard → RPN).

## Démo

**https://nbocquet.github.io/TI-30XS-emulator/**

## Ce qui fonctionne

- Arithmétique : `+` `-` `×` `÷` `^` `(` `)` `%`
- Fonctions trigonométriques : sin, cos, tan et leurs inverses (asin, acos, atan)
- Fonctions hyperboliques : sinh, cosh, tanh et leurs inverses
- Logarithmes et exponentielles : ln, log, eˣ, 10ˣ
- Racines : √, ∛, xˢᵗʰ root
- Factorielle (`n!`), combinaisons nCr, permutations nPr
- Constantes : π, e
- Valeur absolue
- Notation scientifique (×10ⁿ)
- Fractions : saisie `a b/c`, affichage fraction (numérateur/dénominateur en exposant/indice), toggle F↔D
- Affichage des puissances en exposant et des racines avec vinculum
- Navigation par curseur dans l'expression (← →)
- Historique des calculs (↑ ↓)
- Modes d'angle : DEG / RAD / GRAD
- Touche `2nd` pour les fonctions secondaires
- Réponse `Ans` réutilisable
- Multiplication implicite (`2π`, `3(4+1)`…)
- Deux coloris : bleu / rose
- Deuxième écran flottant

## Ce qui n'est pas implémenté

- Mode `data` (statistiques)
- Mode `table`

## Lancer en local

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Tests

```bash
node test.js   # 115 tests
```

## Architecture

Trois fichiers principaux :

| Fichier | Rôle |
|---|---|
| `index.html` | Layout, boutons avec `data-action` |
| `javascript.js` | `Evaluator` (parser/évaluateur), `Calculator` (état), `DisplayManager` (DOM) |
| `style.css` | Layout, thèmes bleu/rose via `data-colorway` |
