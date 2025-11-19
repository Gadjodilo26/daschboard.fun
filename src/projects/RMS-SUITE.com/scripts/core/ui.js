// Couche interaction : lie le state au DOM et à la prévisualisation
import { calculateTotals, centsToCurrency, formatNumber } from "./calcul.js";
import { drawQRCode } from "./qr.js";

// Références d'éléments utilisées à répétition
const SELECTORS = {
  form: "#quote-form",
  itemsBody: "#items-body",
  itemsTable: "#items-table",
  previewItemsBody: "#preview-items-body",
  totalsCard: "[data-total]",
  previewTotals: "[data-preview]",
  previewDocument: "#preview-document",
  previewOverlay: ".preview-overlay",
  body: "body",
  localFilesInput: "#local-files",
  localFilesList: "#local-files-list",
};

// Libellés FR/EN pour les éléments critiques de la preview
const I18N = {
  fr: {
    subtotal: "Sous-total HT",
    discount: "Remise",
    shipping: "Frais / Port HT",
    vatTotal: "TVA totale",
    total: "Total TTC",
    deposit: "Acompte",
    remaining: "Reste à payer",
    client: "Client",
    conditions: "Conditions",
    paymentTerms: "Conditions de paiement :",
    latePenalties: "Pénalités de retard :",
    legalMentions: "Mentions légales",
    bankDetails: "Coordonnées bancaires",
    payment: "Paiement",
    signature: "Cachet et signature",
    dateLabel: "Émis le",
  },
  en: {
    subtotal: "Subtotal (excl. tax)",
    discount: "Discount",
    shipping: "Shipping (excl. tax)",
    vatTotal: "Total VAT",
    total: "Grand total",
    deposit: "Deposit",
    remaining: "Amount due",
    client: "Client",
    conditions: "Terms",
    paymentTerms: "Payment terms:",
    latePenalties: "Late fees:",
    legalMentions: "Legal notices",
    bankDetails: "Bank details",
    payment: "Payment",
    signature: "Stamp & signature",
    dateLabel: "Issued on",
  },
};

// Traduction des préférences de format décimal en locale Intl
const DECIMAL_LOCALES = {
  fr: "fr-FR",
  en: "en-US",
};

