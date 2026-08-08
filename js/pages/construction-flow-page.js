import { getState } from '../state.js';
import { formatCurrency } from '../core/formatters.js';
import { rulesRepository } from '../rules/rules-repository.js';
import { evaluateEligibility } from '../rules/eligibility-engine.js';
import { generateConstructionFlow, calculateManualFlow } from '../construction/construction-flow-engine.js';
import { reconcilePurchase } from '../finance/purchase-reconciliation.js';
import { proposalFromPercent, percentageFlow, buildCorrectionProjection } from '../finance/projection-calculator.js';
import { automaticIntermediateOffsets, manualIntermediateOffsets, monthOffsetOptions, scheduleDates, formatInstallmentDate } from '../core/installment-dates.js';

function settings() { return rulesRepository.get('construction-flow') || {}; }
function projectionSettings() { return rulesRepository.get('projection-settings') || {}; }
function moneyPct(v){ return `${Number(v||0).toFixed(2).replace('.', ',')}%`; }
function pct(value) { return `${Number(value || 0).toFixed(1).replace('.', ',')}% da renda`; }

function intermediateCount(months, cfg) {
  const list=cfg.intermediateSuggestion || [];
  const found=list.find(x=>months >= Number(x.minimumMonths||0) && months <= (x.maximumMonths==null?Infinity:Number(x.maximumMonths)));
  return Math.max(Number(found?.maximumCount)||0,0);
}

function operation(state, result) {
  const analysis=result?.financingAnalysis;
  const selected=analysis?.[state.selectedSystem];
  const sale=Math.max(Number(state.property.saleValue)||0,0);
  const approved=Math.min(Math.max(Number(selected?.estimatedFinancing)||0,0),sale);
  const fgts=Math.min(Math.max(Number(analysis?.fgtsUsed)||0,0),Math.max(sale-approved,0));
  const subsidy=Math.min(Math.max(Number(result?.subsidyUsed)||0,0),Math.max(sale-approved-fgts,0));
  const bankCapacity=Math.min(Math.max(Number(selected?.incomeLimit)||0,0),Math.max(Number(selected?.quotaLimit)||0,0),sale);
  const entry=Math.max(sale-approved-fgts-subsidy,0);
  return {sale,approved,bankCapacity,fgts,subsidy,entry,selected};
}

function isAssociative(state) { return state.property.constructionType === 'associativo'; }

function intermediateName(type='livre') {
  return ({ trimestrais:'Trimestrais', semestrais:'Semestrais', anuais:'Anuais', livre:'Intermediárias livres' })[type] || 'Intermediárias';
}

function associativeAutomatic(state, values) {
  const flow=generateConstructionFlow({
    entry:values.entry,
    income:state.buyer.grossIncome,
    monthsUntilDelivery:state.property.monthsUntilDelivery,
    settings:settings()
  });
  return { proposal:null, flow, approvedBase:values.approved, entryBase:values.entry };
}

function sfhAutomatic(state, values) {
  const cfg=settings();
  const proposal=proposalFromPercent({saleValue:values.sale,approvedFinancing:values.bankCapacity,fgts:values.fgts,subsidy:values.subsidy,requestedPercent:state.flow.constructionProposalPercent});
  const count=intermediateCount(Number(state.property.monthsUntilDelivery)||0,cfg);
  const flow=percentageFlow({entry:proposal.cashFlowEntry,monthsUntilDelivery:state.property.monthsUntilDelivery,actPercentage:state.flow.actPercentage,monthlyPercentage:state.flow.monthlyPercentage,intermediatePercentage:state.flow.intermediatePercentage,intermediateQuantity:count});
  return {proposal,flow,approvedBase:proposal.financing,entryBase:proposal.cashFlowEntry};
}

function automaticData(state, values) { return isAssociative(state) ? associativeAutomatic(state,values) : sfhAutomatic(state,values); }

