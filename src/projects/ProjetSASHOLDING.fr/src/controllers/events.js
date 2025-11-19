/**
 * controllers/events.js
 * Centralise le binding des événements DOM pour garder `main.js` léger.
 */
import { state, defaultInputs, normalizeInputs, normalizeBookkeeping } from '../state.js';
import { storage } from '../storage.js';
import { ui } from '../ui.js';
import { recalculate } from '../core/engine.js';
import { calc } from '../calc.js';
import { sanitizeText, parseNumber, clamp, uuid, formatCurrency } from '../utils.js';
import {
  MEAL_ALLOWANCE_PER_DAY,
  DAILY_WORKING_DAYS_MAX,
  DAILY_WORKING_DAYS_MIN,
  BOOKKEEPING_STATUSES
} from '../config/constants.js';
import { shiftMonth } from '../bookkeeping.js';

export function registerEventListeners() {
  wireForm();
  wireAutosaveToggle();
  wirePrintButtons();
  wireExportButton();
  wireImportInput();
  wireResetButton();
  wireMiscCharges();
  wireDailyCourses();
  wireDailyRevenueShortcut();
  wireBookkeepingModule();
}

function wireForm() {
  const form = document.getElementById('simulation-form');
  if (!form) return;
  form.addEventListener('input', handleFormInput);
}

const formInputHandlers = {
  'input-company-name': (val) => (state.inputs.companyName = sanitizeText(val, 80)),
  'input-manager-name': (val) => (state.inputs.managerName = sanitizeText(val, 60)),
  'input-main-client': (val) => (state.inputs.mainClient = sanitizeText(val, 60)),
  'input-contract-stability': (val) => (state.inputs.contractStability = val),
  'input-vehicle-price': (val) => (state.inputs.vehiclePrice = Math.max(0, parseNumber(val))),
  'input-personal-contribution': (val) => (state.inputs.personalContribution = Math.max(0, parseNumber(val))),
  'input-loan-rate': (val) => (state.inputs.loanRate = Math.max(0, parseNumber(val))),
  'input-loan-duration': (val) => (state.inputs.loanDurationYears = Math.max(1, parseNumber(val))),
  'input-amortization-years': (val) => (state.inputs.amortizationYears = Math.max(1, parseNumber(val))),
  'input-licenses-count': (val) => (state.inputs.licensesCount = Math.max(1, Math.round(parseNumber(val)))),
  'input-license-cost': (val) => (state.inputs.licenseCost = Math.max(0, parseNumber(val))),
  'input-working-days': (val) =>
    (state.inputs.workingDays = clamp(parseNumber(val), DAILY_WORKING_DAYS_MIN, DAILY_WORKING_DAYS_MAX)),
  'input-daily-revenue': (val) => (state.inputs.dailyRevenue = Math.max(0, parseNumber(val))),
  'input-km-allowance-rate': (val) => (state.inputs.kmAllowanceRate = Math.max(0, parseNumber(val))),
  'input-surcharges': (val) => (state.inputs.surcharges = Math.max(0, parseNumber(val))),
  'input-fuel': (val) => (state.inputs.fuel = Math.max(0, parseNumber(val))),
  'input-insurance': (val) => (state.inputs.insurance = Math.max(0, parseNumber(val))),
  'input-maintenance': (val) => (state.inputs.maintenance = Math.max(0, parseNumber(val))),
  'input-tolls': (val) => (state.inputs.tolls = Math.max(0, parseNumber(val))),
  'input-other-charges': (val) => (state.inputs.otherCharges = Math.max(0, parseNumber(val))),
  'input-meal-allowance-rate': (val) =>
    (state.inputs.mealAllowanceRate = parseNumber(val) > 0 ? parseNumber(val) : MEAL_ALLOWANCE_PER_DAY),
  'input-net-remuneration': (val) => (state.inputs.netRemuneration = Math.max(0, parseNumber(val))),
  'input-ssi-rate': (val) => (state.inputs.ssiRate = clamp(parseNumber(val), 0, 80)),
  'input-tns-min-contribution': (val) => (state.inputs.tnsMinContribution = Math.max(0, parseNumber(val))),
  'input-growth-rate': (val) => (state.inputs.growthRate = clamp(parseNumber(val), 0, 20)),
  'input-inflation-rate': (val) => (state.inputs.inflationRate = clamp(parseNumber(val), 0, 10)),
  'input-fiscal-regime': (val) => (state.inputs.fiscalRegime = val),
  'input-is-option': (_val, evt) => (state.inputs.isOption = evt.target.checked),
  'input-vat-franchise': (_val, evt) => (state.inputs.vatFranchise = evt.target.checked),
  'input-vat-rate': (val) => (state.inputs.vatRate = Math.max(0, parseNumber(val))),
  'input-heavy-vehicle-tax': (val) => (state.inputs.heavyVehicleTax = Math.max(0, parseNumber(val))),
  'input-eco-tax': (val) => (state.inputs.ecoTax = Math.max(0, parseNumber(val))),
  'input-client-delay': (val) => (state.inputs.clientPaymentDelay = Math.max(0, parseNumber(val))),
  'input-supplier-delay': (val) => (state.inputs.supplierPaymentDelay = Math.max(0, parseNumber(val)))
};

