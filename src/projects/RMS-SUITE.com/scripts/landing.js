import { initLogoUpload } from "./core/logo.js";

const navButtons = Array.from(document.querySelectorAll("[data-nav-target]"));
const scrollTargets = new Map();
navButtons.forEach((btn) => {
  const targetId = btn.dataset.navTarget;
  if (targetId) {
    const section = document.getElementById(targetId);
    if (section) scrollTargets.set(targetId, section);
  }
});

const setActiveNav = (targetId) => {
  navButtons.forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.navTarget === targetId ? "true" : "false");
  });
};

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = scrollTargets.get(btn.dataset.navTarget);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav(btn.dataset.navTarget);
    }
  });
});

if ("IntersectionObserver" in window && scrollTargets.size) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length > 0) {
        setActiveNav(visible[0].target.id);
      }
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
  );
  scrollTargets.forEach((section) => observer.observe(section));
}

const defaultCompany = () => ({
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
});

const defaultClient = () => ({
  type: "Société",
  name: "",
  contact: "",
  address: "",
  email: "",
  phone: "",
});

const defaultProjectItem = () => ({
  id: crypto.randomUUID(),
  reference: "",
  description: "",
  quantity: 1,
  unit: "u.",
  unitPrice: 0,
  vatRate: 20,
});

const companyState = defaultCompany();
const projectState = {
  client: defaultClient(),
  items: [defaultProjectItem()],
};

const companyForm = document.getElementById("company-form");
const companyPreview = document.querySelector(".company-preview");
const companyLogoPreview = companyPreview?.querySelector("img[data-company-preview='logo']");
const statusOtherInput = companyForm
  ? companyForm.querySelector("[data-company-field='statusOther']")?.closest("label")
  : null;

const projectForm = document.getElementById("project-form");
const projectItemsBody = document.getElementById("project-items-body");
const projectPreviewList = document.getElementById("project-preview-items");

const formatAddress = (value) =>
  value && value.trim() ? value.trim().replace(/\r?\n/g, "<br>") : "";

const updateCompanyPreview = () => {
  if (!companyPreview) return;
  const map = {
    name: companyState.name || "Votre entreprise",
    status: companyState.status === "Autre" && companyState.statusOther
      ? companyState.statusOther
      : companyState.status,
    siren: companyState.siren ? `SIREN / SIRET : ${companyState.siren}` : "",
    vatNumber: companyState.vatNumber ? `TVA : ${companyState.vatNumber}` : "",
    address: formatAddress(companyState.address),
    phone: companyState.phone,
    email: companyState.email,
    website: companyState.website,
    bank: formatAddress(companyState.bank),
  };
  Object.entries(map).forEach(([key, value]) => {
    companyPreview
      .querySelectorAll(`[data-company-preview="${key}"]`)
      .forEach((node) => {
        if (!value) {
          node.innerHTML = "";
          node.textContent = "";
        } else if (/<[a-z][\s\S]*>/i.test(value)) {
          node.innerHTML = value;
        } else {
          node.textContent = value;
        }
      });
  });
  if (companyLogoPreview) {
    if (companyState.logoDataUrl) {
      companyLogoPreview.src = companyState.logoDataUrl;
      companyLogoPreview.hidden = false;
    } else {
      companyLogoPreview.hidden = true;
    }
  }
};

const syncCompanyForm = () => {
  if (!companyForm) return;
  companyForm.querySelectorAll("[data-company-field]").forEach((input) => {
    const key = input.dataset.companyField;
    if (key && companyState[key] !== undefined && input.value !== companyState[key]) {
      input.value = companyState[key];
    }
  });
  if (statusOtherInput) {
    statusOtherInput.hidden = companyState.status !== "Autre";
  }
  updateCompanyPreview();
};

const renderProjectPreview = () => {
  if (!projectPreviewList) return;
  projectPreviewList.innerHTML = "";
  projectState.items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.reference ? item.reference + " — " : ""}${item.description || "Désignation"} | ${item.quantity} ${item.unit} @ ${Number(item.unitPrice).toFixed(2)} €`;
    projectPreviewList.append(li);
  });
  const map = {
    "client.name": projectState.client.name || "Client",
    "client.contact": projectState.client.contact || "",
    "client.address": formatAddress(projectState.client.address),
    "client.email": projectState.client.email || "",
    "client.phone": projectState.client.phone || "",
  };
  Object.entries(map).forEach(([key, value]) => {
    document
      .querySelectorAll(`[data-project-preview=\"${key}\"]`)
      .forEach((node) => {
        if (!value) {
          node.innerHTML = "";
          node.textContent = "";
        } else if (/<[a-z][\\s\\S]*>/i.test(value)) {
          node.innerHTML = value;
        } else {
          node.textContent = value;
        }
      });
  });
  const clientFields = projectForm?.querySelectorAll("[data-project-client]") || [];
  clientFields.forEach((input) => {
    const key = input.dataset.projectClient;
    if (projectState.client[key] !== undefined && input.value !== projectState.client[key]) {
      input.value = projectState.client[key];
    }
  });
};

