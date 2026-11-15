import { solicitud } from './cliente';

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