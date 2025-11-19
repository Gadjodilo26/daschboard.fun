# ProjetSASHOLDING.fr

Simulateur statique (HTML/ESM) destiné à produire un business plan complet pour une EURL de transport frigorifique : simulation mensuelle, projection à 3 ans, besoins de financement et synthèse prête à être imprimée.

## Prise en main rapide

```bash
# Lancer un serveur local
python3 -m http.server 4173

# Ouvrir ensuite http://localhost:4173/index.html dans le navigateur
```

Les pages utilisent toutes `src/main.js` en mode module ES2020 : aucun bundler ni dépendance externe n'est requis.

## Architecture

```
src/
├── config/constants.js       # Constantes métier et clés de configuration
├── core/engine.js            # Orchestrateur des calculs / projections
├── controllers/
│   ├── appController.js      # Initialisation globale (state + UI + events)
│   └── events.js             # Binding DOM + mapping inputs -> state
├── bookkeeping.js            # Agrégations et helpers pour le suivi des frais
├── calc.js                   # Algorithmes financiers (prêt, ratios, projection…)
├── state.js                  # Définition et normalisation des inputs/results
├── storage.js                # Persistance localStorage
├── ui.js                     # Rendus DOM (formulaire, tableaux, graphiques…)
├── utils.js                  # Fonctions génériques (parse, formatters, uuid…)
└── main.js                   # Point d'entrée minimal (bootstrapping)
```

Flux principal :

1. Les événements utilisateurs mettent à jour `state.inputs` via `controllers/events.js`.
2. `core/engine.recalculate()` s'appuie sur `calc.js` pour alimenter `state.results`.
3. `ui.renderAll()` relit `state` et met à jour le DOM / la nouvelle interface de frais.
4. `storage.save()` persiste automatiquement si l'auto-save est activée (inputs + écritures).

## Module « Frais & calendrier »

- Pages dédiées : `bookkeeping.html` (saisie + tableaux) et `calendar.html` (vision calendaire détaillée).
- Données gérées : `state.bookkeeping = { month: 'YYYY-MM', entries: [{ id, date, type, category, amount, status, notes }] }`.
- Actions clés :
  - ajout / modification / suppression d'écritures via le formulaire dédié ;
  - filtrage par mois + export/import JSON indépendant (`bookkeeping-export` / `bookkeeping-import`);
  - calendrier mensuel offrant une liste déroulante par jour pour distinguer entrées (vert) et dépenses (rouge).
- Les totaux mensuels (revenus, dépenses, net) alimentent les panneaux récapitulatifs sur les deux pages.

## Bonnes pratiques de contribution

- Ajouter les nouvelles constantes métier dans `config/constants.js` puis les importer où nécessaire.
- Toute logique numérique/financière doit vivre dans `calc.js` (ou un module dédié comme `bookkeeping.js`) et non dans `ui.js`.
- Après modification de `state.inputs`, appeler `recalculate()` puis `ui.renderAll()` pour garder l'IHM synchronisée.
- Pour toute évolution du schéma `state.inputs`, penser à :  
  1. étendre `defaultInputs()`  
  2. mettre à jour `normalizeInputs()` pour gérer rétrocompatibilité  
  3. adapter le formulaire (`ui.renderForm()` + `controllers/events.js`).
- Pour les écritures de frais, étendre `defaultBookkeepingState()` et `normalizeBookkeeping()` puis ajuster `bookkeeping.html` / `calendar.html` si besoin.
- Utiliser `storage.save({ force: true })` uniquement pour les actions explicites (reset, import, toggle autosave).

## Tests manuels recommandés

- **Simulation** : modifier des hypothèses clés (CA journalier, carburant, prêt) et vérifier la mise à jour instantanée des tableaux.
- **Import/Export** : exporter un scénario JSON, réinitialiser puis réimporter pour vérifier la migration des données.
- **Projection/Impression** : ouvrir les pages `projection.html` et `summary.html`, déclencher l'impression pour valider les styles dédiés.

## Licence

Projet interne SASHOLDING — usage privé. Ajouter une licence si diffusion prévue.
