# Instructions pour Codex — Refactoriser `app.js` en modules ES

But : découper le fichier monolithique `app.js` en modules ES sous `src/` sans ajouter de bundler, garder le site statique (chargement via `<script type="module">`).

Consignes générales
- Créer un dossier `src/` à la racine.
- Maintenir une seule instance de `state` exportée depuis `src/state.js` (objet mutable). Tous les autres modules importent et modifient cet objet, ne pas recréer une nouvelle instance.
- Ne modifiez pas la forme de `state.inputs` sauf si vous ajoutez une migration dans `normalizeInputs()`.
- Conserver les noms de fonctions publiques (ex. `recalculate`, `bindEvents`, `init`) et les exporter depuis `src/main.js` pour la console si utile.
- Ajouter des entêtes JSDoc courts en haut de chaque fichier.

Arborescence à créer

src/
  ├─ state.js        # defaultInputs, state, normalizeInputs
  ├─ utils.js        # parseNumber, formatCurrency, sanitizeText, uuid, formatPercent
  ├─ calc.js         # export const calc = { loanSummary, monthlySummary, buildProjection, financialRatios }
  ├─ storage.js      # export const storage = { save, load, export }
  ├─ ui.js           # export const ui = { renderAll, renderForm, ... }
  └─ main.js         # assemble : recalculate, bindEvents, init

Fichiers / squelettes (à compléter en copiant le code existant depuis `app.js`)

1) `src/state.js`

```javascript
// state.js — default inputs, state object, normalizeInputs
import { sanitizeText, parseNumber, uuid } from './utils.js';

export const defaultInputs = () => ({
  // Coller le contenu de defaultInputs() depuis app.js
});

export const state = {
  currentPage: typeof document !== 'undefined' ? document.body.dataset.page || 'landing' : 'landing',
  autoSaveEnabled: true,
  inputs: defaultInputs(),
  results: { monthly: null, projection: null, loan: null, ratios: null }
};

export function normalizeInputs(payload) {
  // Copier la fonction normalizeInputs depuis app.js, en important ici parseNumber, sanitizeText et createDefaultDailyCourses
}

export default state;
```

2) `src/utils.js`

```javascript
// utils.js — petits utilitaires partagés
export const MEAL_ALLOWANCE_PER_DAY = 17.5;
export const COLD_PRIME_RATE = 0.05;
export const LICENSE_UNIT_COST = 1800;
export const BORROWER_INSURANCE_RATE = 0.0045;

export function parseNumber(value, fallback = 0) { /* copier implémentation */ }
export function sanitizeText(value, max = 120) { /* ... */ }
export function uuid() { /* ... */ }
export function formatCurrency(value, detailed = false) { /* ... */ }
export function formatPercent(value) { /* ... */ }

```

3) `src/calc.js`

```javascript
import { parseNumber, MEAL_ALLOWANCE_PER_DAY, COLD_PRIME_RATE, BORROWER_INSURANCE_RATE } from './utils.js';

export const calc = {
  loanSummary(inputs, overrideAmount = null) { /* copier depuis app.js */ },
  dailyCourseTotal(inputs) { /* ... */ },
  estimateIncomeTax(monthlyNet) { /* ... */ },
  monthlySummary(inputs, loan) { /* ... */ },
  buildProjection(inputs, loan, monthly) { /* ... */ },
  financialRatios(inputs, monthly, projection, loan) { /* ... */ }
};

export default calc;
```

4) `src/storage.js`

```javascript
import { state, normalizeInputs, defaultInputs } from './state.js';

export const storageKey = 'bp-eurl-transport';

export const storage = {
  save(options = {}) { /* copier implémentation en utilisant state */ },
  load() { /* copier implémentation et appeler normalizeInputs */ },
  export() { /* copier implémentation */ }
};

export default storage;
```

5) `src/ui.js`

```javascript
import { state } from './state.js';
import { calc } from './calc.js';
import { storage } from './storage.js';
import { formatCurrency, formatPercent, withTooltip, escapeHtml } from './utils.js';

export const ui = {
  renderAll(options = {}) { /* copier implémentation */ },
  renderForm() { /* ... */ },
  // ... autres fonctions ui
  toast(message, type = 'info') { /* ... */ }
};

export default ui;
```

6) `src/main.js`

```javascript
import { state, normalizeInputs } from './state.js';
import { calc } from './calc.js';
import { storage } from './storage.js';
import { ui } from './ui.js';

export function recalculate() {
  state.inputs = normalizeInputs(state.inputs);
  // Copier la logique existante en appelant calc.* et en mettant à jour state.results
}

export function bindEvents() {
  // Copier bindEvents depuis app.js, en important ui, storage et calc via imports
}

export function init() {
  state.currentPage = document.body.dataset.page || 'landing';
  storage.load();
  recalculate();
  bindEvents();
  ui.renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export default { init, recalculate, bindEvents };
```

Instructions étape-par-étape pour Codex
1. Créer `src/` et ajouter les 6 fichiers ci-dessus avec les squelettes.
2. Copier les const, utilitaires et formatters depuis `app.js` dans `src/utils.js` (préserver formatters Intl).
3. Copier `defaultInputs` et `normalizeInputs` dans `src/state.js`. Exporter `state` comme objet mutable.
4. Copier l'objet `calc` dans `src/calc.js` et remplacer les références aux utilitaires par des imports depuis `utils.js`.
5. Copier `storage` dans `src/storage.js` et remplacer la référence à `normalizeInputs` par l'import depuis `state.js`.
6. Copier `ui` dans `src/ui.js` et ajuster les imports (state, calc, storage, utils). Veiller à ce que `ui.renderForm()` utilise les mêmes `id` d'éléments.
7. Copier `recalculate`, `bindEvents`, `init` dans `src/main.js`, et remplacer les références globales par imports.
8. Modifier `index.html` : remplacer `<script defer src="app.js"></script>` par `<script type="module" src="src/main.js"></script>`.
9. Tester localement via un serveur statique (ex. `python -m http.server`) et vérifier :
   - la page charge sans erreur JS
   - `recalculate()` fonctionne dans la console
   - `storage.save()` / `storage.load()` fonctionne (export/import JSON)

Checklist post-refactor
- Vérifier qu'il n'y a qu'une seule instance de `state` (importée depuis `state.js`).
- Mettre à jour `.github/copilot-instructions.md` et `AGENT.md` pour pointer vers `src/`.
- Lancer manuellement les scénarios listés dans `.github/PR_CHECKLIST_FINANCIAL.md`.

Remarques pour Codex
- Ajoutez des TODO/JSDoc dans chaque fichier pour faciliter la relecture humaine.
- Ce guide a servi à migrer `app.js` vers `src/`. Une fois la migration vérifiée, il est sûr de supprimer `app.js`. Dans ce dépôt la migration ES-modules a été appliquée — vous pouvez supprimer `app.js` maintenant.
- Si vous introduisez des erreurs de portée, recherchez les références globales (ex. `ui`, `storage`, `state`) et importez-les explicitement.

Si vous voulez, je peux maintenant :
- Générer les fichiers squelettes automatiquement (création de `src/` + fichiers initiaux) — puis vous pourrez demander à Codex de remplir chaque fichier.
- Ou exécuter la refactorisation complète moi-même (déplacer le code existant dans les fichiers et tester) — dites-moi si vous voulez que j'applique ça maintenant.

*** Fin des instructions pour Codex
