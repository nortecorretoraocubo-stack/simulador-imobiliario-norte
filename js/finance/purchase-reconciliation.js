const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const nonNegative = (value) => Math.max(money(value), 0);

/**
 * Reconcilia a composição da compra quando o corretor altera manualmente a entrada.
 * O financiamento pode diminuir, mas nunca aumentar além do valor previamente aprovado.
 */
export function reconcilePurchase({ saleValue, approvedFinancing, fgts = 0, subsidy = 0, buyerContribution = 0 }) {
  const sale = nonNegative(saleValue);
  const approved = Math.min(nonNegative(approvedFinancing), sale);
  const fgtsUsed = Math.min(nonNegative(fgts), sale);
  const subsidyUsed = Math.min(nonNegative(subsidy), Math.max(sale - fgtsUsed, 0));
  const minimumEntry = Math.max(money(sale - approved - fgtsUsed - subsidyUsed), 0);
  const maximumBuyerContribution = Math.max(money(sale - fgtsUsed - subsidyUsed), 0);
  const contribution = nonNegative(buyerContribution);

  if (contribution < minimumEntry - 0.009) {
    const missing = money(minimumEntry - contribution);
    return {
      status: 'missing',
      sale,
      approvedFinancing: approved,
      financing: approved,
      financingReduction: 0,
      fgts: fgtsUsed,
      subsidy: subsidyUsed,
      buyerContribution: contribution,
      minimumEntry,
      maximumBuyerContribution,
      balance: missing,
      excess: 0,
      totalComposition: money(approved + fgtsUsed + subsidyUsed + contribution)
    };
  }

  if (contribution > maximumBuyerContribution + 0.009) {
    const excess = money(contribution - maximumBuyerContribution);
    return {
      status: 'excess',
      sale,
      approvedFinancing: approved,
      financing: 0,
      financingReduction: approved,
      fgts: fgtsUsed,
      subsidy: subsidyUsed,
      buyerContribution: contribution,
      minimumEntry,
      maximumBuyerContribution,
      balance: 0,
      excess,
      totalComposition: money(fgtsUsed + subsidyUsed + contribution)
    };
  }

  const financing = Math.max(money(sale - fgtsUsed - subsidyUsed - contribution), 0);
  const cappedFinancing = Math.min(financing, approved);
  const totalComposition = money(cappedFinancing + fgtsUsed + subsidyUsed + contribution);
  return {
    status: 'closed',
    sale,
    approvedFinancing: approved,
    financing: cappedFinancing,
    financingReduction: money(approved - cappedFinancing),
    fgts: fgtsUsed,
    subsidy: subsidyUsed,
    buyerContribution: contribution,
    minimumEntry,
    maximumBuyerContribution,
    balance: money(sale - totalComposition),
    excess: 0,
    totalComposition
  };
}