const renderProjectRows = () => {
  if (!projectItemsBody) return;
  projectItemsBody.innerHTML = "";
  projectState.items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td><input type="text" data-project-field="reference" value="${item.reference || ""}"></td>
      <td><textarea data-project-field="description" rows="2">${item.description || ""}</textarea></td>
      <td><input type="number" min="0" step="0.01" data-project-field="quantity" value="${item.quantity || 0}"></td>
      <td><input type="text" data-project-field="unit" value="${item.unit || "u."}"></td>
      <td><input type="number" min="0" step="0.01" data-project-field="unitPrice" value="${item.unitPrice || 0}"></td>
      <td><input type="number" min="0" max="100" step="0.01" data-project-field="vatRate" value="${item.vatRate || 0}"></td>
      <td class="actions"><button type="button" data-project-row="remove" title="Supprimer">✕</button></td>
    `;
    projectItemsBody.append(tr);
  });
  renderProjectPreview();
};

const addProjectItem = () => {
  projectState.items.push(defaultProjectItem());
  renderProjectRows();
};

const removeProjectItem = (id) => {
  if (projectState.items.length <= 1) return;
  projectState.items = projectState.items.filter((item) => item.id !== id);
  renderProjectRows();
};

const normalizeImportPayload = (input) => {
  if (!input || typeof input !== "object") {
    return { type: "unknown", payload: input };
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
  if (input.kind === "invoice" && input.data) {
    return { type: "invoice", payload: input.data };
  }
  if (input.kind === "card" && input.data) {
    return { type: "card", payload: input.data };
  }
  if (input.company && input.client && Array.isArray(input.items)) {
    return { type: "project", payload: { client: input.client, items: input.items } };
  }
  if (input.siren || input.vatNumber || input.logoDataUrl) {
    return { type: "company", payload: input };
  }
  if (input.client && Array.isArray(input.items)) {
    return { type: "project", payload: input };
  }
  return { type: "unknown", payload: input };
};

const applyCompanyProfile = (profile = {}) => {
  Object.assign(companyState, defaultCompany(), profile);
  syncCompanyForm();
};

const applyProjectData = (project = {}) => {
  projectState.client = { ...defaultClient(), ...(project.client || {}) };
  const items = Array.isArray(project.items) && project.items.length ? project.items : [defaultProjectItem()];
  projectState.items = items.map((item) => ({
    id: crypto.randomUUID(),
    reference: item.reference || "",
    description: item.description || "",
    quantity: Number(item.quantity) || 0,
    unit: item.unit || "u.",
    unitPrice: Number(item.unitPrice) || 0,
    vatRate: Number(item.vatRate) ?? 20,
  }));
  renderProjectRows();
};

const downloadJSON = (filename, content) => {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const openJsonFile = (onLoad) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      onLoad(json, file.name);
    } catch (error) {
      alert("Import impossible : " + error.message);
    } finally {
      input.remove();
    }
  });
  input.click();
};

companyForm?.addEventListener("input", (event) => {
  const target = event.target;
  const key = target.dataset.companyField;
  if (!key || !(key in companyState)) return;
  companyState[key] = target.value;
  if (key === "status" && statusOtherInput) {
    statusOtherInput.hidden = companyState.status !== "Autre";
  }
  updateCompanyPreview();
});

projectForm?.addEventListener("input", (event) => {
  const target = event.target;
  const clientKey = target.dataset.projectClient;
  if (clientKey) {
    projectState.client[clientKey] = target.value;
    renderProjectPreview();
    return;
  }
  const field = target.dataset.projectField;
  if (!field) return;
  const row = target.closest("tr");
  if (!row) return;
  const item = projectState.items.find((entry) => entry.id === row.dataset.id);
  if (!item) return;
  if (field === "description" || field === "reference" || field === "unit") {
    item[field] = target.value;
  } else {
    item[field] = Number(target.value);
  }
  renderProjectPreview();
});

projectItemsBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-row='remove']");
  if (!button) return;
  const row = button.closest("tr");
  if (!row) return;
  removeProjectItem(row.dataset.id);
});

projectForm?.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-project-action='add-item']");
  if (trigger) {
    event.preventDefault();
    addProjectItem();
  }
});

initLogoUpload("[data-company-action='upload-logo']", {
  onLoad(dataUrl) {
    companyState.logoDataUrl = dataUrl;
    updateCompanyPreview();
  },
  previewImage: companyForm?.querySelector(".logo-preview img"),
});

(document.querySelectorAll("[data-company-action]") || []).forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const action = btn.dataset.companyAction;
    if (action === "import") {
      event.preventDefault();
      openJsonFile((json) => {
        const { type, payload } = normalizeImportPayload(json);
        if (type === "company") {
          applyCompanyProfile(payload);
        } else {
          alert("Le fichier sélectionné n’est pas un profil entreprise.");
        }
      });
    } else if (action === "export") {
      event.preventDefault();
      downloadJSON("companyProfile.json", {
        kind: "companyProfile",
        version: 1,
        data: companyState,
      });
    } else if (action === "reset") {
      event.preventDefault();
      Object.assign(companyState, defaultCompany());
      syncCompanyForm();
    }
  });
});

(document.querySelectorAll("[data-project-action]") || []).forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const action = btn.dataset.projectAction;
    if (action === "import") {
      event.preventDefault();
      openJsonFile((json) => {
        const { type, payload } = normalizeImportPayload(json);
        if (type === "project" || type === "quote" || type === "invoice") {
          const data = type === "invoice" ? payload : payload;
          if (type === "quote") {
            applyCompanyProfile(payload.company || {});
            applyProjectData({ client: payload.client, items: payload.items });
          } else {
            applyProjectData(payload);
          }
        } else {
          alert("Le fichier sélectionné n’est pas un projet.");
        }
      });
    } else if (action === "export") {
      event.preventDefault();
      downloadJSON("project.json", {
        kind: "project",
        version: 1,
        data: {
          client: projectState.client,
          items: projectState.items.map(({ id, ...item }) => item),
        },
      });
    } else if (action === "reset") {
      event.preventDefault();
      projectState.client = defaultClient();
      projectState.items = [defaultProjectItem()];
      renderProjectRows();
    }
  });
});

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

const resourcesEmpty = document.querySelector(".resources-empty");
const resourcesList = document.getElementById("local-files-list");
const resourcesInput = document.getElementById("local-files");

const renderLocalResources = (files) => {
  if (!resourcesList) return;
  resourcesList.innerHTML = "";
  if (!files.length) {
    if (resourcesEmpty) resourcesEmpty.hidden = false;
    return;
  }
  if (resourcesEmpty) resourcesEmpty.hidden = true;
  files
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((file) => {
      const item = document.createElement("li");
      item.className = "resource-item";
      const meta = document.createElement("div");
      meta.className = "resource-item-meta";
      const title = document.createElement("strong");
      title.textContent = file.webkitRelativePath || file.name;
      const typeLabel = (() => {
        const lower = file.name.toLowerCase();
        if (lower.includes(".company")) return "Profil";
        if (lower.includes(".project")) return "Projet";
        if (lower.includes(".quote")) return "Devis";
        if (lower.includes(".invoice")) return "Facture";
        if (lower.includes(".card")) return "Carte";
        return "";
      })();
      const details = document.createElement("span");
      const parts = [formatBytes(file.size), formatDateShort(file.lastModified)];
      if (typeLabel) parts.push(typeLabel);
      details.textContent = parts.join(" • ");
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
            if (type === "company") {
              applyCompanyProfile(payload);
              alert(`Profil importé depuis ${file.name}.`);
            } else if (type === "project") {
              applyProjectData(payload);
              alert(`Projet importé depuis ${file.name}.`);
            } else if (type === "quote") {
              applyCompanyProfile(payload.company || {});
              applyProjectData({ client: payload.client, items: payload.items });
              alert(`Données projet extraites du devis ${file.name}.`);
            } else if (type === "invoice") {
              const data = payload.data || payload;
              applyCompanyProfile(data.company || {});
              applyProjectData({ client: data.client, items: data.items });
              alert(`Données projet extraites de la facture ${file.name}.`);
            } else {
              const target =
                type === "card"
                  ? "services/cartes.html"
                  : type === "invoice"
                  ? "services/factures.html"
                  : "services/devis.html";
              if (confirm("Fichier compatible avec un module spécifique. Ouvrir la page dédiée ?")) {
                window.location.href = target;
              }
            }
          } catch (error) {
            alert("Impossible d’importer ce fichier.");
          }
        });
        actions.append(importBtn);
      }

      const downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "btn btn-link";
      downloadBtn.textContent = "Télécharger";
      downloadBtn.addEventListener("click", () => {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      actions.append(downloadBtn);

      item.append(meta, actions);
      resourcesList.append(item);
    });
};

resourcesInput?.addEventListener("change", () => {
  const files = Array.from(resourcesInput.files || []);
  renderLocalResources(files);
  resourcesInput.value = "";
});

syncCompanyForm();
renderProjectRows();
renderLocalResources([]);
