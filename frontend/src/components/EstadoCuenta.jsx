// Etiqueta de color para el estado de una cuenta o membresía
const CLASES = {
  Activo: 'activo',
  Activa: 'activo',
  Suspendido: 'suspendido',
  Pendiente: 'suspendido',
  Inactivo: 'inactivo',
  Vencida: 'inactivo'
};

export default function EstadoCuenta({ estado }) {
  return <span className={`insignia insignia--${CLASES[estado] ?? 'inactivo'}`}>{estado ?? '—'}</span>;
}
