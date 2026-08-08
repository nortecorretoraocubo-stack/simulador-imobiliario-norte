import { getState } from '../state.js';
import { formatCurrency } from '../core/formatters.js';
import { rulesRepository } from '../rules/rules-repository.js';
import { evaluateEligibility } from '../rules/eligibility-engine.js';
import { generateConstructionFlow, calculateManualFlow } from '../construction/construction-flow-engine.js';
import { calculateAcquisitionCosts } from '../finance/acquisition-costs-calculator.js';
import { reconcilePurchase } from '../finance/purchase-reconciliation.js';
import { proposalFromPercent, percentageFlow, buildCorrectionProjection } from '../finance/projection-calculator.js';
import { automaticIntermediateOffsets, manualIntermediateOffsets, scheduleDates, formatInstallmentDate } from '../core/installment-dates.js';

const formatPercent = (value, digits = 2) => value == null
  ? 'Indisponível'
  : `${Number(value).toFixed(digits).replace('.', ',')}%`;

const factorLabels = {
  income: 'limite de renda',
  quota: 'limite da cota',
  needed: 'valor necessário para concluir a compra'
};

function calculateInstallments({ system, financing, monthlyRate, months }) {
  const pv = Math.max(Number(financing) || 0, 0);
  const i = Math.max(Number(monthlyRate) || 0, 0);
  const n = Math.max(Math.trunc(Number(months) || 0), 1);

  if (!pv) return { first: 0, last: 0, total: 0, interest: 0, amortization: 0 };

  if (system === 'sac') {
    const amortization = pv / n;
    const first = amortization + (pv * i);
    const last = amortization + (amortization * i);
    const totalInterest = i * pv * (n + 1) / 2;
    return {
      first,
      last,
      total: pv + totalInterest,
      interest: totalInterest,
      amortization
    };
  }

  const factor = i === 0 ? 0 : Math.pow(1 + i, n);
  const payment = i === 0 ? pv / n : pv * ((i * factor) / (factor - 1));
  const total = payment * n;
  return {
    first: payment,
    last: payment,
    total,
    interest: Math.max(total - pv, 0),
    amortization: 0
  };
}

function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }).format(new Date());
}

function resultStatus(flow, isConstruction) {
  if (!isConstruction) return 'Imóvel pronto';
  if (flow.status === 'closed') return 'Fluxo fechado';
  if (flow.status === 'missing') return `Falta distribuir ${formatCurrency(flow.difference)}`;
  return `Fluxo excede em ${formatCurrency(Math.abs(flow.difference))}`;
}

function renderPaymentFlow(flow, isConstruction, manualEditing, schedule = null) {
  if (!isConstruction) return '';
  const monthlyDates = schedule?.dates?.monthly || [];
  const interDates = schedule?.dates?.intermediates || [];
  const monthlyNote = monthlyDates.length ? `<small>${formatInstallmentDate(monthlyDates[0])} até ${formatInstallmentDate(monthlyDates[monthlyDates.length - 1])}</small>` : '';
  const interNote = interDates.length ? `<small>${interDates.map(formatInstallmentDate).join(' · ')}</small>` : '';
  const keysNote = schedule?.dates?.keys ? `<small>${formatInstallmentDate(schedule.dates.keys)}</small>` : '';
  return `<article class="card result-section-card">
    <div class="result-section-heading">
      <div><span class="status-label">Pagamento da entrada</span><h2>${manualEditing ? 'Fluxo ajustado' : 'Sugestão de fluxo'}</h2></div>
      <span class="badge ${flow.status === 'closed' ? 'badge-success' : 'badge-warning'}">${resultStatus(flow, true)}</span>
    </div>
    <div class="client-flow-grid">
      <div><span>Ato</span><strong>${formatCurrency(flow.act)}</strong></div>
      <div><span>Mensais</span><strong>${flow.monthlyQuantity ? `${flow.monthlyQuantity}× ${formatCurrency(flow.monthlyValue)}` : 'Não utilizadas'}</strong>${monthlyNote}</div>
      <div><span>${flow.intermediateLabel || 'Intermediárias'}</span><strong>${flow.intermediateQuantity ? `${flow.intermediateQuantity}× ${formatCurrency(flow.intermediateValue)}` : 'Não utilizadas'}</strong>${interNote}</div>
      <div><span>Chaves</span><strong>${flow.keys ? formatCurrency(flow.keys) : 'Não utilizada'}</strong>${keysNote}</div>
      ${flow.proSoluto ? `<div><span>Pró-soluto</span><strong>${formatCurrency(flow.proSoluto)}</strong></div>` : ''}
    </div>
  </article>`;
}

