/**
 * core/engine.js
 * Contient la logique d'orchestration des calculs financiers (normalisation + projections).
 */
import { state, normalizeInputs } from '../state.js';
import { calc } from '../calc.js';
import { parseNumber } from '../utils.js';

export function recalculate() {
  state.inputs = normalizeInputs(state.inputs);
  let requiredLoan = null;
  let loan = null;
  let monthly = null;
  const licensesCostBase = parseNumber(state.inputs.licenseCost) * parseNumber(state.inputs.licensesCount);

  for (let i = 0; i < 5; i += 1) {
    loan = calc.loanSummary(state.inputs, requiredLoan);
    state.inputs.monthlyLoanPayment = loan.monthlyPayment;
    monthly = calc.monthlySummary(state.inputs, loan);
    state.inputs.advanceTreasury = monthly.advanceTreasury;
    state.inputs.mealAllowance = monthly.mealAllowance;
    state.inputs.coldPrime = monthly.coldPrime;
    const totalNeeds =
      parseNumber(state.inputs.vehiclePrice) +
      monthly.advanceTreasury +
      licensesCostBase -
      parseNumber(state.inputs.personalContribution);
    const newRequiredLoan = Math.max(0, totalNeeds);
    if (requiredLoan !== null && Math.abs(newRequiredLoan - requiredLoan) < 1) {
      requiredLoan = newRequiredLoan;
      break;
    }
    requiredLoan = newRequiredLoan;
  }

  loan = calc.loanSummary(state.inputs, requiredLoan);
  state.inputs.monthlyLoanPayment = loan.monthlyPayment;
  monthly = calc.monthlySummary(state.inputs, loan);
  state.inputs.advanceTreasury = monthly.advanceTreasury;
  state.inputs.mealAllowance = monthly.mealAllowance;
  state.inputs.coldPrime = monthly.coldPrime;

  const projection = calc.buildProjection(state.inputs, loan, {
    ...monthly,
    amortization: monthly.amortization
  });
  const ratios = calc.financialRatios(state.inputs, monthly, projection, loan);

  state.results = {
    monthly,
    projection,
    loan,
    ratios
  };
}

export default { recalculate };
