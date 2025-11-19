import { centsToCurrency } from "./core/calcul.js";
import { initLogoUpload } from "./core/logo.js";

const DECIMAL_LOCALES = {
  EUR: "fr-FR",
  USD: "en-US",
  GBP: "en-GB",
  CHF: "fr-CH",
};

const DEFAULT_ITEM = () => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  vatRate: 20,
});

const adaptItems = (items = []) =>
  items.map((item) => ({
    id: crypto.randomUUID(),
    description: item.description || "",
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
    vatRate: Number(item.vatRate) ?? 20,
  }));

const normalizeImportPayload = (input) => {
  if (!input || typeof input !== "object") {
    return { type: "unknown", payload: input };
  }
  if (input.kind === "invoice" && input.data) {
    return { type: "invoice", payload: input.data };
  }
  if (input.kind === "companyProfile" && input.data) {
    return { type: "company", payload: input.data };
  }
  if (input.kind === "project" && input.data) {
    return { type: "project", payload: input.data };
  }
  if (input.kind === "quote" && input.data) {
    return { type: "quote", payload: input.data };
  }
  if (input.company && input.client && Array.isArray(input.items)) {
    return { type: "project", payload: { client: input.client, items: input.items } };
  }
  if (input.siren || input.vatNumber || input.logoDataUrl) {
    return { type: "company", payload: input };
  }
  if (input.invoice && Array.isArray(input.items)) {
    return { type: "invoice", payload: input.invoice }; // fallback
  }
  return { type: "unknown", payload: input };
};

const applyCompanyProfile = (profile = {}, { sync = true } = {}) => {
  state.company = {
    ...state.company,
    name: profile.name ?? state.company.name,
    address: profile.address ?? state.company.address,
    phone: profile.phone ?? state.company.phone,
    email: profile.email ?? state.company.email,
    vat: profile.vatNumber ?? profile.vat ?? state.company.vat,
    logoDataUrl: profile.logoDataUrl ?? state.company.logoDataUrl,
  };
  if (sync) syncFormWithState();
};

const applyProjectData = (project = {}, { sync = true } = {}) => {
  if (project.client) {
    state.client = {
      ...state.client,
      name: project.client.name || project.client.contact || state.client.name,
      address: project.client.address ?? state.client.address,
      email: project.client.email ?? state.client.email,
      phone: project.client.phone ?? state.client.phone,
    };
  }
  if (Array.isArray(project.items) && project.items.length) {
    state.items = adaptItems(project.items);
  } else if (!state.items.length) {
    state.items = [DEFAULT_ITEM()];
  }
  if (sync) syncFormWithState();
};

const setCompanyLogo = (dataUrl) => {
  state.company.logoDataUrl = dataUrl || "";
  syncFormWithState();
};

