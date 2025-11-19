// Gestion de l'état applicatif et validations
const TODAY = new Date();

const pad = (n) => String(n).padStart(2, "0");
const todayISO = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(
  TODAY.getDate()
)}`;

const clone = (value) => structuredClone(value);

// État initial du devis et des options
export const defaultState = () => ({
  meta: {
    docType: "Devis",
    language: "fr",
    number: generateQuoteNumber(),
    date: todayISO,
    validity: 30,
    projectRef: "",
    paymentTerms: "30 jours fin de mois",
    latePenalties:
      "Pénalités de retard - indemnité forfaitaire pour frais de recouvrement de 40 €.",
    notes: "",
    paymentUrl: "",
    discountNote: "",
    vatExempt: false,
    legalMentions: "",
    footerNotes: "",
  },
  company: {
    name: "",
    status: "EI",
    statusOther: "",
    siren: "",
    vatNumber: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    bank: "",
    logoDataUrl: "",
  },
  client: {
    type: "Société",
    name: "",
    contact: "",
    address: "",
    email: "",
    phone: "",
  },
  items: [
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
    logoSize: 120,
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
      type: "none",
      percent: 0,
      amount: 0,
    },
    deposit: {
      type: "none",
      percent: 0,
      amount: 0,
    },
    shippingAmount: 0,
    shippingVat: 20,
  },
  ui: {
    printMode: false,
  },
});

// Mini-store observé : set/update/reset/import/export
export function createStore() {
  let state = defaultState();
  const listeners = new Set();

  const notify = () => {
    const snapshot = clone(state);
    listeners.forEach((fn) => fn(snapshot));
  };

  const getState = () => clone(state);

  const set = (path, value) => {
    state = setIn(state, path, value);
    notify();
  };

  const update = (path, updater) => {
    const current = getIn(state, path);
    const nextValue = updater(clone(current));
    set(path, nextValue);
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    listener(getState());
    return () => listeners.delete(listener);
  };

  const reset = () => {
    state = defaultState();
    notify();
  };

  const importData = (data) => {
    const validation = validateQuote(data);
    if (!validation.valid) {
      const error = new Error("Import invalide");
      error.details = validation.errors;
      throw error;
    }
    state = mergeState(defaultState(), data);
    notify();
  };

  const exportData = () => clone(state);

  const validate = () => validateQuote(state);

  return {
    getState,
    set,
    update,
    reset,
    subscribe,
    importData,
    exportData,
    validate,
  };
}

export function generateQuoteNumber() {
  const now = new Date();
  const seq = pad(Math.floor(Math.random() * 999));
  return `DEV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${seq}`;
}

// Contrôle des champs numériques et des URL sensibles
export function validateQuote(state) {
  const errors = {};

  const requireHttps = (url) =>
    !url || (url.startsWith("https://") && !/javascript:|data:/i.test(url));

  if (!requireHttps((state.meta.paymentUrl || "").trim())) {
    errors["meta.paymentUrl"] = "Le lien doit commencer par https://";
  }

  state.items.forEach((item, index) => {
    const itemPath = `items.${index}`;
    if (!(Number(item.quantity) > 0)) {
      errors[`${itemPath}.quantity`] = "Qté &gt; 0";
    }
    if (!(Number(item.unitPrice) >= 0)) {
      errors[`${itemPath}.unitPrice`] = "PU ≥ 0";
    }
    const vat = Number(item.vatRate);
    if (!(vat >= 0 && vat <= 100)) {
      errors[`${itemPath}.vatRate`] = "TVA 0–100";
    }
  });

  if (state.options.discount.type === "percent") {
    const percent = Number(state.options.discount.percent);
    if (!(percent >= 0 && percent <= 100)) {
      errors["options.discount.percent"] = "Remise % entre 0 et 100";
    }
  }

  if (state.options.discount.type === "amount") {
    const amount = Number(state.options.discount.amount);
    if (!(amount >= 0)) {
      errors["options.discount.amount"] = "Montant de remise positif";
    }
  }

  if (state.options.deposit.type === "percent") {
    const percent = Number(state.options.deposit.percent);
    if (!(percent >= 0 && percent <= 100)) {
      errors["options.deposit.percent"] = "Acompte % entre 0 et 100";
    }
  }

  if (state.options.deposit.type === "amount") {
    const amount = Number(state.options.deposit.amount);
    if (!(amount >= 0)) {
      errors["options.deposit.amount"] = "Montant d'acompte positif";
    }
  }

  const shippingVat = Number(state.options.shippingVat);
  if (!(shippingVat >= 0 && shippingVat <= 100)) {
    errors["options.shippingVat"] = "TVA frais entre 0 et 100";
  }

  if (Number(state.options.shippingAmount) < 0) {
    errors["options.shippingAmount"] = "Frais positifs";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Écriture immuable dans l'arborescence de l'état
function setIn(target, path, value) {
  const segments = Array.isArray(path) ? path : path.split(".");
  if (!segments.length) return value;
  const next = clone(target);
  let cursor = next;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    cursor[key] = clone(cursor[key]);
    cursor = cursor[key];
  }
  cursor[segments.at(-1)] = value;
  return next;
}

function getIn(target, path) {
  const segments = Array.isArray(path) ? path : path.split(".");
  return segments.reduce(
    (acc, key) => (acc == null ? acc : acc[key]),
    target
  );
}

// Fusion récursive pour import JSON
function mergeState(base, input) {
  const output = clone(base);
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      output[key] = clone(value);
    } else if (typeof value === "object") {
      output[key] = mergeState(base[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}
