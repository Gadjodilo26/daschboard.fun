/**
 * utils.js
 * Petits utilitaires partagés : parseNumber, sanitizeText, formatters, uuid, etc.
 * Ces helpers restent dénués de logique métier (voir config/constants.js pour les constantes).
 */

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
});

const currencyDetailedFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function formatCurrency(value, detailed = false) {
  return detailed ? currencyDetailedFormatter.format(value) : currencyFormatter.format(value);
}

export function formatPercent(value) {
  if (value === null || Number.isNaN(value)) return 'n/a';
  return percentFormatter.format(value);
}

export function formatMultiple(value) {
  if (value === null || Number.isNaN(value)) return 'n/a';
  return `${value.toFixed(2)}x`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function withTooltip(value, tooltip) {
  if (!tooltip) return value;
  return `<span class="tooltip" tabindex="0" data-tooltip="${escapeHtml(tooltip)}">${value}</span>`;
}

export function parseNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function sanitizeText(value, max = 120) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function uuid() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default {
  parseNumber,
  formatCurrency,
  formatPercent,
  sanitizeText,
  uuid,
  clamp,
  escapeHtml,
  formatMultiple,
  withTooltip
};
