/**
 * config/constants.js
 * Point centralisé pour toutes les constantes métier afin de garder l'application
 * cohérente et faciliter leur maintenance/documentation.
 */
export const MEAL_ALLOWANCE_PER_DAY = 17.5;
export const COLD_PRIME_RATE = 0.05;
export const SSI_DEFAULT_RATE = 45;
export const INTERESSEMENT_RATE = 0.03;
export const LICENSE_UNIT_COST = 1800;
export const BORROWER_INSURANCE_RATE = 0.0045; // 0.45 % annuel pour profil de risque standard

export const BOOKKEEPING_CATEGORIES = [
  'Revenus principaux',
  'Autres revenus',
  'Marketing & acquisition',
  'Fournitures & production',
  'Abonnements & logiciels',
  'Logistique & déplacements',
  'Assurances',
  'Salaires & charges',
  'Honoraires & conseils',
  'Investissements & matériel',
  'Autre charge'
];

export const BOOKKEEPING_STATUSES = ['prévu', 'enregistré', 'payé'];

export const STORAGE_KEY = 'atelier-entreprendre';
export const LEGACY_STORAGE_KEYS = ['bp-eurl-transport'];

// Configuration de l'application courante
export const DAILY_WORKING_DAYS_MAX = 31;
export const DAILY_WORKING_DAYS_MIN = 0;

export default {
  MEAL_ALLOWANCE_PER_DAY,
  COLD_PRIME_RATE,
  SSI_DEFAULT_RATE,
  INTERESSEMENT_RATE,
  LICENSE_UNIT_COST,
  BORROWER_INSURANCE_RATE,
  BOOKKEEPING_CATEGORIES,
  BOOKKEEPING_STATUSES,
  LEGACY_STORAGE_KEYS,
  STORAGE_KEY,
  DAILY_WORKING_DAYS_MAX,
  DAILY_WORKING_DAYS_MIN
};
