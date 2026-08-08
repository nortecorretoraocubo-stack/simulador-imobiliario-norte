import { generateConstructionFlow } from '../../js/construction/construction-flow-engine.js';
const settings={limits:{monthlyIncomePercentage:.2,intermediateIncomePercentage:.8,keysIncomePercentage:.8,minimumActValue:0},intermediateSuggestion:[{minimumMonths:24,maximumMonths:35,maximumCount:2}]};
const simple=generateConstructionFlow({entry:5000,income:4800,monthsUntilDelivery:26,settings});
console.assert(simple.status==='closed','Fluxo simples deve fechar');
console.assert(simple.intermediateQuantity===0,'Fluxo simples não deve criar intermediárias');
const large=generateConstructionFlow({entry:40000,income:4800,monthsUntilDelivery:26,settings});
console.assert(large.status==='closed','Fluxo grande deve fechar');
console.assert(large.intermediateQuantity>0 || large.keys>0 || large.act>960,'Fluxo grande deve usar etapas adicionais');
