import { solicitud } from './cliente';

// Usa el cliente compartido: misma dirección que el resto de la app
// (VITE_API_URL o el proxy de Vite) y envía el token de la sesión.
const MENSAJE_GENERICO = 'Ocurrió un error inesperado';

async function llamar(ruta, opciones, mensajeError) {
  try {
    return await solicitud(`/api/notificaciones${ruta}`, { auth: true, ...opciones });
  } catch (error) {
    // Conserva el mensaje del servidor si lo hay; si no, uno que diga qué falló
    throw new Error(error.message && error.message !== MENSAJE_GENERICO ? error.message : mensajeError);
  }
}

export const notificacionesApi = {
  listarPlantillas: () =>
    llamar('/plantillas', {}, 'Error al cargar las plantillas'),

  actualizarPlantilla: (id, datos) =>
    llamar(`/plantillas/${id}`, { method: 'PUT', body: datos }, 'Error al actualizar la plantilla'),

  listarHistorial: () =>
    llamar('/historial', {}, 'Error al cargar el historial'),

  // Lista de socios para el desplegable
  listarUsuarios: () =>
    llamar('/usuarios', {}, 'Error al cargar los usuarios'),

  enviar: (datos) =>
    llamar('/enviar', { method: 'POST', body: datos }, 'Error al enviar la notificación')
};
