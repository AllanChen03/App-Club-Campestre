const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'; 

export const notificacionesApi = {
  async listarPlantillas() {
    const res = await fetch(`${API_URL}/notificaciones/plantillas`);
    if (!res.ok) throw new Error('Error al cargar las plantillas');
    return res.json();
  },

  async actualizarPlantilla(id, datos) {
    const res = await fetch(`${API_URL}/notificaciones/plantillas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!res.ok) throw new Error('Error al actualizar la plantilla');
    return res.json();
  },

  async listarHistorial() {
    const res = await fetch(`${API_URL}/notificaciones/historial`);
    if (!res.ok) throw new Error('Error al cargar el historial');
    return res.json();
  },

  // Agregamos esta función para obtener la lista de socios para el desplegable
  async listarUsuarios() {
    const res = await fetch(`${API_URL}/notificaciones/usuarios`);
    if (!res.ok) throw new Error('Error al cargar los usuarios');
    return res.json();
  },

  async enviar(datos) {
    const res = await fetch(`${API_URL}/notificaciones/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!res.ok) throw new Error('Error al enviar la notificación');
    return res.json();
  }
};