const todayISO = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const addDaysISO = (iso, days) => {
  const source = iso ? new Date(iso) : new Date();
  if (Number.isNaN(source.getTime())) return todayISO();
  source.setDate(source.getDate() + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${source.getFullYear()}-${pad(source.getMonth() + 1)}-${pad(
    source.getDate()
  )}`;
};

const generateInvoiceNumber = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const seq = pad(Math.floor(Math.random() * 999));
  return `FAC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${seq}`;
};

const state = {
  company: {
    name: "",
    address: "",
    phone: "",
    email: "",
    vat: "",
    logoDataUrl: "",
  },
  client: {
    name: "",
    address: "",
    email: "",
    phone: "",
  },
  invoice: {
    number: generateInvoiceNumber(),
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 30),
    paymentTerms: "À réception",
    notes: "",
    currency: "EUR",
  },
  items: [DEFAULT_ITEM()],
  totals: {
    subtotal: 0,
    vat: 0,
    total: 0,
    due: 0,
  },
};

const elements = {
  form: document.getElementById("invoice-form"),
  itemsBody: document.getElementById("invoice-items-body"),
  previewItemsBody: document.getElementById("invoice-preview-items"),
  totals: document.querySelectorAll("[data-invoice-total]"),
  previewTotals: document.querySelectorAll("[data-invoice-preview^='totals.']"),
  notePreview: document.querySelector(".invoice-notes"),
  termsPreview: document.querySelector(".invoice-terms"),
  logoImg: document.getElementById("invoice-logo"),
  logoFormPreview: document.querySelector(".invoice-logo-preview img"),
  previewOverlay: document.querySelector(".invoice-preview-overlay"),
};

const localeForCurrency = (currency) =>
  DECIMAL_LOCALES[currency] || DECIMAL_LOCALES.EUR;

const toCents = (value) =>
  Math.round((Number(String(value).replace(",", ".")) || 0) * 100);

const formatCurrency = (cents, currency) =>
  centsToCurrency(cents, currency, localeForCurrency(currency));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const multiline = (value) =>
  value && value.trim()
    ? escapeHtml(value).replace(/\r?\n/g, "<br>")
    : "";

const computeTotals = () => {
  let subtotal = 0;
  let vat = 0;
  state.items.forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = toCents(item.unitPrice);
    const vatRate = Math.max(0, Math.min(100, Number(item.vatRate) || 0));
    const lineHT = Math.round(quantity * unitPrice);
    const lineVAT = Math.round((lineHT * vatRate) / 100);
    subtotal += lineHT;
    vat += lineVAT;
  });
  const total = subtotal + vat;
  state.totals = {
    subtotal,
    vat,
    total,
    due: total,
  };
};

const updateTotalsDisplay = () => {
  const currency = state.invoice.currency;
  elements.totals.forEach((node) => {
    const key = node.dataset.invoiceTotal;
    if (key && state.totals[key] !== undefined) {
      node.textContent = formatCurrency(state.totals[key], currency);
    }
  });
  elements.previewTotals.forEach((node) => {
    const key = node.dataset.invoicePreview?.replace("totals.", "");
    if (key && state.totals[key] !== undefined) {
      node.textContent = formatCurrency(state.totals[key], currency);
    }
  });
};

const renderFormItems = () => {
  if (!elements.itemsBody) return;
  elements.itemsBody.innerHTML = "";
  const currency = state.invoice.currency;
  state.items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td>
        <textarea data-invoice-field="description" rows="2" placeholder="Désignation">${escapeHtml(
          item.description || ""
        )}</textarea>
      </td>
      <td>
        <input type="number" min="0" step="0.01" data-invoice-field="quantity" value="${
          item.quantity ?? ""
        }">
      </td>
      <td>
        <input type="number" min="0" step="0.01" data-invoice-field="unitPrice" value="${
          item.unitPrice ?? ""
        }">
      </td>
      <td>
        <input type="number" min="0" max="100" step="0.01" data-invoice-field="vatRate" value="${
          item.vatRate ?? ""
        }">
      </td>
      <td>
        <span data-invoice-field="lineTotal">${formatCurrency(
          Math.round((Number(item.quantity) || 0) * toCents(item.unitPrice)),
          currency
        )}</span>
      </td>
      <td class="actions">
        <button type="button" data-invoice-row="remove" title="Supprimer">✕</button>
        <button type="button" data-invoice-row="duplicate" title="Dupliquer">⧉</button>
      </td>
    `;
    elements.itemsBody.append(tr);
  });
};

const renderPreviewItemsOnly = () => {
  if (!elements.previewItemsBody) return;
  elements.previewItemsBody.innerHTML = "";
  const currency = state.invoice.currency;
  state.items.forEach((item) => {
    const previewRow = document.createElement("tr");
    previewRow.innerHTML = `
      <td>${item.description ? escapeHtml(item.description) : "<em>—</em>"}</td>
      <td>${Number(item.quantity) || 0}</td>
      <td>${formatCurrency(toCents(item.unitPrice), currency)}</td>
      <td>${Number(item.vatRate) || 0}%</td>
      <td>${formatCurrency(
        Math.round((Number(item.quantity) || 0) * toCents(item.unitPrice)),
        currency
      )}</td>
    `;
    elements.previewItemsBody.append(previewRow);
  });
};

const applyPreviewText = (map) => {
  Object.entries(map).forEach(([key, value]) => {
    document
      .querySelectorAll(`[data-invoice-preview="${key}"]`)
      .forEach((node) => {
        if (value === null || value === undefined || value === "") {
          node.textContent = "";
          node.innerHTML = "";
        } else if (/<[a-z][\s\S]*>/i.test(value)) {
          node.innerHTML = value;
        } else {
          node.textContent = value;
        }
      });
  });
};