function handleFormInput(event) {
  const { id, value } = event.target;
  const handler = formInputHandlers[id];
  if (handler) {
    handler(value, event);
    commitState();
    return;
  }
  const miscRow = event.target.closest('#misc-charges .dynamic-list__item');
  if (miscRow) {
    updateMiscCharge(miscRow);
  }
}

function wireAutosaveToggle() {
  const button = document.getElementById('toggle-autosave');
  if (!button) return;
  button.addEventListener('click', () => {
    state.autoSaveEnabled = !state.autoSaveEnabled;
    button.setAttribute('aria-pressed', state.autoSaveEnabled ? 'true' : 'false');
    storage.save({ force: true });
    ui.toast(state.autoSaveEnabled ? 'Sauvegarde automatique activée.' : 'Sauvegarde automatique désactivée.');
  });
}

function wirePrintButtons() {
  const printButtons = [document.getElementById('print-btn'), document.getElementById('btn-print')].filter(Boolean);
  printButtons.forEach((button) =>
    button.addEventListener('click', () => {
      document.body.classList.add('is-printing');
      window.print();
      window.setTimeout(() => document.body.classList.remove('is-printing'), 400);
    })
  );
}

function wireExportButton() {
  const btnExport = document.getElementById('btn-export-json');
  if (!btnExport) return;
  btnExport.addEventListener('click', () => storage.export());
}

function wireImportInput() {
  const fileInput = document.getElementById('input-import-json');
  if (!fileInput) return;
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      state.inputs = normalizeInputs(data.inputs);
      commitState({ skipForm: false });
      ui.toast('Scénario importé avec succès.');
      storage.save({ force: true });
    } catch (error) {
      console.error(error);
      ui.toast('Import impossible. Vérifiez le fichier.', 'error');
    } finally {
      event.target.value = '';
    }
  });
}

function wireResetButton() {
  const btnReset = document.getElementById('btn-reset');
  if (!btnReset) return;
  btnReset.addEventListener('click', () => {
    state.inputs = defaultInputs();
    commitState({ skipForm: false });
    ui.toast('Formulaire réinitialisé.');
    storage.save({ force: true });
  });
}

function wireMiscCharges() {
  const container = document.getElementById('misc-charges');
  if (!container) return;
  container.addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'remove') return;
    const row = event.target.closest('.dynamic-list__item');
    const id = row?.dataset.id;
    if (!id) return;
    state.inputs.miscCharges = state.inputs.miscCharges.filter((item) => item.id !== id);
    commitState({ skipForm: false });
  });

  const addButton = document.getElementById('btn-add-misc-charge');
  if (!addButton) return;
  addButton.addEventListener('click', () => {
    state.inputs.miscCharges.push({ id: uuid(), label: 'Charge complémentaire', amount: 0 });
    commitState({ skipForm: false });
  });
}

function wireDailyCourses() {
  const container = document.getElementById('daily-courses');
  if (!container) return;
  container.addEventListener('input', (event) => {
    const row = event.target.closest('.dynamic-list__item');
    if (!row) return;
    updateDailyCourse(row);
  });
  container.addEventListener('click', (event) => {
    if (event.target.dataset.action !== 'remove') return;
    const row = event.target.closest('.dynamic-list__item');
    const id = row?.dataset.id;
    if (!id) return;
    state.inputs.dailyCourses = state.inputs.dailyCourses.filter((item) => item.id !== id);
    commitState({ skipForm: false });
  });

  const addButton = document.getElementById('btn-add-course');
  if (addButton) {
    addButton.addEventListener('click', () => {
      const index = state.inputs.dailyCourses.length + 1;
      state.inputs.dailyCourses.push({
        id: uuid(),
        label: `Course ${index}`,
        amount: 0,
        distance: 0
      });
      commitState({ skipForm: false });
    });
  }
}

