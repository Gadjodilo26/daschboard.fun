# AGENT.md — guide agent-friendly

Version allégée du guide pour agents automatisés. Contient les points essentiels pour intervenir rapidement sur le dépôt.

- Runtime : front-end statique ES6 — ouvrez `index.html` dans un navigateur ou servez le dossier avec `python -m http.server`.
    - Point d'entrée logique : `src/main.js` → `controllers/appController.js` (qui charge `core/engine.js`, `controllers/events.js`, `bookkeeping.js`).
- Flux principal : utilisateur -> `state.inputs` -> `core/engine.recalculate()` -> `calc.*` -> `state.results` -> `ui.renderAll()`.
- Persistance : `localStorage` via `STORAGE_KEY = "bp-eurl-transport"` (voir `config/constants.js`). Utiliser `storage.save()` / `storage.load()` / `storage.export()`.

Fonctions à connaître rapidement (recherche par nom si besoin) :
- `defaultInputs`, `normalizeInputs` — gestion des entrées et migration
- `defaultBookkeepingState`, `normalizeBookkeeping` — suivi des frais & calendrier
- `calc.loanSummary`, `calc.monthlySummary`, `calc.buildProjection`, `calc.financialRatios` — règles métier financières
- `core/engine.recalculate()` — orchestration (à appeler après modifications de `state.inputs`)
- `controllers/events.registerEventListeners()` / `ui.renderForm()` — mapping DOM ↔ `state.inputs`
- `ui.renderBookkeepingSummary`, `ui.renderBookkeepingEntries`, `ui.renderCalendarView` — nouvelles pages de gestion des frais

Rappels courts pour les agents :
- Préférez modifier `calc.*` pour toute logique métier transport et `bookkeeping.js` pour les agrégations comptables. Evitez de mélanger avec `ui.*`.
- Conserver la compatibilité des clés de `state.inputs` et ajouter une migration dans `normalizeInputs()` si nécessaire.
- Utiliser les utilitaires existants (`parseNumber`, `sanitizeText`, `formatCurrency`).

Si vous avez besoin des numéros de lignes pour une PR, exécutez localement :

    grep -n "loanSummary|monthlySummary|buildProjection|normalizeInputs|defaultInputs|registerEventListeners|renderForm|\\bstorage\\b" src || true
