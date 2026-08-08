import { APP_VERSION, BROKER_PROFILE } from '../constants.js';
import { formatCurrency } from '../core/formatters.js';
import { buildReportData } from '../pages/summary-page.js';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatPercent = (value, digits = 2) => value == null
  ? 'Indisponível'
  : `${Number(value).toFixed(digits).replace('.', ',')}%`;

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function whatsappContactUrl() {
  const text = encodeURIComponent('Acabei de ver a simulação, quero falar sobre isso');
  return `https://wa.me/${BROKER_PROFILE.whatsapp}?text=${text}`;
}

function flowRows(data) {
  if (!data.isConstruction) return '';
  const flow = data.flow;
  return `
    <div class="report-section">
      <h2>Fluxo da entrada</h2>
      <div class="flow-grid">
        <div><span>Ato</span><strong>${formatCurrency(flow.act)}</strong></div>
        <div><span>Mensais</span><strong>${flow.monthlyQuantity ? `${flow.monthlyQuantity} x ${formatCurrency(flow.monthlyValue)}` : 'Não utilizadas'}</strong>${data.schedule?.dates?.monthly?.length ? `<small>${formatDate(data.schedule.dates.monthly[0])} até ${formatDate(data.schedule.dates.monthly[data.schedule.dates.monthly.length-1])}</small>` : ''}</div>
        <div><span>${flow.intermediateLabel || 'Intermediárias'}</span><strong>${flow.intermediateQuantity ? `${flow.intermediateQuantity} x ${formatCurrency(flow.intermediateValue)}` : 'Não utilizadas'}</strong>${data.schedule?.dates?.intermediates?.length ? `<small>${data.schedule.dates.intermediates.map(formatDate).join(' · ')}</small>` : ''}</div>
        <div><span>Chaves</span><strong>${flow.keys ? formatCurrency(flow.keys) : 'Não utilizada'}</strong>${data.schedule?.dates?.keys ? `<small>${formatDate(data.schedule.dates.keys)}</small>` : ''}</div>
        ${flow.proSoluto ? `<div><span>Pró-soluto</span><strong>${formatCurrency(flow.proSoluto)}</strong></div>` : ''}
      </div>
    </div>`;
}

function clientCosts(data) {
  if (data.isConstruction) return '';
  return `<div class="report-section">
    <h2>Custos adicionais estimados</h2>
    <p class="muted">Reserva separada da entrada para impostos, registro, cartório e despesas bancárias.</p>
    <div class="two-values">
      <div><span>Faixa estimada</span><strong>${formatCurrency(data.acquisitionCosts.minimum)} a ${formatCurrency(data.acquisitionCosts.maximum)}</strong></div>
      <div><span>Reserva sugerida</span><strong>${formatCurrency(data.acquisitionCosts.suggested)}</strong></div>
    </div>
  </div>`;
}

