const ROUTES = ['dashboard', 'mercados', 'watchlist', 'activos', 'movimientos', 'ajustes'];
const listeners = new Set();

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

export function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  return ROUTES.includes(hash) ? hash : 'dashboard';
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let prevRoute = null;

function apply() {
  const route = currentRoute();
  document.querySelectorAll('.view').forEach(el => {
    el.hidden = el.dataset.view !== route;
  });
  document.querySelectorAll('.nav-item, .bnav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });
  for (const fn of listeners) fn(route);
  if (route !== prevRoute) {
    prevRoute = route;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', apply);
  if (!location.hash) location.hash = '#/dashboard';
  queueMicrotask(apply);
}
