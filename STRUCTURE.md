# Structure du projet

```
.
├── index.html             # Dashboard principal (consomme les assets de src/)
├── STRUCTURE.md           # Notes sur l'organisation
├── _archive/              # Copies et brouillons hors-ligne
│   ├── pages/             # index copy*.html
│   ├── styles/            # style copy*.css
│   └── unused/            # anciens dossiers (ex. Test)
└── src/
    ├── assets/
    │   ├── css/
    │   │   ├── style.css           # thème principal
    │   │   └── legacy/             # anciens styles Nav/Dock
    │   ├── img/                    # images partagées (logo, visuels...)
    │   │   └── logo/atlas/         # icônes SVG + placeholder
    │   ├── js/
    │   │   ├── app.js              # logique du dashboard
    │   │   ├── contact.js          # modal, validation, envoi
    │   │   └── link-audit.js       # audit de liens
    │   └── lib/                    # dépendances tierces
    ├── data/                       # source de vérité (JSON)
    │   ├── site.json               # branding, services, FAQ, workflows
    │   ├── projects.json           # cartes projets
    │   ├── links.json              # ressources + docks
    │   ├── timeline.json           # rituels / agenda
    │   └── kpis.json               # métriques internes
    ├── pages/                      # pages éditoriales (apache, lamp, contact...)
    └── projects/
        ├── linkplace.fun/          # hub de liens LinkPlace
        ├── linkplace.fr/           # portail éditorial LinkPlace
        ├── MéthodePiccini.com/     # portail coaching premium
        ├── ProjetSASHOLDING.fr/    # Atelier Entreprendre (simulateur business plan)
        ├── RMS-SUITE.com/          # suite offline devis/factures
        ├── Agencementfoessel.fr/  # site FM Multiservices
        ├── subvention.fr./         # moteur de recherche d'aides
        └── Crypto/                 # documentation trading
```

## Règles de travail

- Ajoute les nouveaux assets globaux dans `src/assets` (CSS, JS, images) et référence-les via des chemins relatifs (`src/assets/...`).
- Les projets autonomes se rangent dans `src/projects/<nom-projet>` pour garder leur propre stack.
- Les pages éditoriales/transverses se rangent dans `src/pages/` et utilisent les styles `../assets/css/...`.
- Toute ancienne version ou dossier expérimental doit partir dans `_archive/` (non exposé en prod).
- `index.html` consomme seulement ce qui est dans `src/assets` ; évite d'y mélanger d'autres sources.
- Les données affichées sont chargées depuis `src/data/*.json` ; mets à jour ces fichiers avant de modifier le JS.
