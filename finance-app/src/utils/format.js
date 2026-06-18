const arsFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export const formatARS = (n) => arsFormatter.format(n);
export const formatPct = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
export const formatDate = (d) => new Date(d).toLocaleDateString('es-AR');