function wireDailyRevenueShortcut() {
  const applyDailyBtn = document.getElementById('btn-apply-daily-revenue');
  if (!applyDailyBtn) return;
  applyDailyBtn.addEventListener('click', () => {
    const total = calc.dailyCourseTotal(state.inputs);
    state.inputs.dailyRevenue = Math.round(total * 100) / 100;
    commitState();
    const dailyRevenueInput = document.getElementById('input-daily-revenue');
    if (dailyRevenueInput) {
      dailyRevenueInput.value = state.inputs.dailyRevenue;
    }
    ui.toast(`CA journalier mis à jour (${formatCurrency(total, true)}).`);
  });
}

function wireBookkeepingModule() {
  wireBookkeepingForm();
  wireBookkeepingEntries();
  wireBookkeepingFilters();
  wireBookkeepingImportExport();
  wireCalendarNavigation();
}

function wireBookkeepingForm() {
  const form = document.getElementById('bookkeeping-form');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const entryId = form.dataset.editId || null;
    const entry = {
      id: entryId || uuid(),
      date: formData.get('entry-date') || new Date().toISOString().slice(0, 10),
      type: formData.get('entry-type') === 'income' ? 'income' : 'expense',
      label: sanitizeText(formData.get('entry-label') || 'Ecriture'),
      category: sanitizeText(formData.get('entry-category') || 'Autre charge'),
      amount: Math.max(0, parseNumber(formData.get('entry-amount'))),
      notes: sanitizeText(formData.get('entry-notes') || '', 240),
      status: BOOKKEEPING_STATUSES.includes(formData.get('entry-status'))
        ? formData.get('entry-status')
        : 'enregistré'
    };
    const index = state.bookkeeping.entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) {
      state.bookkeeping.entries[index] = entry;
      ui.toast('Écriture mise à jour.');
    } else {
      state.bookkeeping.entries.push(entry);
      ui.toast('Écriture ajoutée.');
    }
    state.bookkeeping.entries.sort((a, b) => a.date.localeCompare(b.date));
    form.reset();
    delete form.dataset.editId;
    const submitBtn = form.querySelector('[data-role="submit"]');
    if (submitBtn) submitBtn.textContent = 'Enregistrer l’écriture';
    commitState({ skipForm: false });
  });

  const cancelBtn = document.getElementById('bookkeeping-cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => resetBookkeepingForm());
  }

  resetBookkeepingForm();
}

function wireBookkeepingEntries() {
  const container = document.getElementById('bookkeeping-entries');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const entryId = button.dataset.id;
    if (!entryId) return;
    if (button.dataset.action === 'remove') {
      if (window.confirm('Supprimer cette écriture ?')) {
        state.bookkeeping.entries = state.bookkeeping.entries.filter((entry) => entry.id !== entryId);
        commitState({ skipForm: false });
        ui.toast('Écriture supprimée.');
        resetBookkeepingForm();
      }
    } else if (button.dataset.action === 'edit') {
      fillBookkeepingForm(entryId);
    }
  });

  container.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-entry-status]');
    if (!select) return;
    const entryId = select.dataset.entryId;
    const entry = state.bookkeeping.entries.find((item) => item.id === entryId);
    if (!entry) return;
    entry.status = select.value;
    commitState({ skipForm: false });
  });
}

function wireBookkeepingFilters() {
  const filter = document.getElementById('bookkeeping-month-filter');
  if (filter) {
    filter.value = state.bookkeeping.month;
    filter.addEventListener('change', () => {
      if (filter.value) {
        state.bookkeeping.month = filter.value;
        commitState({ skipForm: false });
      }
    });
  }
  const calendarFilter = document.getElementById('calendar-month-filter');
  if (calendarFilter) {
    calendarFilter.value = state.bookkeeping.month;
    calendarFilter.addEventListener('change', () => {
      if (calendarFilter.value) {
        state.bookkeeping.month = calendarFilter.value;
        commitState({ skipForm: false });
      }
    });
  }
}

