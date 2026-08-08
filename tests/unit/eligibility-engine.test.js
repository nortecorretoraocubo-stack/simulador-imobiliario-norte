import { evaluateEligibility } from '../../js/rules/eligibility-engine.js';

export function runEligibilitySmokeTest(ruleSet) {
  const result = evaluateEligibility({
    buyer: { grossIncome: 4800, hasThreeYearsFgts: true, oldestBuyerBirthDate: '1991-01-15' },
    property: { saleValue: 235000, appraisalValue: 240000, state: 'SP', city: 'São Paulo', requestedTerm: 420 },
    ruleSet,
    referenceDate: new Date('2026-08-03T12:00:00')
  });
  console.assert(result.eligible === true, 'O cenário deveria ser elegível.');
  console.assert(result.band === 'Faixa 2', 'Faixa esperada: Faixa 2.');
  console.assert(result.subBand === '2C', 'Subfaixa esperada: 2C.');
  console.assert(result.nominalAnnualRate === 6.5, 'Taxa esperada: 6,50%.');
  return result;
}
