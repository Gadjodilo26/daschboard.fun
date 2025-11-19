# Instructions pour les Agents AI - Méthode Piccini

Ce document guide les agents AI pour travailler efficacement sur ce projet de documentation de la Méthode Piccini.

## Architecture du Projet

Le projet est une documentation web statique structurée comme suit :
- Un fichier HTML unique (`MaxPiccini.html`) contenant toute la documentation
- Style CSS intégré dans le `<head>` pour un design responsive et imprimable
- Structure sémantique avec balises ARIA pour l'accessibilité

## Conventions de Code

### HTML
- Structure sémantique avec rôles ARIA appropriés
- Sections numérotées et identifiées (`id="section-name"`)
- Navigation via sommaire avec ancres
- Classes CSS fonctionnelles (`.box`, `.warn`, `.grid`, etc.)

### CSS
- Variables CSS pour les couleurs et thèmes (préfixe `--`)
- Media queries pour l'impression (`@media print`)
- Classes utilitaires pour la mise en page (`.sr-only`, `.page-break`, etc.)
- Grille flexible pour les KPIs (`.kpi .card`)

## Workflow de Développement

### Modification du Contenu
1. Les références sont notées avec `[n]` où n est le numéro de la source
2. Les variables sont encadrées par `{{VAR_NAME}}` (ex: `{{DATE}}`, `{{MARQUE}}`)
3. Les tableaux utilisent la classe `.grid` avec en-têtes sémantiques

### Accessibilité
- Chaque section a un `role` et `aria-label` appropriés
- Navigation structurée avec landmarks ARIA
- Classes `.sr-only` pour le contenu destiné aux lecteurs d'écran

## Points d'Intégration

### Variables à Remplacer
- `{{DATE}}` : Date courante
- `{{MARQUE}}` : Nom de la marque
- `{{AUTEUR}}` : Nom de l'auteur
- `{{URL_SITE}}` : URL du site web

### Sections Critiques
- Références (`#ressources`) : Doivent être maintenues à jour avec les dates
- Clause de non-responsabilité (`#disclaimer`) : Doit rester conforme aux standards légaux

## Notes Importantes

1. Toujours préserver la structure de numérotation des sections
2. Maintenir la cohérence des références bibliographiques
3. Assurer la compatibilité d'impression (via `@media print`)
4. Respecter les conventions d'accessibilité établies