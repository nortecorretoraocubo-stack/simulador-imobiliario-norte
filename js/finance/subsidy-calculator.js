function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function interpolate(points, income) {
  if (!Array.isArray(points) || !points.length) return 0;
  const ordered = [...points].sort((a, b) => a.income - b.income);
  if (income <= ordered[0].income) return asNumber(ordered[0].value);
  for (let i = 1; i < ordered.length; i += 1) {
    const left = ordered[i - 1];
    const right = ordered[i];
    if (income <= right.income) {
      const width = right.income - left.income;
      if (width <= 0) return asNumber(right.value);
      const t = (income - left.income) / width;
      return asNumber(left.value) + (asNumber(right.value) - asNumber(left.value)) * t;
    }
  }
  return asNumber(ordered[ordered.length - 1].value);
}

export function estimateSubsidy({ income, hasAdditionalProponentOrDependent = false, saleValue = 0, fgtsBalance = 0, subsidiesData = {} }) {
  const grossIncome = Math.max(asNumber(income), 0);
  const sale = Math.max(asNumber(saleValue), 0);
  const fgts = Math.min(Math.max(asNumber(fgtsBalance), 0), sale);
  const rule = (subsidiesData.rules || []).find((item) => item.active !== false && grossIncome >= asNumber(item.minimumIncome) && grossIncome <= asNumber(item.maximumIncome));

  if (!rule || subsidiesData.automaticEnabled === false) {
    return { eligible: false, estimated: 0, potentialMaximum: 0, profile: 'not_applicable', notice: subsidiesData.legalNotice || '' };
  }

  const profiles = subsidiesData.approximationProfiles || {};
  const profileKey = hasAdditionalProponentOrDependent ? 'withAdditionalProponentOrDependent' : 'withoutAdditionalProponentOrDependent';
  const profile = profiles[profileKey] || {};
  const raw = interpolate(profile.points || [], grossIncome);
  const maxIndicative = Math.max(asNumber(rule.maximumIndicativeValue), 0);
  const rounded = Math.max(Math.round(raw / 10) * 10, 0);
  const purchaseNeedBeforeFinancing = Math.max(sale - fgts, 0);
  const estimated = Math.min(rounded, maxIndicative, purchaseNeedBeforeFinancing || maxIndicative);

  return {
    eligible: estimated > 0,
    estimated,
    potentialMaximum: maxIndicative,
    profile: profileKey,
    source: subsidiesData.source || '',
    notice: subsidiesData.legalNotice || 'O subsídio apresentado é estimado e depende do cálculo oficial do agente financeiro.'
  };
}
