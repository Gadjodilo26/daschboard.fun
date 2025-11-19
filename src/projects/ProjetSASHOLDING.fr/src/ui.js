/**
 * ui.js
 * Squelette pour les fonctions d'affichage et d'interaction avec le DOM.
 * Codex : copiez les méthodes ui.* depuis `app.js` et adaptez les imports.
 */
import { state } from './state.js';
import { calc } from './calc.js';
import { storage } from './storage.js';
import { formatCurrency, formatPercent, withTooltip, escapeHtml, formatMultiple, parseNumber } from './utils.js';
import { summarizeMonth, filterEntriesByMonth, formatDateLabel, formatMonthLabel, buildCalendarMatrix } from './bookkeeping.js';
import { BOOKKEEPING_STATUSES } from './config/constants.js';

export const ui = {
  renderAll(options = {}) {
    const { skipForm = false } = options;
    const page = state.currentPage;
    this.renderAutosave();
    switch (page) {
      case 'simulation':
        if (!skipForm) {
          this.renderForm();
        } else {
          this.updateComputedInputs();
        }
        this.renderMonthlySummary();
        this.renderInvestmentSummary();
        this.renderTreasurySummary();
        break;
      case 'projection':
        this.renderProjection();
        this.renderTreasurySummary();
        this.renderChart();
        break;
      case 'financing':
        this.renderInvestmentSummary();
        this.renderTreasurySummary();
        this.renderLoan();
        break;
      case 'summary':
        this.renderExecutiveSummary();
        this.renderSummaryOverview();
        this.renderRatios();
        this.renderFiscalSummary();
        this.renderTreasurySummary();
        break;
      case 'bookkeeping':
        this.renderBookkeepingSummary();
        this.renderBookkeepingEntries();
        break;
      case 'calendar':
        this.renderBookkeepingSummary();
        this.renderCalendarView();
        break;
      case 'exports':
        // nothing specific to render beyond autosave
        break;
      default:
        break;
    }
  },

  renderAutosave() {
    const button = document.getElementById('toggle-autosave');
    if (!button) return;
    button.setAttribute('aria-pressed', state.autoSaveEnabled ? 'true' : 'false');
  },

  renderForm() {
    const formEntries = {
      'input-company-name': state.inputs.companyName,
      'input-manager-name': state.inputs.managerName,
      'input-main-client': state.inputs.mainClient,
      'input-contract-stability': state.inputs.contractStability,
      'input-vehicle-price': state.inputs.vehiclePrice,
      'input-personal-contribution': state.inputs.personalContribution,
      'input-loan-rate': state.inputs.loanRate,
      'input-loan-duration': state.inputs.loanDurationYears,
      'input-amortization-years': state.inputs.amortizationYears,
      'input-licenses-count': state.inputs.licensesCount,
      'input-license-cost': state.inputs.licenseCost,
      'input-monthly-loan-payment': Math.round(state.inputs.monthlyLoanPayment),
      'input-advance-treasury': Math.round(state.inputs.advanceTreasury),
      'input-working-days': state.inputs.workingDays,
      'input-daily-revenue': state.inputs.dailyRevenue,
      'input-km-allowance-rate': state.inputs.kmAllowanceRate,
      'input-surcharges': state.inputs.surcharges,
      'input-fuel': state.inputs.fuel,
      'input-insurance': state.inputs.insurance,
      'input-maintenance': state.inputs.maintenance,
      'input-tolls': state.inputs.tolls,
      'input-other-charges': state.inputs.otherCharges,
      'input-meal-allowance-rate': state.inputs.mealAllowanceRate,
      'input-meal-allowance': Math.round(state.inputs.mealAllowance),
      'input-net-remuneration': state.inputs.netRemuneration,
      'input-ssi-rate': state.inputs.ssiRate,
      'input-tns-min-contribution': state.inputs.tnsMinContribution,
      'input-cold-prime': Math.round(state.inputs.coldPrime),
      'input-growth-rate': state.inputs.growthRate,
      'input-inflation-rate': state.inputs.inflationRate,
      'input-fiscal-regime': state.inputs.fiscalRegime,
      'input-is-option': state.inputs.isOption,
      'input-vat-franchise': state.inputs.vatFranchise,
      'input-vat-rate': state.inputs.vatRate,
      'input-heavy-vehicle-tax': state.inputs.heavyVehicleTax,
      'input-eco-tax': state.inputs.ecoTax,
      'input-client-delay': state.inputs.clientPaymentDelay,
      'input-supplier-delay': state.inputs.supplierPaymentDelay
    };

    Object.entries(formEntries).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (element.type === 'checkbox') {
        element.checked = Boolean(value);
      } else if (element.tagName === 'SELECT') {
        element.value = value;
      } else if (element.matches('input[type="number"]')) {
        element.value = Number.isFinite(value) ? value : '';
      } else {
        element.value = value ?? '';
      }
    });
    this.renderMiscCharges();
    this.renderDailyCourses();
    this.updateComputedInputs();
  },

  renderMiscCharges() {
    const container = document.getElementById('misc-charges');
    if (!container) return;
    container.innerHTML = '';
    (state.inputs.miscCharges || []).forEach((charge) => {
      const row = document.createElement('div');
      row.className = 'dynamic-list__item';
      row.dataset.id = charge.id;
      row.innerHTML = `
        <input type="text" value="${escapeHtml(charge.label)}" aria-label="Libellé charge">
        <input type="number" value="${charge.amount}" step="10" aria-label="Montant charge">
        <button type="button" class="btn btn--ghost btn--small" data-action="remove">Supprimer</button>
      `;
      container.appendChild(row);
    });
    if (!state.inputs.miscCharges || state.inputs.miscCharges.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'form__hint';
      empty.textContent = 'Ajoutez vos charges complémentaires (par exemple, frais bancaires, fournitures…).';
      container.appendChild(empty);
    }
  },

  renderDailyCourses() {
    const container = document.getElementById('daily-courses');
    if (!container) return;
    container.innerHTML = '';
    const courses = state.inputs.dailyCourses || [];
    courses.forEach((course, index) => {
      const row = document.createElement('div');
      row.className = 'dynamic-list__item';
      row.dataset.id = course.id;
      row.innerHTML = `
        <input type="text" value="${escapeHtml(course.label)}" data-field="label" aria-label="Libellé course ${index + 1}">
        <input type="number" value="${course.amount}" data-field="amount" step="10" aria-label="Montant hors indemnité">
        <input type="number" value="${course.distance}" data-field="distance" step="1" aria-label="Kilomètres parcourus">
        <button type="button" class="btn btn--ghost btn--small" data-action="remove">Supprimer</button>
      `;
      container.appendChild(row);
    });
    if (courses.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'form__hint';
      empty.textContent = 'Ajoutez vos courses quotidiennes pour détailler le chiffre d\'affaires journalier.';
      container.appendChild(empty);
    }
  },

  updateComputedInputs() {
    const computedEntries = {
      'input-monthly-loan-payment': Math.round(state.inputs.monthlyLoanPayment),
      'input-advance-treasury': Math.round(state.inputs.advanceTreasury),
      'input-meal-allowance': Math.round(state.inputs.mealAllowance),
      'input-cold-prime': Math.round(state.inputs.coldPrime)
    };
    Object.entries(computedEntries).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.value = Number.isFinite(value) ? value : '';
    });
    this.updateDailyCourseSummary();
  },

  updateDailyCourseSummary() {
    const total = calc.dailyCourseTotal(state.inputs);
    const totalInput = document.getElementById('input-daily-course-total');
    if (totalInput) {
      totalInput.value = formatCurrency(total, true);
    }
    const applyBtn = document.getElementById('btn-apply-daily-revenue');
    if (applyBtn) {
      applyBtn.disabled = (state.inputs.dailyCourses || []).length === 0;
    }
  },

  renderMonthlySummary() {
    const host = document.getElementById('monthly-summary');
    if (!host || !state.results.monthly) return;
    const {
      revenue,
      operatingCharges,
      operatingChargesDisplay,
      resultBeforeTax,
      incomeTax,
      netResult,
      caf,
      marginNet,
      solvencyRatio,
      advanceTreasury,
      personalContribution,
      totalNeeds,
      debtService
    } =
      state.results.monthly;

    host.innerHTML = `
      <dt>Chiffre d'affaires mensuel</dt><dd>${withTooltip(
        formatCurrency(revenue),
        "Recettes facturées sur un mois : jours facturés x CA journalier + surcharges."
      )}</dd>
      <dt>Charges d'exploitation (cash)</dt><dd>${withTooltip(
        formatCurrency(operatingChargesDisplay),
        "Charges mensuelles incluant salaire net, SSI, prime froid, charges variables et mensualité de crédit (assurance comprise)."
      )}</dd>
      <dt>Charges d'exploitation (comptable)</dt><dd>${withTooltip(
        formatCurrency(operatingCharges),
        "Charges opérationnelles hors remboursement de capital : carburant, entretien, charges détaillées, salaire net, prime froid, SSI."
      )}</dd>
      <dt>Résultat avant impôt</dt><dd>${withTooltip(
        formatCurrency(resultBeforeTax),
        "Marge après charges d'exploitation, amortissement et intérêts bancaires, avant impôt personnel."
      )}</dd>
      <dt>Impôt sur le revenu (estim.)</dt><dd>${withTooltip(
        formatCurrency(incomeTax),
        "Estimation mensuelle de l'impôt sur le revenu du gérant (barème simplifié)."
      )}</dd>
      <dt>Résultat net</dt><dd>${withTooltip(
        formatCurrency(netResult),
        "Résultat après impôt et après prime d'intéressement conventionnelle (3 % du résultat net)."
      )}</dd>
      <dt>Capacité d'autofinancement</dt><dd>${withTooltip(
        formatCurrency(caf),
        "Résultat net + amortissement : indicateur clé pour financer dettes et investissements."
      )}</dd>
      <dt>Mensualité (assurance incl.)</dt><dd>${withTooltip(
        formatCurrency(debtService),
        "Remboursement mensuel du prêt incluant l'assurance emprunteur."
      )}</dd>
      <dt>Marge nette</dt><dd>${withTooltip(
        formatPercent(marginNet),
        "Résultat net rapporté au chiffre d'affaires : mesure de rentabilité globale."
      )}</dd>
      <dt>Besoin en fonds de roulement (2 mois)</dt><dd>${withTooltip(
        formatCurrency(advanceTreasury),
        "Coussin de trésorerie couvrant deux mois de charges opérationnelles (charges variables + rémunération + cotisations) ajusté des délais clients/fournisseurs."
      )}</dd>
      <dt>Ratio solvabilité (apport/besoins)</dt><dd>${withTooltip(
        formatPercent(solvencyRatio),
        personalContribution > 0
          ? `Apport (${formatCurrency(personalContribution)}) / besoins (${formatCurrency(totalNeeds)}). Viser ≥ 30 .`
          : "Apport personnel non renseigné : indiquez un montant d'apport pour calculer ce ratio."
      )}</dd>
    `;
  },

  renderInvestmentSummary() {
    const host = document.getElementById('investment-summary');
    if (!host || !state.results.monthly || !state.results.loan) return;
    const { advanceTreasury, totalNeeds, personalContribution } = state.results.monthly;
    const { amount: loanAmount, totalInterest, totalCost } = state.results.loan;
    const licensesCost = parseNumber(state.inputs.licenseCost) * parseNumber(state.inputs.licensesCount);
    const financingGap = totalNeeds - personalContribution;

    host.innerHTML = `
      <dt>Investissement principal</dt><dd>${withTooltip(
        formatCurrency(state.inputs.vehiclePrice),
        "Valeur TTC du matériel clé, du local, du MVP ou du fonds de commerce à financer."
      )}</dd>
      <dt>Actifs immatériels &amp; licences</dt><dd>${withTooltip(
        formatCurrency(licensesCost),
        "Montant des licences, formations, droits d'entrée ou achats immatériels nécessaires au lancement."
      )}</dd>
      <dt>Besoin fonds de roulement</dt><dd>${withTooltip(
        formatCurrency(advanceTreasury),
        "Trésorerie nécessaire pour absorber 2 mois de charges opérationnelles, incluant les décalages clients/fournisseurs."
      )}</dd>
      <dt>Besoin total</dt><dd>${withTooltip(
        formatCurrency(totalNeeds),
        "Somme investissement + licences + BFR : besoins à couvrir par apport + emprunt."
      )}</dd>
      <dt>Apport personnel</dt><dd>${withTooltip(
        formatCurrency(personalContribution),
        "Fonds propres injectés par le gérant (épargne, aides, love money…)."
      )}</dd>
      <dt>Financement bancaire demandé</dt><dd>${withTooltip(
        formatCurrency(loanAmount),
        "Montant du prêt couvrant investissement, immatériel et besoin en fonds de roulement (après apport)."
      )}</dd>
      <dt>Dont BFR financé</dt><dd>${withTooltip(
        formatCurrency(advanceTreasury),
        "Part du prêt dédiée au besoin en fonds de roulement."
      )}</dd>
      <dt>Coût total du prêt</dt><dd>${withTooltip(
        formatCurrency(totalCost),
        "Capital + intérêts sur toute la durée du financement."
      )}</dd>
      <dt>Intérêts cumulés</dt><dd>${withTooltip(
        formatCurrency(totalInterest),
        "Somme des intérêts versés à la banque pendant la durée du prêt."
      )}</dd>
      <dt>Solde financement</dt><dd>${withTooltip(
        formatCurrency(financingGap),
        "Besoins restants après apport : correspond au financement bancaire à assurer."
      )}</dd>
    `;
  },

  renderTreasurySummary() {
    const host = document.getElementById('treasury-summary');
    if (!host || !state.results.projection) return;
    const delayBfr = state.results.monthly?.delayBfr ?? 0;
    const { initialCash, years } = state.results.projection;
    const year1 = years[0]?.treasuryEnd ?? 0;
    const year2 = years[1]?.treasuryEnd ?? year1;
    const year3 = years[2]?.treasuryEnd ?? year2;
    const accumulation = year3 - initialCash;

    host.innerHTML = `
      <dt>Trésorerie initiale (BFR)</dt><dd>${withTooltip(
        formatCurrency(initialCash),
        "Montant du besoin en fonds de roulement financé et disponible dès le démarrage."
      )}</dd>
      <dt>Complément BFR (délais)</dt><dd>${withTooltip(
        formatCurrency(delayBfr),
        "Effet net des délais clients et fournisseurs intégré dans le besoin de fonds de roulement."
      )}</dd>
      <dt>Fin année 1</dt><dd>${withTooltip(
        formatCurrency(year1),
        "Trésorerie cumulée après 12 mois d'activité."
      )}</dd>
      <dt>Fin année 2</dt><dd>${withTooltip(
        formatCurrency(year2),
        "Trésorerie cumulée après 24 mois."
      )}</dd>
      <dt>Fin année 3</dt><dd>${withTooltip(
        formatCurrency(year3),
        "Trésorerie cumulée après 36 mois."
      )}</dd>
      <dt>Capital constitué (3 ans)</dt><dd>${withTooltip(
        formatCurrency(accumulation),
        "Enrichissement net sur la période (Trésorerie fin année 3 - trésorerie initiale)."
      )}</dd>
    `;
  },

  renderBookkeepingSummary() {
    const host = document.getElementById('bookkeeping-summary');
    if (!host || !state.bookkeeping) return;
    const totals = summarizeMonth(state.bookkeeping.entries, state.bookkeeping.month);
    const label = formatMonthLabel(state.bookkeeping.month) || state.bookkeeping.month;
    host.innerHTML = `
      <div class="metric-card">
        <p class="metric-card__label">Revenus (${label})</p>
        <p class="metric-card__value metric-card__value--positive">${formatCurrency(totals.income)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-card__label">Dépenses (${label})</p>
        <p class="metric-card__value metric-card__value--negative">${formatCurrency(totals.expense)}</p>
      </div>
      <div class="metric-card">
        <p class="metric-card__label">Résultat net</p>
        <p class="metric-card__value">${formatCurrency(totals.net)}</p>
      </div>
    `;
    const monthLabel = document.getElementById('bookkeeping-month-label');
    if (monthLabel) {
      monthLabel.textContent = label;
    }
    const calendarLabel = document.getElementById('calendar-month-label');
    if (calendarLabel) {
      calendarLabel.textContent = label;
    }
  },

  renderBookkeepingEntries() {
    const host = document.getElementById('bookkeeping-entries');
    if (!host || !state.bookkeeping) return;
    const entries = filterEntriesByMonth(state.bookkeeping.entries, state.bookkeeping.month);
    if (!entries.length) {
      host.innerHTML = '<p class="form__hint">Aucun mouvement pour ce mois. Ajoutez vos factures et encaissements ci-dessus.</p>';
      return;
    }
    const rows = entries
      .map((entry) => {
        const notes = entry.notes ? `<small class="table__notes">${escapeHtml(entry.notes)}</small>` : '';
        const amountClass = entry.type === 'income' ? 'is-income' : 'is-expense';
        const statusOptions = BOOKKEEPING_STATUSES.map(
          (status) => `<option value="${status}" ${entry.status === status ? 'selected' : ''}>${status}</option>`
        ).join('');
        return `
          <tr data-entry-id="${entry.id}">
            <td>
              <strong>${formatDateLabel(entry.date)}</strong>
              <span class="table__muted">${escapeHtml(entry.category)}</span>
            </td>
            <td>
              <span>${escapeHtml(entry.label)}</span>
              ${notes}
            </td>
            <td>
              <span class="amount ${amountClass}">${entry.type === 'income' ? '+' : '-'}${formatCurrency(entry.amount)}</span>
            </td>
            <td>
              <select data-entry-status data-entry-id="${entry.id}">
                ${statusOptions}
              </select>
            </td>
            <td class="table__actions">
              <button type="button" class="btn btn--ghost btn--small" data-action="edit" data-id="${entry.id}">Modifier</button>
              <button type="button" class="btn btn--ghost btn--small" data-action="remove" data-id="${entry.id}">Supprimer</button>
            </td>
          </tr>
        `;
      })
      .join('');
    host.innerHTML = `
      <div class="table table--bookkeeping">
        <table>
          <thead>
            <tr>
              <th>Date / Catégorie</th>
              <th>Libellé</th>
              <th>Montant</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  renderCalendarView() {
    const host = document.getElementById('bookkeeping-calendar');
    if (!host || !state.bookkeeping) return;
    const weeks = buildCalendarMatrix(state.bookkeeping.month, state.bookkeeping.entries);
    if (!weeks.length) {
      host.innerHTML = '<p class="form__hint">Choisissez un mois valide pour afficher le calendrier.</p>';
      return;
    }
    const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const grid = weeks
      .map(
        (days) =>
          days
            .map((day) => {
              const classes = ['calendar__day'];
              if (!day.inMonth) classes.push('is-muted');
              if (day.isToday) classes.push('is-today');
              const entriesList = day.entries
                .map(
                  (entry) => `
                    <li>
                      <span>${escapeHtml(entry.label)}</span>
                      <span class="amount ${entry.type === 'income' ? 'is-income' : 'is-expense'}">
                        ${entry.type === 'income' ? '+' : '-'}${formatCurrency(entry.amount)}
                      </span>
                    </li>
                  `
                )
                .join('');
              return `
                <div class="${classes.join(' ')}">
                  <header>
                    <span class="calendar__day-number">${day.label}</span>
                    <span class="calendar__totals">
                      ${day.income ? `<span class="tag tag--income">+${formatCurrency(day.income)}</span>` : ''}
                      ${day.expense ? `<span class="tag tag--expense">-${formatCurrency(day.expense)}</span>` : ''}
                    </span>
                  </header>
                  <details ${day.entries.length ? '' : 'open'}>
                    <summary>${day.entries.length ? `${day.entries.length} mouvement${day.entries.length > 1 ? 's' : ''}` : 'Aucun mouvement'}</summary>
                    <ul class="calendar__list">
                      ${entriesList || '<li class="calendar__empty">Aucune écriture</li>'}
                    </ul>
                  </details>
                </div>
              `;
            })
            .join('')
      )
      .join('');
    host.innerHTML = `
      <div class="calendar__weekdays">
        ${weekdays.map((day) => `<span>${day}</span>`).join('')}
      </div>
      <div class="calendar__grid">${grid}</div>
    `;
  },

  renderProjection() {
    const tbody = document.getElementById('projection-yearly');
    if (!tbody || !state.results.projection) return;
    tbody.innerHTML = state.results.projection.years
      .map(
        (row) => `
        <tr>
          <td>Année ${row.year}</td>
          <td>${formatCurrency(row.revenue)}</td>
          <td>${formatCurrency(row.charges)}</td>
          <td>${formatCurrency(row.resultBeforeTax)}</td>
          <td>${formatCurrency(row.caf)}</td>
          <td>${formatCurrency(row.treasuryEnd)}</td>
        </tr>
      `
      )
      .join('');
  },

  renderSummaryOverview() {
    const monthlyHost = document.getElementById('summary-monthly-print');
    const financingHost = document.getElementById('summary-financing-print');
    const treasuryHost = document.getElementById('summary-treasury-print');
    const { monthly, loan, projection } = state.results;
    if (monthlyHost && monthly) {
      monthlyHost.innerHTML = `
        <dt>CA mensuel</dt><dd>${formatCurrency(monthly.revenue)}</dd>
        <dt>Charges d'exploitation</dt><dd>${formatCurrency(monthly.operatingChargesDisplay)}</dd>
        <dt>Résultat net</dt><dd>${formatCurrency(monthly.netResult)}</dd>
        <dt>CAF mensuelle</dt><dd>${formatCurrency(monthly.caf)}</dd>
        <dt>Mensualité (assurance incl.)</dt><dd>${formatCurrency(monthly.debtService)}</dd>
        <dt>BFR 2 mois</dt><dd>${formatCurrency(monthly.advanceTreasury)}</dd>
      `;
    }
    if (financingHost && monthly && loan) {
      const licensesCost = parseNumber(state.inputs.licenseCost) * parseNumber(state.inputs.licensesCount);
      financingHost.innerHTML = `
        <dt>Investissement principal</dt><dd>${formatCurrency(state.inputs.vehiclePrice)}</dd>
        <dt>Actifs immatériels</dt><dd>${formatCurrency(licensesCost)}</dd>
        <dt>BFR (2 mois)</dt><dd>${formatCurrency(monthly.advanceTreasury)}</dd>
        <dt>Apport</dt><dd>${formatCurrency(monthly.personalContribution)}</dd>
        <dt>Prêt sollicité</dt><dd>${formatCurrency(loan.amount)}</dd>
        <dt>Dont BFR financé</dt><dd>${formatCurrency(monthly.advanceTreasury)}</dd>
      `;
    }
    if (treasuryHost && projection) {
      const { initialCash, years } = projection;
      const year1 = years[0]?.treasuryEnd ?? 0;
      const year2 = years[1]?.treasuryEnd ?? year1;
      const year3 = years[2]?.treasuryEnd ?? year2;
      treasuryHost.innerHTML = `
        <dt>Trésorerie initiale (BFR)</dt><dd>${formatCurrency(initialCash)}</dd>
        <dt>Fin année 1</dt><dd>${formatCurrency(year1)}</dd>
        <dt>Fin année 2</dt><dd>${formatCurrency(year2)}</dd>
        <dt>Fin année 3</dt><dd>${formatCurrency(year3)}</dd>
      `;
    }
  },

  renderLoan() {
    const tbody = document.getElementById('loan-schedule-table');
    const overview = document.getElementById('loan-overview');
    if (!tbody || !overview || !state.results.loan) return;
    const rows = state.results.loan.schedule.slice(0, 36).map(
      (row) => `
        <tr>
          <td>M${row.month}</td>
          <td>${formatCurrency(row.payment + state.results.loan.monthlyInsurance)}</td>
          <td>${formatCurrency(row.interest)}</td>
          <td>${formatCurrency(row.principal)}</td>
          <td>${formatCurrency(row.balance)}</td>
        </tr>
      `
    );
    tbody.innerHTML = rows.join('');

    overview.innerHTML = `
      <dt>Montant emprunté</dt><dd>${formatCurrency(state.results.loan.amount)}</dd>
      <dt>Mensualité (avec assurance)</dt><dd>${formatCurrency(state.results.loan.monthlyPayment)}</dd>
      <dt>Assurance emprunteur</dt><dd>${formatCurrency(state.results.loan.monthlyInsurance)}</dd>
      <dt>Durée</dt><dd>${state.results.loan.durationMonths} mois</dd>
      <dt>Intérêts totaux</dt><dd>${formatCurrency(state.results.loan.totalInterest)}</dd>
      <dt>Assurance totale emprunteur</dt><dd>${formatCurrency(state.results.loan.totalInsurance)}</dd>
      <dt>Coût global (intérêts + assurance)</dt><dd>${formatCurrency(state.results.loan.totalCost)}</dd>
    `;
  },

  renderExecutiveSummary() {
    const target = document.getElementById('executive-summary-text');
    if (!target) return;
    const stabilityMap = {
      cadre: 'contrat-cadre de 3 ans',
      renouvelable: 'contrat renouvelable tacitement',
      annuel: 'engagement annuel reconductible'
    };
    const { companyName, managerName, mainClient, contractStability } = state.inputs;
    const { loan } = state.results;
    const { monthly } = state.results;
    if (!loan || !monthly) return;

    const clientLabel = mainClient || 'son client pilote';
    target.textContent = `${companyName} est porté par ${managerName}. Le client principal, ${clientLabel}, s'engage via un ${stabilityMap[contractStability]}. Avec un investissement de ${formatCurrency(state.inputs.vehiclePrice)} financé à hauteur de ${formatCurrency(loan.amount)} et une capacité d'autofinancement mensuelle de ${formatCurrency(monthly.caf)}, le projet démontre une couverture confortable du service de la dette et une trésorerie positive dès les premières années.`;
  },

  renderRatios() {
    const ratioList = document.getElementById('ratio-list');
    const bankerList = document.getElementById('banker-analysis');
    if (!ratioList || !bankerList || !state.results.ratios) return;
    const ratios = state.results.ratios;
    const { personalContribution, totalNeeds } = state.results.monthly;

    ratioList.innerHTML = `
      <dt>CAF annuelle</dt><dd>${withTooltip(
        formatCurrency(ratios.cafAnnual),
        "Capacité d'autofinancement sur 12 mois : résultat net + amortissements. Sert à payer les annuités d'emprunt."
      )}</dd>
      <dt>Résultat net annuel</dt><dd>${withTooltip(
        formatCurrency(ratios.netResultAnnual),
        "Bénéfice estimé sur un an après impôt et intéressement."
      )}</dd>
      <dt>Amortissements annuels</dt><dd>${withTooltip(
        formatCurrency(ratios.amortizationAnnual),
        "Part de la valeur de l'investissement principal passant en charge chaque année."
      )}</dd>
      <dt>Charge IR (estim.)</dt><dd>${withTooltip(
        formatCurrency(ratios.incomeTaxAnnual),
        "Impôt personnel estimé du gérant sur une année."
      )}</dd>
      <dt>Ratio solvabilité (apport/besoins)</dt><dd>${withTooltip(
        formatPercent(ratios.solvencyRatio),
        personalContribution > 0
          ? `Apport (${formatCurrency(personalContribution)}) / besoins (${formatCurrency(totalNeeds)}). Cible ≥ 30 %.`
          : "Apport personnel non renseigné : complétez le champ pour estimer la solvabilité."
      )}</dd>
      <dt>Couverture service de la dette</dt><dd>${withTooltip(
        formatMultiple(ratios.debtCoverage),
        "CAF annuelle / annuités : viser au moins 1,2x pour couvrir le prêt confortablement."
      )}</dd>
      <dt>Marge nette</dt><dd>${withTooltip(
        formatPercent(ratios.marginNet),
        "Résultat net / CA : niveau de rentabilité après toutes charges et impôts."
      )}</dd>
      <dt>Dette / CA</dt><dd>${withTooltip(
        formatPercent(ratios.loanToRevenue),
        "Encours de dette comparé au chiffre d'affaires annuel projeté."
      )}</dd>
      <dt>Part financement bancaire</dt><dd>${withTooltip(
        formatPercent(ratios.loanShare),
        "Part des besoins couverte par la banque. En dessous de 70 % = structure équilibrée."
      )}</dd>
      <dt>Point mort trésorerie</dt><dd>${withTooltip(
        ratios.breakEvenMonths ? `${ratios.breakEvenMonths} mois` : 'n/a',
        "Nombre de mois nécessaires pour que la trésorerie cumulée redevienne positive."
      )}</dd>
    `;

    const analysis = [];
    if (ratios.debtCoverage !== null) {
      if (ratios.debtCoverage >= 1.2) {
        analysis.push("La CAF couvre plus de 120 % du service de la dette : tolérance bancaire atteinte.");
      } else {
        analysis.push("Surveillez la CAF : la couverture du service de la dette est inférieure au seuil recommandé de 120 %.");
      }
    } else {
      analysis.push("Précisez le service de la dette pour apprécier la couverture par la CAF.");
    }
    if (ratios.solvencyRatio !== null) {
      if (ratios.solvencyRatio >= 0.3) {
        analysis.push("L'apport couvre au moins 30 % des besoins : structure de financement robuste.");
      } else {
        analysis.push("Renforcez l'apport ou justifiez les garanties : la part d'apport reste sous 30 % des besoins.");
      }
    } else {
      analysis.push("Complétez les besoins d'investissement pour calculer la solvabilité.");
    }
    if (ratios.marginNet && ratios.marginNet >= 0.12) {
      analysis.push("La marge nette dépasse 12 %, rassurant sur la rentabilité malgré les charges opérationnelles.");
    } else {
      analysis.push("La marge nette reste sous 12 %, un suivi des charges variables est nécessaire.");
    }
    if (ratios.loanToRevenue && ratios.loanToRevenue <= 0.8) {
      analysis.push("L'effet de levier reste maîtrisé : l'encours représente moins de 80 % du CA annuel.");
    } else {
      analysis.push("L'endettement représente plus de 80 % du CA, argumentez la solidité des contrats clients et abonnements.");
    }
    if (ratios.loanShare !== null && ratios.loanShare <= 0.7) {
      analysis.push("La part de financement bancaire reste contenue : les fonds propres complètent efficacement le dossier.");
    } else if (ratios.loanShare !== null) {
      analysis.push("La banque finance plus de 70 % des besoins : mettez en avant les garanties (contrats, caution, épargne).");
    }
    if (ratios.breakEvenMonths && ratios.breakEvenMonths <= 12) {
      analysis.push("La trésorerie redevient positive avant 12 mois, ce qui sécurise l'avance de trésorerie demandée.");
    } else {
      analysis.push("Prévoyez un suivi rapproché de la trésorerie : le point mort dépasse 12 mois.");
    }

    bankerList.innerHTML = analysis.map((item) => `<li>${item}</li>`).join('');
  },

  renderFiscalSummary() {
    const host = document.getElementById('fiscal-summary');
    if (!host || !state.results.monthly?.fiscal) return;
    const { fiscalRegime, isOption, vatFranchise } = state.inputs;
    const { fiscal } = state.results.monthly;
    const microLabel = 'micro-BIC';
    const reelLabel = isOption ? 'régime réel (IS)' : 'régime réel (IR)';
    const vatLabel = vatFranchise
      ? 'Franchise en base (pas de TVA collectée)'
      : `TVA au taux ${(fiscal.vatRate * 100).toFixed(1)} %`;

    host.innerHTML = `
      <dt>Régime fiscal sélectionné</dt><dd>${fiscalRegime === 'micro' ? microLabel : reelLabel}</dd>
      <dt>Base imposable micro (après abattement 50%)</dt><dd>${formatCurrency(fiscal.microBase)}</dd>
      <dt>Base imposable réel</dt><dd>${formatCurrency(fiscal.realBase)}</dd>
      <dt>Base imposable IS</dt><dd>${formatCurrency(fiscal.isBase)}</dd>
      <dt>TVA</dt><dd>${vatLabel}</dd>
      <dt>TVA collectée</dt><dd>${formatCurrency(fiscal.vatCollected)}</dd>
      <dt>TVA déductible estimée</dt><dd>${formatCurrency(fiscal.vatDeductible)}</dd>
      <dt>TVA nette à payer</dt><dd>${formatCurrency(fiscal.vatNet)}</dd>
    `;
  },

  renderChart() {
    const canvas = document.getElementById('projection-chart');
    if (!canvas || !state.results.projection) return;
    const ctx = canvas.getContext('2d');
    const data = state.results.projection.months;
    const labels = data.map((row) => row.month);
    const revenueValues = data.map((row) => row.revenue);
    const chargesValues = data.map((row) => row.charges);
    const resultValues = data.map((row) => row.netResult);
    const treasuryValues = data.map((row) => row.treasury);

    const maxValue = Math.max(...revenueValues, ...chargesValues, ...treasuryValues.map((v) => Math.abs(v)));
    const minTreasury = Math.min(...treasuryValues);
    const padding = 40;
    const availableHeight = canvas.height - padding * 2;
    const availableWidth = canvas.width - padding * 2;

    function yScale(value) {
      return (
        canvas.height -
        padding -
        ((value - minTreasury) / (maxValue - minTreasury || 1)) * availableHeight
      );
    }

    function xScale(index) {
      return padding + (availableWidth / (labels.length - 1 || 1)) * index;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#d7dde4';
    ctx.font = '12px Segoe UI';
    ctx.fillStyle = '#5b6879';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Axes horizontaux (trimestre)
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();

    labels.forEach((label, index) => {
      if ((label - 1) % 3 !== 0) return;
      const x = xScale(index);
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - padding);
      ctx.lineTo(x, canvas.height - padding + 6);
      ctx.stroke();
      ctx.fillText(`M${label}`, x - 4, canvas.height - padding + 18);
    });

    drawLine(revenueValues, '#1f6feb');
    drawLine(chargesValues, '#d1434b');
    drawLine(resultValues, '#2d9d78');
    drawLine(treasuryValues, '#5b3cc4');

    function drawLine(series, color) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      series.forEach((value, index) => {
        const x = xScale(index);
        const y = yScale(value);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-region');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
};

export default ui;

export function initStatusQuiz() {
  const form = document.querySelector('.quiz-form');
  if (!form) return;
  const result = document.getElementById('quiz-result');
  const button = document.getElementById('quiz-submit');
  if (!button || !result) return;

  const computeRecommendation = () => {
    const testMarket = document.getElementById('quiz-test-market')?.value;
    const needAssoc = document.getElementById('quiz-associe')?.value;
    const protection = document.getElementById('quiz-protection')?.value;
    const invest = document.getElementById('quiz-invest')?.value;
    const turnover = document.getElementById('quiz-ca')?.value;
    const salaire = document.getElementById('quiz-salaire')?.value;

    let recommendation = '';
    const reasons = [];

    if (needAssoc === 'oui' || protection === 'fort' || invest === 'fort' || turnover === 'gros') {
      recommendation = '👉 SASU / SAS';
      reasons.push('Tu souhaites accueillir des associés ou sécuriser une protection sociale assimilée salarié.');
      if (invest === 'fort') reasons.push('Un investissement important justifie la responsabilité limitée et la souplesse des actions.');
      if (turnover === 'gros') reasons.push('Tu dépasses les seuils micro, la SAS facilite la croissance rapide et les levées de fonds.');
    } else if (testMarket === 'oui' && invest === 'faible' && turnover === 'micro') {
      recommendation = '👉 Micro-entreprise';
      reasons.push('Formalités ultra simples pour tester ton idée avec peu de charges fixes.');
      reasons.push('Tant que tu restes sous 77 700 € de CA services, tu bénéficies d’une compta allégée.');
    } else {
      recommendation = '👉 EURL / SARL';
      if (salaire === 'oui') reasons.push('Tu veux un salaire régulier : le statut TNS de l’EURL/SARL optimise les cotisations.');
      if (invest !== 'faible') reasons.push('Un investissement moyen nécessite une responsabilité limitée et une banque rassurée.');
      if (turnover !== 'micro') reasons.push('Les seuils micro seront rapidement dépassés : passe sur un vrai bilan.');
    }

    result.textContent = `${recommendation} ${reasons.join(' ')}`;
  };

  button.addEventListener('click', computeRecommendation);
}
