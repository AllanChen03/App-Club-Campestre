import { solicitud } from './cliente';

export const authApi = {
  login: (correo, contrasena) =>
    solicitud('/api/auth/login', { method: 'POST', body: { correo, contrasena } }),

  registro: (datos) =>
    solicitud('/api/auth/registro', { method: 'POST', body: datos }),

  tiposMembresia: () => solicitud('/api/auth/tipos-membresia'),

  recuperarContrasena: (correo) =>
    solicitud('/api/auth/recuperar-contrasena', { method: 'POST', body: { correo } }),

  restablecerContrasena: (access_token, contrasena) =>
    solicitud('/api/auth/restablecer-contrasena', {
      method: 'POST',
      body: { access_token, contrasena }
    }),

  perfil: () => solicitud('/api/auth/perfil', { auth: true }),

  actualizarPerfil: (cambios) =>
    solicitud('/api/auth/perfil', { method: 'PATCH', body: cambios, auth: true }),

  logout: () => solicitud('/api/auth/logout', { method: 'POST', auth: true })
};
