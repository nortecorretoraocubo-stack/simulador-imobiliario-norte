import { bootstrap } from './bootstrap.js';
import { registerRoute, startRouter, navigate } from './router.js';
import { updateState, resetState, getState } from './state.js';
import { setupInstallPrompt } from './ui/install-prompt.js';
import { renderProgress } from './ui/progress-stepper.js';
import { homePage } from './pages/home-page.js';
import { buyerPage } from './pages/buyer-page.js';
import { propertyPage } from './pages/property-page.js';
import { eligibilityPage } from './pages/eligibility-page.js';
import { constructionFlowPage } from './pages/construction-flow-page.js';
import { summaryPage } from './pages/summary-page.js';

await bootstrap();
registerRoute('inicio', homePage);
registerRoute('comprador', buyerPage);
registerRoute('imovel', propertyPage);
registerRoute('enquadramento', eligibilityPage);
registerRoute('fluxo', constructionFlowPage);
registerRoute('resumo', summaryPage);
startRouter(document.querySelector('#app-view'));
setupInstallPrompt(document.querySelector('#install-button'));

document.addEventListener('route:rendered', (event) => renderProgress(event.detail, document.querySelector('#progress-region')));

function rerenderCurrentRoute() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function updateConnectionStatus() {
  const el = document.querySelector('#connection-status');
  const online = navigator.onLine;
  el.textContent = online ? 'Online' : 'Offline';
  el.className = `status-pill ${online ? 'online' : 'offline'}`;
}
addEventListener('online', updateConnectionStatus);
addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

if ('serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
      await registration.update();
    } catch (error) {
      console.error('Falha ao atualizar o Service Worker:', error);
    }
  });
}

