// Utilidades de presentación para reservas, instalaciones e invitados

// '16:00:00' -> '4:00 p. m.'
export function hora(valor) {
  if (!valor) return '—';
  const [h, m] = String(valor).split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

// '16:00:00', '18:00:00' -> '4:00 a 6:00 p. m.'
export function rangoHoras(inicio, fin) {
  const a = hora(inicio);
  const b = hora(fin);
  return a.slice(-5) === b.slice(-5) ? `${a.slice(0, -6)} a ${b}` : `${a} a ${b}`;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// '2026-10-15' -> 'Jueves 15/10/2026'
export function fechaConDia(valor) {
  if (!valor) return '—';
  const [a, m, d] = String(valor).slice(0, 10).split('-');
  const dia = new Date(Date.UTC(+a, +m - 1, +d)).getUTCDay();
  return `${DIAS[dia]} ${d}/${m}/${a}`;
}

export const nombreDia = (valor) => fechaConDia(valor).split(' ')[0];

// Fecha de hoy en Costa Rica: 'YYYY-MM-DD'
export function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date());
}

export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Lunes de la semana de una fecha
export function lunesDe(fecha) {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7;
  return sumarDias(fecha, -dia);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (fecha) => MESES[Number(String(fecha).slice(5, 7)) - 1];

// Fecha y hora de un registro (timestamptz) en hora de Costa Rica
export function fechaHora(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-CR', {
    timeZone: 'America/Costa_Rica', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

// '2026-11-20T08:00:00' -> '20/11/2026, 8:00 a. m.'
export function marcaLocal(valor) {
  if (!valor) return '—';
  const [f, t] = String(valor).replace(' ', 'T').split('T');
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a}, ${hora(t)}`;
}

export const codigoReserva = (id) => `R-${String(id).padStart(4, '0')}`;

// Color de cada instalación según su nombre (los del diseño de JustInMind)
export function colorInstalacion(nombre = '') {
  const n = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.includes('golf')) return 'var(--golf)';
  if (n.includes('tenis')) return 'var(--tenis)';
  if (n.includes('piscina')) return 'var(--piscina)';
  if (n.includes('salon')) return 'var(--salon)';
  return 'var(--verde-claro)';
}

// Busca la instalación que corresponde a un "área" de la pantalla de inicio (?area=golf)
export function instalacionDeArea(instalaciones, area) {
  if (!area) return null;
  const clave = area === 'salon' ? 'salon' : area;
  return instalaciones.find((i) =>
    i.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(clave)) ?? null;
}

export const claseEstado = (estado) => `insignia insignia--${String(estado ?? '').toLowerCase()}`;

export const ACTIVAS = ['Pendiente', 'Confirmada'];
export const RELACIONES = ['Familiar', 'Amigo', 'Otro'];

// '109876543' -> '1-0987-6543' (formato de cédula nacional cuando tiene 9 dígitos)
export function formatoCedula(cedula = '') {
  const c = String(cedula);
  return /^\d{9}$/.test(c) ? `${c[0]}-${c.slice(1, 5)}-${c.slice(5)}` : c;
}

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
