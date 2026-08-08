const CACHE_VERSION = 'norte-fluxo-datas-v1.13.2';

const APP_SHELL = [
  './', './index.html', './manifest.json',
  './css/main.css', './css/variables.css', './css/reset.css', './css/layout.css',
  './css/components.css', './css/forms.css', './css/cards.css', './css/alerts.css',
  './css/responsive.css', './css/print.css', './css/themes/norte.css',
  './js/app.js', './js/bootstrap.js', './js/router.js', './js/state.js', './js/constants.js',
  './js/core/event-bus.js', './js/core/formatters.js', './js/core/installment-dates.js',
  './js/rules/rules-loader.js', './js/rules/rules-validator.js', './js/rules/rules-repository.js',
  './js/rules/income-rule-engine.js', './js/rules/property-limit-engine.js',
  './js/rules/rate-rule-engine.js', './js/rules/quota-rule-engine.js',
  './js/rules/term-rule-engine.js', './js/rules/eligibility-engine.js', './js/rules/sbpe-engine.js',
  './js/finance/rate-converter.js', './js/finance/income-limit-calculator.js',
  './js/finance/financing-calculator.js', './js/finance/subsidy-calculator.js', './js/finance/projection-calculator.js', './js/finance/acquisition-costs-calculator.js', './js/finance/purchase-reconciliation.js', './js/construction/construction-flow-engine.js',
  './js/storage/storage-service.js', './js/ui/install-prompt.js', './js/ui/progress-stepper.js',
  './js/pages/home-page.js', './js/pages/buyer-page.js', './js/pages/property-page.js',
  './js/pages/eligibility-page.js', './js/pages/construction-flow-page.js', './js/pages/summary-page.js',
  './js/reports/report-service.js',
  './data/defaults/app-settings.json', './data/defaults/rules-index.json',
  './data/defaults/income-bands.json', './data/defaults/interest-rates.json',
  './data/defaults/municipalities.json', './data/defaults/property-limits.json',
  './data/defaults/financing-quotas.json', './data/defaults/subsidies.json',
  './data/defaults/terms.json', './data/defaults/construction-flow.json',
  './data/defaults/legal-notices.json', './data/defaults/sbpe-rules.json', './data/defaults/acquisition-costs.json', './data/defaults/projection-settings.json',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (request.mode === 'navigate' ? await caches.match('./index.html') : null) ||
      new Response('Conteúdo indisponível offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Durante o desenvolvimento e nas atualizações, HTML, JS, CSS e JSON priorizam a versão da pasta atual.
  if (event.request.mode === 'navigate' || /\.(?:html|js|css|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
