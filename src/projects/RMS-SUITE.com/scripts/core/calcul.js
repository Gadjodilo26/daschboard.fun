// Fonctions de calcul en centimes pour éviter les erreurs flottantes
const clamp = (value, min, max) =>
  Math.min(Math.max(Number(value) || 0, min), max);

const toCents = (value) =>
  Math.round((Number(String(value).replace(",", ".") || 0)) * 100);

const percentOf = (baseCents, percent) =>
  Math.round((baseCents * (Number(percent) || 0)) / 100);

// Retourne les lignes calculées et les totaux agrégés
export function calculateTotals(state) {
  const results = {
    items: [],
    totals: {
      subtotal: 0,
      discount: 0,
      shipping: 0,
      shippingVat: 0,
      vatLines: 0,
      vatTotal: 0,
      totalHT: 0,
      totalTTC: 0,
      deposit: 0,
      remaining: 0,
    },
    notes: {
      vat: "",
      discount: state.meta.discountNote || "",
    },
  };

  const vatExempt = Boolean(state.meta.vatExempt);
  if (vatExempt) {
    results.notes.vat =
      "TVA non applicable, article 293 B du CGI.";
  }

  let subtotal = 0;
  let vatTotal = 0;
  const effectiveItems = [];

  state.items.forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPriceCents = toCents(item.unitPrice);
    const vatRate = vatExempt ? 0 : clamp(item.vatRate, 0, 100);
    const lineHT = Math.round(quantity * unitPriceCents);
    const lineVat = Math.round((lineHT * vatRate) / 100);
    subtotal += lineHT;
    vatTotal += lineVat;

    effectiveItems.push({
      ...item,
      quantity,
      unitPriceCents,
      lineHT,
      lineVat,
    });
  });

  let discountCents = 0;
  if (state.options.discount.type === "percent") {
    discountCents = percentOf(
      subtotal,
      clamp(state.options.discount.percent, 0, 100)
    );
  } else if (state.options.discount.type === "amount") {
    discountCents = Math.min(
      subtotal,
      Math.max(0, toCents(state.options.discount.amount))
    );
  }

  const discountFactor =
    subtotal === 0 ? 0 : (subtotal - discountCents) / subtotal;

  vatTotal = 0;
  const itemsWithDiscount = effectiveItems.map((item) => {
    const discountShare = Math.round(item.lineHT * (1 - discountFactor));
    const discountedHT = item.lineHT - discountShare;
    const discountedVat = Math.round((discountedHT * item.vatRate) / 100);
    vatTotal += discountedVat;
    return { ...item, discountedHT, discountedVat };
  });

  const shippingCents = Math.max(0, toCents(state.options.shippingAmount));
  const shippingVatRate = vatExempt
    ? 0
    : clamp(state.options.shippingVat, 0, 100);
  const shippingVat = Math.round((shippingCents * shippingVatRate) / 100);

  const subtotalAfterDiscount =
    subtotal - discountCents + shippingCents;
  const totalVat = vatTotal + shippingVat;
  const totalHT = subtotalAfterDiscount;
  const totalTTC = totalHT + totalVat;

  let depositCents = 0;
  if (state.options.deposit.type === "percent") {
    depositCents = percentOf(
      totalTTC,
      clamp(state.options.deposit.percent, 0, 100)
    );
  } else if (state.options.deposit.type === "amount") {
    depositCents = Math.min(
      totalTTC,
      Math.max(0, toCents(state.options.deposit.amount))
    );
  }

  const remaining = Math.max(0, totalTTC - depositCents);

  results.items = itemsWithDiscount;
  results.totals = {
    subtotal,
    discount: discountCents,
    shipping: shippingCents,
    shippingVat,
    vatLines: vatTotal,
    vatTotal: totalVat,
    totalHT,
    totalTTC,
    deposit: depositCents,
    remaining,
  };

  return results;
}

// Mise en forme monétaire depuis un entier en centimes
export function centsToCurrency(cents, currency, locale) {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(cents / 100);
}

// Utilitaires de formatage numériques génériques
export function formatNumber(value, locale, options = {}) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...options,
  }).format(value);
}
