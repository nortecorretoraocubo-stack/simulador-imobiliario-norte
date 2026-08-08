export const formatCurrency = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL'
}).format(Number(value) || 0);
