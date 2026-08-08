function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function findMunicipality(property, municipalitiesData) {
  const municipality = municipalitiesData.municipalities.find((item) =>
    item.active !== false && item.state === property.state && normalize(item.city) === normalize(property.city)
  );
  return municipality || null;
}

export function evaluatePropertyLimit({ property, band, municipalitiesData, propertyLimitsData }) {
  const municipality = findMunicipality(property, municipalitiesData);
  if (!municipality) {
    return {
      matched: false,
      eligible: false,
      status: 'municipality_pending',
      message: propertyLimitsData.fallback.message,
      municipality: null,
      propertyLimit: null
    };
  }

  const rule = propertyLimitsData.rules.find((item) =>
    item.active !== false && item.state === municipality.state &&
    (normalize(item.city) === normalize(municipality.city) || item.regionalGroup === municipality.regionalGroup)
  );

  if (!rule || !rule.limits?.[band]) {
    return {
      matched: false,
      eligible: false,
      status: 'limit_pending',
      message: propertyLimitsData.fallback.message,
      municipality,
      propertyLimit: null
    };
  }

  const propertyLimit = Number(rule.limits[band]);
  // Para enquadramento no MCMV, o teto do programa é validado pela avaliação bancária.
  const validationValue = Number(property.appraisalValue);
  const eligible = validationValue <= propertyLimit;
  return {
    matched: true,
    eligible,
    status: eligible ? 'within_limit' : 'over_limit',
    message: eligible
      ? 'Avaliação bancária dentro do teto permitido para a faixa.'
      : propertyLimitsData.doubleEligibility.overLimitMessage.replace('{band}', band),
    municipality,
    rule,
    propertyLimit,
    validationValue
  };
}