const renderPreview = () => {
  const currency = state.invoice.currency;
  renderPreviewItemsOnly();
  applyPreviewText({
    "company.name": state.company.name || "Votre entreprise",
    "company.address": state.company.address
      ? state.company.address.replace(/\r?\n/g, "<br>")
      : "",
    "company.phone": state.company.phone || "",
    "company.email": state.company.email || "",
    "company.vat": state.company.vat || "",
    "client.name": state.client.name || "Client",
    "client.address": state.client.address
      ? state.client.address.replace(/\r?\n/g, "<br>")
      : "",
    "client.email": state.client.email || "",
    "client.phone": state.client.phone || "",
    "invoice.number": state.invoice.number,
    "invoice.issueDate": state.invoice.issueDate,
    "invoice.dueDate": state.invoice.dueDate,
    "invoice.notes": escapeHtml(state.invoice.notes || ""),
    "totals.subtotal": formatCurrency(state.totals.subtotal, currency),
    "totals.vat": formatCurrency(state.totals.vat, currency),
    "totals.total": formatCurrency(state.totals.total, currency),
    "totals.due": formatCurrency(state.totals.due, currency),
  });

  const termsNode = elements.termsPreview;
  if (termsNode) {
    if (state.invoice.paymentTerms.trim()) {
      termsNode.hidden = false;
      termsNode.innerHTML = `<strong>Conditions de paiement :</strong><br>${multiline(
        state.invoice.paymentTerms
      )}`;
    } else {
      termsNode.hidden = true;
      termsNode.textContent = "";
    }
  }

  if (elements.notePreview) {
    if (state.invoice.notes.trim()) {
      elements.notePreview.hidden = false;
      elements.notePreview.innerHTML = `<strong>Notes :</strong><br>${multiline(
        state.invoice.notes
      )}`;
    } else {
      elements.notePreview.hidden = true;
      elements.notePreview.textContent = "";
    }
  }

  if (elements.logoImg) {
    if (state.company.logoDataUrl) {
      elements.logoImg.src = state.company.logoDataUrl;
      elements.logoImg.hidden = false;
    } else {
      elements.logoImg.hidden = true;
    }
  }
};

const renderAll = () => {
  computeTotals();
  renderFormItems();
  updateTotalsDisplay();
  renderPreview();
};

const setPreviewVisibility = (open) => {
  const overlay = elements.previewOverlay;
  if (!overlay) {
    if (!open) {
      document.body.classList.remove("preview-open");
    }
    return;
  }
  if (open) {
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("preview-open");
  } else {
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("preview-open");
  }
};

const openPreview = () => {
  renderAll();
  setPreviewVisibility(true);
  const modalBody = elements.previewOverlay?.querySelector(".preview-modal-body");
  if (modalBody) modalBody.scrollTop = 0;
};

const closePreview = () => {
  setPreviewVisibility(false);
};

const updateState = (path, value) => {
  const segments = path.split(".");
  let cursor = state;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!(key in cursor)) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[segments.at(-1)] = value;
};

const syncFormWithState = () => {
  if (!elements.form) return;
  elements.form.querySelectorAll("[data-invoice-bind]").forEach((el) => {
    const path = el.dataset.invoiceBind;
    const segments = path.split(".");
    const value = segments.reduce((acc, key) => (acc ? acc[key] : undefined), state) ?? "";
    if (el.value !== value) el.value = value;
  });
  if (elements.logoFormPreview) {
    if (state.company.logoDataUrl) {
      elements.logoFormPreview.src = state.company.logoDataUrl;
      elements.logoFormPreview.hidden = false;
    } else {
      elements.logoFormPreview.hidden = true;
    }
  }
  renderAll();
};

const addItem = () => {
  state.items.push(DEFAULT_ITEM());
  renderAll();
};

const removeItem = (id) => {
  if (state.items.length <= 1) return;
  state.items = state.items.filter((item) => item.id !== id);
  renderAll();
};

const duplicateItem = (id) => {
  const index = state.items.findIndex((item) => item.id === id);
  if (index === -1) return;
  const copy = { ...state.items[index], id: crypto.randomUUID() };
  state.items.splice(index + 1, 0, copy);
  renderAll();
};

const handleItemInput = (row, field, value) => {
  const id = row.dataset.id;
  const index = state.items.findIndex((item) => item.id === id);
  if (index === -1) return;
  if (field === "description") {
    state.items[index][field] = value;
  } else {
    state.items[index][field] = Number(value);
  }
  const currency = state.invoice.currency;
  const span = row.querySelector('[data-invoice-field="lineTotal"]');
  if (span) {
    const lineTotal = Math.round(
      (Number(state.items[index].quantity) || 0) * toCents(state.items[index].unitPrice)
    );
    span.textContent = formatCurrency(lineTotal, currency);
  }
  computeTotals();
  updateTotalsDisplay();
  renderPreview();
};

const resetState = () => {
  state.company = {
    name: "",
    address: "",
    phone: "",
    email: "",
    vat: "",
    logoDataUrl: "",
  };
  state.client = {
    name: "",
    address: "",
    email: "",
    phone: "",
  };
  state.invoice = {
    number: generateInvoiceNumber(),
    issueDate: todayISO(),
    dueDate: addDaysISO(todayISO(), 30),
    paymentTerms: "À réception",
    notes: "",
    currency: "EUR",
  };
  state.items = [DEFAULT_ITEM()];
  syncFormWithState();
};

