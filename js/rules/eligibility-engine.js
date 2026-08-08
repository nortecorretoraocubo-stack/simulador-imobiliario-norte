import { findIncomeBand } from './income-rule-engine.js';
import { evaluatePropertyLimit } from './property-limit-engine.js';
import { findInterestRate } from './rate-rule-engine.js';
import { findQuota, calculateQuotaBase } from './quota-rule-engine.js';
import { calculateMaximumTerm } from './term-rule-engine.js';
import { calculateFinancingLimits } from '../finance/financing-calculator.js';
import { evaluateSbpe } from './sbpe-engine.js';
import { estimateSubsidy } from '../finance/subsidy-calculator.js';

export function evaluateEligibility({ buyer, property, ruleSet, referenceDate = new Date(), manualAnnualRate = 0 }) {
  const checks = [];
  const warnings = [];
  const errors = [];
  const brokerNotes = [];

  // Regra operacional do Simulador Norte: modalidade SFH segue sempre pelo SBPE,
  // independentemente de renda ou valor do imóvel.
  if (property.constructionType === 'sfh') {
    return evaluateSbpe({
      buyer, property, ruleSet, referenceDate, manualAnnualRate,
      fallbackReason: 'Modalidade SFH selecionada. Operação direcionada obrigatoriamente ao SBPE.'
    });
  }

  // Combinação inexistente no produto: imóvel usado não pode estar em obras.
  if (property.condition === 'usado' && property.deliveryStatus === 'em_obras') {
    return {
      eligible: false,
      status: 'invalid_property_combination',
      program: 'Pendente',
      creditLine: null,
      message: 'A combinação Usado + Em obras não é permitida. Selecione imóvel pronto.',
      checks: [{ ok: false, label: 'Combinação Usado + Em obras inválida' }],
      warnings: [], errors: ['A combinação Usado + Em obras não existe.'], brokerNotes: []
    };
  }

  // O MCMV automático só é avaliado quando a modalidade informada é Associativo.
  // Novo/Usado + Pronto: base da cota = menor entre venda e avaliação.
  // Novo + Em obras: base da cota = avaliação bancária.
  const incomeResult = findIncomeBand(buyer.grossIncome, ruleSet.files['income-bands']);
  checks.push({ ok: incomeResult.matched, label: incomeResult.matched ? 'Renda analisada no MCMV' : incomeResult.message });

  if (!incomeResult.matched) {
    const reason = incomeResult.status === 'outside_program'
      ? 'Renda acima do limite do Minha Casa, Minha Vida.'
      : incomeResult.message;
    return evaluateSbpe({ buyer, property, ruleSet, referenceDate, manualAnnualRate, fallbackReason: reason });
  }

  const { rule: incomeRule } = incomeResult;
  const fgtsStatus = buyer.hasThreeYearsFgts ? 'cotista' : 'nao_cotista';
  checks.push({ ok: true, label: `${buyer.hasThreeYearsFgts ? 'Cotista' : 'Não cotista'} FGTS identificado` });

  const propertyResult = evaluatePropertyLimit({
    property,
    band: incomeRule.band,
    municipalitiesData: ruleSet.files.municipalities,
    propertyLimitsData: ruleSet.files['property-limits']
  });
  checks.push({ ok: Boolean(propertyResult.municipality), label: propertyResult.municipality ? 'Município localizado' : 'Município sem regra cadastrada' });
  checks.push({ ok: propertyResult.eligible, label: propertyResult.message });

  if (!propertyResult.eligible) {
    return evaluateSbpe({
      buyer,
      property,
      ruleSet,
      referenceDate,
      manualAnnualRate,
      fallbackReason: `Renda compatível com ${incomeRule.band}, mas o imóvel não atende ao teto dessa faixa no MCMV.`
    });
  }

  const region = propertyResult.municipality?.countryRegion || null;
  const rateResult = region
    ? findInterestRate({
        band: incomeRule.band,
        subBand: incomeRule.subBand,
        region,
        fgtsStatus,
        referenceDate,
        ratesData: ruleSet.files['interest-rates']
      })
    : { matched: false, message: 'Taxa automática indisponível enquanto o imóvel não estiver enquadrado.' };
  checks.push({ ok: rateResult.matched, label: rateResult.matched ? 'Taxa automática localizada' : rateResult.message });

  if (!rateResult.matched) {
    return evaluateSbpe({ buyer, property, ruleSet, referenceDate, manualAnnualRate, fallbackReason: 'Não foi localizada taxa MCMV compatível para esta operação.' });
  }

  const quotaResult = findQuota({
    quotasData: ruleSet.files['financing-quotas'],
    property
  });
  const baseQuota = calculateQuotaBase({
    saleValue: property.saleValue,
    appraisalValue: property.appraisalValue,
    quotaBase: quotaResult.quotaBase
  });
  checks.push({ ok: true, label: `Cota de ${(quotaResult.quota * 100).toFixed(0)}% localizada` });
  checks.push({ ok: baseQuota > 0, label: quotaResult.quotaBase === 'appraisal' ? 'Base da cota definida pela avaliação bancária' : 'Base da cota definida pelo menor valor entre venda e avaliação' });

  const termResult = calculateMaximumTerm({ birthDate: buyer.oldestBuyerBirthDate, requestedTerm: property.requestedTerm, termsData: ruleSet.files.terms, referenceDate });
  checks.push({ ok: termResult.allowedMonths > 0, label: `Prazo máximo estimado: ${termResult.allowedMonths} meses` });
  if (termResult.notice) warnings.push(termResult.notice);

  const saleValue = Number(property.saleValue || 0);
  const appraisalValue = Number(property.appraisalValue || 0);
  const appraisalDifference = appraisalValue - saleValue;
  const subsidyResult = estimateSubsidy({
    income: buyer.grossIncome,
    hasAdditionalProponentOrDependent: Boolean(buyer.hasAdditionalProponentOrDependent),
    saleValue,
    fgtsBalance: buyer.fgtsBalance,
    subsidiesData: ruleSet.files.subsidies
  });
  if (subsidyResult.estimated > 0) {
    checks.push({ ok: true, label: `Subsídio aproximado estimado em R$ ${subsidyResult.estimated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` });
    warnings.push(subsidyResult.notice);
  } else if (Number(buyer.grossIncome || 0) <= 5000) {
    checks.push({ ok: true, label: 'Subsídio estimado em R$ 0,00 para os dados informados' });
  }
  const eligible = rateResult.matched && termResult.allowedMonths > 0;

  let financingAnalysis = null;
  if (eligible) {
    financingAnalysis = calculateFinancingLimits({
      income: buyer.grossIncome,
      commitments: buyer.monthlyCommitments,
      nominalAnnualRate: rateResult.nominalAnnualRate,
      months: termResult.allowedMonths,
      quotaBase: baseQuota,
      quota: quotaResult.quota,
      saleValue,
      fgtsBalance: buyer.fgtsBalance,
      settings: ruleSet.files['app-settings'],
      subsidyUsed: subsidyResult.estimated
    });
    checks.push({ ok: financingAnalysis.price.estimatedFinancing > 0, label: 'Limites pela renda, cota e valor necessário calculados' });
  }

  if (quotaResult.quotaBase === 'appraisal' && appraisalDifference > 0) {
    brokerNotes.push(`A avaliação supera o valor de venda em ${appraisalDifference.toFixed(2)}. No associativo em obras, a avaliação foi usada como base da cota.`);
    brokerNotes.push('Essa diferença favorável pode estar vinculada à estrutura contratual da construtora, inclusive eventual parcela bônus. Confirmar no contrato da operação.');
  }

  return {
    eligible,
    status: eligible ? 'eligible' : propertyResult.status,
    program: 'Minha Casa, Minha Vida',
    creditLine: 'MCMV',
    band: incomeRule.band,
    subBand: incomeRule.subBand,
    fgtsStatus,
    fgtsAllowed: true,
    region,
    municipality: propertyResult.municipality,
    propertyLimit: propertyResult.propertyLimit,
    propertyWithinLimit: propertyResult.eligible,
    nominalAnnualRate: rateResult.nominalAnnualRate ?? null,
    monthlyRate: rateResult.monthlyRate ?? null,
    effectiveAnnualRate: rateResult.effectiveAnnualRate ?? null,
    rateRuleId: rateResult.rule?.id ?? null,
    rateIndexer: 'Sem indexador adicional nesta simulação',
    rateEditable: false,
    quota: quotaResult.quota,
    quotas: { price: quotaResult.quota, sac: quotaResult.quota },
    quotaOrigin: quotaResult.origin,
    quotaBaseType: quotaResult.quotaBase,
    maximumTermMonths: termResult.allowedMonths,
    baseQuota,
    appraisalDifference,
    subsidyUsed: subsidyResult.estimated,
    subsidyPotentialMaximum: subsidyResult.potentialMaximum,
    subsidyProfile: subsidyResult.profile,
    subsidyNotice: subsidyResult.notice,
    financingAnalysis,
    message: eligible ? 'Operação enquadrada nas regras automáticas cadastradas.' : propertyResult.message,
    requiresManualRate: false,
    checks,
    warnings,
    errors,
    brokerNotes
  };
}
