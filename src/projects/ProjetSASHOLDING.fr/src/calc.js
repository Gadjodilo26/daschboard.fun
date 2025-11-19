/**
 * calc.js
 * Squelette pour les calculs financiers. Codex : copiez les fonctions depuis `app.js`.
 */
import { parseNumber } from './utils.js';
import {
  MEAL_ALLOWANCE_PER_DAY,
  COLD_PRIME_RATE,
  INTERESSEMENT_RATE,
  BORROWER_INSURANCE_RATE
} from './config/constants.js';

export const calc = {
  loanSummary(inputs, overrideAmount = null) {
    const baseNeed = Math.max(0, parseNumber(inputs.vehiclePrice) - parseNumber(inputs.personalContribution));
    const override = overrideAmount != null && Number.isFinite(overrideAmount) ? overrideAmount : null;
    const loanAmount = Math.max(0, override ?? baseNeed);
    const durationMonths = Math.max(1, Math.round(parseNumber(inputs.loanDurationYears) * 12));
    const annualRate = Math.max(0, parseNumber(inputs.loanRate) / 100);
    const monthlyRate = annualRate / 12;

    let baseMonthlyPayment = 0;
    if (monthlyRate === 0) {
      baseMonthlyPayment = durationMonths === 0 ? 0 : loanAmount / durationMonths;
    } else {
      const factor = Math.pow(1 + monthlyRate, durationMonths);
      baseMonthlyPayment = loanAmount * ((monthlyRate * factor) / (factor - 1));
    }

    const schedule = [];
    let balance = loanAmount;
    let totalInterest = 0;
    const monthlyInsurance = loanAmount * BORROWER_INSURANCE_RATE / 12;
    for (let month = 1; month <= durationMonths; month += 1) {
      const interest = balance * monthlyRate;
      const principal = Math.min(balance, baseMonthlyPayment - interest);
      balance -= principal;
      totalInterest += interest;
      schedule.push({
        month,
        payment: baseMonthlyPayment,
        insurance: monthlyInsurance,
        interest,
        principal,
        balance: Math.max(0, balance)
      });
      if (balance <= 0.5) {
        break;
      }
    }

    return {
      amount: loanAmount,
      baseMonthlyPayment,
      monthlyInsurance,
      monthlyPayment: baseMonthlyPayment + monthlyInsurance,
      durationMonths,
      totalInterest,
      totalInsurance: monthlyInsurance * durationMonths,
      totalCost: loanAmount + totalInterest + monthlyInsurance * durationMonths,
      schedule
    };
  },

  dailyCourseTotal(inputs) {
    const kmRate = Math.max(0, parseNumber(inputs.kmAllowanceRate));
    const courses = Array.isArray(inputs.dailyCourses) ? inputs.dailyCourses : [];
    return courses.reduce((acc, course) => {
      const amount = Math.max(0, parseNumber(course.amount));
      const distance = Math.max(0, parseNumber(course.distance));
      return acc + amount + distance * kmRate;
    }, 0);
  },

  estimateIncomeTax(monthlyNet) {
    const annual = monthlyNet * 12;
    if (annual <= 0) return 0;
    const brackets = [
      { limit: 10777, rate: 0 },
      { limit: 27478, rate: 0.11 },
      { limit: 78570, rate: 0.30 },
      { limit: 168994, rate: 0.41 },
      { limit: Infinity, rate: 0.45 }
    ];

    let remaining = annual;
    let previousLimit = 0;
    let tax = 0;
    for (const bracket of brackets) {
      const taxableSlice = Math.max(0, Math.min(remaining, bracket.limit - previousLimit));
      tax += taxableSlice * bracket.rate;
      remaining -= taxableSlice;
      previousLimit = bracket.limit;
      if (remaining <= 0) break;
    }
    return tax / 12;
  },

  monthlySummary(inputs, loan) {
    const workingDays = Math.max(0, Math.min(parseNumber(inputs.workingDays), 31));
    const baseRevenue = workingDays * parseNumber(inputs.dailyRevenue) + parseNumber(inputs.surcharges);

    const mealAllowanceRate =
      parseNumber(inputs.mealAllowanceRate) > 0 ? parseNumber(inputs.mealAllowanceRate) : MEAL_ALLOWANCE_PER_DAY;
    const mealAllowance = workingDays * mealAllowanceRate;
    const coldPrime = parseNumber(inputs.netRemuneration) * COLD_PRIME_RATE;
    const ssiRate = parseNumber(inputs.ssiRate) / 100;
    const netRemuneration = parseNumber(inputs.netRemuneration);
    const ssiContributions = Math.max(netRemuneration * ssiRate, parseNumber(inputs.tnsMinContribution));

    const miscChargesTotal = (inputs.miscCharges || []).reduce((acc, charge) => acc + parseNumber(charge.amount), 0);
    const variableCharges =
      parseNumber(inputs.fuel) +
      parseNumber(inputs.insurance) +
      parseNumber(inputs.maintenance) +
      parseNumber(inputs.tolls) +
      parseNumber(inputs.otherCharges) +
      miscChargesTotal +
      parseNumber(inputs.heavyVehicleTax) +
      parseNumber(inputs.ecoTax);

    const fixedCharges = mealAllowance + coldPrime + ssiContributions + netRemuneration;

    const operatingCharges = variableCharges + fixedCharges;
    const debtService = loan.monthlyPayment;
    const operatingChargesDisplay = operatingCharges + debtService;
    const amortizationYears = Math.max(1, parseNumber(inputs.amortizationYears));
    const amortization = parseNumber(inputs.vehiclePrice) / (amortizationYears * 12);
    const interest = loan.schedule.length ? loan.schedule[0].interest : 0;
    const insurance = loan.monthlyInsurance || 0;

    const totalCharges = operatingCharges + amortization + interest + insurance;
    const resultBeforeTax = baseRevenue - totalCharges;
    const incomeTax = resultBeforeTax > 0 ? this.estimateIncomeTax(resultBeforeTax) : 0;
    const netResult = resultBeforeTax - incomeTax;
    const interessement = netResult > 0 ? netResult * (INTERESSEMENT_RATE / 12) : 0;
    const netResultAfterInteressement = netResult - interessement;
    const caf = netResultAfterInteressement + amortization;
    const principal = loan.schedule.length ? loan.schedule[0].principal : 0;
    const cashFlow = caf - principal - insurance;

    const cashOutflowsForBfr =
      variableCharges +
      coldPrime +
      mealAllowance +
      ssiContributions +
      netRemuneration;

    const clientDelay = Math.max(0, parseNumber(inputs.clientPaymentDelay));
    const supplierDelay = Math.max(0, parseNumber(inputs.supplierPaymentDelay));
    const receivablesBfr = (baseRevenue * clientDelay) / 30;
    const payableBase = Math.max(0, operatingCharges - netRemuneration - ssiContributions - mealAllowance);
    const payablesBfr = (payableBase * supplierDelay) / 30;
    const delayBfr = Math.max(0, receivablesBfr - payablesBfr);
    const advanceTreasury = Math.max(0, cashOutflowsForBfr * 2 + delayBfr);
    const licensesCost = parseNumber(inputs.licensesCount) * parseNumber(inputs.licenseCost);
    const personalContribution = parseNumber(inputs.personalContribution);
    const totalNeeds = parseNumber(inputs.vehiclePrice) + advanceTreasury + licensesCost;
    const solvencyRatio =
      totalNeeds === 0 || personalContribution <= 0 ? null : personalContribution / totalNeeds;
    const annualDebtService = loan.monthlyPayment * 12;
    const debtCoverage = annualDebtService === 0 ? null : (caf * 12) / annualDebtService;
    const debtRatio = baseRevenue <= 0 ? null : loan.amount / (baseRevenue * 12);
    const netMargin = baseRevenue <= 0 ? null : netResultAfterInteressement / baseRevenue;

    const microAbatementRate = 0.5;
    const taxableBaseMicro = baseRevenue * (1 - microAbatementRate);
    const taxableBaseReel = Math.max(0, resultBeforeTax);
    const taxableBaseIs = taxableBaseReel;
    const vatRate = parseNumber(inputs.vatRate) / 100;
    const vatCollected = inputs.vatFranchise ? 0 : baseRevenue * vatRate;
    const vatDeductibleBase =
      parseNumber(inputs.fuel) +
      parseNumber(inputs.maintenance) +
      parseNumber(inputs.otherCharges) +
      miscChargesTotal +
      parseNumber(inputs.heavyVehicleTax) +
      parseNumber(inputs.ecoTax);
    const vatDeductible = inputs.vatFranchise ? 0 : vatDeductibleBase * vatRate;

    return {
      revenue: baseRevenue,
      operatingCharges,
      operatingChargesDisplay,
      totalCharges,
      amortization,
      interest,
      resultBeforeTax,
      incomeTax,
      netResult: netResultAfterInteressement,
      caf,
      cashFlow,
      treasury: cashFlow,
      marginNet: netMargin,
      solvencyRatio,
      debtCoverage,
      debtRatio,
      advanceTreasury,
      principal,
      annualDebtService,
      mealAllowance,
      mealAllowanceRate,
      coldPrime,
      ssiContributions,
      interessement,
      variableCharges,
      baseRevenue,
      baseOperatingCharges: operatingCharges,
      baseLoanPayment: loan.baseMonthlyPayment ?? loan.monthlyPayment,
      monthlyInsurance: loan.monthlyInsurance,
      miscChargesTotal,
      totalNeeds,
      personalContribution,
      insurance,
      debtService,
      delayBfr,
      fiscal: {
        microBase: Math.max(0, taxableBaseMicro),
        microAbatementRate,
        realBase: taxableBaseReel,
        isBase: taxableBaseIs,
        vatCollected,
        vatDeductible,
        vatNet: vatCollected - vatDeductible,
        vatRate
      }
    };
  },

  buildProjection(inputs, loan, monthly) {
    const months = [];
    const years = [
      { year: 1, revenue: 0, charges: 0, resultBeforeTax: 0, caf: 0, treasuryEnd: 0 },
      { year: 2, revenue: 0, charges: 0, resultBeforeTax: 0, caf: 0, treasuryEnd: 0 },
      { year: 3, revenue: 0, charges: 0, resultBeforeTax: 0, caf: 0, treasuryEnd: 0 }
    ];

    const amortizationMonths = Math.round(Math.max(1, parseNumber(inputs.amortizationYears)) * 12);
    const baseRevenue = monthly.baseRevenue;
    const baseVariableCharges = monthly.variableCharges;
    const fixedCharges =
      monthly.baseOperatingCharges - monthly.variableCharges;

    const growthRate = parseNumber(inputs.growthRate) / 100;
    const inflationRate = parseNumber(inputs.inflationRate) / 100;

    const loanSchedule = loan.schedule;
    const initialCash = monthly.advanceTreasury;

    let cumulativeTreasury = initialCash;

    for (let index = 0; index < 36; index += 1) {
      const yearIndex = Math.floor(index / 12);
      const growthFactor = Math.pow(1 + growthRate, yearIndex);
      const inflationFactor = Math.pow(1 + inflationRate, yearIndex);

      const revenue = baseRevenue * growthFactor;
      const variableCharges = baseVariableCharges * inflationFactor;
      const operatingCharges = variableCharges + fixedCharges;
      const amortization =
        index < amortizationMonths ? monthly.amortization : 0;
      const interest = loanSchedule[index] ? loanSchedule[index].interest : 0;
      const principal = loanSchedule[index] ? loanSchedule[index].principal : 0;
      const insurance = loanSchedule[index] ? loan.monthlyInsurance : 0;
      const debtService = loanSchedule[index] ? loan.monthlyPayment : 0;
      const resultBeforeTax = revenue - (operatingCharges + amortization + interest + insurance);
      const incomeTax = resultBeforeTax > 0 ? this.estimateIncomeTax(resultBeforeTax) : 0;
      const netResult = resultBeforeTax - incomeTax;
      const interessement = netResult > 0 ? netResult * (INTERESSEMENT_RATE / 12) : 0;
      const netResultAfterInteressement = netResult - interessement;
      const caf = netResultAfterInteressement + amortization;
      const cashFlow = caf - principal - insurance;

      cumulativeTreasury += cashFlow;

      const chargesDisplay = operatingCharges + debtService;

      months.push({
        month: index + 1,
        revenue,
        charges: chargesDisplay,
        netResult: netResultAfterInteressement,
        treasury: cumulativeTreasury
      });

      const yearData = years[yearIndex];
      yearData.revenue += revenue;
      yearData.charges += chargesDisplay;
      yearData.resultBeforeTax += resultBeforeTax;
      yearData.caf += caf;
      yearData.treasuryEnd = cumulativeTreasury;
    }

    return { months, years, initialCash };
  },

  financialRatios(inputs, monthly, projection, loan) {
    const annualRevenue = monthly.baseRevenue * 12;
    const cafAnnual = monthly.caf * 12;
    const netResultAnnual = monthly.netResult * 12;
    const amortizationAnnual = monthly.amortization * 12;
    const incomeTaxAnnual = monthly.incomeTax * 12;
    const interessementAnnual = monthly.interessement * 12;
    const solvencyRatio = monthly.solvencyRatio;
    const debtRatio = monthly.debtRatio;
    const marginNet = monthly.marginNet;
    const debtCoverage = monthly.debtCoverage;
    const loanToRevenue = annualRevenue > 0 ? loan.amount / annualRevenue : null;
    const loanShare = monthly.totalNeeds > 0 ? loan.amount / monthly.totalNeeds : null;
    const breakEvenMonths = projection.months.findIndex((row) => row.treasury >= 0) + 1;

    return {
      cafAnnual,
      netResultAnnual,
      amortizationAnnual,
      incomeTaxAnnual,
      interessementAnnual,
      solvencyRatio,
      debtRatio,
      marginNet,
      debtCoverage,
      loanToRevenue,
      loanShare,
      breakEvenMonths: breakEvenMonths > 0 ? breakEvenMonths : null,
      annualRevenue
    };
  }
};

export default calc;
