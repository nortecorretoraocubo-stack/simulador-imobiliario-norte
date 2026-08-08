import { getState } from '../state.js';

const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function parts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : { year: '', month: '', day: '' };
}
function options(start, end, selected, descending = false) {
  const values = Array.from({ length: Math.abs(end-start)+1 }, (_,i) => descending ? start-i : start+i);
  return values.map(v => `<option value="${v}" ${Number(selected)===v?'selected':''}>${v}</option>`).join('');
}

export const buyerPage = () => {
  const { buyer } = getState();
  const dob = parts(buyer.oldestBuyerBirthDate);
  const currentYear = new Date().getFullYear();
  return `<section class="page-grid">
    <header><p class="eyebrow">Etapa 1 de 5</p><h1 class="page-title" tabindex="-1">Dados do comprador</h1><p class="page-description">Comece pelas informações essenciais. O rascunho fica salvo automaticamente neste aparelho.</p></header>
    <form id="buyer-form" class="form-card form-grid">
      <div class="field field-full"><label for="buyer-name">Nome do cliente (opcional)</label><input id="buyer-name" name="name" value="${buyer.name || ''}" autocomplete="name"></div>
      <div class="field"><label for="gross-income">Renda familiar bruta mensal</label><input id="gross-income" name="grossIncome" type="number" min="0" step="0.01" inputmode="decimal" value="${buyer.grossIncome || ''}" required></div>
      <div class="field"><label for="fgts-balance">Saldo disponível de FGTS</label><input id="fgts-balance" name="fgtsBalance" type="number" min="0" step="0.01" inputmode="decimal" value="${buyer.fgtsBalance || ''}"></div>
      <div class="field"><label for="fgts-three-years">Possui três anos de FGTS?</label><select id="fgts-three-years" name="hasThreeYearsFgts"><option value="true" ${buyer.hasThreeYearsFgts ? 'selected':''}>Sim</option><option value="false" ${!buyer.hasThreeYearsFgts ? 'selected':''}>Não</option></select></div>
      <fieldset class="field field-full birthdate-field"><legend>Data de nascimento do comprador mais velho</legend><div class="birthdate-selects">
        <label><span>Dia</span><select name="birthDay" required><option value="">Dia</option>${options(1,31,dob.day)}</select></label>
        <label><span>Mês</span><select name="birthMonth" required><option value="">Mês</option>${months.map((m,i)=>`<option value="${i+1}" ${dob.month===i+1?'selected':''}>${m}</option>`).join('')}</select></label>
        <label><span>Ano</span><select name="birthYear" required><option value="">Ano</option>${options(currentYear-18, currentYear-100, dob.year, true)}</select></label>
      </div><small class="field-help">A data completa permite calcular com precisão a quantidade máxima de parcelas.</small></fieldset>
      <div class="field"><label for="commitments">Compromissos mensais existentes</label><input id="commitments" name="monthlyCommitments" type="number" min="0" step="0.01" inputmode="decimal" value="${buyer.monthlyCommitments || ''}"></div>
      <div class="field field-full">
        <label class="check-option subsidy-check"><input id="additional-proponent-dependent" name="hasAdditionalProponentOrDependent" type="checkbox" value="true" ${buyer.hasAdditionalProponentOrDependent ? 'checked' : ''}><span>Marque se houver mais de um proponente ou dependente</span></label>
        <small class="field-help">Essa informação aumenta o potencial estimado de subsídio quando a operação estiver em faixa elegível. O valor definitivo depende da análise oficial.</small>
      </div>
      <div class="actions-row field-full"><button class="button button-primary" type="submit">Salvar e continuar</button><a class="button button-ghost" href="#/inicio">Voltar</a></div>
    </form>
  </section>`;
};