function technicalPage(data) {
  const { result, item, installments, state, entry, acquisitionCosts } = data;
  const baseLabel = result.quotaBaseType === 'appraisal' ? 'Avaliação bancária' : 'Menor entre venda e avaliação';
  const alerts = [...(result.warnings || []), ...(result.brokerNotes || [])];
  return `<section class="technical-page page-break">
    <header class="technical-title"><small>USO DO CORRETOR</small><h1>Análise detalhada</h1></header>
    <div class="technical-columns">
      <div class="tech-card"><h2>Enquadramento</h2>
        <p><span>Programa</span><strong>${escapeHtml(result.program)}</strong></p>
        <p><span>Linha/faixa</span><strong>${escapeHtml(result.creditLine || result.band)}${result.subBand ? ` - ${escapeHtml(result.subBand)}` : ''}</strong></p>
        <p><span>FGTS</span><strong>${result.fgtsStatus === 'cotista' ? 'Cotista' : 'Não cotista'}</strong></p>
        <p><span>Taxa nominal</span><strong>${formatPercent(result.nominalAnnualRate)} a.a.${result.rateIndexer ? ` + ${escapeHtml(result.rateIndexer)}` : ''}</strong></p>
        <p><span>Taxa efetiva</span><strong>${formatPercent(result.effectiveAnnualRate)} a.a.</strong></p>
        <p><span>Prazo</span><strong>${result.maximumTermMonths} meses</strong></p>
      </div>
      <div class="tech-card"><h2>Limites</h2>
        <p><span>Limite pela renda</span><strong>${formatCurrency(item.incomeLimit)}</strong></p>
        <p><span>Limite pela cota</span><strong>${formatCurrency(item.quotaLimit)}</strong></p>
        <p><span>Valor necessário</span><strong>${formatCurrency(item.amountNeeded)}</strong></p>
        <p><span>Fator limitante</span><strong>${escapeHtml(item.limitingFactor || '-')}</strong></p>
        <p><span>Entrada apurada</span><strong>${formatCurrency(entry)}</strong></p>
      </div>
      <div class="tech-card"><h2>Garantia</h2>
        <p><span>Venda</span><strong>${formatCurrency(state.property.saleValue)}</strong></p>
        <p><span>Avaliação</span><strong>${formatCurrency(state.property.appraisalValue)}</strong></p>
        <p><span>Base da cota</span><strong>${formatCurrency(result.baseQuota)}</strong></p>
        <p><span>Critério</span><strong>${baseLabel}</strong></p>
        <p><span>Cota</span><strong>${formatPercent((item.quota ?? result.quota) * 100, 0)}</strong></p>
      </div>
      <div class="tech-card"><h2>Financiamento</h2>
        <p><span>Sistema</span><strong>${state.selectedSystem === 'sac' ? 'SAC' : 'Price'}</strong></p>
        <p><span>Primeira parcela</span><strong>${formatCurrency(installments.first)}</strong></p>
        <p><span>Última parcela</span><strong>${formatCurrency(installments.last)}</strong></p>
        <p><span>Total aproximado</span><strong>${formatCurrency(installments.total)}</strong></p>
        <p><span>Juros aproximados</span><strong>${formatCurrency(installments.interest)}</strong></p>
      </div>
    </div>
    <div class="tech-card wide"><h2>Custos de documentação e contratação</h2>
      <p><span>Reserva estimada</span><strong>${formatCurrency(acquisitionCosts.minimum)} a ${formatCurrency(acquisitionCosts.maximum)}</strong></p>
      <p><span>Referência sugerida</span><strong>${formatCurrency(acquisitionCosts.suggested)}</strong></p>
      <p><span>ITBI preliminar</span><strong>${formatCurrency(acquisitionCosts.preliminaryItbi)}</strong></p>
      <p><span>Avaliação bancária</span><strong>${formatCurrency(acquisitionCosts.components.bankAppraisal?.minimumValue)} a ${formatCurrency(acquisitionCosts.components.bankAppraisal?.maximumValue)}</strong></p>
    </div>
    ${alerts.length ? `<div class="tech-card wide"><h2>Alertas e observações</h2>${alerts.map((alert) => `<p class="alert-line">${escapeHtml(alert)}</p>`).join('')}</div>` : ''}
  </section>`;
}

function projectionPage(data) {
  if (!data.isConstruction || !data.projection) return '';
  const p = data.projection;
  const pct = (v) => `${Number(v||0).toFixed(2).replace('.', ',')}%`;
  const rows=p.rows.map(r=>`<tr><td><strong>${r.number}</strong>${r.dueDate?`<br><small>${r.dueDate}</small>`:''}</td><td>${formatCurrency(r.flowCorrected)}</td><td>${formatCurrency(r.evolution)}</td><td><strong>${formatCurrency(r.total)}</strong></td></tr>`).join('');
  const risk=data.state.property.constructionType==='sfh'?`<div class="projection-risk"><span>Nível de risco projetado no repasse</span><strong>${p.risk}</strong><small>Saldo estimado com INCC: ${formatCurrency(p.projectedFinancing)} · uso da capacidade atual por renda: ${pct(p.projectedUsage*100)}</small></div>`:'';
  return `<section class="technical-page page-break"><header class="technical-title"><small>PROJEÇÃO COMERCIAL</small><h1>Projeção com correção</h1></header><div class="two-values"><div><span>INCC de referência</span><strong>${pct(p.inccMonthly*100)} a.m.</strong></div><div><span>IGP-M de referência</span><strong>${pct(p.igpmMonthly*100)} a.m.</strong></div></div>${risk}<table class="projection-report-table"><thead><tr><th>Nº da parcela</th><th>Parcela fluxo</th><th>Parcela Ev. Obra</th><th>Parcela Total</th></tr></thead><tbody>${rows}</tbody></table><p class="projection-note">Projeção comercial baseada em índices de referência e curva teórica de obra. O ato não sofre INCC. As parcelas seguintes recebem correção cumulativa até o pagamento. Pró-soluto, quando houver, é projetado pelo IGP-M. No Associativo, a evolução de obra real depende das medições e liberações da CAIXA e pode incluir TR, MIP, DFI e tarifa de administração.</p></section>`;
}

