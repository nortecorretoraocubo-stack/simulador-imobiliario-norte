function matches(expected, actual) {
  return expected === '*' || expected === actual;
}

export function findQuota({ quotasData, property = {}, amortizationSystem = '*' }) {
  const rules = (quotasData?.rules || []).filter((rule) => rule.active !== false);
  const context = {
    modality: property.constructionType || (property.deliveryStatus === 'em_obras' ? 'associativo' : 'sfh'),
    propertyCondition: property.condition || '*',
    deliveryStatus: property.deliveryStatus || '*',
    amortizationSystem,
    constructionType: property.constructionType || '*'
  };

  const scored = rules
    .filter((rule) =>
      matches(rule.modality ?? '*', context.modality) &&
      matches(rule.propertyCondition ?? '*', context.propertyCondition) &&
      matches(rule.deliveryStatus ?? '*', context.deliveryStatus) &&
      matches(rule.amortizationSystem ?? '*', context.amortizationSystem) &&
      matches(rule.constructionType ?? '*', context.constructionType)
    )
    .map((rule) => ({
      rule,
      score: ['modality', 'propertyCondition', 'deliveryStatus', 'amortizationSystem', 'constructionType']
        .reduce((total, key) => total + ((rule[key] && rule[key] !== '*') ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  const selected = scored[0]?.rule || null;
  return {
    quota: selected?.standardQuota ?? quotasData?.defaultQuota ?? 0.8,
    maximumQuota: selected?.maximumQuota ?? quotasData?.defaultQuota ?? 0.8,
    quotaBase: selected?.quotaBase ?? 'minimum',
    origin: selected?.id || 'defaultQuota',
    rule: selected
  };
}

export function calculateQuotaBase({ saleValue, appraisalValue, quotaBase }) {
  const sale = Math.max(Number(saleValue) || 0, 0);
  const appraisal = Math.max(Number(appraisalValue) || 0, 0);
  if (quotaBase === 'appraisal') return appraisal;
  if (quotaBase === 'sale') return sale;
  return Math.min(sale, appraisal);
}
