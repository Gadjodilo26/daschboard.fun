## But rapide

Ce dépôt est une application front-end statique (HTML/CSS/JS) pour préparer un business plan de transport frigorifique.

Ces instructions aident un agent IA à être immédiatement productif : où lire la logique, quels fichiers modifier, et quelles conventions suivre.

## Architecture & big-picture

- Runtime : navigateur moderne (ES6). Pas de build tool ni de serveur backend dans le repo — ouvrir `index.html` ou servir le dossier statique.
- Entrées principales : `index.html`, `simulation.html`, `projection.html`, `financing.html`, `summary.html`, `exports.html`.
- Logique centrale : code réorganisé en modules ES sous `src/` (entrée : `src/main.js`). Les responsabilités restent les mêmes : utilitaires, state, calc, storage, printing, ui, events.
- Flux de données : utilisateur → `state.inputs` → `recalculate()` → `calc.*` → `state.results` → `ui.renderAll()` → DOM.
- Persistance : `localStorage` via la clé `bp-eurl-transport` (voir `storageKey` dans `src/storage.js`).

## Points d'intégration importants

- localStorage import/export : `storage.save()`, `storage.load()`, `storage.export()` (export JSON téléchargeable via `btn-export-json`).
- Impression : `printing.print()` applique la classe `is-printing` puis `window.print()`.
- Navigation page : la page active est déterminée par `document.body.dataset.page` (valeurs : `landing`, `simulation`, `projection`, `financing`, `summary`, `exports`).

## Conventions projet (à respecter lors d'éditions)

- IDs d'inputs : préfixe `input-` (ex. `input-daily-revenue`, `input-loan-rate`) ; le mapping d'ID ↔ state est centralisé dans `ui.renderForm()` et l'écouteur `bindEvents()`.
- Regroupement logique : ne pas disperser la logique financière — modifier/ajouter des calculs dans l'espace `calc` (ex. `calc.loanSummary`, `calc.monthlySummary`).
- Normalisation/validation : utilisez `parseNumber()`, `sanitizeText()` et `normalizeInputs()` pour garantir la compatibilité avec la sauvegarde.
- Formats d'affichage : utiliser `formatCurrency()` et `formatPercent()` pour rester cohérent avec l'UI.

## Exemples concrets (où et comment modifier)

- Ajouter un nouvel champ input (ex. `input-new-charge`):
  1. Ajouter la clé et la valeur par défaut dans `defaultInputs()`.
  2. Mettre à jour `normalizeInputs()` pour valider la clé.
  3. Ajouter l'ID au mapping dans `ui.renderForm()` pour l'affichage initial.
  4. Ajouter le gestionnaire dans `bindEvents()` (mapper l'ID à l'affectation sur `state.inputs`).
  5. Si c'est utilisé dans des calculs, appeler `recalculate()` et intégrer la clé dans `calc.*`.

- Modifier le calcul du prêt : regarder `calc.loanSummary(inputs, overrideAmount)` (dans `src/calc.js`) — retourner un objet avec `monthlyPayment`, `monthlyInsurance`, `schedule`.

- Sauvegarde & migration : si vous changez la forme de `state.inputs`, adaptez `storage.load()` pour migrer / appeler `normalizeInputs()` afin d'éviter de casser les sauvegardes existantes.

## Debug & workflows locaux

- Exécution locale : le site est statique — pour tester rapidement lancez un serveur simple (ex. `python -m http.server 8000` dans le dossier du projet) et ouvrez `http://localhost:8000`.
- Debugging : console du navigateur — `recalculate()`, `storage.save({ force: true })`, `storage.export()` sont pratiques pour forcer calculs et vérifier la persistance.
- Tests rapides manuels : modifier `state.inputs` dans la console puis appeler `recalculate()` et `ui.renderAll()` pour vérifier l'impact.

## Patterns à connaître pour les agents IA

- Séparer UI vs logique : privilégier `calc.*` pour les changements de règle métier; `ui.*` pour les modifications d'affichage.
- Conserver la compatibilité locale : ne pas renommer la clé `storageKey` ni la structure JSON sans migration.
- Réutiliser utilitaires existants : `parseNumber()`, `formatCurrency()`, `sanitizeText()` plutôt que d'ajouter des variantes.

## Fichiers clés à consulter

`src/` — cœur du code désormais réparti : `src/state.js`, `src/calc.js`, `src/storage.js`, `src/ui.js`, `src/main.js`.
- `index.html` — structure et navigation principale (body dataset page, header/nav, points d'entrée UI).
- `styles.css` — classes utilitaires et layout (respecter classes `btn`, `page-hero`, etc.).

## Liens rapides (fichiers & fonctions)

Les symboles clés ont été répartis dans les modules `src/` :

- `defaultInputs` — valeurs par défaut : `src/state.js`
- `normalizeInputs(payload)` — validation/migration des inputs sauvegardés : `src/state.js`
- `calc.loanSummary(inputs, overrideAmount)` — simulation prêt, échéancier : `src/calc.js`
- `calc.monthlySummary(inputs, loan)` — calculs mensuels (CAF, impôt, BFR, marge) : `src/calc.js`
- `calc.buildProjection(inputs, loan, monthly)` — projection 36 mois : `src/calc.js`
- `storage` object (save / load / export) — persistance localStorage : `src/storage.js`
- `ui.renderForm()` — mapping ID->state pour la forme : `src/ui.js`
- `bindEvents()` / `recalculate()` — orchestration et attache des listeners : `src/main.js`

Remarque : si vous avez besoin de localiser précisément des blocs de code, utilisez une recherche dans le dossier `src/`, par exemple :

  grep -n "loanSummary\|monthlySummary\|buildProjection\|normalizeInputs\|defaultInputs\|bindEvents\|renderForm\|\\bstorage\\b" src || true

--
J'ai ajouté aussi une checklist PR dédiée aux calculs financiers (`.github/PR_CHECKLIST_FINANCIAL.md`) et une version agent-friendly `AGENT.md` à la racine. Voir les fichiers ajoutés pour les détails.

Si une section est incomplète ou si vous voulez que j'ajoute des exemples précis (liens vers lignes de `app.js` ou un plan de tests unitaires extrait des fonctions `calc`), dites-le et j'affinerai ce fichier. 

Merci — voulez-vous que j'ajoute aussi une checklist de revue PR spécifique au calcul financier (ex : test de cohérence loan vs monthly)?
