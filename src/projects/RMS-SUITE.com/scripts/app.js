// Point d'entrée : instancie le store et branche l'interface utilisateur
import { createStore } from "./core/state.js";
import { initUI } from "./core/ui.js";
import { initLogoUpload } from "./core/logo.js";

// État centralisé de l'application
const store = createStore();

// Initialisation des interactions lorsque le DOM est prêt
document.addEventListener("DOMContentLoaded", () => {
  initUI(store);

  // Sample demo data button
  document.querySelectorAll("[data-action='fill-demo']").forEach((demoButton) => {
    demoButton.addEventListener("click", () => {
      store.importData(createDemo());
    });
  });

  const logoPreview = document.querySelector(".logo-preview img");
  initLogoUpload("input[type='file'][data-action='upload-logo']", {
    onLoad(dataUrl) {
      store.set("company.logoDataUrl", dataUrl);
    },
    previewImage: logoPreview,
  });
});

// Jeu de données d'exemple pour illustrer le fonctionnement complet
function createDemo() {
  return {
    meta: {
      docType: "Devis",
      language: "fr",
      number: "DEV-20240515-045",
      date: "2024-05-15",
      validity: 45,
      projectRef: "PROJ-UX-2024-05",
      paymentTerms: "50% à la commande, solde à 30 jours",
      latePenalties:
        "Pénalités : taux légal majoré + indemnité de 40 € (art. D441-5 C. Com.).",
      notes:
        "Planning indicatif :\n- Démarrage sous 10 jours ouvrés\n- Livraison itérative\nDocumentation : https://www.devis.fr/docs/presta",
    },
    company: {
      name: "Devis.fr Solutions",
      status: "SAS",
      siren: "123 456 789 00012",
      vatNumber: "FR12 345678901",
      address: "42 rue des Entrepreneurs\n75015 Paris\nFrance",
      phone: "+33 (0)1 23 45 67 89",
      email: "contact@devis.fr",
      website: "https://www.devis.fr",
      bank: "IBAN FR76 3000 6000 0112 3456 7890 189\nBIC AGRIFRPPXXX",
    },
    client: {
      type: "Société",
      name: "Agence Horizon",
      contact: "Camille Martin",
      address: "8 avenue de la Liberté\n69003 Lyon\nFrance",
      email: "camille.martin@agencehorizon.fr",
      phone: "+33 (0)4 78 00 00 00",
    },
    items: [
      {
        id: crypto.randomUUID(),
        reference: "UX-WS",
        description:
          "Atelier d'immersion utilisateur et cadrage stratégique.\nLivrables : synthèse, personas, roadmap.",
        quantity: 2,
        unit: "jour",
        unitPrice: 680,
        vatRate: 20,
      },
      {
        id: crypto.randomUUID(),
        reference: "UI-DESIGN",
        description:
          "Design system personnalisé + maquettes responsives.\nInclut 2 allers-retours de corrections.",
        quantity: 1,
        unit: "forfait",
        unitPrice: 2450,
        vatRate: 20,
      },
      {
        id: crypto.randomUUID(),
        reference: "DEV-INT",
        description:
          "Intégration front-end composants modulaires.\nTechnos : HTML5, CSS3, JS vanilla.",
        quantity: 5,
        unit: "jour",
        unitPrice: 520,
        vatRate: 20,
      },
    ],
    options: {
      currency: "EUR",
      decimalFormat: "fr",
      layout: "classic",
      density: "normal",
      theme: "default",
      font: "system",
      orientation: "portrait",
      descriptionWidth: 60,
      headerRatio: 55,
      logoPlacement: "left",
      logoSize: 110,
      headerBanner: false,
      columnVisibility: {
        reference: true,
        unit: true,
        vatRate: true,
      },
      sections: {
        signature: true,
        bank: true,
        qr: true,
        legal: true,
        conditions: true,
      },
      discount: {
        type: "percent",
        percent: 5,
        amount: 0,
      },
      deposit: {
        type: "percent",
        percent: 40,
        amount: 0,
      },
      shippingAmount: 120,
      shippingVat: 20,
    },
  };
}
