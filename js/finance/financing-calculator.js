import { nominalAnnualPercentToMonthlyDecimal } from './rate-converter.js';
import { calculateIncomeCapacity, calculatePricePresentValue, calculateSacPresentValue } from './income-limit-calculator.js';

function smallestFactor(values) {
  const entries = Object.entries(values);
  return entries.reduce((smallest, current) => current[1] < smallest[1] ? current : smallest, entries[0])[0];
}

export function calculateFinancingLimits({
  income,
  commitments,
  nominalAnnualRate,
  months,
  quotaBase,
  quota,
  priceQuota,
  sacQuota,
  saleValue,
  fgtsBalance = 0,
  subsidyUsed = 0,
  proSolutoUsed = 0,
  settings = {},
  fgtsAllowed = true
}) {
  const commitment = settings.incomeCommitment || {};
  const capacity = calculateIncomeCapacity({
    income,
    commitments,
    financialBasePercentage: commitment.financialBasePercentage ?? 0.28,
    totalPercentage: commitment.maximumTotalPercentage ?? 0.30,
    reservePercentage: commitment.commercialReservePercentage ?? 0.02
  });
  const monthlyRate = nominalAnnualPercentToMonthlyDecimal(nominalAnnualRate);
  const priceIncomeLimit = calculatePricePresentValue({ payment: capacity.financialBasePayment, monthlyRate, months });
  const sacIncomeLimit = calculateSacPresentValue({ firstPayment: capacity.financialBasePayment, monthlyRate, months });
  const base = Math.max(Number(quotaBase) || 0, 0);
  const resolvedPriceQuota = Math.max(Number(priceQuota ?? quota) || 0, 0);
  const resolvedSacQuota = Math.max(Number(sacQuota ?? quota) || 0, 0);
  const sale = Math.max(Number(saleValue) || 0, 0);
  const fgtsUsed = fgtsAllowed ? Math.min(Math.max(Number(fgtsBalance) || 0, 0), sale) : 0;
  const amountNeeded = Math.max(sale - fgtsUsed - Math.max(Number(subsidyUsed) || 0, 0) - Math.max(Number(proSolutoUsed) || 0, 0), 0);

  const makeResult = (incomeLimit, system, systemQuota) => {
    const quotaLimit = base * systemQuota;
    const values = { income: incomeLimit, quota: quotaLimit, needed: amountNeeded };
    return {
      system,
      quota: systemQuota,
      incomeLimit,
      quotaLimit,
      amountNeeded,
      estimatedFinancing: Math.max(Math.min(...Object.values(values)), 0),
      limitingFactor: smallestFactor(values)
    };
  };

  return {
    incomeCapacity: capacity,
    monthlyRate,
    fgtsUsed,
    price: makeResult(priceIncomeLimit, 'price', resolvedPriceQuota),
    sac: makeResult(sacIncomeLimit, 'sac', resolvedSacQuota)
  };
}
