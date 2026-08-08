function isDateActive(rule, referenceDate) {
  if (rule.active === false) return false;
  const date = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (rule.validFrom && date < new Date(`${rule.validFrom}T00:00:00`)) return false;
  if (rule.validUntil && date > new Date(`${rule.validUntil}T23:59:59`)) return false;
  return true;
}

export function findInterestRate({ band, subBand, region, fgtsStatus, referenceDate, ratesData }) {
  const rule = ratesData.rules.find((item) =>
    isDateActive(item, referenceDate) &&
    item.band === band &&
    (item.subBand ?? null) === (subBand ?? null) &&
    item.regions.includes(region) &&
    item.fgtsStatus === fgtsStatus
  );

  if (!rule) {
    return {
      matched: false,
      message: 'Condição pendente de validação. Informe uma taxa manual para continuar.',
      requiresManualRate: true
    };
  }

  const nominalAnnualRate = Number(rule.nominalAnnualRate);
  const monthlyRate = nominalAnnualRate / 100 / 12;
  const effectiveAnnualRate = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
  return { matched: true, rule, nominalAnnualRate, monthlyRate, effectiveAnnualRate };
}
