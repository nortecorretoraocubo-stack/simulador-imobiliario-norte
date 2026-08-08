const REQUIRED_TOP_LEVEL = {
  'app-settings': ['appVersion', 'rulesVersion', 'incomeCommitment', 'term'],
  'income-bands': ['version', 'rules', 'outsideProgram'],
  'interest-rates': ['version', 'rateType', 'rules'],
  municipalities: ['version', 'municipalities'],
  'property-limits': ['version', 'rules', 'doubleEligibility'],
  'financing-quotas': ['version', 'defaultQuota', 'rules'],
  subsidies: ['version', 'automaticEnabled', 'rules'],
  terms: ['version', 'absoluteMaximumMonths', 'maximumAgeAtEnd'],
  'construction-flow': ['version', 'limits', 'distributionOrder'],
  'legal-notices': ['version', 'notices'],
  'sbpe-rules': ['version', 'program', 'sfh', 'sfi'],
  'acquisition-costs': ['version', 'estimate', 'components', 'display']
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateRuleCollection(id, data, errors) {
  if ('rules' in data && !Array.isArray(data.rules)) {
    errors.push(`${id}: o campo "rules" deve ser uma lista.`);
  }

  if (Array.isArray(data.rules)) {
    const ids = new Set();
    data.rules.forEach((rule, index) => {
      if (!isPlainObject(rule)) {
        errors.push(`${id}: regra ${index + 1} inválida.`);
        return;
      }
      if (rule.id) {
        if (ids.has(rule.id)) errors.push(`${id}: identificador duplicado "${rule.id}".`);
        ids.add(rule.id);
      }
    });
  }
}

export function validateRulesIndex(index) {
  const errors = [];
  if (!isPlainObject(index)) return { valid: false, errors: ['Índice de regras inválido.'] };
  if (!index.rulesVersion) errors.push('Índice sem rulesVersion.');
  if (!Array.isArray(index.files) || index.files.length === 0) errors.push('Índice sem arquivos cadastrados.');

  const ids = new Set();
  for (const file of index.files || []) {
    if (!file.id || !file.path) errors.push('Entrada do índice sem id ou path.');
    if (ids.has(file.id)) errors.push(`Arquivo duplicado no índice: ${file.id}.`);
    ids.add(file.id);
  }

  return { valid: errors.length === 0, errors };
}

export function validateRuleFile(id, data) {
  const errors = [];
  if (!isPlainObject(data)) return { valid: false, errors: [`${id}: conteúdo JSON inválido.`] };

  for (const field of REQUIRED_TOP_LEVEL[id] || []) {
    if (!(field in data)) errors.push(`${id}: campo obrigatório ausente: ${field}.`);
  }

  validateRuleCollection(id, data, errors);
  return { valid: errors.length === 0, errors };
}

export function validateRuleSet(index, files) {
  const errors = [];
  const warnings = [];
  const indexResult = validateRulesIndex(index);
  errors.push(...indexResult.errors);

  for (const definition of index.files || []) {
    const data = files[definition.id];
    if (!data) {
      const message = `Arquivo de regras não carregado: ${definition.id}.`;
      (definition.required ? errors : warnings).push(message);
      continue;
    }
    const result = validateRuleFile(definition.id, data);
    errors.push(...result.errors);
  }

  const versions = new Set(
    Object.values(files)
      .map((file) => file?.version || file?.rulesVersion)
      .filter(Boolean)
  );
  if (versions.size > 1) warnings.push('A base contém arquivos com versões diferentes.');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    loadedCount: Object.keys(files).length,
    expectedCount: index.files?.length || 0
  };
}
