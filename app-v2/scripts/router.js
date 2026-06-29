const ROUTES = ['dashboard', 'mercados', 'watchlist', 'activos', 'movimientos', 'ajustes'];
const listeners = new Set();

export function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(hash) ? hash : 'dashboard';
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function apply() {
  const route = currentRoute();
  document.querySelectorAll('.view').forEach(el => {
    el.hidden = el.dataset.view !== route;
  });
  document.querySelectorAll('.nav-item, .bnav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });
  for (const fn of listeners) fn(route);
}

export function initRouter() {
  window.addEventListener('hashchange', apply);
  if (!location.hash) location.hash = '#/dashboard';
  queueMicrotask(apply);
}
