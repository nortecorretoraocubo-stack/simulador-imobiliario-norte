const steps = [
  { route: 'comprador', label: 'Comprador' },
  { route: 'imovel', label: 'Imóvel' },
  { route: 'enquadramento', label: 'Enquadramento' },
  { route: 'fluxo', label: 'Sugestão de fluxo' },
  { route: 'resumo', label: 'Resumo' }
];
export function renderProgress(route, target) {
  if (!target) return;
  const currentIndex = steps.findIndex((step) => step.route === route);
  if (currentIndex < 0) { target.innerHTML = ''; target.hidden = true; return; }
  target.hidden = false;
  const percentage = steps.length === 1 ? 100 : (currentIndex / (steps.length - 1)) * 100;
  target.innerHTML = `<div class="progress-wrap"><div class="progress-mobile"><div><strong>Etapa ${currentIndex + 1} de ${steps.length}</strong><span>${steps[currentIndex].label}</span></div><div class="progress-track" aria-hidden="true"><span style="width:${percentage}%"></span></div></div><ol class="progress-stepper" aria-label="Progresso da simulação">${steps.map((step, index) => { const status=index<currentIndex?'completed':index===currentIndex?'current':'pending'; return `<li class="progress-step ${status}" ${status==='current'?'aria-current="step"':''}><a href="#/${step.route}"><span class="step-number">${index<currentIndex?'✓':index+1}</span><span class="step-label">${step.label}</span></a></li>`; }).join('')}</ol></div>`;
}
