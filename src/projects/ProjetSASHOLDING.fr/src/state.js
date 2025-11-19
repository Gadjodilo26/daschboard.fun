/**
 * state.js
 * Définit `defaultInputs`, `state` et `normalizeInputs`.
 * TODO: compléter `defaultInputs()` et `normalizeInputs()` en copiant la logique depuis `app.js`.
 */
import { sanitizeText, parseNumber, uuid } from './utils.js';
import {
  MEAL_ALLOWANCE_PER_DAY,
  LICENSE_UNIT_COST,
  SSI_DEFAULT_RATE,
  BOOKKEEPING_CATEGORIES,
  BOOKKEEPING_STATUSES
} from './config/constants.js';

export const defaultInputs = () => ({
  companyName: 'Atelier Entreprendre',
  managerName: 'Camille Durand',
  mainClient: 'Client pilote',
  contractStability: 'cadre',
  vehiclePrice: 80000,
  personalContribution: 15000,
  loanRate: 3.2,
  loanDurationYears: 5,
  amortizationYears: 5,
  licensesCount: 1,
  licenseCost: LICENSE_UNIT_COST,
  monthlyLoanPayment: 0,
  advanceTreasury: 0,
  workingDays: 20,
  dailyRevenue: 850,
  kmAllowanceRate: 0.35,
  dailyCourses: createDefaultDailyCourses(),
  surcharges: 500,
  fuel: 1200,
  insurance: 350,
  maintenance: 250,
  tolls: 400,
  otherCharges: 300,
  miscCharges: [
    { id: uuid(), label: 'Télécom & logiciels', amount: 120 },
    { id: uuid(), label: 'Honoraires comptables', amount: 150 }
  ],
  mealAllowanceRate: MEAL_ALLOWANCE_PER_DAY,
  mealAllowance: 0,
  netRemuneration: 2500,
  ssiRate: SSI_DEFAULT_RATE,
  tnsMinContribution: 300,
  coldPrime: 0,
  growthRate: 5,
  inflationRate: 2,
  fiscalRegime: 'reel', // or micro
  isOption: false,
  vatFranchise: true,
  vatRate: 20,
  heavyVehicleTax: 0,
  ecoTax: 0,
  clientPaymentDelay: 45,
  supplierPaymentDelay: 15
});

function currentISODate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const defaultBookkeepingEntry = (overrides = {}) => {
  const type = overrides.type === 'income' ? 'income' : 'expense';
  const category = BOOKKEEPING_CATEGORIES.includes(overrides.category)
    ? overrides.category
    : type === 'income'
      ? 'Revenus principaux'
      : 'Autre charge';
  const status = BOOKKEEPING_STATUSES.includes(overrides.status) ? overrides.status : 'enregistré';
  return {
    id: overrides.id || uuid(),
    date: overrides.date || currentISODate(),
    type,
    label: sanitizeText(overrides.label || 'Nouvelle écriture', 80),
    category,
    amount: Math.max(0, parseNumber(overrides.amount || 0)),
    notes: sanitizeText(overrides.notes || '', 240),
    status
  };
};

export const defaultBookkeepingState = () => {
  const month = currentMonthString();
  return {
    month,
    entries: [
      defaultBookkeepingEntry({
        date: `${month}-03`,
        type: 'income',
        label: 'Facture client pilote',
        amount: 16500,
        category: 'Revenus principaux',
        status: 'payé'
      }),
      defaultBookkeepingEntry({
        date: `${month}-05`,
        type: 'expense',
        label: 'Consommables & énergie',
        amount: 2400,
        category: 'Fournitures & production',
        status: 'payé'
      }),
      defaultBookkeepingEntry({
        date: `${month}-12`,
        type: 'expense',
        label: 'Déplacements commerciaux',
        amount: 480,
        category: 'Logistique & déplacements',
        status: 'enregistré'
      })
    ]
  };
};

