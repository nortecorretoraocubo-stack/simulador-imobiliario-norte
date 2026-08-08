export function nominalAnnualPercentToMonthlyDecimal(ratePercent) {
  return (Number(ratePercent) || 0) / 100 / 12;
}

export function monthlyDecimalToEffectiveAnnualPercent(monthlyRate) {
  const rate = Math.max(Number(monthlyRate) || 0, 0);
  return (Math.pow(1 + rate, 12) - 1) * 100;
}
