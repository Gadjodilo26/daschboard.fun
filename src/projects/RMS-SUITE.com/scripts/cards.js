import { drawQRCode } from "./core/qr.js";

const canvas = document.getElementById("card-canvas");
const qrTemp = document.getElementById("card-qr-temp");
const form = document.getElementById("card-form");

const THEMES = {
  marine: {
    background: "#ffffff",
    foreground: "#0f172a",
    accent: "#1f6feb",
  },
  graphite: {
    background: "#1f2937",
    foreground: "#f9fafb",
    accent: "#f97316",
  },
  coral: {
    background: "#fff1f2",
    foreground: "#831843",
    accent: "#ec4899",
  },
  emerald: {
    background: "#ecfdf5",
    foreground: "#065f46",
    accent: "#10b981",
  },
};

const state = {
  fullName: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  qrLink: "",
  theme: "marine",
  accent: THEMES.marine.accent,
  logoDataUrl: "",
};

const normalizeImportPayload = (input) => {
  if (!input || typeof input !== "object") {
    return { type: "unknown", payload: input };
  }
  if (input.kind === "card" && input.data) {
    return { type: "card", payload: input.data };
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
  if (input.fullName && input.theme) {
    return { type: "card", payload: input };
  }
  if (input.siren || input.vatNumber || input.logoDataUrl) {
    return { type: "company", payload: input };
  }
  if (input.client && Array.isArray(input.items)) {
    return { type: "project", payload: input };
  }
  return { type: "unknown", payload: input };
};

const CARD_SIZE = {
  width: 1004, // ≈ 85 mm à 300 dpi
  height: 650, // ≈ 55 mm à 300 dpi
};

const ctx = canvas?.getContext("2d");
const LOGO_MAX_WIDTH = 240;
const LOGO_MAX_HEIGHT = 140;
const LOGO_PADDING = 60;
let logoImage = null;
let logoImageSource = "";

const prepareCanvas = () => {
  if (!canvas || !ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(CARD_SIZE.width * ratio);
  const height = Math.round(CARD_SIZE.height * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${CARD_SIZE.width}px`;
    canvas.style.height = `${CARD_SIZE.height}px`;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.scale(ratio, ratio);
};

const resetState = () => {
  state.fullName = "";
  state.title = "";
  state.company = "";
  state.phone = "";
  state.email = "";
  state.website = "";
  state.qrLink = "";
  state.theme = "marine";
  state.accent = THEMES.marine.accent;
  state.logoDataUrl = "";
  updateLogoImage("");
  syncForm();
  renderCard();
};

const syncForm = () => {
  if (!form) return;
  form.querySelectorAll("[data-card-bind]").forEach((el) => {
    const key = el.dataset.cardBind;
    if (state[key] !== undefined && el.value !== state[key]) {
      el.value = state[key];
    }
  });
};

const formatPhone = (value = "") => String(value).replace(/\s+/g, " ").trim();

const updateLogoImage = (dataUrl) => {
  if (!dataUrl) {
    logoImage = null;
    logoImageSource = "";
    return;
  }
  if (logoImageSource === dataUrl && logoImage && logoImage.complete) {
    return;
  }
  logoImageSource = dataUrl;
  const img = new Image();
  img.onload = () => {
    logoImage = img;
    renderCard();
  };
  img.onerror = () => {
    logoImage = null;
    logoImageSource = "";
    renderCard();
  };
  img.src = dataUrl;
};

const renderCard = () => {
  if (!ctx || !canvas) return;
  prepareCanvas();
  const theme = THEMES[state.theme] || THEMES.marine;
  const accent = state.accent || theme.accent;

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, CARD_SIZE.width, CARD_SIZE.height);

  // Accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, CARD_SIZE.height - 48, CARD_SIZE.width, 48);

  const hasLogo =
    logoImage &&
    logoImage.complete &&
    logoImage.naturalWidth > 0 &&
    logoImage.naturalHeight > 0 &&
    state.logoDataUrl;
  const rightReserved = hasLogo ? LOGO_MAX_WIDTH + LOGO_PADDING : LOGO_PADDING;
  const maxTextWidth = CARD_SIZE.width - LOGO_PADDING - rightReserved;

  ctx.fillStyle = theme.foreground;
  ctx.textBaseline = "top";
  ctx.font = "bold 54px 'Segoe UI', 'Helvetica Neue', Arial";
  ctx.textBaseline = "top";
  ctx.fillText(state.fullName || "Prénom Nom", LOGO_PADDING, 70, maxTextWidth);

  ctx.font = "30px 'Segoe UI', 'Helvetica Neue', Arial";
  ctx.fillStyle = accent;
  ctx.fillText(state.title || "Fonction", LOGO_PADDING, 138, maxTextWidth);

  ctx.font = "26px 'Segoe UI', 'Helvetica Neue', Arial";
  ctx.fillStyle = theme.foreground;
  ctx.fillText(state.company || "Entreprise", LOGO_PADDING, 188, maxTextWidth);

  ctx.font = "22px 'Segoe UI', 'Helvetica Neue', Arial";
  const details = [
    state.phone ? `📞  ${formatPhone(state.phone)}` : "",
    state.email ? `✉️  ${state.email}` : "",
    state.website ? `🔗  ${state.website.replace(/^https?:\/\//, "")}` : "",
  ].filter(Boolean);

  details.forEach((line, index) => {
    ctx.fillText(line, LOGO_PADDING, 240 + index * 34, maxTextWidth);
  });

  if (hasLogo) {
    const scale = Math.min(
      LOGO_MAX_WIDTH / logoImage.naturalWidth,
      LOGO_MAX_HEIGHT / logoImage.naturalHeight,
      1
    );
    const drawWidth = logoImage.naturalWidth * scale;
    const drawHeight = logoImage.naturalHeight * scale;
    const x = CARD_SIZE.width - drawWidth - LOGO_PADDING;
    const y = LOGO_PADDING;
    ctx.drawImage(logoImage, x, y, drawWidth, drawHeight);
  }

  // QR code
  const qrX = CARD_SIZE.width - 240 - 70;
  const qrY = CARD_SIZE.height - 240 - 70;

  ctx.clearRect(qrX - 4, qrY - 4, 248, 248);

  if (qrTemp && state.qrLink?.startsWith("https://")) {
    drawQRCode(qrTemp, state.qrLink);
    ctx.drawImage(qrTemp, qrX, qrY, 240, 240);
  } else {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(qrX, qrY, 240, 240);
    ctx.font = "20px 'Segoe UI', 'Helvetica Neue', Arial";
    ctx.fillStyle = accent;
    const previousAlign = ctx.textAlign;
    const previousBaseline = ctx.textBaseline;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QR code", qrX + 120, qrY + 120);
    ctx.textAlign = previousAlign;
    ctx.textBaseline = previousBaseline;
  }
};

const exportCard = () => {
  const payload = {
    kind: "card",
    version: 1,
    data: { ...state },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = state.fullName || "card";
  a.download = `${safeName.replace(/\s+/g, "_").toLowerCase()}.card.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const importCard = (data) => {
  const payload = data && data.kind === "card" && data.data ? data.data : data;
  if (!payload) throw new Error("Format carte invalide");
  Object.assign(state, payload);
  updateLogoImage(state.logoDataUrl || "");
  if (!state.accent) {
    const theme = THEMES[state.theme] || THEMES.marine;
    state.accent = theme.accent;
  }
  syncForm();
  renderCard();
  alert("Carte importée avec succès.");
};

const applyCompanyProfile = (profile = {}, { sync = true } = {}) => {
  if (profile.name !== undefined) state.company = profile.name;
  if (profile.phone !== undefined) state.phone = profile.phone;
  if (profile.email !== undefined) state.email = profile.email;
  if (profile.website !== undefined) state.website = profile.website;
  if (profile.logoDataUrl !== undefined) {
    state.logoDataUrl = profile.logoDataUrl || "";
    updateLogoImage(state.logoDataUrl);
  }
  if (profile.contactName && !state.fullName) {
    state.fullName = profile.contactName;
  }
  if (sync) {
    syncForm();
    renderCard();
  }
};

const applyProjectData = (project = {}) => {
  const emitter = project.company || project.emitter;
  if (emitter) {
    applyCompanyProfile(emitter, { sync: false });
  }
  if (project.representative && !state.fullName) {
    state.fullName = project.representative;
  }
  syncForm();
  renderCard();
};

const downloadPng = () => {
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = `${(state.fullName || "carte").replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png", 1);
  link.click();
};

const printCard = () => {
  document.getElementById("card-preview")?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.body.classList.add("print-card");
  window.print();
};

if (form) {
  form.addEventListener("input", (event) => {
    const target = event.target;
    const key = target.dataset.cardBind;
    if (!key) return;
    const rawValue = target.value;
    const nextValue =
      key === "qrLink" || key === "website" ? rawValue.trim() : rawValue;
    state[key] = nextValue;
    if (key === "theme" && form.querySelector('[data-card-bind="accent"]')) {
      const theme = THEMES[target.value];
      if (theme) {
        state.accent = theme.accent;
        form.querySelector('[data-card-bind="accent"]').value = theme.accent;
      }
    }
    renderCard();
  });

  form.addEventListener("change", (event) => {
    const target = event.target;
    const key = target.dataset.cardBind;
    if (!key) return;
    const rawValue = target.value;
    const nextValue =
      key === "qrLink" || key === "website" ? rawValue.trim() : rawValue;
    state[key] = nextValue;
    if (key === "theme" && form.querySelector('[data-card-bind="accent"]')) {
      const theme = THEMES[target.value];
      if (theme) {
        state.accent = theme.accent;
        form.querySelector('[data-card-bind="accent"]').value = theme.accent;
      }
    }
    renderCard();
  });
}

document.querySelectorAll("[data-card-action]").forEach((btn) => {
  btn.addEventListener("click", (event) => {
    const action = btn.dataset.cardAction;
    event.preventDefault();
    if (action === "export") {
      exportCard();
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
          if (type === "card") {
            importCard(payload);
          } else if (type === "company") {
            applyCompanyProfile(payload);
            alert("Profil importé sur la carte.");
          } else if (type === "project") {
            applyProjectData(payload);
            if (payload?.company || payload?.emitter) {
              alert("Profil émetteur importé depuis le projet.");
            } else {
              alert("Ce projet ne contient pas de profil émetteur. Importez un profil entreprise.");
            }
          } else if (type === "quote" || type === "invoice") {
            const data = payload.data || payload;
            const emitter = data.company || data.emitter || data.profile;
            if (emitter) {
              applyCompanyProfile(emitter);
              let updated = false;
              if (data.meta?.contactName && !state.fullName) {
                state.fullName = data.meta.contactName;
                updated = true;
              }
              if (updated) {
                syncForm();
                renderCard();
              }
              alert(
                `Profil émetteur importé depuis ${
                  type === "quote" ? "le devis" : "la facture"
                }.`
              );
            } else {
              alert("Ce fichier ne contient pas de profil émetteur exploitable.");
            }
          } else {
            alert("Ce fichier ne correspond pas au module Carte de visite.");
          }
        } catch (error) {
          console.error(error);
          alert("Impossible d'importer ce fichier.");
        } finally {
          input.remove();
        }
      });
      input.click();
    } else if (action === "download") {
      downloadPng();
    } else if (action === "print") {
      printCard();
    } else if (action === "reset") {
      if (confirm("Réinitialiser la carte de visite ?")) {
        resetState();
      }
    }
  });
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("print-card");
});

resetState();

window.RMS_CARD = {
  import: importCard,
  export: exportCard,
  download: downloadPng,
  getState: () => structuredClone(state),
  loadCompanyProfile: applyCompanyProfile,
  loadProject: applyProjectData,
};