function renderDetailedAnalysis({ result, item, installments, flow, state, entry, acquisitionCosts, approvedFinancing, financing }) {
  const capacity = result.financingAnalysis?.incomeCapacity || {};
  const checks = result.checks || [];
  const technicalAlerts = [
    ...(result.warnings || []),
    ...(result.brokerNotes || []),
    ...(state.flow.manualEditing ? ['O fluxo de pagamento foi editado manualmente.'] : []),
    ...(state.flow.includeProSoluto ? ['Pró-soluto incluído na edição manual do fluxo. Confirmar condições no contrato da construtora.'] : [])
  ];
  const baseLabel = result.quotaBaseType === 'appraisal'
    ? 'Avaliação bancária'
    : 'Menor valor entre venda e avaliação';

  return `<details class="technical-details">
    <summary><span>ⓘ</span> Análise detalhada</summary>
    <div class="technical-content">
      <div class="technical-grid">
        <section>
          <span class="status-label">Enquadramento</span>
          <div class="summary-list">
            <div class="summary-row"><span>Programa</span><strong>${result.program}</strong></div>
            <div class="summary-row"><span>Linha / faixa</span><strong>${result.creditLine || result.band}${result.subBand ? ` · ${result.subBand}` : ''}</strong></div>
            <div class="summary-row"><span>Condição FGTS</span><strong>${result.fgtsStatus === 'cotista' ? 'Cotista' : 'Não cotista'}</strong></div>
            <div class="summary-row"><span>Taxa nominal</span><strong>${formatPercent(result.nominalAnnualRate)} a.a.${result.rateIndexer ? ` + ${result.rateIndexer}` : ''}</strong></div>
            <div class="summary-row"><span>Taxa mensal</span><strong>${formatPercent((result.monthlyRate || 0) * 100, 4)}</strong></div>
            <div class="summary-row"><span>Taxa efetiva</span><strong>${formatPercent(result.effectiveAnnualRate)} a.a.</strong></div>
            <div class="summary-row"><span>Prazo</span><strong>${result.maximumTermMonths} meses</strong></div>
          </div>
        </section>
        <section>
          <span class="status-label">Limites calculados</span>
          <div class="summary-list">
            <div class="summary-row"><span>Limite pela renda</span><strong>${formatCurrency(item.incomeLimit)}</strong></div>
            <div class="summary-row"><span>Limite pela cota</span><strong>${formatCurrency(item.quotaLimit)}</strong></div>
            <div class="summary-row"><span>Valor necessário</span><strong>${formatCurrency(item.amountNeeded)}</strong></div>
            <div class="summary-row"><span>Fator limitante</span><strong>${factorLabels[item.limitingFactor] || item.limitingFactor}</strong></div>
            <div class="summary-row"><span>Parcela-base financeira</span><strong>${formatCurrency(capacity.financialBasePayment)}</strong></div>
            <div class="summary-row"><span>Reserva comercial</span><strong>${formatCurrency(capacity.commercialReserve)}</strong></div>
          </div>
        </section>
        <section>
          <span class="status-label">Imóvel e garantia</span>
          <div class="summary-list">
            <div class="summary-row"><span>Valor de venda</span><strong>${formatCurrency(state.property.saleValue)}</strong></div>
            <div class="summary-row"><span>Avaliação bancária</span><strong>${formatCurrency(state.property.appraisalValue)}</strong></div>
            <div class="summary-row"><span>Base da cota</span><strong>${formatCurrency(result.baseQuota)}</strong></div>
            <div class="summary-row"><span>Critério da base</span><strong>${baseLabel}</strong></div>
            <div class="summary-row"><span>Cota utilizada</span><strong>${formatPercent((item.quota ?? result.quota) * 100, 0)}</strong></div>
            <div class="summary-row"><span>Teto da linha/faixa</span><strong>${result.propertyLimit ? formatCurrency(result.propertyLimit) : 'Não se aplica'}</strong></div>
          </div>
        </section>
        <section>
          <span class="status-label">Financiamento selecionado</span>
          <div class="summary-list">
            <div class="summary-row"><span>Sistema</span><strong>${state.selectedSystem === 'sac' ? 'SAC' : 'Price'}</strong></div>
            <div class="summary-row"><span>Financiamento aprovado estimado</span><strong>${formatCurrency(approvedFinancing)}</strong></div>
            <div class="summary-row"><span>Financiamento após ajuste da entrada</span><strong>${formatCurrency(financing)}</strong></div>
            <div class="summary-row"><span>Primeira parcela financeira</span><strong>${formatCurrency(installments.first)}</strong></div>
            <div class="summary-row"><span>Última parcela financeira</span><strong>${formatCurrency(installments.last)}</strong></div>
            ${state.selectedSystem === 'sac' ? `<div class="summary-row"><span>Amortização mensal</span><strong>${formatCurrency(installments.amortization)}</strong></div>` : ''}
            <div class="summary-row"><span>Total aproximado</span><strong>${formatCurrency(installments.total)}</strong></div>
            <div class="summary-row"><span>Juros aproximados</span><strong>${formatCurrency(installments.interest)}</strong></div>
            <div class="summary-row"><span>Subsídio estimado</span><strong>${formatCurrency(result.subsidyUsed || 0)}</strong></div>
            <div class="summary-row"><span>Potencial máximo indicativo</span><strong>${formatCurrency(result.subsidyPotentialMaximum || 0)}</strong></div>
            <div class="summary-row"><span>Entrada apurada</span><strong>${formatCurrency(entry)}</strong></div>
          </div>
        </section>
      </div>

      <section class="technical-acquisition-costs">
        <span class="status-label">Custos de documentação e contratação</span>
        <div class="summary-list">
          <div class="summary-row"><span>Reserva estimada</span><strong>${formatCurrency(acquisitionCosts.minimum)} a ${formatCurrency(acquisitionCosts.maximum)}</strong></div>
          <div class="summary-row"><span>Referência sugerida</span><strong>${formatCurrency(acquisitionCosts.suggested)}</strong></div>
          <div class="summary-row"><span>ITBI preliminar (3%)</span><strong>${formatCurrency(acquisitionCosts.preliminaryItbi)}</strong></div>
          <div class="summary-row"><span>Avaliação bancária</span><strong>${formatCurrency(acquisitionCosts.components.bankAppraisal?.minimumValue)} a ${formatCurrency(acquisitionCosts.components.bankAppraisal?.maximumValue)}</strong></div>
          <div class="summary-row"><span>Análise de crédito/jurídica</span><strong>${formatCurrency(acquisitionCosts.components.creditAndLegalAnalysis?.minimumValue)} a ${formatCurrency(acquisitionCosts.components.creditAndLegalAnalysis?.maximumValue)}</strong></div>
          <div class="summary-row"><span>Certidões</span><strong>${formatCurrency(acquisitionCosts.components.certificates?.minimumValue)} a ${formatCurrency(acquisitionCosts.components.certificates?.maximumValue)}</strong></div>
          <div class="summary-row"><span>Registro do imóvel</span><strong>Tabela progressiva vigente</strong></div>
        </div>
        <div class="technical-alerts">
          <p>Esses valores são paralelos à entrada e não foram abatidos dos recursos próprios apresentados na compra.</p>
          <p>${acquisitionCosts.components.propertyRegistry?.discountNote || ''}</p>
          <p>${acquisitionCosts.components.itbi?.sfhNote || ''}</p>
          <p>${acquisitionCosts.components.mandatoryInsurance?.note || ''}</p>
        </div>
      </section>

      <section class="technical-checks">
        <span class="status-label">Verificações do sistema</span>
        <div class="diagnostic-list">${checks.map((check) => `<div class="diagnostic-item ${check.ok ? 'ok' : 'error'}"><span class="diagnostic-icon">${check.ok ? '✓' : '!'}</span><span>${check.label}</span></div>`).join('')}</div>
      </section>

      ${technicalAlerts.length ? `<section class="technical-alerts"><span class="status-label">Observações e alertas</span>${technicalAlerts.map((alert) => `<p>${alert}</p>`).join('')}</section>` : ''}
      ${state.property.deliveryStatus === 'em_obras' ? `<p class="technical-flow-status"><strong>Status do fluxo:</strong> ${resultStatus(flow, true)}</p>` : ''}
    </div>
  </details>`;
}