const exportInvoice = () => {
  const payload = {
    kind: "invoice",
    version: 1,
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.invoice.number || "facture"}.invoice.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const importInvoice = (data) => {
  const payload =
    data && data.kind === "invoice" && data.data ? data.data : data;
  if (!payload || !payload.invoice || !payload.items) {
    throw new Error("Format de facture invalide");
  }
  applyCompanyProfile(payload.company || {}, { sync: false });
  applyProjectData(
    {
      client: payload.client,
      items: payload.items,
    },
    { sync: false }
  );
  state.invoice = {
    ...state.invoice,
    ...payload.invoice,
    number: payload.invoice.number || generateInvoiceNumber(),
    dueDate: payload.invoice.dueDate || addDaysISO(payload.invoice.issueDate, 30),
  };
  if (!state.items.length) state.items = [DEFAULT_ITEM()];
  syncFormWithState();
  alert("Facture importée avec succès.");
};

const printInvoice = () => {
  openPreview();
  const body = document.body;
  document
    .getElementById("invoice-preview")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  body.classList.add("print-invoice");
  window.print();
};

if (elements.form) {
  elements.form.addEventListener("input", (event) => {
    const target = event.target;
    const path = target.dataset.invoiceBind;
    if (path) {
      updateState(path, target.value);
      renderAll();
    }
  });

  elements.form.addEventListener("change", (event) => {
    const target = event.target;
    const path = target.dataset.invoiceBind;
    if (path) {
      updateState(path, target.value);
      renderAll();
    }
  });

  elements.form.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-invoice-action]");
    if (!trigger) return;
    event.preventDefault();
    switch (trigger.dataset.invoiceAction) {
      case "add-item":
        addItem();
        break;
      default:
        break;
    }
  });

  elements.itemsBody?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-invoice-row]");
    if (!btn) return;
    const row = btn.closest("tr");
    if (!row) return;
    const action = btn.dataset.invoiceRow;
    const id = row.dataset.id;
    if (action === "remove") {
      removeItem(id);
    } else if (action === "duplicate") {
      duplicateItem(id);
    }
  });

  elements.itemsBody?.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      const field = target.dataset.invoiceField;
      if (!field) return;
      const row = target.closest("tr");
      if (!row) return;
      handleItemInput(row, field, target.value);
    },
    true
  );
}

initLogoUpload("[data-invoice-logo-input]", {
  onLoad: setCompanyLogo,
  previewImage: elements.logoFormPreview,
});

document.querySelectorAll("[data-invoice-action]").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const action = btn.dataset.invoiceAction;
    if (action === "add-item") return;
    event.preventDefault();
    if (action === "toggle-preview") {
      openPreview();
    } else if (action === "import") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          const { type, payload } = normalizeImportPayload(json);
          if (type === "invoice") {
            importInvoice(payload);
          } else if (type === "company") {
            applyCompanyProfile(payload);
            syncFormWithState();
            alert("Profil entreprise importé.");
          } else if (type === "project") {
            applyProjectData(payload);
            alert("Projet importé.");
          } else if (type === "quote") {
            applyCompanyProfile(payload.company || {}, { sync: false });
            applyProjectData({ client: payload.client, items: payload.items }, { sync: false });
            syncFormWithState();
            alert("Devis importé. Les données ont été appliquées à la facture.");
          } else {
            alert("Ce fichier ne contient pas de données de facture compatibles.");
          }
        } catch (error) {
          console.error(error);
          alert("Impossible d'importer ce fichier.");
        } finally {
          input.remove();
        }
      });
      input.click();
    } else if (action === "export") {
      exportInvoice();
    } else if (action === "reset") {
      if (confirm("Réinitialiser la facture ?")) {
        resetState();
      }
    } else if (action === "print") {
      printInvoice();
    }
  });
});

document
  .querySelectorAll("[data-invoice-preview='close']")
  .forEach((btn) =>
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      closePreview();
    })
  );

document
  .querySelectorAll("[data-invoice-preview='print']")
  .forEach((btn) =>
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      printInvoice();
    })
  );

elements.previewOverlay?.addEventListener("click", (event) => {
  if (event.target === elements.previewOverlay) {
    closePreview();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("preview-open")) {
    closePreview();
  }
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-invoice");
});

syncFormWithState();

window.RMS_INVOICE = {
  import: importInvoice,
  export: exportInvoice,
  getState: () => structuredClone(state),
  reset: resetState,
  loadCompanyProfile: applyCompanyProfile,
  loadProject: applyProjectData,
  setLogo: setCompanyLogo,
  preview: openPreview,
  print: printInvoice,
};
