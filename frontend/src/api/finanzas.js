import { descargarArchivo, solicitud } from './cliente';

// Descargar el PDF del estado de cuenta (la ruta exige sesión).
// Sin periodo es el actual; con periodo ('2026-10') es un mes anterior.
export const descargarPdfEstadoCuentaAPI = (idSocio, periodo) =>
  descargarArchivo(
    `/api/finanzas/estado-cuenta/${idSocio}/pdf${periodo ? `?periodo=${periodo}` : ''}`,
    `estado-de-cuenta${periodo ? `-${periodo}` : ''}.pdf`
  );

// Consultar el estado de cuenta de un socio (requiere autenticación)
export const obtenerEstadoCuentaAPI = async (idSocio) => {
  return await solicitud(`/api/finanzas/estado-cuenta/${idSocio}`, { 
    method: 'GET', 
    auth: true 
  });
};

// Registrar un pago manual (requiere autenticación de admin)
export const registrarPagoAPI = async (datosPago) => {
  return await solicitud('/api/finanzas/pagos', {
    method: 'POST',
    body: datosPago,
    auth: true
  });
};

// Obtener la lista de socios morosos (requiere autenticación)
export const obtenerMorososAPI = async () => {
  return await solicitud('/api/finanzas/morosos', { 
    method: 'GET', 
    auth: true 
  });
};
export const obtenerResumenFinancieroAPI = async () => {
  return await solicitud('/api/finanzas/resumen', { 
    method: 'GET', 
    auth: true 
  });
};