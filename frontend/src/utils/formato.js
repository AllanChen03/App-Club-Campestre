// "2026-10-25" o ISO -> "25/10/2026"
export function fecha(valor) {
  if (!valor) return '—';
  const [a, m, d] = String(valor).slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : '—';
}

export const colones = (n) => `₡${Number(n ?? 0).toLocaleString('es-CR')}`;

export function iniciales(nombre = '') {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
