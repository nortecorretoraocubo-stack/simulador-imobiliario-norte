import { getState } from '../state.js';
import { formatCurrency } from '../core/formatters.js';
import { rulesRepository } from '../rules/rules-repository.js';
import { evaluateEligibility } from '../rules/eligibility-engine.js';

const formatPercent = (value, digits = 2) => value == null ? 'Indisponível' : `${Number(value).toFixed(digits).replace('.', ',')}%`;
const factorLabels = { income: 'Renda', quota: 'Cota', needed: 'Valor necessário' };

function ageFromBirthDate(value) {
  if (!value) return null;
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function renderRuleStatus(status) {
  return `<article class="card highlight-card"><div><span class="status-label">Motor de regras</span><h2>${status.ready ? 'Regras carregadas e validadas' : 'A base possui pendências'}</h2><p>${status.ready ? `${status.loadedCount} de ${status.expectedCount} arquivos disponíveis · versão ${status.version}` : (status.errors[0] || 'Não foi possível validar todos os arquivos.')}</p></div><span class="badge ${status.ready ? 'badge-success' : 'badge-warning'}">${status.ready ? 'Base pronta' : 'Verificar base'}</span></article>`;
}

function quotaLabel(result) {
  if (result.quotas && result.quotas.price !== result.quotas.sac) {
    return `${formatPercent(result.quotas.price * 100, 0)} Price · ${formatPercent(result.quotas.sac * 100, 0)} SAC`;
  }
  return result.quota ? formatPercent(result.quota * 100, 0) : 'Pendente';
}

function renderResult(result) {
  const sbpe = result.program === 'SBPE';
  const title = result.eligible ? (sbpe ? `Opção SBPE/${result.creditLine} disponível` : 'Enquadramento automático concluído') : 'Enquadramento não liberado';
  return `<article class="card eligibility-result ${result.eligible ? 'approved' : 'denied'}">
    <div class="eligibility-result-header"><div><span class="status-label">Resultado</span><h2>${title}</h2><p>${result.message}</p></div><span class="badge ${result.eligible ? 'badge-success' : 'badge-warning'}">${result.eligible ? 'Compatível' : 'Atenção'}</span></div>
    <div class="result-grid">
      <div><span>Programa</span><strong>${result.program || 'Não definido'}</strong></div><div><span>Linha / faixa</span><strong>${result.creditLine || result.band || 'Não definida'}</strong></div>
      <div><span>Subfaixa</span><strong>${result.subBand || 'Não se aplica'}</strong></div><div><span>FGTS</span><strong>${result.fgtsAllowed === false ? 'Não considerado automaticamente' : (result.fgtsStatus === 'cotista' ? 'Cotista' : 'Não cotista')}</strong></div>
      <div><span>Taxa nominal anual</span><strong>${formatPercent(result.nominalAnnualRate)}${result.rateIndexer ? ` + ${result.rateIndexer}` : ''}</strong></div><div><span>Taxa efetiva anual</span><strong>${formatPercent(result.effectiveAnnualRate)}</strong></div>
      <div><span>Teto do imóvel</span><strong>${result.propertyLimit ? formatCurrency(result.propertyLimit) : (result.creditLine === 'SFI' ? 'Sem teto SFH' : 'Pendente')}</strong></div><div><span>Cota utilizada</span><strong>${quotaLabel(result)}</strong></div>
      <div><span>Prazo máximo</span><strong>${result.maximumTermMonths != null ? `${result.maximumTermMonths} meses` : 'Pendente'}</strong></div><div><span>Base da cota</span><strong>${result.baseQuota != null ? formatCurrency(result.baseQuota) : 'Pendente'}</strong></div>
      ${result.program === 'Minha Casa, Minha Vida' ? `<div><span>Subsídio estimado</span><strong>${formatCurrency(result.subsidyUsed || 0)}</strong></div><div><span>Potencial máximo indicativo</span><strong>${formatCurrency(result.subsidyPotentialMaximum || 0)}</strong></div>` : ''}
    </div>
  </article>`;
}

function renderSbpeRateEditor(result, manualAnnualRate) {
  if (result.program !== 'SBPE') return '';
  return `<form id="sbpe-rate-form" class="card form-grid compact-gap">
    <div class="field field-full"><span class="status-label">Taxa de referência SBPE</span><h2>Confirme a taxa usada na simulação</h2><p class="page-description">A taxa varia conforme banco, relacionamento e análise de crédito. A TR atualiza o saldo devedor e não está projetada no cálculo das parcelas.</p></div>
    <div class="field"><label for="sbpe-annual-rate">Taxa nominal anual (%)</label><input id="sbpe-annual-rate" name="sbpeAnnualRate" type="number" min="0.01" max="30" step="0.01" inputmode="decimal" value="${manualAnnualRate || result.nominalAnnualRate || ''}" required></div>
    <div class="field"><label>Indexador</label><input value="${result.rateIndexer || 'Conforme contrato'}" disabled></div>
    <div class="actions-row field-full"><button class="button button-primary" type="submit">Recalcular SBPE</button></div>
  </form>`;
}

function renderFinancingCard(item, capacity, fgtsUsed, selectedSystem) {
  const selected = item.system === selectedSystem;
  return `<article class="card financing-limit-card financing-choice ${selected ? 'selected' : ''}" data-financing-card="${item.system}">
    <div class="eligibility-result-header"><div><span class="status-label">Modelo de financiamento</span><h2>${item.system === 'price' ? 'Price' : 'SAC'}</h2></div><span class="badge badge-soft">Cota ${(item.quota * 100).toFixed(0)}% · limitado por ${factorLabels[item.limitingFactor]}</span></div>
    <div class="summary-list">
      <div class="summary-row"><span>Limite pela renda</span><strong>${formatCurrency(item.incomeLimit)}</strong></div><div class="summary-row"><span>Limite pela cota</span><strong>${formatCurrency(item.quotaLimit)}</strong></div>
      <div class="summary-row"><span>Valor necessário</span><strong>${formatCurrency(item.amountNeeded)}</strong></div><div class="summary-row total-row"><span>Financiamento estimado</span><strong>${formatCurrency(item.estimatedFinancing)}</strong></div>
      <div class="summary-row"><span>Parcela-base financeira</span><strong>${formatCurrency(capacity.financialBasePayment)}</strong></div><div class="summary-row"><span>Reserva comercial</span><strong>${formatCurrency(capacity.commercialReserve)}</strong></div>
      <div class="summary-row"><span>FGTS considerado</span><strong>${formatCurrency(fgtsUsed)}</strong></div>
    </div>
    <label class="financing-radio"><input type="radio" name="financingSystem" value="${item.system}" ${selected ? 'checked' : ''}><span>Escolher ${item.system === 'price' ? 'Price' : 'SAC'}</span></label>
  </article>`;
}

function renderFinancingAnalysis(result, selectedSystem) {
  if (!result.financingAnalysis) return '';
  const a = result.financingAnalysis;
  return `<section class="page-grid compact-gap"><header><span class="status-label">Escolha do financiamento</span><h2>Selecione Price ou SAC</h2><p class="page-description">As cotas podem ser diferentes conforme o sistema escolhido.</p></header><div class="comparison-carousel">${renderFinancingCard(a.price, a.incomeCapacity, a.fgtsUsed, selectedSystem)}${renderFinancingCard(a.sac, a.incomeCapacity, a.fgtsUsed, selectedSystem)}</div></section>`;
}

function renderDiagnostic(result) {
  const notes = result.brokerNotes?.length ? `<div class="broker-note"><strong>Observação interna</strong>${result.brokerNotes.map((n) => `<p>${n}</p>`).join('')}</div>` : '';
  return `<article class="card diagnostic-panel"><div class="diagnostic-heading"><div><span class="status-label">Modo corretor</span><h2>Como o sistema chegou ao resultado</h2></div><span class="diagnostic-count">${result.checks.filter((i) => i.ok).length}/${result.checks.length}</span></div><div class="diagnostic-list">${result.checks.map((i) => `<div class="diagnostic-item ${i.ok ? 'ok' : 'error'}"><span class="diagnostic-icon">${i.ok ? '✓' : '!'}</span><span>${i.label}</span></div>`).join('')}</div>${notes}</article>`;
}

export const eligibilityPage = () => {
  const state = getState();
  const { buyer, property, selectedSystem, credit } = state;
  const status = rulesRepository.getStatus();
  const result = status.ready ? evaluateEligibility({ buyer, property, ruleSet: rulesRepository.getAll(), manualAnnualRate: credit?.sbpeAnnualRate }) : null;
  const age = ageFromBirthDate(buyer.oldestBuyerBirthDate);
  const canContinue = Boolean(result?.eligible && selectedSystem);
  const selectedLabel = selectedSystem === 'sac' ? 'SAC' : 'Price';

  return `<section class="page-grid">
    <header><p class="eyebrow">Etapa 3 de 5</p><h1 class="page-title" tabindex="-1">Enquadramento</h1><p class="page-description">Primeiro o sistema tenta o MCMV. Quando a renda ou o imóvel não forem compatíveis, apresenta automaticamente a alternativa SBPE.</p></header>
    ${renderRuleStatus(status)}
    <div class="two-column equal-columns"><article class="card"><h2>Cliente</h2><div class="summary-list"><div class="summary-row"><span>Renda</span><strong>${formatCurrency(buyer.grossIncome)}</strong></div><div class="summary-row"><span>FGTS 3 anos</span><strong>${buyer.hasThreeYearsFgts ? 'Sim · Cotista' : 'Não · Não cotista'}</strong></div><div class="summary-row"><span>Composição para subsídio</span><strong>${buyer.hasAdditionalProponentOrDependent ? 'Mais de um proponente ou dependente' : 'Sem marcador adicional'}</strong></div><div class="summary-row"><span>Idade atual</span><strong>${age != null ? `${age} anos` : 'Não informada'}</strong></div></div></article><article class="card"><h2>Imóvel</h2><div class="summary-list"><div class="summary-row"><span>Venda</span><strong>${formatCurrency(property.saleValue)}</strong></div><div class="summary-row"><span>Avaliação</span><strong>${formatCurrency(property.appraisalValue)}</strong></div><div class="summary-row"><span>Modalidade informada</span><strong>${property.constructionType === 'associativo' ? 'Associativo' : 'SFH'}</strong></div><div class="summary-row"><span>Local</span><strong>${property.city || 'Não informado'} / ${property.state}</strong></div></div></article></div>
    ${status.ready ? renderResult(result) + renderSbpeRateEditor(result, credit?.sbpeAnnualRate) + renderFinancingAnalysis(result, selectedSystem) + renderDiagnostic(result) : `<div class="alert alert-danger">${status.errors.join(' ')}</div>`}
    ${result?.warnings?.length ? `<div class="alert alert-warning">${result.warnings.map((w) => `<p>${w}</p>`).join('')}</div>` : ''}
    ${result?.eligible && !selectedSystem ? '<div id="financing-selection-alert" class="alert alert-info">Selecione Price ou SAC para liberar o avanço.</div>' : ''}
    <div class="actions-row"><button id="continue-from-eligibility" class="button button-primary ${canContinue ? '' : 'button-disabled'}" type="button" ${canContinue ? '' : 'disabled'}>Continuar para sugestão de fluxo</button><a class="button button-ghost" href="#/imovel">Voltar</a></div>
    <dialog id="financing-confirm-dialog" class="confirm-dialog"><div><span class="status-label">Confirmar escolha</span><h2 id="financing-confirm-title">Você escolheu ${selectedLabel}</h2><p id="financing-confirm-text">Tem certeza de que deseja usar o modelo <strong>${selectedLabel}</strong> nesta simulação?</p><div class="actions-row"><button id="cancel-financing-system" class="button button-ghost" type="button">Não, alterar</button><button id="confirm-financing-system" class="button button-primary" type="button">Sim, continuar</button></div></div></dialog>
  </section>`;
};