document.addEventListener('submit', (event) => {
  if (event.target.id === 'buyer-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const year = String(data.birthYear).padStart(4, '0');
    const month = String(data.birthMonth).padStart(2, '0');
    const day = String(data.birthDay).padStart(2, '0');
    const birthDate = `${year}-${month}-${day}`;
    const parsed = new Date(`${birthDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(year) || parsed.getMonth()+1 !== Number(data.birthMonth) || parsed.getDate() !== Number(data.birthDay)) {
      alert('Informe uma data de nascimento válida.');
      return;
    }
    updateState('buyer', {
      name: data.name.trim(),
      grossIncome: Number(data.grossIncome),
      fgtsBalance: Number(data.fgtsBalance),
      hasThreeYearsFgts: data.hasThreeYearsFgts === 'true',
      oldestBuyerBirthDate: birthDate,
      monthlyCommitments: Number(data.monthlyCommitments),
      hasAdditionalProponentOrDependent: data.hasAdditionalProponentOrDependent === 'true'
    });
    updateState('selectedSystem', null);
    navigate('imovel');
  }

  if (event.target.id === 'sbpe-rate-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const rate = Number(data.sbpeAnnualRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      alert('Informe uma taxa anual válida para o SBPE.');
      return;
    }
    updateState('credit', { sbpeAnnualRate: rate });
    updateState('selectedSystem', null);
    rerenderCurrentRoute();
  }
  if (event.target.id === 'property-form') {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (data.condition === 'usado' && data.deliveryStatus === 'em_obras') {
      alert('A combinação Usado + Em obras não existe. Selecione a situação Pronto.');
      return;
    }
    if (data.deliveryStatus === 'em_obras') {
      const months = Number(data.monthsUntilDelivery);
      if (!Number.isInteger(months) || months < 2 || months > 60) {
        alert('Informe um prazo de obra entre 2 e 60 meses.');
        return;
      }
    }
    updateState('property', {
      projectName: data.projectName.trim(), saleValue: Number(data.saleValue), appraisalValue: Number(data.appraisalValue), state: data.state,
      city: data.city.trim(), condition: data.condition, deliveryStatus: data.deliveryStatus, constructionType: data.constructionType,
      metropolitanRegion: true, requestedTerm: Number(data.requestedTerm) || 420, monthsUntilDelivery: Number(data.monthsUntilDelivery) || 0
    });
    updateState('selectedSystem', null);
    navigate('enquadramento');
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'delivery-status') {
    const field = document.querySelector('#delivery-months-field');
    const condition = document.querySelector('#condition')?.value;
    if (condition === 'usado' && event.target.value === 'em_obras') {
      event.target.value = 'pronto';
      if (field) field.hidden = true;
      alert('Imóvel usado só pode ser selecionado como Pronto.');
    } else if (field) {
      field.hidden = event.target.value !== 'em_obras';
    }
  }
  if (event.target.id === 'condition') {
    const delivery = document.querySelector('#delivery-status');
    const worksOption = delivery?.querySelector('option[value="em_obras"]');
    const field = document.querySelector('#delivery-months-field');
    const isUsed = event.target.value === 'usado';
    if (worksOption) worksOption.disabled = isUsed;
    if (isUsed && delivery) delivery.value = 'pronto';
    if (field && isUsed) field.hidden = true;
  }
  if (event.target.name === 'financingSystem') {
    updateState('selectedSystem', event.target.value);
    const system = event.target.value;
    document.querySelectorAll('[data-financing-card]').forEach((card) => {
      const selected = card.dataset.financingCard === system;
      card.classList.toggle('selected', selected);
      const radio = card.querySelector('input[name="financingSystem"]');
      if (radio) radio.checked = selected;
    });
    const continueButton = document.querySelector('#continue-from-eligibility');
    if (continueButton) {
      continueButton.disabled = false;
      continueButton.classList.remove('button-disabled');
    }
    document.querySelector('#financing-selection-alert')?.remove();
    const dialogTitle = document.querySelector('#financing-confirm-title');
    const dialogText = document.querySelector('#financing-confirm-text');
    const label = system === 'sac' ? 'SAC' : 'Price';
    if (dialogTitle) dialogTitle.textContent = `Você escolheu ${label}`;
    if (dialogText) dialogText.innerHTML = `Tem certeza de que deseja usar o modelo <strong>${label}</strong> nesta simulação?`;
  }
  if (event.target.id === 'manual-flow-toggle') {
    updateState('flow', { manualEditing: event.target.checked, includeProSoluto: event.target.checked ? getState().flow.includeProSoluto : false });
    rerenderCurrentRoute();
  }
  if (event.target.id === 'pro-soluto-toggle') {
    updateState('flow', { includeProSoluto: event.target.checked });
    rerenderCurrentRoute();
  }
  if (event.target.id === 'flow-due-day') {
    updateState('flow', { dueDay: Number(event.target.value) || 10 });
    rerenderCurrentRoute();
    return;
  }
  if (event.target.id === 'intermediate-schedule-type') {
    updateState('flow', { intermediateScheduleType: event.target.value, intermediateFirstOffset: null, intermediateFreeOffsets: [] });
    rerenderCurrentRoute();
    return;
  }
  if (event.target.id === 'intermediate-first-offset') {
    updateState('flow', { intermediateFirstOffset: Number(event.target.value) || 1 });
    rerenderCurrentRoute();
    return;
  }
  if (event.target.matches('[data-intermediate-free-index]')) {
    const state = getState();
    const offsets = Array.isArray(state.flow.intermediateFreeOffsets) ? [...state.flow.intermediateFreeOffsets] : [];
    const index = Math.max(0, Number(event.target.dataset.intermediateFreeIndex) || 0);
    offsets[index] = Number(event.target.value) || 1;
    updateState('flow', { intermediateFreeOffsets: offsets });
    rerenderCurrentRoute();
    return;
  }
  const autoFlowFieldMap = {
    'construction-proposal-percent':'constructionProposalPercent',
    'flow-act-percent':'actPercentage',
    'flow-monthly-percent':'monthlyPercentage',
    'flow-intermediate-percent':'intermediatePercentage'
  };
  if (autoFlowFieldMap[event.target.id]) {
    updateState('flow', { [autoFlowFieldMap[event.target.id]]: Number(event.target.value) || 0 });
    rerenderCurrentRoute();
    return;
  }
  const flowFieldMap = {
    'flow-act':'act',
    'flow-monthly-quantity':'monthlyQuantity',
    'flow-monthly-value':'monthlyValue',
    'flow-intermediate-quantity':'intermediateQuantity',
    'flow-intermediate-value':'intermediateValue',
    'flow-keys':'keys',
    'pro-soluto-percentage':'proSolutoPercentage',
    'pro-soluto-value':'proSolutoValue',
    'pro-soluto-installments':'proSolutoInstallments'
  };
  if (flowFieldMap[event.target.id]) {
    const key = flowFieldMap[event.target.id];
    let value = Number(event.target.value) || 0;
    if (key === 'intermediateQuantity') value = Math.min(Math.max(Math.trunc(value), 0), 12);
    if (key === 'monthlyQuantity') value = Math.min(Math.max(Math.trunc(value), 0), Math.max(Number(getState().property.monthsUntilDelivery) || 0, 0));
    if (key === 'proSolutoInstallments') value = Math.min(Math.max(Math.trunc(value), 0), 120);
    updateState('flow', { [key]: value });
    rerenderCurrentRoute();
  }
});

let autoFlowInputTimer = null;
document.addEventListener('input', (event) => {
  const map = {
    'construction-proposal-percent':'constructionProposalPercent',
    'flow-act-percent':'actPercentage',
    'flow-monthly-percent':'monthlyPercentage',
    'flow-intermediate-percent':'intermediatePercentage'
  };
  const key = map[event.target.id];
  if (!key) return;
  const id = event.target.id;
  const value = Number(event.target.value) || 0;
  updateState('flow', { [key]: value });
  clearTimeout(autoFlowInputTimer);
  autoFlowInputTimer = setTimeout(() => {
    rerenderCurrentRoute();
    requestAnimationFrame(() => {
      const input = document.getElementById(id);
      if (input) { input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {} }
    });
  }, 250);
});


// Campos numéricos do simulador aceitam somente números e, quando necessário, separador decimal.
document.addEventListener('keydown', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;
  if (['e','E','+','-'].includes(event.key)) event.preventDefault();
});

document.addEventListener('paste', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'number') return;
  const text = (event.clipboardData?.getData('text') || '').trim().replace(',', '.');
  const integerOnly = String(input.step || '') === '1';
  const valid = integerOnly ? /^\d+$/.test(text) : /^\d+(?:\.\d+)?$/.test(text);
  if (!valid) {
    event.preventDefault();
    const cleaned = integerOnly ? text.replace(/\D/g, '') : text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    input.value = cleaned;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
});

document.addEventListener('click', async (event) => {
  const reportActions = {
    'whatsapp-result': 'openWhatsApp',
    'copy-whatsapp-result': 'copyWhatsAppMessage',
    'pdf-client-result': 'generateClientPdf',
    'pdf-broker-result': 'generateBrokerPdf',
    'print-result': 'printResult'
  };
  const reportAction = reportActions[event.target.id];
  if (reportAction) {
    event.preventDefault();
    const reports = await import('./reports/report-service.js');
    await reports[reportAction]();
    return;
  }
  if (event.target.id === 'reset-simulation') { resetState(); navigate('comprador'); }
  const card = event.target.closest('[data-financing-card]');
  if (card && !event.target.closest('input, label')) {
    const radio = card.querySelector('input[name="financingSystem"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  if (event.target.id === 'continue-from-eligibility') {
    const dialog = document.querySelector('#financing-confirm-dialog');
    if (dialog?.showModal) dialog.showModal();
    else if (confirm(`Você escolheu ${getState().selectedSystem === 'sac' ? 'SAC' : 'Price'}. Deseja continuar?`)) navigate('fluxo');
  }
  if (event.target.id === 'restore-auto-flow') {
    updateState('flow', { act:null, monthlyQuantity:null, monthlyValue:null, intermediateQuantity:null, intermediateValue:null, keys:null, includeProSoluto:false, proSolutoValue:0 });
    rerenderCurrentRoute();
  }
  if (event.target.id === 'confirm-financing-system') {
    event.preventDefault();
    const dialog = document.querySelector('#financing-confirm-dialog');
    if (dialog?.open) dialog.close();
    navigate('fluxo');
  }
  if (event.target.id === 'cancel-financing-system') {
    event.preventDefault();
    const dialog = document.querySelector('#financing-confirm-dialog');
    if (dialog?.open) dialog.close();
    document.querySelector(`[data-financing-card="${getState().selectedSystem}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
