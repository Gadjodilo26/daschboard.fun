const RMS_WEBSITE_BRIEF = (() => {
  const STORAGE_KEY = "RMS_WEBSITE_LANDING_DRAFT";
  const MAIL_TO = "support@rms-suite.com";

  const completenessChecks = [
    (model) => Boolean(model.contact.name),
    (model) => Boolean(model.contact.email),
    (model) => Boolean(model.project.objective),
    (model) => model.sections.list.length > 0,
    (model) => Boolean(model.project.cta),
    (model) => Boolean(model.design.style),
    (model) => Boolean(model.logistics.deadline),
    (model) => Boolean(model.logistics.budget),
    (model) => model.consent === true,
  ];

  const state = {
    form: null,
    progressBar: null,
    progressPercent: null,
    messageEl: null,
    previewOverlay: null,
    lastOutput: null,
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isValidUrl = (value) => /^https?:\/\/.+/i.test(value);
  const splitList = (value) =>
    value
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);

  const collect = () => {
    const { form } = state;
    const sections = Array.from(form.querySelectorAll('input[name="sections"]:checked')).map((input) => input.value);
    const contents = Array.from(form.querySelectorAll('input[name="contents"]:checked')).map((input) => input.value);

    return {
      contact: {
        name: form.contactName.value.trim(),
        company: form.contactCompany.value.trim(),
        email: form.contactEmail.value.trim(),
        phone: form.contactPhone.value.trim(),
      },
      project: {
        objective: form.projectObjective.value,
        objectiveOther: form.projectObjectiveOther.value.trim(),
        valueProp: form.projectValue.value.trim(),
        audience: form.projectAudience.value.trim(),
        offer: form.projectOffer.value.trim(),
        cta: form.projectCta.value.trim(),
        tone: form.projectTone.value.trim(),
      },
      sections: {
        list: sections,
        other: form.sectionsOther.value.trim(),
        contents,
        assets: form.assetsLinks.value.trim(),
      },
      design: {
        style: form.designStyle.value.trim(),
        colors: form.designColors.value.trim(),
        inspirations: form.designInspirations.value.trim(),
      },
      logistics: {
        deadline: form.logisticsDeadline.value,
        budget: form.logisticsBudget.value.trim(),
        support: form.logisticsSupport.value,
        ecommerce: form.logisticsEcommerce.value,
        updates: form.logisticsUpdates.value,
        notes: form.logisticsNotes.value.trim(),
      },
      consent: form.consentRgpd.checked,
    };
  };

  const validate = (model) => {
    const errors = {};

    if (!model.contact.name) {
      errors.contactName = "Le nom est requis.";
    }
    if (!model.contact.email) {
      errors.contactEmail = "L’e-mail est requis.";
    } else if (!isValidEmail(model.contact.email)) {
      errors.contactEmail = "Adresse e-mail invalide.";
    }
    if (!model.project.objective) {
      errors.projectObjective = "Sélectionnez l’objectif principal.";
    }
    if (!model.sections.list.length) {
      errors.sections = "Sélectionnez au moins une section.";
    }
    if (!model.consent) {
      errors.consentRgpd = "Vous devez accepter l’utilisation des données.";
    }

    if (model.sections.assets) {
      const urls = splitList(model.sections.assets);
      if (urls.some((url) => !isValidUrl(url))) {
        errors.assetsLinks = "Chaque lien doit commencer par http:// ou https://.";
      }
    }
    if (model.design.inspirations) {
      const urls = splitList(model.design.inspirations);
      if (urls.some((url) => !isValidUrl(url))) {
        errors.designInspirations = "Chaque URL doit commencer par http:// ou https://.";
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  };

  const normalizedObjective = (model) => {
    if (model.project.objective === "autre") {
      return model.project.objectiveOther || "Objectif à définir";
    }
    return model.project.objective || "Objectif à définir";
  };

  const humanizeObjective = (value) => {
    switch (value) {
      case "collecte-leads":
        return "Collecter des leads";
      case "vente-produit":
        return "Vendre un produit / service";
      case "lancement":
        return "Lancer une offre / un évènement";
      case "application":
        return "Promouvoir une application";
      case "autre":
        return "Objectif personnalisé";
      default:
        return value || "Objectif à définir";
    }
  };

  const composeEmail = (model) => {
    const sections = [...model.sections.list];
    if (sections.includes("other") && model.sections.other) {
      sections.splice(sections.indexOf("other"), 1);
      sections.push(...splitList(model.sections.other).map((item) => item.toLowerCase()));
    }

    const contents = model.sections.contents.join(", ") || "À produire";
    const objectiveLabel = humanizeObjective(model.project.objective);
    const subject = `[Brief Landing Page] ${model.contact.company || model.contact.name || "Client"} — ${objectiveLabel} — ${
      model.logistics.deadline || "Planning à définir"
    }`;

    const logisticStatements = [
      "Tarif indicatif RMS Suite : entre 300 € et 500 € (landing HTML/CSS).",
      "E-commerce : non proposé par défaut, échange possible sur demande.",
      "Nom de domaine : géré par RMS Suite pour simplifier le lancement.",
      `Mises à jour : ${model.logistics.updates === "oui" ? "oui, souhaitées sous contrat." : model.logistics.updates === "non" ? "non, besoin ponctuel." : "à définir ensemble."}`,
    ];

    const textLines = [
      "=== Coordonnées ===",
      `Nom : ${model.contact.name || "—"}`,
      `Société : ${model.contact.company || "—"}`,
      `Email : ${model.contact.email || "—"}`,
      `Téléphone : ${model.contact.phone || "—"}`,
      "",
      "=== Projet ===",
      `Objectif : ${objectiveLabel}${model.project.objective === "autre" && model.project.objectiveOther ? ` (${model.project.objectiveOther})` : ""}`,
      `Proposition de valeur : ${model.project.valueProp || "—"}`,
      `Public visé : ${model.project.audience || "—"}`,
      `Offre / Promesse : ${model.project.offer || "—"}`,
      `CTA principal : ${model.project.cta || "—"}`,
      `Ton & style : ${model.project.tone || "—"}`,
      "",
      "=== Contenu & sections ===",
      `Sections : ${sections.length ? sections.join(", ") : "—"}`,
      `Contenus disponibles : ${contents}`,
      `Liens utiles : ${model.sections.assets || "—"}`,
      "",
      "=== Identité & inspirations ===",
      `Style visuel : ${model.design.style || "—"}`,
      `Couleurs : ${model.design.colors || "—"}`,
      `Inspirations : ${model.design.inspirations || "—"}`,
      "",
      "=== Logistique ===",
      `Deadline : ${model.logistics.deadline || "—"}`,
      `Budget : ${model.logistics.budget || "—"}`,
      `Accompagnement technique : ${model.logistics.support || "—"}`,
      `Intérêt e-commerce : ${model.logistics.ecommerce === "oui" ? "Oui (à discuter)" : "Non"}`,
      `Notes complémentaires : ${model.logistics.notes || "—"}`,
      "",
      "=== Informations RMS Suite ===",
      ...logisticStatements,
      "",
      "=== Consentement ===",
      `RGPD accepté : ${model.consent ? "Oui" : "Non"}`,
    ];

    const textBody = textLines.join("\n");

    const htmlSections = [
      `<h2>Coordonnées</h2>
      <p><strong>Nom :</strong> ${escapeHtml(model.contact.name || "—")}<br>
      <strong>Société :</strong> ${escapeHtml(model.contact.company || "—")}<br>
      <strong>Email :</strong> ${escapeHtml(model.contact.email || "—")}<br>
      <strong>Téléphone :</strong> ${escapeHtml(model.contact.phone || "—")}</p>`,

      `<h2>Projet</h2>
      <p><strong>Objectif :</strong> ${escapeHtml(objectiveLabel)}${
        model.project.objective === "autre" && model.project.objectiveOther
          ? ` (${escapeHtml(model.project.objectiveOther)})`
          : ""
      }<br>
      <strong>Proposition de valeur :</strong> ${escapeHtml(model.project.valueProp || "—")}<br>
      <strong>Public visé :</strong> ${escapeHtml(model.project.audience || "—")}<br>
      <strong>Offre / Promesse :</strong> ${escapeHtml(model.project.offer || "—")}<br>
      <strong>CTA principal :</strong> ${escapeHtml(model.project.cta || "—")}<br>
      <strong>Ton &amp; style :</strong> ${escapeHtml(model.project.tone || "—")}</p>`,

      `<h2>Contenu &amp; sections</h2>
      <p><strong>Sections :</strong> ${escapeHtml(sections.join(", ") || "—")}<br>
      <strong>Contenus disponibles :</strong> ${escapeHtml(contents)}<br>
      <strong>Liens utiles :</strong> ${escapeHtml(model.sections.assets || "—")}</p>`,

      `<h2>Identité &amp; inspirations</h2>
      <p><strong>Style visuel :</strong> ${escapeHtml(model.design.style || "—")}<br>
      <strong>Couleurs :</strong> ${escapeHtml(model.design.colors || "—")}<br>
      <strong>Inspirations :</strong> ${escapeHtml(model.design.inspirations || "—")}</p>`,

      `<h2>Logistique</h2>
      <p><strong>Deadline :</strong> ${escapeHtml(model.logistics.deadline || "—")}<br>
      <strong>Budget :</strong> ${escapeHtml(model.logistics.budget || "—")}<br>
      <strong>Accompagnement technique :</strong> ${escapeHtml(model.logistics.support || "—")}<br>
      <strong>Intérêt e-commerce :</strong> ${escapeHtml(model.logistics.ecommerce === "oui" ? "Oui (à discuter)" : "Non")}<br>
      <strong>Notes :</strong> ${escapeHtml(model.logistics.notes || "—")}</p>`,

      `<h2>Informations RMS Suite</h2>
      <ul>
        ${logisticStatements.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>`,

      `<h2>Consentement</h2>
      <p><strong>RGPD accepté :</strong> ${model.consent ? "Oui" : "Non"}</p>`,
    ];

    const htmlBody = `<article>${htmlSections.join("")}</article>`;

    return { subject, textBody, htmlBody };
  };

  const buildPromptJSON = (model) => {
    const sections = [...model.sections.list];
    if (sections.includes("other") && model.sections.other) {
      sections.splice(sections.indexOf("other"), 1);
      sections.push(
        ...splitList(model.sections.other).map((item) =>
          item
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
        )
      );
    }

    return JSON.stringify(
      {
        kind: "landing_brief",
        version: 1,
        contact: {
          name: model.contact.name || "",
          company: model.contact.company || "",
          email: model.contact.email || "",
          phone: model.contact.phone || "",
        },
        project: {
          objective: normalizedObjective(model),
          value_prop: model.project.valueProp || "",
          audience: model.project.audience || "",
          offer: model.project.offer || "",
          cta: model.project.cta || "",
          tone: model.project.tone || "",
        },
        sections: {
          list: sections,
          contents_provided: model.sections.contents || [],
          assets: splitList(model.sections.assets),
        },
        design: {
          style: model.design.style || "",
          colors: splitList(model.design.colors),
          inspirations: splitList(model.design.inspirations),
        },
        logistics: {
          deadline: model.logistics.deadline || "",
          budget: model.logistics.budget || "",
          support: model.logistics.support || "",
          ecommerce_interest: model.logistics.ecommerce || "",
          updates_contract: model.logistics.updates || "",
          notes: model.logistics.notes || "",
          pricing_reference: "300-500 EUR forfait landing page",
          domain_by_rms: true,
        },
        consent: model.consent,
      },
      null,
      2
    );
  };

  const renderPreview = ({ subject, textBody, htmlBody, json }) => {
    const subjectEl = document.getElementById("preview-subject");
    const textEl = document.getElementById("preview-text");
    const htmlEl = document.getElementById("preview-html");
    const jsonEl = document.getElementById("preview-json");

    if (subjectEl) subjectEl.textContent = subject || "—";
    if (textEl) textEl.value = textBody || "";
    if (htmlEl) htmlEl.innerHTML = htmlBody || "<p>—</p>";
    if (jsonEl) jsonEl.value = json || "";

    state.lastOutput = { subject, textBody, htmlBody, json };
  };

  const openMailClientOrDownload = ({ to, subject, textBody }) => {
    const encoded = encodeURIComponent(`${subject}${textBody}`);
    if (encoded.length < 1800) {
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;
      window.location.href = mailto;
    } else {
      const blob = new Blob([`${subject}\n\n${textBody}`], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "brief-landing-page.txt";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.alert("Le message est trop long pour le client mail. Un fichier texte a été téléchargé.");
    }
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      window.alert("Contenu copié dans le presse-papiers.");
    } catch (error) {
      console.error("Clipboard error", error);
      window.alert("Impossible de copier le contenu.");
    }
  };

  const showErrors = (errors) => {
    if (state.messageEl) {
      if (Object.keys(errors).length) {
        state.messageEl.hidden = false;
        state.messageEl.textContent = "Merci de corriger les champs indiqués.";
      } else {
        state.messageEl.hidden = true;
        state.messageEl.textContent = "";
      }
    }
    state.form.querySelectorAll("[data-error-for]").forEach((node) => {
      const key = node.dataset.errorFor;
      node.textContent = errors[key] || "";
    });
  };

  const persistDraft = (model) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    } catch (error) {
      console.warn("Impossible de sauvegarder le brouillon.", error);
    }
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;

      const assign = (selector, value) => {
        const field = state.form.querySelector(selector);
        if (!field || value === undefined || value === null) return;
        field.value = value;
      };

      assign("#contact-name", data.contact?.name);
      assign("#contact-company", data.contact?.company);
      assign("#contact-email", data.contact?.email);
      assign("#contact-phone", data.contact?.phone);
      assign("#project-objective", data.project?.objective);
      assign("#project-objective-other", data.project?.objectiveOther);
      assign("#project-value", data.project?.valueProp);
      assign("#project-audience", data.project?.audience);
      assign("#project-offer", data.project?.offer);
      assign("#project-cta", data.project?.cta);
      assign("#project-tone", data.project?.tone);
      assign("#sections-other", data.sections?.other);
      assign("#assets-links", data.sections?.assets);
      assign("#design-style", data.design?.style);
      assign("#design-colors", data.design?.colors);
      assign("#design-inspirations", data.design?.inspirations);
      assign("#logistics-deadline", data.logistics?.deadline);
      assign("#logistics-budget", data.logistics?.budget);
      assign("#logistics-support", data.logistics?.support);
      assign("#logistics-ecommerce", data.logistics?.ecommerce);
      assign("#logistics-updates", data.logistics?.updates);
      assign("#logistics-notes", data.logistics?.notes);

      (data.sections?.list || []).forEach((value) => {
        const checkbox = state.form.querySelector(`input[name="sections"][value="${value}"]`);
        if (checkbox) checkbox.checked = true;
      });
      (data.sections?.contents || []).forEach((value) => {
        const checkbox = state.form.querySelector(`input[name="contents"][value="${value}"]`);
        if (checkbox) checkbox.checked = true;
      });
      const consentBox = state.form.querySelector("#consent-rgpd");
      if (consentBox) consentBox.checked = Boolean(data.consent);
    } catch (error) {
      console.warn("Impossible de restaurer le brouillon.", error);
    }
  };

  const resetForm = () => {
    state.form.reset();
    localStorage.removeItem(STORAGE_KEY);
    state.lastOutput = null;
    renderPreview({ subject: "", textBody: "", htmlBody: "<p>—</p>", json: "" });
    updateProgress();
    showErrors({});
  };

  const updateProgress = () => {
    const model = collect();
    const filled = completenessChecks.reduce((count, check) => count + (check(model) ? 1 : 0), 0);
    const percent = Math.round((filled / completenessChecks.length) * 100);
    if (state.progressBar) state.progressBar.value = percent;
    if (state.progressPercent) state.progressPercent.textContent = `${percent}%`;
  };

  const onFormChange = () => {
    const model = collect();
    persistDraft(model);
    updateProgress();
    if (state.lastOutput) {
      const email = composeEmail(model);
      const json = buildPromptJSON(model);
      renderPreview({ ...email, json });
    }
  };

  const ensureOutput = () => {
    const model = collect();
    const validation = validate(model);
    showErrors(validation.errors);
    if (!validation.valid) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return null;
    }
    const email = composeEmail(model);
    const json = buildPromptJSON(model);
    renderPreview({ ...email, json });
    return { model, email };
  };

  const setPreviewVisibility = (open) => {
    if (!state.previewOverlay) return;
    if (open) {
      state.previewOverlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("preview-open");
    } else {
      state.previewOverlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("preview-open");
    }
  };

  const bindCopyButtons = () => {
    document.querySelectorAll("[data-copy-target]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const targetId = btn.dataset.copyTarget;
        const copyHtml = btn.dataset.copyHtml === "true";
        const node = document.getElementById(targetId);
        if (!node) return;
        const text = copyHtml ? node.innerHTML : node.value || node.textContent || "";
        if (!text) {
          window.alert("Rien à copier pour le moment.");
          return;
        }
        await copyToClipboard(text);
      });
    });
  };

  const init = () => {
    state.form = document.getElementById("brief-form");
    state.progressBar = document.getElementById("brief-progress");
    state.progressPercent = document.getElementById("brief-progress-percent");
    state.messageEl = document.getElementById("form-errors");
    state.previewOverlay = document.getElementById("preview-overlay");

    if (!state.form) return;

    restoreDraft();
    updateProgress();

    state.form.addEventListener("input", onFormChange, true);
    state.form.addEventListener("change", onFormChange, true);

    document.getElementById("btn-preview")?.addEventListener("click", () => {
      const result = ensureOutput();
      if (!result) return;
      setPreviewVisibility(true);
    });

    document.getElementById("btn-copy-message")?.addEventListener("click", async () => {
      const result = ensureOutput();
      if (!result) return;
      await copyToClipboard(`${result.email.subject}\n\n${result.email.textBody}`);
    });

    document.getElementById("btn-open-mail")?.addEventListener("click", () => {
      const result = ensureOutput();
      if (!result) return;
      openMailClientOrDownload({
        to: MAIL_TO,
        subject: result.email.subject,
        textBody: result.email.textBody,
      });
    });

    document.getElementById("btn-reset")?.addEventListener("click", () => {
      if (window.confirm("Réinitialiser le formulaire et supprimer le brouillon ?")) {
        resetForm();
      }
    });

    document.getElementById("btn-close-preview")?.addEventListener("click", () => {
      setPreviewVisibility(false);
    });

    state.previewOverlay?.addEventListener("click", (event) => {
      if (event.target === state.previewOverlay) {
        setPreviewVisibility(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("preview-open")) {
        setPreviewVisibility(false);
      }
    });

    bindCopyButtons();
    renderPreview({ subject: "", textBody: "", htmlBody: "<p>—</p>", json: "" });
  };

  return {
    init,
    collect,
    validate,
    composeEmail,
    buildPromptJSON,
    renderPreview,
    openMailClientOrDownload,
    copyToClipboard,
  };
})();

window.RMS_WEBSITE_BRIEF = RMS_WEBSITE_BRIEF;
document.addEventListener("DOMContentLoaded", () => {
  RMS_WEBSITE_BRIEF.init();
});
