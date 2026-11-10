import { solicitud } from './cliente';

const opciones = (method, body) => ({ method, body, auth: true });

export const usuariosApi = {
  listar: () => solicitud('/api/usuarios', { auth: true }),
  obtener: (id) => solicitud(`/api/usuarios/${id}`, { auth: true }),
  actualizar: (id, cambios) => solicitud(`/api/usuarios/${id}`, opciones('PATCH', cambios)),
  suspender: (id) => solicitud(`/api/usuarios/${id}/suspender`, opciones('PATCH')),
  activar: (id) => solicitud(`/api/usuarios/${id}/activar`, opciones('PATCH')),
  desactivar: (id) => solicitud(`/api/usuarios/${id}/desactivar`, opciones('PATCH')),
  restablecerContrasena: (id) =>
    solicitud(`/api/usuarios/${id}/restablecer-contrasena`, opciones('POST')),
  roles: () => solicitud('/api/usuarios/roles', { auth: true }),
  crearAdministrador: (datos) =>
    solicitud('/api/usuarios/administradores', opciones('POST', datos))
};
