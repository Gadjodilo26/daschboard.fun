# Checklist revue PR — calculs financiers

Objectif : vérifier que toute modification touchant la logique financière (`calc.*`, `recalculate`, `storage`) est correcte, non régressive et testable.

Avant d'ouvrir la PR
- S'assurer qu'une copie locale du site s'ouvre sans erreurs (ouvrir `index.html` via un serveur statique).
- Mettre à jour `defaultInputs()` si de nouvelles clés `state.inputs` sont ajoutées.
- Modifier `normalizeInputs()` pour valider/migrer les anciennes sauvegardes.

Tests manuels rapides (navigateur console)
- Ouvrir la console et exécuter :
  - `recalculate();` (doit s'exécuter sans erreur)
  - `state.results.loan` — vérifier `amount`, `monthlyPayment`, `schedule` (mensualités cohérentes)
  - `state.results.monthly` — vérifier `caf`, `advanceTreasury`, `monthly.debtService`
  - `state.results.projection.months.length === 36` (projection 36 mois)
- Scénarios à tester :
  - Zero rate loan (mettre `input-loan-rate` à 0) — mensualité = capital / mois
  - Durée de prêt = 1 an (vérifier arrondis), durée très longue
  - TVA franchise ON/OFF (`input-vat-franchise`) — vérifier `fiscal.vatNet`
  - Supprimer toutes les `dailyCourses` puis cliquer `btn-apply-daily-revenue`

Vérifications automatiques et invariants
- La somme des `schedule[].principal` + `totalInterest` doit être cohérente avec `loan.totalCost`.
- `state.inputs.monthlyLoanPayment` doit être égal à `state.results.loan.monthlyPayment` après `recalculate()`.
- `advanceTreasury` doit être >= 0.

UX / sauvegarde
- Vérifier `storage.save()` / `storage.load()` : faire un `storage.export()` puis `storage.load()` en important le fichier.
- Ne pas renommer la clé `storageKey` (`bp-eurl-transport`) sans écrire une migration explicite dans `storage.load()`.

Calage PR — description minimale
- Indiquer quelles fonctions `calc.*` ont été modifiées.
- Fournir 2-3 captures d'écran (simulation avant / après) ou un petit fichier JSON exporté montrant les différences.
- Lister les cas limites testés (ex. taux 0, durée 1 mois, CA nul).

Si vous modifiez des noms d'inputs, mettez à jour `ui.renderForm()` et `bindEvents()` et incluez une migration dans `normalizeInputs()`.