function scheduleForFlow(state, flow, manual=false) {
  const months=Number(state.property.monthsUntilDelivery)||0;
  let schedule;
  if (manual) {
    schedule=manualIntermediateOffsets({
      type:state.flow.intermediateScheduleType || 'livre',
      quantity:flow.intermediateQuantity,
      firstOffset:state.flow.intermediateFirstOffset,
      freeOffsets:state.flow.intermediateFreeOffsets || [],
      monthsUntilDelivery:months
    });
  } else {
    schedule={ offsets:automaticIntermediateOffsets(flow.intermediateQuantity,months), valid:true, warning:'' };
  }
  const dates=scheduleDates({
    dueDay:state.flow.dueDay || 10,
    monthsUntilDelivery:months,
    monthlyQuantity:flow.monthlyQuantity,
    intermediateOffsets:schedule.offsets
  });
  return {...schedule,dates};
}

function manualData(state, values, auto) {
  const cfg=settings();
  const flow=calculateManualFlow({
    entry:auto.entryBase,
    income:state.buyer.grossIncome,
    monthlyLimitPercentage:cfg.limits?.monthlyIncomePercentage,
    intermediateLimitPercentage:cfg.limits?.intermediateIncomePercentage,
    keysLimitPercentage:cfg.limits?.keysIncomePercentage,
    act:state.flow.act ?? auto.flow.act,
    monthlyQuantity:Math.min(state.flow.monthlyQuantity ?? auto.flow.monthlyQuantity, Math.max(Number(state.property.monthsUntilDelivery)||0,0)),
    monthlyValue:state.flow.monthlyValue ?? auto.flow.monthlyValue,
    intermediateQuantity:Math.min(state.flow.intermediateQuantity ?? auto.flow.intermediateQuantity,12),
    intermediateValue:state.flow.intermediateValue ?? auto.flow.intermediateValue,
    keys:state.flow.keys ?? auto.flow.keys,
    proSolutoValue:state.flow.includeProSoluto ? state.flow.proSolutoValue : 0
  });
  flow.proSolutoInstallments=Math.max(Number(state.flow.proSolutoInstallments)||0,0);
  flow.intermediateLabel=intermediateName(state.flow.intermediateScheduleType || 'livre');
  const reconciliation=reconcilePurchase({saleValue:values.sale,approvedFinancing:auto.approvedBase,fgts:values.fgts,subsidy:values.subsidy,buyerContribution:flow.compositionTotal});
  const schedule=scheduleForFlow(state,flow,true);
  return {flow,reconciliation,schedule};
}

function dueDayControl(state) {
  const current=Number(state.flow.dueDay)||10;
  return `<article class="card due-date-card"><div class="result-section-heading"><div><span class="status-label">Datas do fluxo</span><h2>Escolha a data de vencimento</h2><p>Mensais, intermediárias e chaves usarão este dia. O ato permanece na data da simulação.</p></div></div><div class="field"><label for="flow-due-day">Dia de vencimento</label><select id="flow-due-day">${[5,10,15,20].map(d=>`<option value="${d}" ${current===d?'selected':''}>Dia ${d}</option>`).join('')}</select></div></article>`;
}

