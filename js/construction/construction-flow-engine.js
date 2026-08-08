const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const nonNegative = (value) => Math.max(money(value), 0);

function intermediateCountForMonths(months, suggestions = []) {
  const found = suggestions.find((item) => {
    const min = Number(item.minimumMonths) || 0;
    const max = item.maximumMonths == null ? Infinity : Number(item.maximumMonths);
    return months >= min && months <= max;
  });
  return Math.max(Number(found?.maximumCount) || 0, 0);
}

function distributeEvenly(total, quantity, maximumPerInstallment = Infinity) {
  const safeTotal = nonNegative(total);
  const safeQty = Math.max(Math.trunc(Number(quantity) || 0), 0);
  if (!safeQty || safeTotal <= 0) return { quantity: 0, value: 0, total: 0, remainder: safeTotal };
  const value = Math.min(money(safeTotal / safeQty), nonNegative(maximumPerInstallment));
  const distributed = money(value * safeQty);
  return { quantity: safeQty, value, total: distributed, remainder: money(safeTotal - distributed) };
}

export function generateConstructionFlow({ entry, income, monthsUntilDelivery, settings = {} }) {
  const totalEntry = nonNegative(entry);
  const grossIncome = nonNegative(income);
  const months = Math.max(Math.trunc(Number(monthsUntilDelivery) || 0), 0);
  const limits = settings.limits || {};
  const monthlyLimit = money(grossIncome * (Number(limits.monthlyIncomePercentage) || 0.20));
  const intermediateLimit = money(grossIncome * (Number(limits.intermediateIncomePercentage) || 0.80));
  const keysLimit = money(grossIncome * (Number(limits.keysIncomePercentage) || 0.80));
  const configuredMinimumAct = nonNegative(limits.minimumActValue);

  if (totalEntry <= 0) {
    return finalize({ entry: 0, income: grossIncome, monthlyLimit, intermediateLimit, keysLimit, act: 0, monthlyQuantity: 0, monthlyValue: 0, intermediateQuantity: 0, intermediateValue: 0, keys: 0, mode: 'automatic' });
  }

  // A primeira parcela é sempre o ato. Sem mínimo configurado, usa-se até uma mensal máxima.
  let act = Math.min(totalEntry, configuredMinimumAct > 0 ? configuredMinimumAct : monthlyLimit || totalEntry);
  let remainder = money(totalEntry - act);

  // O ato ocupa o primeiro mês; as mensais usam os meses restantes até as chaves.
  const availableMonthlyCount = Math.max(months - 1, 0);
  let monthlyQuantity = 0;
  let monthlyValue = 0;
  if (remainder > 0 && availableMonthlyCount > 0 && monthlyLimit > 0) {
    const monthlyCapacity = money(availableMonthlyCount * monthlyLimit);
    const monthlyTarget = Math.min(remainder, monthlyCapacity);
    const monthly = distributeEvenly(monthlyTarget, availableMonthlyCount, monthlyLimit);
    monthlyQuantity = monthly.quantity;
    monthlyValue = monthly.value;
    remainder = money(remainder - monthly.total);
  }

  let intermediateQuantity = 0;
  let intermediateValue = 0;
  if (remainder > 0 && intermediateLimit > 0) {
    const suggestedCount = intermediateCountForMonths(months, settings.intermediateSuggestion || []);
    if (suggestedCount > 0) {
      const target = Math.min(remainder, money(suggestedCount * intermediateLimit));
      const intermediate = distributeEvenly(target, suggestedCount, intermediateLimit);
      intermediateQuantity = intermediate.quantity;
      intermediateValue = intermediate.value;
      remainder = money(remainder - intermediate.total);
    }
  }

  let keys = 0;
  if (remainder > 0 && keysLimit > 0) {
    keys = Math.min(remainder, keysLimit);
    remainder = money(remainder - keys);
  }

  // O saldo que não couber nos limites sugeridos volta para o ato, conforme a ordem oficial.
  if (remainder > 0) {
    act = money(act + remainder);
    remainder = 0;
  }

  const result = finalize({ entry: totalEntry, income: grossIncome, monthlyLimit, intermediateLimit, keysLimit, act, monthlyQuantity, monthlyValue, intermediateQuantity, intermediateValue, keys, mode: 'automatic' });
  return adjustCentDifference(result);
}

