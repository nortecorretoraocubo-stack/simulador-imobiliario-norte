export function calculateIncomeCapacity({ income, commitments = 0, financialBasePercentage = 0.28, totalPercentage = 0.30, reservePercentage = 0.02 }) {
  const grossIncome = Math.max(Number(income) || 0, 0);
  const existingCommitments = Math.max(Number(commitments) || 0, 0);
  return {
    maximumTotalPayment: Math.max(grossIncome * totalPercentage - existingCommitments, 0),
    financialBasePayment: Math.max(grossIncome * financialBasePercentage - existingCommitments, 0),
    commercialReserve: grossIncome * reservePercentage
  };
}

export function calculatePricePresentValue({ payment, monthlyRate, months }) {
  const pmt = Math.max(Number(payment) || 0, 0);
  const i = Math.max(Number(monthlyRate) || 0, 0);
  const n = Math.max(Math.floor(Number(months) || 0), 0);
  if (!n) return 0;
  if (!i) return pmt * n;
  const factor = Math.pow(1 + i, n);
  return pmt * (factor - 1) / (i * factor);
}

export function calculateSacPresentValue({ firstPayment, monthlyRate, months }) {
  const pmt = Math.max(Number(firstPayment) || 0, 0);
  const i = Math.max(Number(monthlyRate) || 0, 0);
  const n = Math.max(Math.floor(Number(months) || 0), 0);
  if (!n) return 0;
  return pmt / (1 / n + i);
}