function proposalControls(state, auto) {
  if (!auto.proposal) return '';
  const min=auto.proposal.minimumPercent;
  const current=auto.proposal.percent;
  const a=Number(state.flow.actPercentage ?? 10), m=Number(state.flow.monthlyPercentage ?? 60), i=Number(state.flow.intermediatePercentage ?? 20);
  const keys=Math.max(100-a-m-i,0);
  return `<article class="card proposal-card">
    <div class="result-section-heading"><div><span class="status-label">SFH em obras · Proposta da construtora</span><h2>Quanto será pago durante a obra?</h2><p>Este caminho é usado quando o repasse bancário acontece após a conclusão da obra.</p></div><span class="badge badge-soft">Mín. ${moneyPct(min)}</span></div>
    <div class="field"><label for="construction-proposal-percent">Proposta da construtora para obras (%)</label><input id="construction-proposal-percent" type="number" min="${min.toFixed(2)}" max="100" step="0.1" inputmode="decimal" value="${current.toFixed(2)}"><small class="field-help">Aceita de 20% a 100%, respeitando o mínimo exigido pela diferença entre preço e financiamento possível.</small></div>
    <div class="client-support-values"><div><span>Parcela do imóvel durante a obra</span><strong>${formatCurrency(auto.proposal.nonBankPortion)}</strong></div><div><span>Financiamento projetado</span><strong>${formatCurrency(auto.proposal.financing)}</strong></div><div><span>Fluxo em dinheiro</span><strong>${formatCurrency(auto.proposal.cashFlowEntry)}</strong></div></div>
    <div class="percentage-builder"><h3>Definição do fluxo automático</h3><p class="result-helper">Ato + mensais + intermediárias. O percentual restante vai automaticamente para chaves.</p><div class="form-grid">
      <div class="field"><label for="flow-act-percent">Ato (%)</label><input id="flow-act-percent" type="number" min="0" max="100" step="1" inputmode="numeric" value="${a}"></div>
      <div class="field"><label for="flow-monthly-percent">Mensais (%)</label><input id="flow-monthly-percent" type="number" min="0" max="100" step="1" inputmode="numeric" value="${m}"></div>
      <div class="field"><label for="flow-intermediate-percent">Intermediárias (%)</label><input id="flow-intermediate-percent" type="number" min="0" max="100" step="1" inputmode="numeric" value="${i}"></div>
      <div class="field"><label>Chaves (automático)</label><div class="readonly-value">${moneyPct(keys)}</div></div>
    </div>${a+m+i>100?'<div class="alert alert-warning">A soma de ato, mensais e intermediárias não pode ultrapassar 100%.</div>':''}</div>
  </article>`;
}

function dateList(dates=[]) { return dates.length ? dates.map(formatInstallmentDate).join(' · ') : '—'; }
function installmentCard(label, main, detail='', percentage='', tone='') {
  return `<div class="flow-installment ${tone}"><span>${label}</span><strong>${main}</strong>${detail?`<small>${detail}</small>`:''}${percentage?`<em>${percentage}</em>`:''}</div>`;
}

function flowView(flow, schedule) {
  const dates=schedule.dates;
  const monthlyDetail=flow.monthlyQuantity ? `1ª ${formatInstallmentDate(dates.monthly[0])} · última ${formatInstallmentDate(dates.monthly[dates.monthly.length-1])} · Total ${formatCurrency(flow.monthlyTotal)}` : '';
  const intermediateDetail=flow.intermediateQuantity ? `${dateList(dates.intermediates)} · Total ${formatCurrency(flow.intermediateTotal)}` : '';
  return `<div class="flow-timeline">
    ${installmentCard('Ato',formatCurrency(flow.act),`Data ${formatInstallmentDate(dates.act)}`,pct(flow.percentages?.act),'primary')}
    ${flow.monthlyQuantity?installmentCard('Mensais',`${flow.monthlyQuantity}× ${formatCurrency(flow.monthlyValue)}`,monthlyDetail,pct(flow.percentages?.monthly)):''}
    ${flow.intermediateQuantity?installmentCard('Intermediárias',`${flow.intermediateQuantity}× ${formatCurrency(flow.intermediateValue)}`,intermediateDetail,pct(flow.percentages?.intermediate)):''}
    ${flow.keys>0?installmentCard('Chaves',formatCurrency(flow.keys),`Vencimento ${formatInstallmentDate(dates.keys)}`,pct(flow.percentages?.keys)):''}
  </div><div class="flow-status ${flow.status}"><span class="badge ${flow.status==='closed'?'badge-success':'badge-warning'}">${flow.status==='closed'?'Fluxo fechado':'Revisar fluxo'}</span><div><span>Total do fluxo</span><strong>${formatCurrency(flow.compositionTotal)}</strong></div></div>`;
}

