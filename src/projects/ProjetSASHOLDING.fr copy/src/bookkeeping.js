/**
 * bookkeeping.js
 * Ensemble d'utilitaires pour filtrer et agréger les écritures comptables simples.
 */
import { parseNumber } from './utils.js';

const MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre'
];

function getMonthDateRange(month) {
  if (!month || !month.match(/^\d{4}-\d{2}$/)) return null;
  const [year, monthStr] = month.split('-');
  const start = new Date(Number(year), Number(monthStr) - 1, 1);
  const end = new Date(Number(year), Number(monthStr), 1);
  return { start, end };
}

export function filterEntriesByMonth(entries = [], month) {
  const range = getMonthDateRange(month);
  if (!range) return entries;
  return (entries || []).filter((entry) => {
    const date = new Date(entry.date);
    return date >= range.start && date < range.end;
  });
}

export function summarizeMonth(entries = [], month) {
  const subset = filterEntriesByMonth(entries, month);
  return subset.reduce(
    (acc, entry) => {
      const amount = parseNumber(entry.amount);
      if (entry.type === 'income') {
        acc.income += amount;
      } else {
        acc.expense += amount;
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
}

export function groupEntriesByDate(entries = [], month) {
  const subset = filterEntriesByMonth(entries, month);
  return subset.reduce((acc, entry) => {
    const key = entry.date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
}

export function formatDateLabel(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTH_LABELS[date.getMonth()]}`;
}

export function formatMonthLabel(month) {
  if (!month || !month.match(/^\d{4}-\d{2}$/)) return '';
  const [year, monthStr] = month.split('-');
  const monthIndex = Number(monthStr) - 1;
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

export function buildCalendarMatrix(month, entries = []) {
  const range = getMonthDateRange(month);
  if (!range) return [];
  const firstDay = new Date(range.start);
  const firstWeekDay = (firstDay.getDay() + 6) % 7; // Monday = 0
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(calendarStart.getDate() - firstWeekDay);
  const weeks = [];
  const entriesByDate = groupEntriesByDate(entries, month);
  let cursor = new Date(calendarStart);
  for (let week = 0; week < 6; week += 1) {
    const days = [];
    for (let day = 0; day < 7; day += 1) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const dayEntries = entriesByDate[isoDate] || [];
      const income = dayEntries
        .filter((entry) => entry.type === 'income')
        .reduce((sum, entry) => sum + parseNumber(entry.amount), 0);
      const expense = dayEntries
        .filter((entry) => entry.type !== 'income')
        .reduce((sum, entry) => sum + parseNumber(entry.amount), 0);
      days.push({
        isoDate,
        label: cursor.getDate(),
        inMonth: cursor.getMonth() === range.start.getMonth(),
        isToday: isTodayDate(cursor),
        entries: dayEntries,
        income,
        expense
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

function isTodayDate(date) {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function shiftMonth(month, delta) {
  const range = getMonthDateRange(month);
  if (!range) return month;
  const target = new Date(range.start);
  target.setMonth(target.getMonth() + delta);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  filterEntriesByMonth,
  summarizeMonth,
  groupEntriesByDate,
  buildCalendarMatrix,
  formatMonthLabel,
  formatDateLabel,
  shiftMonth
};
