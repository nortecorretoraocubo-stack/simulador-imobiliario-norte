export function findIncomeBand(income, incomeBands) {
  const numericIncome = Number(income);
  if (!Number.isFinite(numericIncome) || numericIncome < 0) {
    return { matched: false, status: 'invalid_income', message: 'Informe uma renda familiar válida.' };
  }

  const rule = incomeBands.rules.find((item) =>
    item.active !== false && numericIncome >= item.minimumIncome && numericIncome <= item.maximumIncome
  );

  if (rule) return { matched: true, rule };

  if (numericIncome > incomeBands.outsideProgram.minimumIncomeExclusive) {
    return {
      matched: false,
      status: 'outside_program',
      message: incomeBands.outsideProgram.message,
      requiresManualRate: incomeBands.outsideProgram.requiresManualRate
    };
  }

  return { matched: false, status: 'no_rule', message: 'Não existe faixa de renda ativa compatível.' };
}
