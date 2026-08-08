import { APP_VERSION, STORAGE_KEYS } from './constants.js';
import { storageService } from './storage/storage-service.js';
import { loadDefaultRules } from './rules/rules-loader.js';
import { rulesRepository } from './rules/rules-repository.js';

export async function bootstrap() {
  let ruleSet;
  try {
    ruleSet = await loadDefaultRules();
    rulesRepository.setRuleSet(ruleSet);

    const settings = ruleSet.files['app-settings'];
    if (!storageService.get(STORAGE_KEYS.settings)) storageService.set(STORAGE_KEYS.settings, settings);
    storageService.set(STORAGE_KEYS.rulesVersion, ruleSet.index.rulesVersion);
    storageService.set(STORAGE_KEYS.rulesStatus, rulesRepository.getStatus());
  } catch (error) {
    ruleSet = {
      index: { rulesVersion: 'indisponível' },
      validation: { valid: false, errors: [error.message], warnings: [], loadedCount: 0, expectedCount: 0 }
    };
    storageService.set(STORAGE_KEYS.rulesStatus, {
      ready: false,
      version: null,
      loadedCount: 0,
      expectedCount: 0,
      errors: [error.message],
      warnings: []
    });
  }

  document.querySelector('#app-version').textContent = APP_VERSION;
  document.querySelector('#rules-version').textContent = ruleSet.index.rulesVersion;
  return ruleSet;
}