export function calculateManualFlow({ entry, income, monthlyLimitPercentage = 0.20, intermediateLimitPercentage = 0.80, keysLimitPercentage = 0.80, act = 0, monthlyQuantity = 0, monthlyValue = 0, intermediateQuantity = 0, intermediateValue = 0, keys = 0, proSolutoValue = 0 }) {
  const totalEntry = nonNegative(entry);
  const proSoluto = Math.min(nonNegative(proSolutoValue), totalEntry);
  const distributableEntry = money(totalEntry - proSoluto);
  return finalize({
    entry: totalEntry,
    distributableEntry,
    income: nonNegative(income),
    monthlyLimit: money(nonNegative(income) * Number(monthlyLimitPercentage || 0.20)),
    intermediateLimit: money(nonNegative(income) * Number(intermediateLimitPercentage || 0.80)),
    keysLimit: money(nonNegative(income) * Number(keysLimitPercentage || 0.80)),
    act: nonNegative(act),
    monthlyQuantity: Math.max(Math.trunc(Number(monthlyQuantity) || 0), 0),
    monthlyValue: nonNegative(monthlyValue),
    intermediateQuantity: Math.max(Math.trunc(Number(intermediateQuantity) || 0), 0),
    intermediateValue: nonNegative(intermediateValue),
    keys: nonNegative(keys),
    proSoluto,
    mode: 'manual'
  });
}

function finalize(values) {
  const entry = nonNegative(values.entry);
  const distributableEntry = values.distributableEntry == null ? entry : nonNegative(values.distributableEntry);
  const act = nonNegative(values.act);
  const monthlyQuantity = Math.max(Math.trunc(Number(values.monthlyQuantity) || 0), 0);
  const monthlyValue = nonNegative(values.monthlyValue);
  const intermediateQuantity = Math.max(Math.trunc(Number(values.intermediateQuantity) || 0), 0);
  const intermediateValue = nonNegative(values.intermediateValue);
  const keys = nonNegative(values.keys);
  const proSoluto = nonNegative(values.proSoluto);
  const monthlyTotal = money(monthlyQuantity * monthlyValue);
  const intermediateTotal = money(intermediateQuantity * intermediateValue);
  const distributed = money(act + monthlyTotal + intermediateTotal + keys);
  const difference = money(distributableEntry - distributed);
  const status = Math.abs(difference) < 0.01 ? 'closed' : difference > 0 ? 'missing' : 'excess';
  const income = nonNegative(values.income);
  const percent = (value) => income > 0 ? (nonNegative(value) / income) * 100 : 0;
  const warnings = [];
  if (monthlyValue > values.monthlyLimit + 0.009) warnings.push('A mensal supera 20% da renda configurada.');
  if (intermediateValue > values.intermediateLimit + 0.009) warnings.push('A intermediária supera 80% da renda configurada.');
  if (keys > values.keysLimit + 0.009) warnings.push('A parcela de chaves supera 80% da renda configurada.');
  if (act > values.monthlyLimit + 0.009) warnings.push('O ato supera o limite comercial de uma mensal.');
  return {
    ...values,
    entry,
    distributableEntry,
    act,
    monthlyQuantity,
    monthlyValue,
    monthlyTotal,
    intermediateQuantity,
    intermediateValue,
    intermediateTotal,
    keys,
    proSoluto,
    distributed,
    compositionTotal: money(distributed + proSoluto),
    difference,
    status,
    warnings,
    percentages: { act: percent(act), monthly: percent(monthlyValue), intermediate: percent(intermediateValue), keys: percent(keys) }
  };
}

function adjustCentDifference(result) {
  if (Math.abs(result.difference) < 0.01 || result.status === 'excess') return result;
  // Ajuste de centavos na última parcela mensal, quando houver; caso contrário, no ato.
  if (result.monthlyQuantity > 0) {
    const adjustedValue = money(result.monthlyValue + result.difference / result.monthlyQuantity);
    return finalize({ ...result, monthlyValue: adjustedValue });
  }
  return finalize({ ...result, act: money(result.act + result.difference) });
}