export const state = {
  currentPage: typeof document !== 'undefined' ? document.body.dataset.page || 'landing' : 'landing',
  autoSaveEnabled: true,
  inputs: defaultInputs(),
  results: { monthly: null, projection: null, loan: null, ratios: null },
  bookkeeping: defaultBookkeepingState()
};

export function normalizeInputs(payload) {
  const base = defaultInputs();
  const inputs = { ...base, ...(payload || {}) };
  inputs.companyName = sanitizeText(inputs.companyName, 80);
  inputs.managerName = sanitizeText(inputs.managerName, 60);
  inputs.mainClient = sanitizeText(inputs.mainClient, 60);
  inputs.contractStability = ['cadre', 'renouvelable', 'annuel'].includes(inputs.contractStability)
    ? inputs.contractStability
    : 'cadre';
  inputs.licensesCount = Math.max(1, Math.round(parseNumber(inputs.licensesCount)));
  inputs.licenseCost = Math.max(0, parseNumber(inputs.licenseCost) || LICENSE_UNIT_COST);
  inputs.mealAllowanceRate =
    parseNumber(inputs.mealAllowanceRate) > 0 ? parseNumber(inputs.mealAllowanceRate) : MEAL_ALLOWANCE_PER_DAY;
  inputs.miscCharges = (inputs.miscCharges || []).map((charge) => ({
    id: charge.id || uuid(),
    label: sanitizeText(charge.label || 'Charge'),
    amount: Math.max(0, parseNumber(charge.amount))
  }));
  inputs.dailyCourses = normalizeDailyCourses(inputs.dailyCourses);
  inputs.kmAllowanceRate = Math.max(0, parseNumber(inputs.kmAllowanceRate));
  inputs.tnsMinContribution = Math.max(0, parseNumber(inputs.tnsMinContribution));
  inputs.fiscalRegime = ['micro', 'reel'].includes(inputs.fiscalRegime) ? inputs.fiscalRegime : 'reel';
  inputs.isOption = Boolean(inputs.isOption);
  inputs.vatFranchise = Boolean(inputs.vatFranchise);
  inputs.vatRate = Math.max(0, parseNumber(inputs.vatRate) || 0);
  inputs.heavyVehicleTax = Math.max(0, parseNumber(inputs.heavyVehicleTax));
  inputs.ecoTax = Math.max(0, parseNumber(inputs.ecoTax));
  inputs.clientPaymentDelay = Math.max(0, parseNumber(inputs.clientPaymentDelay));
  inputs.supplierPaymentDelay = Math.max(0, parseNumber(inputs.supplierPaymentDelay));
  return inputs;
}

function normalizeBookkeepingEntry(entry) {
  if (!entry) return defaultBookkeepingEntry();
  return defaultBookkeepingEntry({
    ...entry,
    date: typeof entry.date === 'string' && entry.date.match(/^\d{4}-\d{2}-\d{2}$/)
      ? entry.date
      : currentISODate(),
    amount: parseNumber(entry.amount)
  });
}

export function normalizeBookkeeping(payload) {
  const base = defaultBookkeepingState();
  const entries = Array.isArray(payload?.entries) ? payload.entries.map(normalizeBookkeepingEntry) : base.entries;
  const month = typeof payload?.month === 'string' && payload.month.match(/^\d{4}-\d{2}$/)
    ? payload.month
    : base.month;
  return {
    month,
    entries
  };
}

function createDefaultDailyCourses() {
  return [
    { id: uuid(), label: 'Course matin', amount: 320, distance: 220 },
    { id: uuid(), label: 'Course après-midi', amount: 262, distance: 180 },
    { id: uuid(), label: 'Course additionnelle', amount: 100, distance: 80 }
  ];
}

function normalizeDailyCourses(courses) {
  if (!Array.isArray(courses)) {
    return createDefaultDailyCourses();
  }
  return courses.map((course, index) => ({
    id: course?.id || uuid(),
    label: sanitizeText(course?.label || `Course ${index + 1}`, 60),
    amount: Math.max(0, parseNumber(course?.amount)),
    distance: Math.max(0, parseNumber(course?.distance))
  }));

}

export default state;
