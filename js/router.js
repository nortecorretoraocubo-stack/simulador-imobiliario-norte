const routes = new Map();
export function registerRoute(name, renderer) { routes.set(name, renderer); }
export function getCurrentRoute() { return location.hash.replace('#/', '') || 'inicio'; }
export function navigate(route) { location.hash = `#/${route}`; }
export function startRouter(target) {
  const render = () => {
    const route = getCurrentRoute();
    const renderer = routes.get(route) || routes.get('inicio');
    target.innerHTML = renderer();
    document.querySelectorAll('[data-route]').forEach((link) => link.classList.toggle('active', link.dataset.route === route));
    window.dispatchEvent(new CustomEvent('route:rendered', { detail: route }));
  };
  addEventListener('hashchange', render);
  render();
}
