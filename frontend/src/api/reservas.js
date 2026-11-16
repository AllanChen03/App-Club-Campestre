import { descargarArchivo, solicitud } from './cliente';

const con = (method, body) => ({ method, body, auth: true });
const consulta = (params) => {
  const limpio = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const texto = new URLSearchParams(limpio).toString();
  return texto ? `?${texto}` : '';
};

export const instalacionesApi = {
  listar: () => solicitud('/api/instalaciones', { auth: true }),
  crear: (datos) => solicitud('/api/instalaciones', con('POST', datos)),
  actualizar: (id, datos) => solicitud(`/api/instalaciones/${id}`, con('PATCH', datos)),
  crearServicio: (id, datos) => solicitud(`/api/instalaciones/${id}/servicios`, con('POST', datos)),
  actualizarServicio: (id, datos) => solicitud(`/api/instalaciones/servicios/${id}`, con('PATCH', datos)),
  disponibilidad: (id, fecha, excluir) =>
    solicitud(`/api/instalaciones/${id}/disponibilidad${consulta({ fecha, excluir })}`, { auth: true }),
  bloqueos: (params = {}) => solicitud(`/api/instalaciones/bloqueos${consulta(params)}`, { auth: true }),
  crearBloqueo: (datos) => solicitud('/api/instalaciones/bloqueos', con('POST', datos)),
  eliminarBloqueo: (id) => solicitud(`/api/instalaciones/bloqueos/${id}`, con('DELETE')),
  ocupacion: (fecha) => solicitud(`/api/instalaciones/ocupacion${consulta({ fecha })}`, { auth: true }),
  reporte: (desde, hasta) => solicitud(`/api/instalaciones/reportes${consulta({ desde, hasta })}`, { auth: true })
};

export const reservasApi = {
  // Socio
  mias: () => solicitud('/api/reservas/mias', { auth: true }),
  mia: (id) => solicitud(`/api/reservas/mias/${id}`, { auth: true }),
  crear: (datos) => solicitud('/api/reservas/mias', con('POST', datos)),
  modificarMia: (id, datos) => solicitud(`/api/reservas/mias/${id}`, con('PATCH', datos)),
  cancelarMia: (id) => solicitud(`/api/reservas/mias/${id}/cancelar`, con('POST')),

  // Administración
  listar: (params) => solicitud(`/api/reservas${consulta(params)}`, { auth: true }),
  detalle: (id) => solicitud(`/api/reservas/${id}`, { auth: true }),
  modificar: (id, datos) => solicitud(`/api/reservas/${id}`, con('PATCH', datos)),
  confirmar: (id) => solicitud(`/api/reservas/${id}/confirmar`, con('POST')),
  cancelar: (id, motivo) => solicitud(`/api/reservas/${id}/cancelar`, con('POST', { motivo }))
};

export const invitadosApi = {
  mios: () => solicitud('/api/invitados', { auth: true }),
  cupo: (fecha) => solicitud(`/api/invitados/cupo${consulta({ fecha })}`, { auth: true }),
  registrar: (datos) => solicitud('/api/invitados/visitas', con('POST', datos)),
  cancelarVisita: (id) => solicitud(`/api/invitados/visitas/${id}/cancelar`, con('POST')),
  delDia: (fecha) => solicitud(`/api/invitados/dia${consulta({ fecha })}`, { auth: true })
};

// Descarga el PDF del reporte de uso como archivo
export function descargarReporte(desde, hasta) {
  return descargarArchivo(
    `/api/instalaciones/reportes/pdf${consulta({ desde, hasta })}`,
    `reporte-instalaciones-${desde}-a-${hasta}.pdf`
  );
}
