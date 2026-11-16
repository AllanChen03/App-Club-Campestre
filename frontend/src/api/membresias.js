import { solicitud } from './cliente';

const opciones = (method, body) => ({ method, body, auth: true });

export const membresiasApi = {
  // Socio logueado
  mia: () => solicitud('/api/membresias/mia', { auth: true }),
  agregarMiBeneficiario: (datos) => solicitud('/api/membresias/mia/beneficiarios', opciones('POST', datos)),
  eliminarMiBeneficiario: (idBeneficiario) =>
    solicitud(`/api/membresias/mia/beneficiarios/${idBeneficiario}`, opciones('DELETE')),

  // Tipos de membresía (Admin)
  listarTipos: () => solicitud('/api/membresias/tipos', { auth: true }),
  crearTipo: (datos) => solicitud('/api/membresias/tipos', opciones('POST', datos)),
  actualizarTipo: (id, cambios) => solicitud(`/api/membresias/tipos/${id}`, opciones('PATCH', cambios)),

  // Administración de membresías (Admin)
  listarSocios: () => solicitud('/api/membresias', { auth: true }),
  obtenerDetalle: (id) => solicitud(`/api/membresias/${id}`, { auth: true }),
  asignar: (datos) => solicitud('/api/membresias', opciones('POST', datos)),
  actualizar: (id, cambios) => solicitud(`/api/membresias/${id}`, opciones('PATCH', cambios)),
  agregarBeneficiario: (idMembresia, datos) =>
    solicitud(`/api/membresias/${idMembresia}/beneficiarios`, opciones('POST', datos)),
  eliminarBeneficiario: (idMembresia, idBeneficiario) =>
    solicitud(`/api/membresias/${idMembresia}/beneficiarios/${idBeneficiario}`, opciones('DELETE'))
};