function wireBookkeepingImportExport() {
  const exportBtn = document.getElementById('bookkeeping-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.bookkeeping, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bookkeeping-${state.bookkeeping.month}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      ui.toast('Export compta généré.');
    });
  }

  const importInput = document.getElementById('bookkeeping-import');
  if (importInput) {
    importInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        state.bookkeeping = normalizeBookkeeping(payload);
        commitState({ skipForm: false });
        ui.toast('Import compta réussi.');
      } catch (error) {
        console.error(error);
        ui.toast('Import compta impossible.', 'error');
      } finally {
        event.target.value = '';
      }
    });
  }
}

function wireCalendarNavigation() {
  const prev = document.getElementById('calendar-prev-month');
  const next = document.getElementById('calendar-next-month');
  const todayBtn = document.getElementById('calendar-today');
  if (prev) {
    prev.addEventListener('click', () => {
      state.bookkeeping.month = shiftMonth(state.bookkeeping.month, -1);
      commitState({ skipForm: false });
    });
  }
  if (next) {
    next.addEventListener('click', () => {
      state.bookkeeping.month = shiftMonth(state.bookkeeping.month, 1);
      commitState({ skipForm: false });
    });
  }
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      const now = new Date();
      state.bookkeeping.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      commitState({ skipForm: false });
    });
  }
}

function fillBookkeepingForm(entryId) {
  const form = document.getElementById('bookkeeping-form');
  if (!form) return;
  const entry = state.bookkeeping.entries.find((item) => item.id === entryId);
  if (!entry) return;
  form.dataset.editId = entry.id;
  form.querySelector('[name="entry-date"]').value = entry.date;
  form.querySelector('[name="entry-type"]').value = entry.type;
  form.querySelector('[name="entry-label"]').value = entry.label;
  form.querySelector('[name="entry-category"]').value = entry.category;
  form.querySelector('[name="entry-amount"]').value = entry.amount;
  form.querySelector('[name="entry-status"]').value = entry.status;
  form.querySelector('[name="entry-notes"]').value = entry.notes ?? '';
  const submitBtn = form.querySelector('[data-role="submit"]');
  if (submitBtn) submitBtn.textContent = 'Mettre à jour l’écriture';
  ui.toast('Écriture chargée pour modification.');
}

function resetBookkeepingForm() {
  const form = document.getElementById('bookkeeping-form');
  if (!form) return;
  form.reset();
  delete form.dataset.editId;
  const submitBtn = form.querySelector('[data-role="submit"]');
  if (submitBtn) submitBtn.textContent = 'Enregistrer l’écriture';
  const dateInput = form.querySelector('[name="entry-date"]');
  if (dateInput && state.bookkeeping?.month) {
    dateInput.value = `${state.bookkeeping.month}-01`;
  }
}

function updateMiscCharge(element) {
  const id = element.dataset.id;
  const labelInput = element.querySelector('input[type="text"]');
  const amountInput = element.querySelector('input[type="number"]');
  const charge = state.inputs.miscCharges.find((item) => item.id === id);
  if (!charge) return;
  charge.label = sanitizeText(labelInput.value || 'Charge');
  charge.amount = Math.max(0, parseNumber(amountInput.value));
  labelInput.value = charge.label;
  amountInput.value = charge.amount;
  commitState();
}

function updateDailyCourse(element) {
  const id = element.dataset.id;
  const labelInput = element.querySelector('input[data-field="label"]');
  const amountInput = element.querySelector('input[data-field="amount"]');
  const distanceInput = element.querySelector('input[data-field="distance"]');
  const course = state.inputs.dailyCourses.find((item) => item.id === id);
  if (!course) return;
  course.label = sanitizeText(labelInput.value || 'Course', 60);
  course.amount = Math.max(0, parseNumber(amountInput.value));
  course.distance = Math.max(0, parseNumber(distanceInput.value));
  labelInput.value = course.label;
  amountInput.value = course.amount;
  distanceInput.value = course.distance;
  commitState();
}

function commitState({ skipForm = true } = {}) {
  recalculate();
  storage.save();
  ui.renderAll({ skipForm });
}

export default { registerEventListeners };
