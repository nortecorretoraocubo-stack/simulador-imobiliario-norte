import { calculateMaximumTerm } from './term-rule-engine.js';
import { calculateFinancingLimits } from '../finance/financing-calculator.js';
import { nominalAnnualPercentToMonthlyDecimal, monthlyDecimalToEffectiveAnnualPercent } from '../finance/rate-converter.js';

export function evaluateSbpe({ buyer, property, ruleSet, referenceDate = new Date(), manualAnnualRate = 0, fallbackReason = '' }) {
  const config = ruleSet.files['sbpe-rules'];
  const checks = [];
  const warnings = [...(config.notices || [])];
  const brokerNotes = [];
  const appraisal = Math.max(Number(property.appraisalValue) || 0, 0);
  const sale = Math.max(Number(property.saleValue) || 0, 0);
  const income = Math.max(Number(buyer.grossIncome) || 0, 0);

  if (!income || !sale || !appraisal) {
    return {
      eligible: false,
      status: 'invalid_sbpe_data',
      program: 'SBPE',
      message: 'Informe renda, valor de venda e avaliação bancária para simular pelo SBPE.',
      checks,
      warnings,
      errors: [],
      brokerNotes
    };
  }

  const isSfh = appraisal <= Number(config.sfh.maximumAppraisalValue);
  const lineConfig = isSfh ? config.sfh : config.sfi;
  const line = isSfh ? 'SFH' : 'SFI';
  const configuredRate = Number(manualAnnualRate) > 0 ? Number(manualAnnualRate) : Number(lineConfig.referenceAnnualRate || 0);
  const requiresManualRate = !configuredRate;

  checks.push({ ok: true, label: fallbackReason || 'Operação direcionada para análise pelo SBPE' });
  checks.push({ ok: true, label: isSfh ? `Avaliação dentro do teto do SFH de R$ 2.250.000` : 'Avaliação acima do teto do SFH; operação direcionada ao SFI' });
  checks.push({ ok: !requiresManualRate, label: requiresManualRate ? 'Informe uma taxa anual para calcular a operação' : `Taxa de referência configurada em ${configuredRate.toFixed(2).replace('.', ',')}% a.a. + ${lineConfig.indexer}` });
  checks.push({ ok: true, label: `Cota SAC de ${(lineConfig.quotas.sac * 100).toFixed(0)}% e Price de ${(lineConfig.quotas.price * 100).toFixed(0)}%` });

  const termResult = calculateMaximumTerm({
    birthDate: buyer.oldestBuyerBirthDate,
    requestedTerm: property.requestedTerm,
    termsData: ruleSet.files.terms,
    referenceDate
  });
  const maximumTermMonths = Math.min(termResult.allowedMonths, Number(lineConfig.maximumTermMonths || 420));
  checks.push({ ok: maximumTermMonths > 0, label: `Prazo máximo estimado: ${maximumTermMonths} meses` });
  if (termResult.notice) warnings.push(termResult.notice);

  const fgtsAllowed = Boolean(lineConfig.fgtsMayBeUsed);
  if (!fgtsAllowed && Number(buyer.fgtsBalance || 0) > 0) {
    warnings.push('O FGTS não foi considerado automaticamente nesta simulação SFI. Confirme as condições da operação.');
  }

  const useAppraisalBase = property.deliveryStatus === 'em_obras' && property.constructionType === 'associativo';
  const baseQuota = useAppraisalBase ? appraisal : Math.min(sale, appraisal);
  let financingAnalysis = null;
  if (!requiresManualRate && maximumTermMonths > 0) {
    financingAnalysis = calculateFinancingLimits({
      income,
      commitments: buyer.monthlyCommitments,
      nominalAnnualRate: configuredRate,
      months: maximumTermMonths,
      quotaBase: baseQuota,
      priceQuota: lineConfig.quotas.price,
      sacQuota: lineConfig.quotas.sac,
      saleValue: sale,
      fgtsBalance: buyer.fgtsBalance,
      fgtsAllowed,
      settings: ruleSet.files['app-settings']
    });
    checks.push({ ok: true, label: 'Limites pela renda, cota e valor necessário calculados para o SBPE' });
  }

  if (fallbackReason) brokerNotes.push(fallbackReason);
  brokerNotes.push(`Linha selecionada: SBPE/${line}. Base da cota: ${useAppraisalBase ? 'avaliação bancária, por se tratar de associativo em obras' : 'menor valor entre venda e avaliação'}.`);
  brokerNotes.push(`Taxa utilizada apenas como referência comercial: ${configuredRate ? configuredRate.toFixed(2).replace('.', ',') + '% a.a.' : 'pendente de preenchimento'} ${lineConfig.indexer ? '+ ' + lineConfig.indexer : ''}.`);

  const monthlyRate = configuredRate ? nominalAnnualPercentToMonthlyDecimal(configuredRate) : null;
  return {
    eligible: !requiresManualRate && maximumTermMonths > 0,
    status: requiresManualRate ? 'manual_rate_required' : 'eligible',
    program: 'SBPE',
    creditLine: line,
    band: line,
    subBand: null,
    fgtsStatus: buyer.hasThreeYearsFgts ? 'cotista' : 'nao_cotista',
    fgtsAllowed,
    nominalAnnualRate: configuredRate || null,
    monthlyRate,
    effectiveAnnualRate: monthlyRate != null ? monthlyDecimalToEffectiveAnnualPercent(monthlyRate) : null,
    rateIndexer: lineConfig.indexer,
    rateEditable: true,
    requiresManualRate,
    propertyLimit: isSfh ? Number(config.sfh.maximumAppraisalValue) : null,
    propertyWithinLimit: true,
    quota: null,
    quotas: { price: lineConfig.quotas.price, sac: lineConfig.quotas.sac },
    quotaBaseType: useAppraisalBase ? 'appraisal' : 'minimum',
    maximumTermMonths,
    baseQuota,
    appraisalDifference: appraisal - sale,
    subsidyUsed: 0,
    subsidyPotentialMaximum: 0,
    subsidyProfile: 'not_applicable',
    financingAnalysis,
    message: requiresManualRate
      ? `Operação direcionada ao SBPE/${line}. Informe a taxa anual para concluir a simulação.`
      : `Operação simulada pelo SBPE/${line}, pois não houve enquadramento automático no MCMV.`,
    checks,
    warnings,
    errors: [],
    brokerNotes
  };
}
