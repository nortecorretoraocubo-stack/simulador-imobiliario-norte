function positive(value) {
  return Math.max(Number(value) || 0, 0);
}

export function calculateAcquisitionCosts({ saleValue, appraisalValue, settings = {} }) {
  const sale = positive(saleValue);
  const appraisal = positive(appraisalValue);
  const estimate = settings.estimate || {};
  const minimumPercentage = positive(estimate.minimumPercentage || 0.04);
  const suggestedPercentage = positive(estimate.suggestedPercentage || 0.045);
  const maximumPercentage = positive(estimate.maximumPercentage || 0.05);
  const calculationBase = estimate.calculationBase === 'appraisalValue' ? appraisal : sale;
  const itbiRate = positive(settings.components?.itbi?.standardRate || 0.03);

  return {
    base: calculationBase,
    minimumPercentage,
    suggestedPercentage,
    maximumPercentage,
    minimum: calculationBase * minimumPercentage,
    suggested: calculationBase * suggestedPercentage,
    maximum: calculationBase * maximumPercentage,
    preliminaryItbi: calculationBase * itbiRate,
    components: settings.components || {},
    notices: settings.notices || [],
    display: settings.display || {}
  };
}