// Initialisation principale : binding des événements et rendu
export function initUI(store) {
  const elements = mapSelectors(SELECTORS);
  const body = document.querySelector("body");
  const navButtons = Array.from(document.querySelectorAll("[data-nav-target]"));
  const scrollButtons = document.querySelectorAll("[data-scroll-target]");
  const observedSections = Array.from(
    new Set(navButtons.map((btn) => btn.dataset.navTarget).filter(Boolean))
  );
  const resourcesEmpty = document.querySelector(".resources-empty");

  const setActiveNav = (targetId) => {
    navButtons.forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.navTarget === targetId ? "true" : "false");
    });
  };

  const scrollToSection = (targetId) => {
    if (!targetId) return;
    const section = document.getElementById(targetId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav(targetId);
    }
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => scrollToSection(btn.dataset.navTarget));
  });

  scrollButtons.forEach((btn) => {
    btn.addEventListener("click", () => scrollToSection(btn.dataset.scrollTarget));
  });

  if ("IntersectionObserver" in window && observedSections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const targetId = visible[0].target.id;
          setActiveNav(targetId);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    observedSections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  if (elements.localFilesInput) {
    elements.localFilesInput.addEventListener("change", () => {
      renderLocalFiles(Array.from(elements.localFilesInput.files || []));
      elements.localFilesInput.value = "";
    });
  }

  // Applique les classes de thème/densité au body
  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return "";
    if (bytes === 0) return "0 octet";
    const units = ["octets", "Ko", "Mo", "Go", "To"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
  };

  const formatDateShort = (timestamp, locale = "fr-FR") =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));

  const normalizeImportPayload = (input) => {
    if (!input || typeof input !== "object") {
      return { type: "quote", payload: input };
    }
    if (input.kind === "companyProfile" && input.data) {
      return { type: "company", payload: input.data };
    }
    if (input.kind === "project" && input.data) {
      return { type: "project", payload: input.data };
    }
    if (input.kind === "invoice" && input.data) {
      return { type: "invoice", payload: input };
    }
    if (input.kind === "card" && input.data) {
      return { type: "card", payload: input };
    }
    if (input.kind === "quote" && input.data) {
      return { type: "quote", payload: input.data };
    }
    if (input.company && input.client && Array.isArray(input.items)) {
      return { type: "project", payload: { client: input.client, items: input.items } };
    }
    if (input.invoice && Array.isArray(input.items)) {
      return { type: "invoice", payload: input };
    }
    if ((input.fullName && input.theme) || input.qrLink) {
      return { type: "card", payload: input };
    }
    if (input.siren || input.vatNumber || input.logoDataUrl) {
      return { type: "company", payload: input };
    }
    if (input.client && Array.isArray(input.items)) {
      return { type: "project", payload: input };
    }
    return { type: "quote", payload: input };
  };

  const renderLocalFiles = (files) => {
    const list = elements.localFilesList;
    if (!list) return;
    list.innerHTML = "";
    if (!files.length) {
      if (resourcesEmpty) resourcesEmpty.hidden = false;
      return;
    }
    if (resourcesEmpty) resourcesEmpty.hidden = true;
    const state = store.getState();
    const locale = DECIMAL_LOCALES[state.options.decimalFormat] || "fr-FR";
    files
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, locale))
      .forEach((file) => {
        const item = document.createElement("li");
        item.className = "resource-item";
        const label = file.webkitRelativePath || file.name;
        const meta = document.createElement("div");
        meta.className = "resource-item-meta";
        const title = document.createElement("strong");
        title.textContent = label;
        const details = document.createElement("span");
        const lowerName = file.name.toLowerCase();
        let typeLabel = "";
        if (lowerName.includes(".invoice")) {
          typeLabel = "Facture";
        } else if (lowerName.includes(".card")) {
          typeLabel = "Carte";
        } else if (lowerName.includes(".quote")) {
          typeLabel = "Devis";
        } else if (lowerName.includes(".company")) {
          typeLabel = "Profil";
        } else if (lowerName.includes(".project")) {
          typeLabel = "Projet";
        }
        const metaParts = [
          formatBytes(file.size),
          formatDateShort(file.lastModified, locale),
        ];
        if (typeLabel) metaParts.push(typeLabel);
        details.textContent = metaParts.join(" • ");
        meta.append(title, details);

        const actions = document.createElement("div");
        actions.className = "resource-item-actions";

        if (file.name.toLowerCase().endsWith(".json")) {
          const importBtn = document.createElement("button");
          importBtn.type = "button";
          importBtn.className = "btn btn-outline";
          importBtn.textContent = "Importer";
          importBtn.addEventListener("click", async () => {
            try {
              const text = await file.text();
              const json = JSON.parse(text);
              const { type, payload } = normalizeImportPayload(json);
              if (type === "invoice" && window.RMS_INVOICE) {
                window.RMS_INVOICE.import(payload);
                setActiveNav("invoice-section");
                scrollToSection("invoice-section");
                alert(`Facture importée depuis ${file.name}.`);
              } else if (type === "card" && window.RMS_CARD) {
                window.RMS_CARD.import(payload);
                setActiveNav("cards-section");
                scrollToSection("cards-section");
                alert(`Carte de visite importée depuis ${file.name}.`);
              } else if (type === "company") {
                const current = store.getState().company;
                store.set("company", { ...current, ...payload });
                setActiveNav("quote-section");
                scrollToSection("quote-section");
                alert(`Profil entreprise importé depuis ${file.name}.`);
              } else if (type === "project") {
                const adaptedItems = (payload.items || []).map((item) => ({
                  id: crypto.randomUUID(),
                  reference: item.reference || "",
                  description: item.description || "",
                  quantity: Number(item.quantity) || 0,
                  unit: item.unit || "u.",
                  unitPrice: Number(item.unitPrice) || 0,
                  vatRate: Number(item.vatRate) ?? 20,
                  errors: {},
                }));
                store.set("client", { ...store.getState().client, ...payload.client });
                if (adaptedItems.length) {
                  store.set("items", adaptedItems);
                }
                setActiveNav("quote-section");
                scrollToSection("quote-section");
                alert(`Projet importé depuis ${file.name}.`);
              } else {
                store.importData(payload);
                setActiveNav("quote-section");
                scrollToSection("quote-section");
                alert(`Devis importé depuis ${file.name}.`);
              }
            } catch (error) {
              console.error("Import local échoué", error);
              alert("Impossible d'importer ce fichier. Vérifiez le format JSON.");
            }
          });
          actions.append(importBtn);
        } else {
          const downloadBtn = document.createElement("button");
          downloadBtn.type = "button";
          downloadBtn.className = "btn btn-link";
          downloadBtn.textContent = "Télécharger";
          downloadBtn.addEventListener("click", () => {
            const blobUrl = URL.createObjectURL(file);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = file.name;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          });
          actions.append(downloadBtn);
        }

        item.append(meta, actions);
        list.append(item);
      });
  };

  const stateToClasses = (state) => {
    body.classList.remove(
      ...Array.from(body.classList).filter((cls) =>
        /(theme-|density-|layout-|orientation-|font-)/.test(cls)
      )
    );
    body.classList.add(
      `theme-${state.options.theme}`,
      `density-${state.options.density}`,
      `layout-${state.options.layout}`,
      `orientation-${state.options.orientation}`,
      `font-${state.options.font}`
    );
    if (state.options.headerBanner) {
      body.classList.add("has-header-banner");
    } else {
      body.classList.remove("has-header-banner");
    }
  };

  // Met à jour les variables CSS dynamiques (ratios, logo)
  const applyCustomProperties = (state) => {
    const companyRatio = Math.max(0.3, state.options.headerRatio / 100);
    const clientRatio = Math.max(
      0.3,
      (100 - state.options.headerRatio) / 100
    );
    body.style.setProperty("--header-company-fr", `${companyRatio}fr`);
    body.style.setProperty("--header-client-fr", `${clientRatio}fr`);
    body.style.setProperty("--description-fr", `${state.options.descriptionWidth}`);
    body.style.setProperty(
      "--logo-size",
      `${Math.max(60, Math.min(180, state.options.logoSize))}px`
    );
  };

  // Capture générique pour les inputs data-bind
  const handleDataBindInput = (event) => {
    const path = event.target.dataset.bind;
    if (!path) return;
    const { type, value, checked } = event.target;
    let next = value;
    if (type === "number" || type === "range") {
      next = value === "" ? "" : Number(value);
    }
    if (type === "checkbox") {
      next = checked;
    }
    if (path === "meta.paymentUrl" && typeof next === "string") {
      next = next.trim();
    }
    if (event.target.matches("input[type='radio']")) {
      store.set(path, next);
    } else {
      store.set(path, next);
    }
  };

  const form = elements.form;
  // Binding global du formulaire (input & change)
  form.addEventListener("input", handleDataBindInput, true);
  form.addEventListener("change", handleDataBindInput, true);

  // Actions contextuelles sur les boutons du formulaire
  form.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const dataset = action.dataset;
    if (dataset.action === "upload-logo") {
      // Laisse le navigateur afficher la boîte de dialogue fichier
      return;
    }
    event.preventDefault();
    if (dataset.action === "add-item") {
      addItem();
    }
  });

  // Gestion des actions par ligne (supprimer, dupliquer, déplacer)
  elements.itemsBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-row-action]");
    if (!button) return;
    const row = button.closest("tr");
    if (!row) return;
    const itemId = row.dataset.id;
    switch (button.dataset.rowAction) {
      case "remove":
        removeItem(itemId);
        break;
      case "duplicate":
        duplicateItem(itemId);
        break;
      case "move-up":
        moveItem(itemId, -1);
        break;
      case "move-down":
        moveItem(itemId, 1);
        break;
      default:
        break;
    }
  });

  // Mises à jour en direct des champs numériques des lignes
  elements.itemsBody.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      const field = target.dataset.field;
      if (!field) return;
      const row = target.closest("tr");
      if (!row) return;
      const itemId = row.dataset.id;
      updateItem(itemId, field, target.value);
    },
    true
  );

  // Fabrique une nouvelle ligne d'article
  const addItem = () => {
    store.update("items", (items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        reference: "",
        description: "",
        quantity: 1,
        unit: "u.",
        unitPrice: 0,
        vatRate: 20,
        errors: {},
      },
    ]);
  };

  // Suppression sécurisée (au moins une ligne reste présente)
  const removeItem = (id) => {
    store.update("items", (items) =>
      items.length <= 1 ? items : items.filter((item) => item.id !== id)
    );
  };

  // Copie d'une ligne existante en conservant les valeurs
  const duplicateItem = (id) => {
    store.update("items", (items) => {
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return items;
      const copy = cloneItem(items[index]);
      copy.id = crypto.randomUUID();
      const next = items.slice();
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  // Réordonne les lignes en déplaçant la sélection
  const moveItem = (id, direction) => {
    store.update("items", (items) => {
      const index = items.findIndex((item) => item.id === id);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= items.length) {
        return items;
      }
      const next = items.slice();
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  // Synchronise les champs d'une ligne avec l'état
  const updateItem = (id, field, value) => {
    store.update("items", (items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]:
                field === "quantity" ||
                field === "unitPrice" ||
                field === "vatRate"
                  ? Number(value)
                  : value,
            }
          : item
      )
    );
  };

  const cloneItem = (item) => ({
    reference: item.reference,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    errors: {},
  });

  // Construit le tableau des articles côté formulaire
  const renderItemsForm = (state, errors = {}) => {
    const fragment = document.createDocumentFragment();
    state.items.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      const basePath = `items.${index}`;
      tr.innerHTML = `
        <td data-column="reference">
          <input type="text" data-field="reference" value="${escapeHtml(
            item.reference || ""
          )}" placeholder="Réf.">
        </td>
        <td class="wide">
          <textarea data-field="description" rows="2" placeholder="Désignation">${escapeHtml(
            item.description || ""
          )}</textarea>
        </td>
        <td>
          <input type="number" min="0" step="0.01" data-field="quantity" value="${
            item.quantity ?? ""
          }">
          <p class="field-error" aria-live="polite" data-error-path="${basePath}.quantity">${
            errors[`${basePath}.quantity`] ?? ""
          }</p>
        </td>
        <td data-column="unit">
          <input type="text" data-field="unit" value="${escapeHtml(
            item.unit || ""
          )}" placeholder="u.">
        </td>
        <td>
          <input type="number" min="0" step="0.01" data-field="unitPrice" value="${
            item.unitPrice ?? ""
          }">
          <p class="field-error" aria-live="polite" data-error-path="${basePath}.unitPrice">${
            errors[`${basePath}.unitPrice`] ?? ""
          }</p>
        </td>
        <td data-column="vatRate">
          <input type="number" min="0" max="100" step="0.01" data-field="vatRate" value="${
            item.vatRate ?? ""
          }">
          <p class="field-error" aria-live="polite" data-error-path="${basePath}.vatRate">${
            errors[`${basePath}.vatRate`] ?? ""
          }</p>
        </td>
        <td>
          <span data-field="lineTotal">—</span>
        </td>
        <td class="actions">
          <button type="button" data-row-action="move-up" title="Monter">↑</button>
          <button type="button" data-row-action="move-down" title="Descendre">↓</button>
          <button type="button" data-row-action="duplicate" title="Dupliquer">⧉</button>
          <button type="button" data-row-action="remove" title="Supprimer">✕</button>
        </td>
      `;
      fragment.appendChild(tr);
    });
    elements.itemsBody.replaceChildren(fragment);
    applyColumnVisibility(state);
  };

  // Alimente la table d'aperçu avec des valeurs formatées
  const renderPreviewItems = (state, formattedItems, locale, currency) => {
    const fragment = document.createDocumentFragment();
    formattedItems.forEach((item) => {
      if (isEmptyItem(item)) return;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-column="reference">${escapeHtml(
          item.reference || "—"
        )}</td>
        <td>${formatMultiline(item.description)}</td>
        <td>${formatNumber(item.quantity, locale)}</td>
        <td data-column="unit">${escapeHtml(item.unit || "—")}</td>
        <td>${formatCurrency(item.unitPriceCents, currency, locale)}</td>
        <td data-column="vatRate">${formatNumber(item.vatRate, locale, {
          maximumFractionDigits: 2,
        })}%</td>
        <td>${formatCurrency(item.discountedHT, currency, locale)}</td>
      `;
      fragment.appendChild(tr);
    });
    elements.previewItemsBody.replaceChildren(fragment);
    applyColumnVisibility(state);
  };

  // Masque/affiche les colonnes optionnelles
  const applyColumnVisibility = (state) => {
    const columns = state.options.columnVisibility;
    Object.entries(columns).forEach(([key, visible]) => {
      document
        .querySelectorAll(`[data-column="${key}"]`)
        .forEach((el) => (el.style.display = visible ? "" : "none"));
    });
  };

  const formatCurrency = (cents, currency, locale) =>
    centsToCurrency(cents, currency, locale);

  // Convertit des retours à la ligne en <br>
  const formatMultiline = (value) =>
    value && value.trim()
      ? escapeHtml(value).replace(/\r?\n/g, "<br>")
      : "<em>—</em>";

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const isEmptyItem = (item) =>
    !item.reference &&
    !item.description &&
    !(Number(item.quantity) > 0) &&
    !(Number(item.unitPrice) > 0);

  // Calcule et affiche les totaux côté formulaire et prévisualisation
  const renderTotals = (state) => {
    const locale = DECIMAL_LOCALES[state.options.decimalFormat] || "fr-FR";
    const results = calculateTotals(state);
    const currency = state.options.currency;

    elements.itemsBody
      .querySelectorAll("tr")
      .forEach((row, index) => {
        const item = results.items[index];
        if (!item) return;
        const totalCell = row.querySelector('[data-field="lineTotal"]');
        if (totalCell) {
          totalCell.textContent = formatCurrency(
            item.discountedHT,
            currency,
            locale
          );
        }
      });

    renderPreviewItems(state, results.items, locale, currency);

    document
      .querySelectorAll("[data-total]")
      .forEach((el) => {
        const key = el.dataset.total;
        const value = results.totals[mapTotalKey(key)];
        if (typeof value === "number") {
          el.textContent = formatCurrency(value, currency, locale);
        }
      });

    setPreview(
      "totals.subtotal",
      formatCurrency(results.totals.subtotal, currency, locale)
    );
    setPreview(
      "totals.discountValue",
      formatCurrency(results.totals.discount, currency, locale)
    );
    setPreview(
      "totals.shipping",
      formatCurrency(results.totals.shipping, currency, locale)
    );
    setPreview(
      "totals.vatTotal",
      formatCurrency(results.totals.vatTotal, currency, locale)
    );
    setPreview(
      "totals.totalTTC",
      formatCurrency(results.totals.totalTTC, currency, locale)
    );
    setPreview(
      "totals.depositValue",
      formatCurrency(results.totals.deposit, currency, locale)
    );
    setPreview(
      "totals.remaining",
      formatCurrency(results.totals.remaining, currency, locale)
    );
    setPreview("meta.discountNote", results.notes.discount || "");
    setPreview("meta.vatMention", results.notes.vat || "");
  };

  const mapTotalKey = (key) => {
    switch (key) {
      case "subtotal":
        return "subtotal";
      case "discount":
        return "discount";
      case "vat":
        return "vatTotal";
      case "total":
        return "totalTTC";
      case "deposit":
        return "deposit";
      case "remaining":
        return "remaining";
      default:
        return key;
    }
  };

  // Remplit les informations textuelles de la preview (identités, notes, etc.)
  const renderPreviewMeta = (state) => {
    const locale = DECIMAL_LOCALES[state.options.decimalFormat] || "fr-FR";
    const lang = I18N[state.meta.language] || I18N.fr;
    const docLabel = state.meta.docType || "Devis";
    const date = state.meta.date
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "long",
        }).format(new Date(state.meta.date))
      : "";
    setPreview("meta.docLabel", docLabel);
    setPreview("meta.number", state.meta.number);
    setPreview("meta.dateLabel", `${lang.dateLabel} ${date}`);
    setPreview(
      "meta.validity",
      state.meta.validity
        ? `${state.meta.validity} ${state.meta.language === "en" ? "days" : "jours"}`
        : ""
    );
    setPreview(
      "meta.projectRefHtml",
      state.meta.projectRef ? `Réf: ${escapeHtml(state.meta.projectRef)}` : ""
    );
    setPreview("company.identity", composeIdentity(state.company));
    setPreview("company.addressHtml", formatMultiline(state.company.address));
    setPreview("company.phone", state.company.phone || "");
    setPreview("company.email", state.company.email || "");
    setPreview(
      "company.websiteHtml",
      linkifyWebsite(state.company.website)
    );
    setPreview(
      "company.footerIdentity",
      composeFooterIdentity(state.company)
    );
    setPreview("client.type", state.client.type);
    setPreview("client.title", lang.client);
    setPreview("client.name", state.client.name || "—");
    setPreview("client.contact", state.client.contact || "");
    setPreview("client.addressHtml", formatMultiline(state.client.address));
    setPreview("client.phone", state.client.phone || "");
    setPreview("client.email", state.client.email || "");
    setPreview("meta.paymentTerms", state.meta.paymentTerms || "");
    setPreview("meta.latePenalties", state.meta.latePenalties || "");
    setPreview("meta.notesHtml", formatMultiline(state.meta.notes));
    setPreview("meta.legalMentions", formatMultiline(state.meta.legalMentions));
    setPreview("company.bank", formatMultiline(state.company.bank));
    setPreview("meta.footerNotes", formatMultiline(state.meta.footerNotes));

    localizeHeadings(lang);
    updateFooterInformation(state);
  };

  // Affecte simultanément tous les nœuds partageant data-preview
  const setPreview = (key, value) => {
    document
      .querySelectorAll(`[data-preview="${key}"]`)
      .forEach((el) => {
        if (value === null || value === undefined || value === "") {
          el.textContent = "";
          el.innerHTML = "";
          return;
        }
        if (/<[a-z][\s\S]*>/i.test(value)) {
          el.innerHTML = value;
        } else {
          el.textContent = value;
        }
      });
  };

  // Prépare une ligne synthétique pour l'identité société
  const composeIdentity = (company) => {
    const status =
      company.status === "Autre" && company.statusOther
        ? company.statusOther
        : company.status;
    const siren = company.siren ? `SIREN/SIRET ${company.siren}` : "";
    const vat = company.vatNumber ? `TVA ${company.vatNumber}` : "";
    return [status, siren, vat].filter(Boolean).join(" • ");
  };

  // Assemble le pied de page avec les coordonnées de l'émetteur
  const composeFooterIdentity = (company) => {
    const parts = [
      company.name,
      company.address?.replace(/\n/g, " "),
      company.phone,
      company.email,
    ].filter(Boolean);
    return parts.join(" • ");
  };

  // Transforme les URL valides en liens cliquables sécurisés
  const linkifyWebsite = (url) => {
    if (!url) return "";
    if (!/^https?:\/\//.test(url)) return escapeHtml(url);
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(
      url.replace(/^https?:\/\//, "")
    )}</a>`;
  };

  // Met à jour les titres statiques selon la langue sélectionnée
  const localizeHeadings = (lang) => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (lang[key]) {
        el.textContent = lang[key];
      }
    });
  };

  // Injecte la date d'impression et le numéro de page
  const updateFooterInformation = (state) => {
    const locale = DECIMAL_LOCALES[state.options.decimalFormat] || "fr-FR";
    const now = new Date();
    const date = new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(now);
    setPreview(
      "meta.printInformation",
      `${date} — Page <span class="page-number">1</span>`
    );
  };

  // Ouvre/ferme la modale de prévisualisation avec validation
  const setPreviewVisibility = (open) => {
    if (open) {
      const validation = store.validate();
      if (!validation.valid) {
        displayGlobalErrors(validation.errors);
        alert("Corrigez les erreurs avant la prévisualisation.");
        return false;
      }
      body.classList.add("preview-open");
      elements.previewOverlay?.setAttribute("aria-hidden", "false");
      updateFooterInformation(store.getState());
    } else {
      body.classList.remove("preview-open");
      elements.previewOverlay?.setAttribute("aria-hidden", "true");
    }
    return true;
  };

  // Boutons qui ouvrent la fenêtre d'aperçu
  document
    .querySelectorAll("[data-action='toggle-preview']")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        setPreviewVisibility(true);
      })
    );

  document
    .querySelectorAll("[data-action='close-preview']")
    .forEach((btn) => btn.addEventListener("click", () => setPreviewVisibility(false)));

  // Boutons d'impression (imposent une validation)
  document
    .querySelectorAll("[data-action='print']")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const validation = store.validate();
        if (!validation.valid) {
          displayGlobalErrors(validation.errors);
          alert("Corrigez les erreurs avant l'impression.");
          return;
        }
        body.classList.add("print-quote");
        window.print();
      })
    );

  // Fermeture en cliquant à l'extérieur du document
  elements.previewOverlay?.addEventListener("click", (event) => {
    if (event.target === elements.previewOverlay) {
      setPreviewVisibility(false);
    }
  });

  // Bouton de réinitialisation globale
  document
    .querySelectorAll("[data-action='reset-form']")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        if (
          confirm(
            "Réinitialiser toutes les données ?\nCette action efface toutes vos informations saisies."
          )
        ) {
          store.reset();
        }
      })
    );

  // Gestion d'import/export JSON (fichiers locaux)
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.hidden = true;
  document.body.append(importInput);
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const { type, payload } = normalizeImportPayload(json);
      if (type === "invoice" && window.RMS_INVOICE) {
        window.RMS_INVOICE.import(payload);
      } else if (type === "card" && window.RMS_CARD) {
        window.RMS_CARD.import(payload);
      } else if (type === "company") {
        const current = store.getState().company;
        store.set("company", { ...current, ...payload });
        alert("Profil entreprise importé.");
      } else if (type === "project") {
        const adaptedItems = (payload.items || []).map((item) => ({
          id: crypto.randomUUID(),
          reference: item.reference || "",
          description: item.description || "",
          quantity: Number(item.quantity) || 0,
          unit: item.unit || "u.",
          unitPrice: Number(item.unitPrice) || 0,
          vatRate: Number(item.vatRate) ?? 20,
          errors: {},
        }));
        store.set("client", { ...store.getState().client, ...payload.client });
        if (adaptedItems.length) {
          store.set("items", adaptedItems);
        }
        alert("Projet importé.");
      } else {
        store.importData(payload);
      }
    } catch (error) {
      alert("Import impossible : " + error.message);
    } finally {
      importInput.value = "";
    }
  });

  document
    .querySelectorAll("[data-action='import-json']")
    .forEach((btn) =>
      btn.addEventListener("click", () => importInput.click())
    );

  document
    .querySelectorAll("[data-action='export-json']")
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        const data = store.exportData();
        const payload = {
          kind: "quote",
          version: 1,
          data,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(data.meta.number || "devis").replace(/\s+/g, "_")}.quote.json`;
        a.click();
        URL.revokeObjectURL(url);
      })
    );

  // Affiche les erreurs de validation près des champs concernés
  const displayGlobalErrors = (errors) => {
    document
      .querySelectorAll("[data-error-path]")
      .forEach((el) => (el.textContent = ""));
    Object.entries(errors).forEach(([path, message]) => {
      const el = document.querySelector(`[data-error-path="${path}"]`);
      if (el) {
        el.textContent = message;
      }
      if (path.startsWith("options.")) {
        const el2 = document.getElementById(path.replace(/\./g, "-"));
        if (el2) el2.textContent = message;
      }
    });
  };

  // Répercuter les valeurs du store vers les inputs (notamment import/reset)
  const syncFormValues = (state) => {
    document.querySelectorAll("[data-bind]").forEach((element) => {
      if (element.dataset.field) return;
      const path = element.dataset.bind;
      const value = resolvePath(state, path);
      if (element.type === "checkbox") {
        const next = Boolean(value);
        if (element.checked !== next) element.checked = next;
      } else if (element.type === "radio") {
        element.checked = element.value === String(value);
      } else if (element.tagName === "SELECT") {
        const next = value ?? "";
        if (element.value !== next) element.value = next;
      } else {
        const next = value ?? "";
        if (element.value !== next) element.value = next;
      }
    });
  };

  const resolvePath = (object, path) =>
    path.split(".").reduce((acc, key) => (acc != null ? acc[key] : undefined), object);

  const updateSectionsVisibility = (state) => {
    const sectionsConfig = state.options.sections || {};
    const hasConditions =
      Boolean(state.meta.paymentTerms?.trim()) ||
      Boolean(state.meta.latePenalties?.trim()) ||
      Boolean(state.meta.notes?.trim());
    const hasLegal = Boolean(state.meta.legalMentions?.trim());
    const hasBank = Boolean(state.company.bank?.trim());
    const hasValidPaymentLink = (state.meta.paymentUrl ?? "")
      .trim()
      .startsWith("https://");

    const defaults = {
      signature: true,
      bank: hasBank,
      qr: hasValidPaymentLink,
      legal: hasLegal,
      conditions: hasConditions,
    };

    const allSections = new Set([
      "signature",
      "bank",
      "qr",
      "legal",
      "conditions",
      ...Object.keys(sectionsConfig),
    ]);

    const evaluate = (section) => {
      const configured =
        sectionsConfig[section] !== undefined
          ? sectionsConfig[section]
          : defaults[section] ?? true;
      switch (section) {
        case "bank":
          return configured && hasBank;
        case "qr":
          return configured && hasValidPaymentLink;
        case "legal":
          return configured && hasLegal;
        case "conditions":
          return configured && hasConditions;
        case "signature":
          return configured;
        default:
          return configured;
      }
    };

    allSections.forEach((section) => {
      const shouldShow = evaluate(section);
      document
        .querySelectorAll(`[data-section="${section}"]`)
        .forEach((el) => {
          el.hidden = !shouldShow;
          el.dataset.visible = shouldShow ? "true" : "false";
        });
    });
  };

  // Met à jour l'aperçu du logo côté formulaire + preview
  const updateLogo = (state) => {
    const img = document.getElementById("preview-logo");
    const preview = document.querySelector(".logo-preview img");
    if (!img || !preview) return;
    if (state.company.logoDataUrl) {
      img.src = state.company.logoDataUrl;
      img.hidden = false;
      preview.src = state.company.logoDataUrl;
      preview.hidden = false;
    } else {
      img.hidden = true;
      preview.hidden = true;
    }
    img.style.maxHeight = `${Math.max(60, state.options.logoSize)}px`;
    preview.style.maxHeight = `${Math.max(60, state.options.logoSize)}px`;

    const placement = state.options.logoPlacement;
    img.dataset.placement = placement;
  };

  // Affiche lien + QR uniquement si l'URL est sécurisée
  const updatePaymentLink = (state) => {
    const anchor = document.querySelector("[data-preview='meta.paymentLink']");
    if (!anchor) return;
    const section = anchor.closest(".preview-payment");
    const canvas = document.getElementById("payment-qr");
    const rawUrl = state.meta.paymentUrl ?? "";
    const normalizedUrl = rawUrl.trim();
    const hasValidUrl = normalizedUrl.startsWith("https://");

    if (hasValidUrl) {
      anchor.href = normalizedUrl;
      anchor.textContent = normalizedUrl;
    } else {
      anchor.removeAttribute("href");
      anchor.textContent = "";
    }

    if (canvas) {
      canvas.hidden = !hasValidUrl;
      canvas.setAttribute("aria-hidden", hasValidUrl ? "false" : "true");
    }
    if (section) {
      section.dataset.hasContent = hasValidUrl ? "true" : "false";
    }

    drawPaymentCode(hasValidUrl ? normalizedUrl : "");
  };

  // Enveloppe utilitaire pour éviter les appels sans canvas
  const drawPaymentCode = (url) => {
    const canvas = document.getElementById("payment-qr");
    if (!canvas) return;
    drawQRCode(canvas, url);
  };

  // Harmonise les classes et variables CSS après chaque mise à jour
  const applyBodyClasses = (state) => {
    stateToClasses(state);
    applyCustomProperties(state);
    updatePrintOrientation(state.options.orientation);
  };

  // Injecte dynamiquement les marges/format de page pour l'impression
  const updatePrintOrientation = (orientation) => {
    let styleTag = document.getElementById("print-orientation-style");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "print-orientation-style";
      document.head.append(styleTag);
    }
    const size = orientation === "landscape" ? "A4 landscape" : "A4";
    styleTag.textContent = `@media print{ @page { size: ${size}; margin: 8mm 12mm 12mm 12mm; } }`;
  };

  // Rendu complet à chaque évolution du store
  store.subscribe((state) => {
    const validation = store.validate();
    syncFormValues(state);
    renderItemsForm(state, validation.errors);
    renderTotals(state);
    renderPreviewMeta(state);
    updatePaymentLink(state);
    updateSectionsVisibility(state);
    updateLogo(state);
    applyBodyClasses(state);
    displayGlobalErrors(validation.errors);
  });

  // Dernière validation juste avant d'ouvrir la boîte d'impression
  window.addEventListener("beforeprint", () => {
    if (body.classList.contains("print-invoice") || body.classList.contains("print-card")) {
      return;
    }
    const validation = store.validate();
    if (!validation.valid) {
      displayGlobalErrors(validation.errors);
      throw new Error("Validation errors");
    }
    updateFooterInformation(store.getState());
  });

  window.addEventListener("afterprint", () => {
    body.classList.remove("print-quote", "print-invoice", "print-card");
  });

  // ESC permet de refermer rapidement la prévisualisation
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setPreviewVisibility(false);
    }
  });

  // Permet d'ouvrir directement en mode impression via ?print=1
  if (new URLSearchParams(location.search).get("print") === "1") {
    setPreviewVisibility(true);
  }
}

// Convertit l'objet de sélecteurs en références directes
const mapSelectors = (selectors) =>
  Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [
      key,
      document.querySelector(selector),
    ])
  );