function renderProjection(data) {
  if (!data.isConstruction || !data.projection) return '';
  const { projection, state, financing, item } = data;
  const pct = (v) => `${Number(v||0).toFixed(2).replace('.', ',')}%`;
  const rows = projection.rows.map(r => `<tr><td>${r.number}</td><td>${formatCurrency(r.flowCorrected)}</td><td>${formatCurrency(r.evolution)}</td><td><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('');
  const risk = state.property.constructionType === 'sfh' ? `<div class="risk-box risk-${projection.risk.toLowerCase()}"><span>Nível de risco projetado no repasse</span><strong>${projection.risk}</strong><small>Saldo futuro estimado com INCC: ${formatCurrency(projection.projectedFinancing)} · capacidade atual pela renda: ${formatCurrency(item.incomeLimit)} · uso projetado: ${pct(projection.projectedUsage*100)}</small></div>` : '';
  const assoc = state.property.constructionType === 'associativo' ? `<div class="alert alert-info">A evolução de obra é uma estimativa. Primeira parcela projetada: <strong>${formatCurrency(projection.firstEvolution)}</strong>. A cobrança real depende das liberações mensais após medição da CAIXA e pode incluir TR, seguros e tarifa administrativa.</div>` : '';
  return `<details class="technical-details projection-details"><summary><span>↗</span> Projeção com correção</summary><div class="technical-content"><div class="projection-indexes"><span>INCC de referência: <strong>${pct(projection.inccMonthly*100)} a.m.</strong></span><span>IGP-M de referência: <strong>${pct(projection.igpmMonthly*100)} a.m.</strong></span></div>${risk}${assoc}<div class="projection-table-wrap"><table class="projection-table"><thead><tr><th>Nº da parcela</th><th>Parcela fluxo</th><th>Parcela Ev. Obra</th><th>Parcela Total</th></tr></thead><tbody>${rows}</tbody></table></div><p class="result-helper">Projeção comercial. O ato não sofre INCC; as demais parcelas do fluxo recebem correção cumulativa até o pagamento. Pró-soluto, quando houver, é projetado pelo IGP-M.</p></div></details>`;
}

export function buildReportData() {
  const s = getState();
  const status = rulesRepository.getStatus();
  const rules = rulesRepository.getAll();
  const result = status.ready
    ? evaluateEligibility({ buyer: s.buyer, property: s.property, ruleSet: rules, manualAnnualRate: s.credit?.sbpeAnnualRate })
    : null;
  if (!result?.eligible || !s.selectedSystem) return null;

  const item = result.financingAnalysis[s.selectedSystem];
  const approvedFinancing = item.estimatedFinancing || 0;
  const fgts = result.financingAnalysis.fgtsUsed || 0;
  const subsidy = Math.min(Math.max(Number(result.subsidyUsed) || 0, 0), Math.max((s.property.saleValue || 0) - fgts, 0));
  const isConstruction = s.property.deliveryStatus === 'em_obras';
  const isAssociative = s.property.constructionType === 'associativo';
  const settings = rulesRepository.get('construction-flow') || {};
  const projectionSettings = rulesRepository.get('projection-settings') || {};
  const acquisitionCosts = calculateAcquisitionCosts({ saleValue: s.property.saleValue, appraisalValue: s.property.appraisalValue, settings: rulesRepository.get('acquisition-costs') || {} });

  let financing = approvedFinancing;
  let entry = Math.max((s.property.saleValue || 0) - financing - fgts - subsidy, 0);
  let minimumEntry = entry;
  let reconciliation = reconcilePurchase({ saleValue:s.property.saleValue, approvedFinancing, fgts, subsidy, buyerContribution:entry });
  let automatic = null;
  let flow = { act:0, monthlyQuantity:0, monthlyValue:0, monthlyTotal:0, intermediateQuantity:0, intermediateValue:0, intermediateTotal:0, keys:0, proSoluto:0, proSolutoInstallments:0, status:'closed', compositionTotal:entry };
  let proposal = null;
  let approvedBase = approvedFinancing;

  if (isConstruction) {
    const months=Number(s.property.monthsUntilDelivery)||0;
    if (isAssociative) {
      automatic = generateConstructionFlow({ entry, income:s.buyer.grossIncome, monthsUntilDelivery:months, settings });
      approvedBase = approvedFinancing;
    } else {
      const bankCapacity=Math.min(item.incomeLimit||0,item.quotaLimit||0,s.property.saleValue||0);
      proposal = proposalFromPercent({ saleValue:s.property.saleValue, approvedFinancing:bankCapacity, fgts, subsidy, requestedPercent:s.flow.constructionProposalPercent });
      const suggestions=settings.intermediateSuggestion || [];
      const suggested=suggestions.find(x=>months >= Number(x.minimumMonths||0) && months <= (x.maximumMonths==null?Infinity:Number(x.maximumMonths)));
      const interQty=Math.max(Number(suggested?.maximumCount)||0,0);
      automatic = percentageFlow({ entry:proposal.cashFlowEntry, monthsUntilDelivery:months, actPercentage:s.flow.actPercentage, monthlyPercentage:s.flow.monthlyPercentage, intermediatePercentage:s.flow.intermediatePercentage, intermediateQuantity:interQty });
      entry = proposal.cashFlowEntry;
      financing = proposal.financing;
      approvedBase = proposal.financing;
    }

    if (s.flow.manualEditing) {
      flow = calculateManualFlow({
        entry: isAssociative ? minimumEntry : proposal.cashFlowEntry,
        income: s.buyer.grossIncome,
        monthlyLimitPercentage: settings.limits?.monthlyIncomePercentage,
        intermediateLimitPercentage: settings.limits?.intermediateIncomePercentage,
        keysLimitPercentage: settings.limits?.keysIncomePercentage,
        act: s.flow.act ?? automatic.act,
        monthlyQuantity: Math.min(s.flow.monthlyQuantity ?? automatic.monthlyQuantity, months),
        monthlyValue: s.flow.monthlyValue ?? automatic.monthlyValue,
        intermediateQuantity: Math.min(s.flow.intermediateQuantity ?? automatic.intermediateQuantity,12),
        intermediateValue: s.flow.intermediateValue ?? automatic.intermediateValue,
        keys: s.flow.keys ?? automatic.keys,
        proSolutoValue: s.flow.includeProSoluto ? s.flow.proSolutoValue : 0
      });
      flow.proSolutoInstallments = Math.max(Number(s.flow.proSolutoInstallments)||0,0);
      flow.intermediateLabel = ({trimestrais:'Trimestrais',semestrais:'Semestrais',anuais:'Anuais',livre:'Intermediárias livres'})[s.flow.intermediateScheduleType || 'livre'] || 'Intermediárias';
      reconciliation = reconcilePurchase({ saleValue:s.property.saleValue, approvedFinancing:approvedBase, fgts, subsidy, buyerContribution:flow.compositionTotal });
      const manualSchedule = manualIntermediateOffsets({ type:s.flow.intermediateScheduleType || 'livre', quantity:flow.intermediateQuantity, firstOffset:s.flow.intermediateFirstOffset, freeOffsets:s.flow.intermediateFreeOffsets || [], monthsUntilDelivery:months });
      if (reconciliation.status !== 'closed' || !manualSchedule.valid) return null;
      financing = reconciliation.financing;
      entry = reconciliation.buyerContribution;
      flow = { ...flow, entry, status:reconciliation.status, difference:0 };
    } else {
      flow = automatic;
      reconciliation = reconcilePurchase({ saleValue:s.property.saleValue, approvedFinancing:approvedBase, fgts, subsidy, buyerContribution:entry });
    }
  }

  let offsets=[];
  let schedule={ offsets:[], valid:true, warning:'', dates:{ act:new Date(), monthly:[], intermediates:[], keys:null } };
  if (isConstruction) {
    if (s.flow.manualEditing) {
      const ms=manualIntermediateOffsets({ type:s.flow.intermediateScheduleType || 'livre', quantity:flow.intermediateQuantity, firstOffset:s.flow.intermediateFirstOffset, freeOffsets:s.flow.intermediateFreeOffsets || [], monthsUntilDelivery:s.property.monthsUntilDelivery });
      offsets=ms.offsets; schedule={...ms,dates:scheduleDates({ dueDay:s.flow.dueDay||10, monthsUntilDelivery:s.property.monthsUntilDelivery, monthlyQuantity:flow.monthlyQuantity, intermediateOffsets:offsets })};
    } else {
      offsets=automaticIntermediateOffsets(flow.intermediateQuantity,s.property.monthsUntilDelivery);
      schedule={offsets,valid:true,warning:'',dates:scheduleDates({ dueDay:s.flow.dueDay||10, monthsUntilDelivery:s.property.monthsUntilDelivery, monthlyQuantity:flow.monthlyQuantity, intermediateOffsets:offsets })};
    }
  }

  const installments = calculateInstallments({ system:s.selectedSystem, financing, monthlyRate:result.monthlyRate, months:result.maximumTermMonths });
  const projection = isConstruction ? buildCorrectionProjection({ flow, monthsUntilDelivery:s.property.monthsUntilDelivery, financing, monthlyFinancingRate:result.monthlyRate, constructionType:s.property.constructionType, projectionSettings, incomeLimit:item.incomeLimit, dueDay:s.flow.dueDay||10, intermediateOffsets:offsets }) : null;
  return { state:s, result, item, approvedFinancing, financing, fgts, subsidy, entry, minimumEntry, reconciliation, settings, acquisitionCosts, automatic, flow, isConstruction, installments, proposal, projection, projectionSettings, schedule };
}

export const summaryPage = () => {
  const data = buildReportData();
  if (!data) {
    return `<section class="page-grid"><header><p class="eyebrow">Etapa 5 de 5</p><h1 class="page-title">Resultado da simulação</h1></header><div class="alert alert-warning">Conclua o enquadramento e escolha Price ou SAC antes de abrir o resultado.</div><div class="actions-row"><a class="button button-primary" href="#/enquadramento">Ir ao enquadramento</a></div></section>`;
  }
  const { state: s, result, item, approvedFinancing, financing, fgts, subsidy, entry, acquisitionCosts, flow, isConstruction, installments } = data;
  return `<section class="page-grid result-page">
    <header class="result-hero">
      <span class="result-check" aria-hidden="true">✓</span>
      <div><p class="eyebrow">Etapa 5 de 5</p><h1 class="page-title" tabindex="-1">Sua simulação está pronta</h1><p class="page-description">Uma visão clara de como poderá ficar a compra deste imóvel.</p></div>
    </header>

    <article class="card client-result-card">
      <div class="client-result-header">
        <div><span class="status-label">Resultado da simulação</span><h2>${s.buyer.name || 'Cliente'}</h2><p>${s.property.projectName || 'Imóvel selecionado'} · ${todayLabel()}</p></div>
        <span class="system-chip">${s.selectedSystem === 'sac' ? 'SAC' : 'PRICE'}</span>
      </div>

      <div class="client-main-values">
        <div class="main-value"><span>Valor do imóvel</span><strong>${formatCurrency(s.property.saleValue)}</strong></div>
        <div class="main-value featured"><span>Financiamento estimado</span><strong>${formatCurrency(financing)}</strong></div>
        <div class="main-value"><span>Entrada necessária</span><strong>${formatCurrency(entry)}</strong></div>
      </div>

      <div class="client-support-values">
        <div><span>FGTS</span><strong>${fgts ? formatCurrency(fgts) : 'Não utilizado'}</strong></div>
        <div><span>Subsídio estimado</span><strong>${formatCurrency(subsidy)}</strong></div>
        <div><span>Prazo</span><strong>${result.maximumTermMonths} meses</strong></div>
        <div><span>Taxa nominal</span><strong>${formatPercent(result.nominalAnnualRate)} a.a.${result.rateIndexer ? ` + ${result.rateIndexer}` : ''}</strong></div>
      </div>

      <div class="client-support-values simulation-parameters">
        <div><span>Renda utilizada</span><strong>${formatCurrency(s.buyer.grossIncome)}</strong></div>
        <div><span>Participante ou dependente</span><strong>${s.buyer.hasAdditionalProponentOrDependent ? 'Sim' : 'Não'}</strong></div>
      </div>
    </article>

    <article class="card result-section-card">
      <div class="result-section-heading"><div><span class="status-label">Financiamento</span><h2>Parcelas estimadas</h2></div><span class="badge badge-soft">${s.selectedSystem === 'sac' ? 'Parcelas decrescentes' : 'Parcelas financeiras fixas'}</span></div>
      <div class="installment-pair">
        <div><span>Primeira parcela</span><strong>${formatCurrency(installments.first)}</strong></div>
        <div><span>Última parcela</span><strong>${formatCurrency(installments.last)}</strong></div>
      </div>
      <p class="result-helper">Valores financeiros aproximados, sem substituir o cálculo oficial de seguros, tarifas e análise de crédito.</p>
    </article>

    ${!isConstruction ? `<article class="card result-section-card acquisition-costs-card">
      <div class="result-section-heading">
        <div><span class="status-label">Documentação e contratação</span><h2>Reserve também estes custos</h2></div>
        <span class="badge badge-soft">Estimativa</span>
      </div>
      <div class="client-main-values acquisition-values">
        <div class="main-value featured"><span>Faixa estimada</span><strong>${formatCurrency(acquisitionCosts.minimum)} a ${formatCurrency(acquisitionCosts.maximum)}</strong></div>
        <div class="main-value"><span>Reserva sugerida</span><strong>${formatCurrency(acquisitionCosts.suggested)}</strong></div>
      </div>
      <p class="result-helper">Estimativa de impostos, registro, cartório e despesas bancárias. Esse valor é separado da entrada e deve ser confirmado na contratação.</p>
    </article>` : ''}

    ${renderPaymentFlow(flow, isConstruction, s.flow.manualEditing, data.schedule)}

    <div class="client-legal-notice">
      <strong>Importante</strong>
      <p>Esta simulação é uma estimativa comercial e não representa aprovação de crédito. Taxas, cotas, subsídios, seguros, prazos e valores dependem da análise da instituição financeira, avaliação do imóvel e regras vigentes.</p>
    </div>

    ${renderDetailedAnalysis({ result, item, installments, flow, state: s, entry, acquisitionCosts, approvedFinancing, financing })}

    ${renderProjection(data)}

    <article class="card report-actions-card">
      <div><span class="status-label">Relatórios e compartilhamento</span><h2>Leve esta simulação com você</h2><p>Gere uma versão limpa para o cliente, abra o relatório técnico ou envie o resumo pelo WhatsApp.</p></div>
      <div class="report-action-grid">
        <button id="whatsapp-result" class="button button-primary" type="button">WhatsApp</button>
        <button id="copy-whatsapp-result" class="button button-secondary" type="button">Copiar mensagem</button>
        <button id="pdf-client-result" class="button button-secondary" type="button">PDF Cliente</button>
        <button id="pdf-broker-result" class="button button-secondary" type="button">PDF Corretor</button>
        <button id="print-result" class="button button-ghost" type="button">Imprimir</button>
      </div>
      <small>Ao gerar o PDF, escolha “Salvar como PDF” na janela de impressão do navegador.</small>
    </article>

    <div class="actions-row result-actions no-print">
      ${isConstruction ? '<a class="button button-ghost" href="#/fluxo">Editar fluxo</a>' : ''}
      <a class="button button-ghost" href="#/enquadramento">Alterar financiamento</a>
      <button id="reset-simulation" class="button button-primary" type="button">Nova simulação</button>
    </div>
  </section>`;
};
