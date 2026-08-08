let currentRuleSet = null;

export const rulesRepository = {
  setRuleSet(ruleSet) {
    currentRuleSet = ruleSet;
  },

  isReady() {
    return Boolean(currentRuleSet?.validation?.valid);
  },

  getStatus() {
    if (!currentRuleSet) {
      return { ready: false, version: null, loadedCount: 0, expectedCount: 0, errors: ['Base ainda não carregada.'], warnings: [] };
    }
    return {
      ready: currentRuleSet.validation.valid,
      version: currentRuleSet.index.rulesVersion,
      loadedAt: currentRuleSet.loadedAt,
      loadedCount: currentRuleSet.validation.loadedCount,
      expectedCount: currentRuleSet.validation.expectedCount,
      errors: [...currentRuleSet.validation.errors],
      warnings: [...currentRuleSet.validation.warnings]
    };
  },

  get(id) {
    if (!currentRuleSet) throw new Error('A base de regras ainda não foi carregada.');
    if (!currentRuleSet.files[id]) throw new Error(`Regra não encontrada: ${id}.`);
    return structuredClone(currentRuleSet.files[id]);
  },

  getAll() {
    if (!currentRuleSet) return null;
    return structuredClone(currentRuleSet);
  }
};
