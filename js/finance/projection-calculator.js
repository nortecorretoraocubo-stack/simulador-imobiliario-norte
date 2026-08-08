import { automaticIntermediateOffsets, dueDateForOffset, formatInstallmentDate } from '../core/installment-dates.js';

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const clamp = (v, a, b) => Math.min(Math.max(Number(v) || 0, a), b);

export function constructionProgressAt(month, settings = {}) {
  const milestones = settings.evolution?.milestones || [[0,0],[36,1]];
  const m = Math.max(Number(month) || 0, 0);
  if (m <= milestones[0][0]) return milestones[0][1];
  for (let i=1;i<milestones.length;i++) {
    const [m2,p2]=milestones[i]; const [m1,p1]=milestones[i-1];
    if (m <= m2) return p1 + ((m-m1)/(m2-m1))*(p2-p1);
  }
  return milestones[milestones.length-1][1];
}

export function buildCorrectionProjection({ flow, monthsUntilDelivery, financing, monthlyFinancingRate, constructionType, projectionSettings, incomeLimit, dueDay = 10, intermediateOffsets = null, baseDate = new Date() }) {
  const months=Math.max(Math.trunc(Number(monthsUntilDelivery)||0),0);
  const incc=Number(projectionSettings?.incc?.monthlyReference)||0;
  const igpm=Number(projectionSettings?.igpm?.monthlyReference)||0;
  const rows=[];
  const offsets = Array.isArray(intermediateOffsets) && intermediateOffsets.length
    ? intermediateOffsets.map(Number)
    : automaticIntermediateOffsets(flow?.intermediateQuantity, months);
  const intermediateCountByMonth = offsets.reduce((acc, m) => {
    if (m >= 1 && m <= months) acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  rows.push({number:'Ato',label:'Ato',month:0,dueDate:formatInstallmentDate(baseDate),flowBase:money(flow?.act),flowCorrected:money(flow?.act),evolution:0,total:money(flow?.act),index:'Sem correção'});
  for(let m=1;m<=months;m++){
    let base=0;
    const labels=[String(m)];
    if(m<=Number(flow?.monthlyQuantity||0)) { base += Number(flow?.monthlyValue)||0; }
    const interCount=intermediateCountByMonth[m] || 0;
    if(interCount){ base += (Number(flow?.intermediateValue)||0) * interCount; labels.push(interCount > 1 ? `${interCount} Intermediárias` : 'Intermediária'); }
    if(m===months && Number(flow?.keys||0) > 0){ base += Number(flow?.keys)||0; labels.push('Chaves'); }
    const corrected=money(base*Math.pow(1+incc,m));
    let evolution=0;
    if(constructionType==='associativo' && m>=Number(projectionSettings?.evolution?.firstChargeAfterMonths||2)){
      const avg=Number(projectionSettings?.evolution?.averageConstructionMonths||36);
      const elapsed=Math.max(avg-months,0);
      const progress=constructionProgressAt(Math.min(elapsed+m,avg),projectionSettings);
      const released=money((Number(financing)||0)*progress);
      evolution=money(released*(Number(monthlyFinancingRate)||0));
    }
    const date=dueDateForOffset(m,dueDay,baseDate);
    const label = labels.join(' + ');
    rows.push({number:label,displayNumber:label,month:m,dueDate:formatInstallmentDate(date),flowBase:money(base),flowCorrected:corrected,evolution,total:money(corrected+evolution),index:base?`INCC × ${m}`:''});
  }
  const proValue=Number(flow?.proSoluto)||0;
  const proQty=Math.max(Math.trunc(Number(flow?.proSolutoInstallments)||0),0);
  if(proValue>0 && proQty>0){
    const unit=proValue/proQty;
    for(let k=1;k<=proQty;k++){
      const corrected=money(unit*Math.pow(1+igpm,k));
      const date=dueDateForOffset(months+k,dueDay,baseDate);
      rows.push({number:`PS ${k}`,label:`Pró-soluto ${k}`,month:months+k,dueDate:formatInstallmentDate(date),flowBase:money(unit),flowCorrected:corrected,evolution:0,total:corrected,index:`IGP-M × ${k}`});
    }
  }
  const currentFinancing=Math.max(Number(financing)||0,0);
  const projectedFinancing=money(currentFinancing*Math.pow(1+incc,months));
  const incomeCapacity=Math.max(Number(incomeLimit)||0,0);
  const projectedUsage=incomeCapacity>0?projectedFinancing/incomeCapacity:0;
  let risk='Não se aplica';
  if(constructionType==='sfh'){
    const low=Number(projectionSettings?.risk?.lowMaximum)||0.85;
    const moderate=Number(projectionSettings?.risk?.moderateMaximum)||1;
    risk=projectedUsage<=low?'Baixo':projectedUsage<=moderate?'Moderado':'Alto';
  }
  return {rows,inccMonthly:incc,igpmMonthly:igpm,projectedFinancing,projectedUsage,risk,firstEvolution:rows.find(r=>r.evolution>0)?.evolution||0};
}

export function proposalFromPercent({ saleValue, approvedFinancing, fgts=0, subsidy=0, requestedPercent }) {
  const sale=Math.max(Number(saleValue)||0,0); const approved=Math.max(Number(approvedFinancing)||0,0);
  const financingMinimumWorks=sale>0?((sale-Math.min(approved,sale))/sale)*100:20;
  const resourceMinimum=sale>0?((Math.max(Number(fgts)||0,0)+Math.max(Number(subsidy)||0,0))/sale)*100:0;
  const minimumPercent=Math.min(100,Math.max(20,financingMinimumWorks,resourceMinimum));
  const requested=clamp(requestedPercent==null?Math.max(30,minimumPercent):requestedPercent,minimumPercent,100);
  const nonBankPortion=money(sale*(requested/100));
  const financing=money(Math.max(sale-nonBankPortion,0));
  const cashFlowEntry=money(Math.max(nonBankPortion-Math.max(Number(fgts)||0,0)-Math.max(Number(subsidy)||0,0),0));
  return {minimumPercent,percent:requested,nonBankPortion,financing,cashFlowEntry};
}

export function percentageFlow({ entry, monthsUntilDelivery, actPercentage=10, monthlyPercentage=60, intermediatePercentage=20, intermediateQuantity=0 }) {
  const total=Math.max(Number(entry)||0,0); const months=Math.max(Math.trunc(Number(monthsUntilDelivery)||0),0);
  let a=clamp(actPercentage,0,100), m=clamp(monthlyPercentage,0,100), i=clamp(intermediatePercentage,0,100);
  if (Math.max(Math.trunc(Number(intermediateQuantity)||0),0) === 0) i = 0;
  const sum=a+m+i; let warning='';
  if(sum>100){ warning='A soma de ato, mensais e intermediárias ultrapassa 100%. Ajuste os percentuais.'; }
  const keysPct=Math.max(100-sum,0);
  const monthlyQty=Math.max(months-1,0);
  const interQty=Math.max(Math.trunc(Number(intermediateQuantity)||0),0);
  const act=money(total*a/100), monthlyTotal=money(total*m/100), intermediateTotal=money(total*i/100), keys=money(total*keysPct/100);
  const monthlyValue=monthlyQty?money(monthlyTotal/monthlyQty):0;
  const intermediateValue=interQty?money(intermediateTotal/interQty):0;
  return {entry:total,act,monthlyQuantity:monthlyQty,monthlyValue,monthlyTotal,intermediateQuantity:interQty,intermediateValue,intermediateTotal,keys,proSoluto:0,proSolutoInstallments:0,compositionTotal:money(act+monthlyTotal+intermediateTotal+keys),status:sum<=100?'closed':'excess',difference:sum<=100?0:money(total-(act+monthlyTotal+intermediateTotal+keys)),warnings:warning?[warning]:[],percentages:{act:a,monthly:m,intermediate:i,keys:keysPct}};
}