function input(id,label,value,step='0.01',extra=''){ return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" min="0" step="${step}" inputmode="${step==='1'?'numeric':'decimal'}" value="${value??0}" ${extra}></div>`; }

function intermediateScheduleEditor(state, flow, schedule) {
  if (!flow.intermediateQuantity) return '';
  const type=state.flow.intermediateScheduleType || 'livre';
  const months=Number(state.property.monthsUntilDelivery)||0;
  const typeOptions=[['trimestrais','Trimestrais'],['semestrais','Semestrais'],['anuais','Anuais'],['livre','Livre']].map(([v,l])=>`<option value="${v}" ${type===v?'selected':''}>${l}</option>`).join('');
  let controls='';
  if(type==='livre') {
    controls=`<div class="free-intermediate-grid">${Array.from({length:Math.min(flow.intermediateQuantity,12)},(_,i)=>`<div class="field"><label for="intermediate-free-offset-${i}">Intermediária ${i+1} · mês/ano</label><select id="intermediate-free-offset-${i}" data-intermediate-free-index="${i}">${monthOffsetOptions(months,schedule.offsets[i])}</select></div>`).join('')}</div>`;
  } else {
    const first=Number(state.flow.intermediateFirstOffset)||schedule.offsets[0]||1;
    controls=`<div class="field"><label for="intermediate-first-offset">Mês/ano da primeira</label><select id="intermediate-first-offset">${monthOffsetOptions(months,first)}</select></div><div class="schedule-preview"><span>Datas calculadas</span><strong>${dateList(schedule.dates.intermediates)}</strong></div>`;
  }
  return `<div class="intermediate-schedule-panel"><h3>Periodicidade das intermediárias</h3><div class="form-grid"><div class="field"><label for="intermediate-schedule-type">Como serão chamadas?</label><select id="intermediate-schedule-type">${typeOptions}</select></div>${controls}</div>${schedule.warning?`<div class="alert alert-warning">${schedule.warning}</div>`:''}</div>`;
}

function manualEditor(state, data) {
  const f=data.flow, r=data.reconciliation;
  const interLabel=intermediateName(state.flow.intermediateScheduleType || 'livre');
  const max=(Number(state.property.saleValue)||0)*((Number(state.flow.proSolutoPercentage)||8)/100);
  return `<div class="manual-flow-options"><div class="alert alert-warning">No modo manual, aumentar a entrada reduz automaticamente o financiamento. O resultado só é liberado quando a soma fecha o valor do imóvel.</div><div class="form-grid manual-grid">
    ${input('flow-act','Ato',f.act)}
    ${input('flow-monthly-quantity','Quantidade de mensais',f.monthlyQuantity,'1',`max="${Math.max(Number(state.property.monthsUntilDelivery)||0,0)}"`)}
    ${input('flow-monthly-value','Valor de cada mensal',f.monthlyValue)}
    ${input('flow-intermediate-quantity',`Quantidade de ${interLabel.toLowerCase()}`,f.intermediateQuantity,'1','max="12"')}
    ${input('flow-intermediate-value',`Valor de cada ${interLabel.toLowerCase().replace('intermediárias livres','intermediária livre').replace('trimestrais','trimestral').replace('semestrais','semestral').replace('anuais','anual')}`,f.intermediateValue)}
    ${input('flow-keys','Chaves',f.keys)}
  </div>
  ${intermediateScheduleEditor(state,f,data.schedule)}
  <label class="check-option"><input id="pro-soluto-toggle" type="checkbox" ${state.flow.includeProSoluto?'checked':''}><span>Incluir pró-soluto</span></label>
  ${state.flow.includeProSoluto?`<div class="form-grid">${input('pro-soluto-percentage','Percentual máximo sugerido',state.flow.proSolutoPercentage||8)}${input('pro-soluto-value','Valor utilizado',state.flow.proSolutoValue||0)}${input('pro-soluto-installments','Número de parcelas',state.flow.proSolutoInstallments||16,'1','max="120"')}</div><p class="result-helper">Máximo sugerido: ${formatCurrency(max)}. As parcelas do pró-soluto serão projetadas com IGP-M.</p>`:''}
  ${f.warnings?.length?`<div class="alert alert-warning">${f.warnings.join(' ')}</div>`:''}
  <div class="schedule-preview"><span>Vencimento das mensais</span><strong>${f.monthlyQuantity ? `${formatInstallmentDate(data.schedule.dates.monthly[0])} até ${formatInstallmentDate(data.schedule.dates.monthly[data.schedule.dates.monthly.length-1])}` : 'Não utilizadas'}</strong></div>
  <div class="schedule-preview"><span>Chaves</span><strong>${formatInstallmentDate(data.schedule.dates.keys)}</strong></div>
  <div class="flow-status ${r.status}"><span class="badge ${r.status==='closed'&&data.schedule.valid?'badge-success':'badge-warning'}">${r.status==='closed'&&data.schedule.valid?'Composição fechada':!data.schedule.valid?'Revisar datas':r.status==='missing'?`Falta ${formatCurrency(r.balance)}`:`Excede ${formatCurrency(r.excess)}`}</span><div><span>Entrada escolhida</span><strong>${formatCurrency(r.buyerContribution)}</strong></div><div><span>Financiamento ajustado</span><strong>${formatCurrency(r.financing)}</strong></div>${r.financingReduction>0?`<div><span>Redução do financiamento</span><strong>${formatCurrency(r.financingReduction)}</strong></div>`:''}</div></div>`;
}

function projectionDetails(state, flow, financing, result, item, schedule) {
  const ps=projectionSettings();
  const projection=buildCorrectionProjection({flow,monthsUntilDelivery:state.property.monthsUntilDelivery,financing,monthlyFinancingRate:result.monthlyRate,constructionType:state.property.constructionType,projectionSettings:ps,incomeLimit:item?.incomeLimit,dueDay:state.flow.dueDay||10,intermediateOffsets:schedule.offsets});
  const rows=projection.rows.map(r=>`<tr><td><strong>${r.number}</strong><small>${r.dueDate||''}</small></td><td>${formatCurrency(r.flowCorrected)}</td><td>${formatCurrency(r.evolution)}</td><td><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('');
  const risk=state.property.constructionType==='sfh'?`<div class="risk-panel risk-${projection.risk.toLowerCase()}"><span>Risco estimado no repasse futuro</span><strong>${projection.risk}</strong><small>Financiamento projetado com INCC: ${formatCurrency(projection.projectedFinancing)} · utilização da capacidade atual: ${moneyPct(projection.projectedUsage*100)}</small></div>`:'';
  const evolutionNote=state.property.constructionType==='associativo'?`<div class="alert alert-info">A primeira evolução de obra projetada é de aproximadamente <strong>${formatCurrency(projection.firstEvolution)}</strong>. A cobrança real depende da medição, liberações, seguros, TR e demais encargos do contrato.</div>`:'';
  return `<details class="technical-details projection-details"><summary><span>↗</span> Projeção com correção</summary><div class="technical-content"><div class="projection-indexes"><span>INCC projetado: <strong>${moneyPct(projection.inccMonthly*100)} ao mês</strong></span><span>IGP-M projetado: <strong>${moneyPct(projection.igpmMonthly*100)} ao mês</strong></span></div>${risk}${evolutionNote}<div class="projection-table-wrap"><table class="projection-table"><thead><tr><th>Nº da parcela</th><th>Parcela fluxo</th><th>Parcela Ev. Obra</th><th>Parcela Total</th></tr></thead><tbody>${rows}</tbody></table></div><p class="result-helper">Ato sem INCC. Mensais, intermediárias e chaves recebem correção cumulativa até o vencimento. Quando coincidirem no mesmo mês, a primeira coluna identifica os componentes somados. Pró-soluto, quando houver, recebe IGP-M.</p></div></details>`;
}

export const constructionFlowPage=()=>{
  const state=getState(); const ready=rulesRepository.getStatus().ready;
  const result=ready?evaluateEligibility({buyer:state.buyer,property:state.property,ruleSet:rulesRepository.getAll(),manualAnnualRate:state.credit?.sbpeAnnualRate}):null;
  if(!state.selectedSystem) return `<section class="page-grid"><header><p class="eyebrow">Etapa 4 de 5</p><h1 class="page-title">Sugestão de fluxo</h1></header><div class="alert alert-warning">Escolha Price ou SAC no enquadramento antes de continuar.</div></section>`;
  const isConstruction=state.property.deliveryStatus==='em_obras';
  const values=operation(state,result);
  if(!isConstruction) return `<section class="page-grid"><header><p class="eyebrow">Etapa 4 de 5</p><h1 class="page-title">Sugestão de fluxo</h1></header><div class="alert alert-info">Imóvel pronto: não há fluxo de obra.</div><div class="actions-row"><a class="button button-primary" href="#/resumo">Continuar para resultado</a><a class="button button-ghost" href="#/enquadramento">Voltar</a></div></section>`;

  const auto=automaticData(state,values); const manual=Boolean(state.flow.manualEditing); const md=manual?manualData(state,values,auto):null;
  const flow=manual?md.flow:auto.flow;
  const schedule=manual?md.schedule:scheduleForFlow(state,flow,false);
  const financing=manual?md.reconciliation.financing:auto.approvedBase;
  const canContinue=manual?(md.reconciliation.status==='closed'&&schedule.valid):flow.status==='closed';
  const pathLabel=isAssociative(state)?'Associativo em obras':'SFH em obras';

  return `<section class="page-grid"><header><p class="eyebrow">Etapa 4 de 5</p><h1 class="page-title">Sugestão de fluxo</h1><p class="page-description">${isAssociative(state)?'Caminho Associativo: mantemos a sugestão automática tradicional e acrescentamos datas e projeção de correção/evolução de obra.':'Caminho SFH em obras: defina a proposta da construtora e a distribuição percentual antes do repasse bancário futuro.'}</p></header>
  <article class="card flow-summary-card"><div class="result-section-heading"><div><span class="status-label">${pathLabel}</span><h2>${state.property.projectName||'Imóvel selecionado'}</h2></div><span class="badge badge-soft">${state.selectedSystem==='sac'?'SAC':'PRICE'}</span></div><div class="client-support-values"><div><span>Valor do imóvel</span><strong>${formatCurrency(values.sale)}</strong></div><div><span>Financiamento ${isAssociative(state)?'estimado':'máximo estimado'}</span><strong>${formatCurrency(isAssociative(state)?values.approved:values.bankCapacity)}</strong></div><div><span>FGTS</span><strong>${formatCurrency(values.fgts)}</strong></div><div><span>Subsídio</span><strong>${formatCurrency(values.subsidy)}</strong></div><div><span>Meses até as chaves</span><strong>${state.property.monthsUntilDelivery} meses</strong></div></div></article>
  ${dueDayControl(state)}
  ${!manual?proposalControls(state,auto):''}
  <article class="card"><div class="result-section-heading"><div><span class="status-label">${manual?'Distribuição manual':'Distribuição automática'}</span><h2>${manual?'Fluxo em edição':'Fluxo sugerido'}</h2></div><span class="badge ${canContinue?'badge-success':'badge-warning'}">${canContinue?'Fechado':'Revisar'}</span></div>${manual?manualEditor(state,md):flowView(flow,schedule)}</article>
  ${projectionDetails(state,flow,financing,result,values.selected,schedule)}
  <article class="card manual-flow-card"><div class="toggle-row"><div><span class="status-label">Modo corretor</span><h2>Editar fluxo manualmente</h2><p>Ative para alterar valores, datas das intermediárias e liberar o pró-soluto.</p></div><label class="switch"><input id="manual-flow-toggle" type="checkbox" ${manual?'checked':''}><span></span></label></div>${manual?'<button id="restore-auto-flow" class="button button-ghost" type="button">Restaurar sugestão automática</button>':'<p class="restricted-note">O pró-soluto permanece disponível somente no modo manual.</p>'}</article>
  <div class="actions-row">${canContinue?'<a class="button button-primary" href="#/resumo">Continuar para resultado</a>':'<button class="button button-primary button-disabled" disabled>Revise o fluxo para continuar</button>'}<a class="button button-ghost" href="#/enquadramento">Alterar financiamento</a></div></section>`;
};
