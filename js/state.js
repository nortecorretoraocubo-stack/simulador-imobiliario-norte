import { STORAGE_KEYS } from './constants.js';
import { storageService } from './storage/storage-service.js';
import { eventBus } from './core/event-bus.js';

const initialState = {
  buyer: {
    name: '',
    grossIncome: 0,
    fgtsBalance: 0,
    hasThreeYearsFgts: true,
    oldestBuyerBirthDate: '',
    monthlyCommitments: 0,
    hasAdditionalProponentOrDependent: false
  },
  property: {
    projectName: '',
    saleValue: 0,
    appraisalValue: 0,
    state: 'SP',
    city: 'São Paulo',
    metropolitanRegion: true,
    condition: 'novo',
    deliveryStatus: 'pronto',
    constructionType: 'sfh',
    requestedTerm: 420,
    monthsUntilDelivery: 0
  },
  selectedSystem: null,
  credit: { sbpeAnnualRate: 0 },
  subsidy: { used: 0, estimated: 0 },
  flow: {
    manualEditing: false,
    includeProSoluto: false,
    proSolutoPercentage: 8,
    proSolutoValue: 0,
    proSolutoInstallments: 16,
    act: null,
    monthlyQuantity: null,
    monthlyValue: null,
    intermediateQuantity: null,
    intermediateValue: null,
    keys: null,
    constructionProposalPercent: null,
    actPercentage: 10,
    monthlyPercentage: 60,
    intermediatePercentage: 20,
    dueDay: 10,
    intermediateScheduleType: 'livre',
    intermediateFirstOffset: null,
    intermediateFreeOffsets: []
  },
  warnings: [],
  errors: []
};

function migrate(saved) {
  const next = structuredClone(initialState);
  if (!saved || typeof saved !== 'object') return next;
  next.buyer = { ...next.buyer, ...(saved.buyer || {}) };
  next.property = { ...next.property, ...(saved.property || {}) };
  next.credit = { ...next.credit, ...(saved.credit || {}) };
  next.subsidy = { ...next.subsidy, ...(saved.subsidy || {}) };
  next.flow = { ...next.flow, ...(saved.flow || {}) };
  next.selectedSystem = ['price', 'sac'].includes(saved.selectedSystem) ? saved.selectedSystem : null;
  return next;
}

let state = migrate(storageService.get(STORAGE_KEYS.currentSimulation, null));
export const getState = () => structuredClone(state);
export function updateState(section, values) {
  if (section === 'selectedSystem') state = { ...state, selectedSystem: values };
  else state = { ...state, [section]: { ...state[section], ...values } };
  storageService.set(STORAGE_KEYS.currentSimulation, state);
  eventBus.emit('state:changed', getState());
}
export function resetState() {
  state = structuredClone(initialState);
  storageService.set(STORAGE_KEYS.currentSimulation, state);
  eventBus.emit('state:changed', getState());
}
