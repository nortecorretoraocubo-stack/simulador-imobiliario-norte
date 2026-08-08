const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function safeDate(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date || Date.now());
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function dueDateForOffset(offset, dueDay = 10, baseDate = new Date()) {
  const base = safeDate(baseDate);
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  const target = new Date(base.getFullYear(), base.getMonth() + safeOffset, 1, 12, 0, 0);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(Math.trunc(Number(dueDay) || 10), 1), last);
  target.setDate(safeDay);
  return target;
}

export function formatInstallmentDate(date) {
  return safeDate(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function monthYearLabel(offset, baseDate = new Date()) {
  const d = dueDateForOffset(offset, 1, baseDate);
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

export function monthOffsetOptions(monthsUntilDelivery, selected = null, baseDate = new Date()) {
  const months = Math.max(0, Math.min(60, Math.trunc(Number(monthsUntilDelivery) || 0)));
  return Array.from({ length: months }, (_, i) => {
    const offset = i + 1;
    return `<option value="${offset}" ${Number(selected) === offset ? 'selected' : ''}>${monthYearLabel(offset, baseDate)}</option>`;
  }).join('');
}

export function automaticIntermediateOffsets(quantity, monthsUntilDelivery) {
  const q = Math.max(0, Math.min(12, Math.trunc(Number(quantity) || 0)));
  const total = Math.max(1, Math.trunc(Number(monthsUntilDelivery) || 0));
  return Array.from({ length: q }, (_, i) => {
    const proportional = Math.round(((i + 1) * total) / (q + 1));
    return Math.max(1, Math.min(total, proportional));
  });
}

export function manualIntermediateOffsets({ type = 'livre', quantity = 0, firstOffset = null, freeOffsets = [], monthsUntilDelivery = 0 }) {
  const q = Math.max(0, Math.min(12, Math.trunc(Number(quantity) || 0)));
  const months = Math.max(0, Math.min(60, Math.trunc(Number(monthsUntilDelivery) || 0)));
  if (!q || !months) return { offsets: [], valid: true, warning: '' };

  if (type === 'livre') {
    const offsets = Array.from({ length: q }, (_, i) => {
      const fallback = Math.max(1, Math.min(months, Math.round(((i + 1) * months) / (q + 1))));
      const chosen = Math.trunc(Number(freeOffsets?.[i]) || fallback);
      return Math.max(1, Math.min(months, chosen));
    });
    return { offsets, valid: true, warning: '' };
  }

  const interval = type === 'trimestrais' ? 3 : type === 'semestrais' ? 6 : 12;
  const first = Math.max(1, Math.min(months, Math.trunc(Number(firstOffset) || interval)));
  const offsets = Array.from({ length: q }, (_, i) => first + (i * interval));
  const valid = offsets.every((v) => v <= months);
  return {
    offsets: offsets.filter((v) => v <= months),
    valid,
    warning: valid ? '' : `A quantidade de intermediárias ultrapassa a data das chaves. Reduza a quantidade ou antecipe a primeira ${type}.`
  };
}

export function scheduleDates({ dueDay = 10, monthsUntilDelivery = 0, monthlyQuantity = 0, intermediateOffsets = [], baseDate = new Date() }) {
  const months = Math.max(0, Math.trunc(Number(monthsUntilDelivery) || 0));
  const monthlyQty = Math.max(0, Math.trunc(Number(monthlyQuantity) || 0));
  return {
    act: safeDate(baseDate),
    monthly: Array.from({ length: monthlyQty }, (_, i) => dueDateForOffset(i + 1, dueDay, baseDate)),
    intermediates: (intermediateOffsets || []).map((offset) => dueDateForOffset(offset, dueDay, baseDate)),
    keys: months > 0 ? dueDateForOffset(months, dueDay, baseDate) : null
  };
}
