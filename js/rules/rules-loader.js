import { validateRuleSet, validateRulesIndex } from './rules-validator.js';

const INDEX_PATH = './data/defaults/rules-index.json';

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Não foi possível carregar ${path} (${response.status}).`);
  try {
    return await response.json();
  } catch {
    throw new Error(`O arquivo ${path} não contém JSON válido.`);
  }
}

export async function loadDefaultRules() {
  const index = await fetchJson(INDEX_PATH);
  const indexValidation = validateRulesIndex(index);
  if (!indexValidation.valid) throw new Error(indexValidation.errors.join(' '));

  const entries = await Promise.all(
    index.files.map(async (definition) => {
      try {
        return [definition.id, await fetchJson(definition.path), null];
      } catch (error) {
        return [definition.id, null, error];
      }
    })
  );

  const files = {};
  const loadingErrors = [];
  for (const [id, data, error] of entries) {
    if (data) files[id] = data;
    if (error) loadingErrors.push(error.message);
  }

  const validation = validateRuleSet(index, files);
  validation.errors.unshift(...loadingErrors);
  validation.valid = validation.errors.length === 0;

  return {
    index,
    files,
    validation,
    loadedAt: new Date().toISOString(),
    source: 'default-json'
  };
}