function reportHtml(data, includeTechnical = false, includeProjection = false) {
  const { state, result, financing, fgts, subsidy, entry, installments } = data;
  const customer = state.buyer.name || 'Cliente';
  const project = state.property.projectName || 'Imóvel selecionado';
  const contactUrl = whatsappContactUrl();
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulação de Financiamento - ${escapeHtml(customer)}</title>
  <style>
    :root{--navy:#102a43;--green:#23856b;--soft:#eef8f4;--line:#d8e1e8;--text:#243b53;--muted:#627d98;--warn:#fff7df;--warn-border:#f2c94c}
    *{box-sizing:border-box}body{margin:0;background:#eef2f5;color:var(--text);font-family:Arial,Helvetica,sans-serif}.toolbar{position:sticky;top:0;display:flex;justify-content:center;gap:10px;padding:12px;background:#102a43}.toolbar button{border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}.toolbar .primary{background:#91d6bd;color:#102a43}.sheet{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:16mm 15mm 13mm;box-shadow:0 12px 40px #0002;position:relative}.brand{display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--navy);padding-bottom:12px}.brand-mark{width:42px;height:42px;border-radius:12px;background:var(--navy);color:#fff;display:grid;place-items:center;font-size:24px;font-weight:800}.brand h1{font-size:20px;margin:0;color:var(--navy)}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.prepared{display:flex;justify-content:space-between;gap:20px;margin:18px 0 12px}.prepared span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.prepared strong{font-size:14px}.hero-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.hero-card{padding:13px;border:1px solid var(--line);border-radius:12px}.hero-card.featured{background:var(--soft);border-color:#91d6bd}.hero-card span,.flow-grid span,.two-values span{display:block;color:var(--muted);font-size:11px}.hero-card strong{display:block;margin-top:5px;font-size:20px;color:var(--navy)}.support-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.support-grid div{padding:10px;background:#f7f9fb;border-radius:9px}.support-grid span{display:block;font-size:10px;color:var(--muted)}.support-grid strong{display:block;margin-top:4px;font-size:13px}.report-section{border-top:1px solid var(--line);padding-top:13px;margin-top:13px}.report-section h2{font-size:15px;color:var(--navy);margin:0 0 9px}.flow-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.flow-grid div,.two-values div{padding:10px;border:1px solid var(--line);border-radius:9px}.flow-grid strong,.two-values strong{display:block;margin-top:4px;font-size:13px}.flow-grid small{display:block;margin-top:3px;color:var(--muted);font-size:8px;line-height:1.3}.two-values{display:grid;grid-template-columns:1fr 1fr;gap:8px}.muted{color:var(--muted);font-size:11px;margin:0 0 8px}.legal{margin-top:16px;padding:12px 14px;background:var(--warn);border:1px solid var(--warn-border);border-radius:10px;font-size:11px;line-height:1.45;font-weight:800}.quote{text-align:center;color:var(--green);font-weight:700;font-size:12px;margin:17px 0 10px}.contact{text-align:center}.contact a{display:inline-block;background:var(--navy);color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:12px}.footer{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;justify-content:space-between;color:#829ab1;font-size:8px;border-top:1px solid var(--line);padding-top:5px}.page-break{page-break-before:always}.technical-page{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm;box-shadow:0 12px 40px #0002}.technical-title small{color:var(--green);font-weight:800}.technical-title h1{color:var(--navy);margin:4px 0 15px}.technical-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tech-card{border:1px solid var(--line);border-radius:10px;padding:12px}.tech-card.wide{margin-top:10px}.tech-card h2{font-size:14px;margin:0 0 8px;color:var(--navy)}.tech-card p{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #edf2f6;padding:5px 0;margin:0;font-size:10px}.tech-card p:last-child{border-bottom:0}.tech-card span{color:var(--muted)}.tech-card strong{text-align:right}.alert-line{display:block!important;line-height:1.4}.system-badge{display:inline-block;background:var(--navy);color:#fff;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:800}
    .projection-risk{margin:14px 0;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--soft)}.projection-risk span,.projection-risk small{display:block;color:var(--muted);font-size:10px}.projection-risk strong{display:block;color:var(--navy);font-size:18px;margin:4px 0}.projection-report-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:9px}.projection-report-table th,.projection-report-table td{border:1px solid var(--line);padding:5px;text-align:right}.projection-report-table th:first-child,.projection-report-table td:first-child{text-align:center}.projection-report-table th{background:#f4f7f9;color:var(--navy)}.projection-note{font-size:9px;color:var(--muted);line-height:1.45;margin-top:10px}
    @media print{body{background:#fff}.toolbar{display:none}.sheet,.technical-page{margin:0;box-shadow:none}.sheet{page-break-after:${includeTechnical ? 'always' : 'auto'}}@page{size:A4;margin:0}}
    @media(max-width:800px){.sheet,.technical-page{width:100%;min-height:auto;margin:0;padding:24px 18px;box-shadow:none}.hero-grid{grid-template-columns:1fr}.support-grid,.flow-grid{grid-template-columns:1fr 1fr}.technical-columns{grid-template-columns:1fr}.footer{position:static;margin-top:20px}.toolbar{position:static}}
  </style></head><body>
  <div class="toolbar"><button class="primary" onclick="window.print()">Imprimir / Salvar em PDF</button><button onclick="window.close()">Fechar</button></div>
  <main class="sheet">
    <header class="brand"><div class="brand-mark">N</div><div><h1>SIMULAÇÃO DE FINANCIAMENTO IMOBILIÁRIO</h1><p>Norte Corretor de Imóveis</p></div></header>
    <div class="prepared"><div><span>Preparada para</span><strong>${escapeHtml(customer)}</strong></div><div><span>Empreendimento</span><strong>${escapeHtml(project)}</strong></div><div><span>Data</span><strong>${formatDate()}</strong></div></div>
    <div class="hero-grid">
      <div class="hero-card"><span>Valor do imóvel</span><strong>${formatCurrency(state.property.saleValue)}</strong></div>
      <div class="hero-card featured"><span>Financiamento estimado</span><strong>${formatCurrency(financing)}</strong></div>
      <div class="hero-card"><span>Entrada estimada</span><strong>${formatCurrency(entry)}</strong></div>
    </div>
    <div class="support-grid">
      <div><span>Sistema</span><strong>${state.selectedSystem === 'sac' ? 'SAC' : 'PRICE'}</strong></div>
      <div><span>Prazo</span><strong>${result.maximumTermMonths} meses</strong></div>
      <div><span>Primeira parcela</span><strong>${formatCurrency(installments.first)}</strong></div>
      <div><span>Última parcela</span><strong>${formatCurrency(installments.last)}</strong></div>
    </div>
    <div class="report-section"><h2>Parâmetros da simulação</h2><div class="two-values">
      <div><span>Renda familiar utilizada</span><strong>${formatCurrency(state.buyer.grossIncome)}</strong></div>
      <div><span>Participante ou dependente adicional</span><strong>${state.buyer.hasAdditionalProponentOrDependent ? 'Sim' : 'Não'}</strong></div>
    </div></div>
    <div class="report-section"><h2>Composição da compra</h2><div class="support-grid">
      <div><span>FGTS</span><strong>${fgts ? formatCurrency(fgts) : 'Não utilizado'}</strong></div>
      <div><span>Subsídio estimado</span><strong>${formatCurrency(subsidy)}</strong></div>
      <div><span>Taxa nominal</span><strong>${formatPercent(result.nominalAnnualRate)} a.a.${result.rateIndexer ? ` + ${escapeHtml(result.rateIndexer)}` : ''}</strong></div>
      <div><span>Linha</span><strong>${escapeHtml(result.creditLine || result.band || result.program)}</strong></div>
    </div></div>
    ${flowRows(data)}
    ${clientCosts(data)}
    <div class="legal">ESSE DOCUMENTO SE TRATA DE UMA SIMULAÇÃO E NÃO REPRESENTA O RESULTADO REAL OFERTADO PELA INSTITUIÇÃO FINANCEIRA. ENTRE EM CONTATO PARA FAZER A ANÁLISE OFICIAL.</div>
    <p class="quote">Uma boa decisão começa com uma simulação bem construída.</p>
    <div class="contact"><a href="${contactUrl}" target="_blank" rel="noopener">Falar com o Corretor Norte - ${BROKER_PROFILE.phoneDisplay}</a></div>
    <footer class="footer"><span>Simulador Norte - versão ${APP_VERSION}</span><span>${formatDate()}</span></footer>
  </main>
  ${includeTechnical ? technicalPage(data) : ''}
  ${includeProjection ? projectionPage(data) : ''}
  </body></html>`;
}

function openReport(includeTechnical = false, includeProjection = false) {
  const data = buildReportData();
  if (!data) { alert('Conclua a simulação antes de gerar o relatório.'); return; }
  const popup = window.open('', '_blank');
  if (!popup) { alert('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente novamente.'); return; }
  popup.document.open(); popup.document.write(reportHtml(data, includeTechnical, includeProjection)); popup.document.close(); popup.focus();
}

function askProjection() {
  const data=buildReportData();
  return Boolean(data?.isConstruction) && confirm('Deseja incluir a página “Projeção com correção” neste PDF/impressão?');
}

export function generateClientPdf() { openReport(false, askProjection()); }
export function generateBrokerPdf() { openReport(true, askProjection()); }
export function printResult() { openReport(false, askProjection()); }

export function buildWhatsAppMessage() {
  const data = buildReportData();
  if (!data) return '';
  const { state, financing, fgts, subsidy, entry, installments, result, flow, isConstruction } = data;
  const name = state.buyer.name ? `, ${state.buyer.name}` : '';
  const lines = [
    '🏡 *RESULTADO DA SIMULAÇÃO*',
    '',
    `Olá${name}!`,
    '',
    'Conforme nossa conversa, segue um resumo da simulação:',
    '',
    `🏠 *Valor do imóvel:* ${formatCurrency(state.property.saleValue)}`,
    `💰 *Financiamento estimado:* ${formatCurrency(financing)}`,
    `📌 *Entrada estimada:* ${formatCurrency(entry)}`,
    `📅 *Prazo:* ${result.maximumTermMonths} meses`,
    `📉 *Primeira parcela:* ${formatCurrency(installments.first)}`,
    `📈 *Última parcela:* ${formatCurrency(installments.last)}`,
    `📊 *Sistema:* ${state.selectedSystem === 'sac' ? 'SAC' : 'PRICE'}`,
    fgts ? `🏦 *FGTS utilizado:* ${formatCurrency(fgts)}` : '',
    `🎯 *Subsídio estimado:* ${formatCurrency(subsidy)}`, 
  ].filter(Boolean);
  if (isConstruction) {
    lines.push('', '*Fluxo da entrada*', `• Ato: ${formatCurrency(flow.act)}`);
    if (flow.monthlyQuantity) lines.push(`• ${flow.monthlyQuantity} mensais de ${formatCurrency(flow.monthlyValue)}`);
    if (flow.intermediateQuantity) lines.push(`• ${flow.intermediateQuantity} intermediárias de ${formatCurrency(flow.intermediateValue)}`);
    if (flow.keys) lines.push(`• Chaves: ${formatCurrency(flow.keys)}`);
    if (flow.proSoluto) lines.push(`• Pró-soluto: ${formatCurrency(flow.proSoluto)}`);
  }
  lines.push('', '*Esta simulação foi elaborada com base nas informações fornecidas e serve como estimativa comercial. A aprovação e as condições finais dependem da análise da instituição financeira.*', '', 'Estou à disposição para ajustar a simulação ou esclarecer qualquer dúvida.', '', '🏡 *RESULTADO DA SIMULAÇÃO*', `*${BROKER_PROFILE.name}*`, `📱 ${BROKER_PROFILE.phoneDisplay}`);
  return lines.join('\n');
}

export function openWhatsApp() {
  const message = buildWhatsAppMessage();
  if (!message) { alert('Conclua a simulação antes de compartilhar.'); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

export async function copyWhatsAppMessage() {
  const message = buildWhatsAppMessage();
  if (!message) { alert('Conclua a simulação antes de copiar.'); return; }
  try {
    await navigator.clipboard.writeText(message);
    alert('Mensagem copiada.');
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = message;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    alert('Mensagem copiada.');
  }
}
