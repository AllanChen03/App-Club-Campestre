const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const CLAVE_SESION = 'cva_sesion';

// Error con el código HTTP y los datos que devuelve el backend
export class ApiError extends Error {
  constructor(mensaje, status, datos = {}) {
    super(mensaje);
    this.status = status;
    this.datos = datos;
  }
}

//----------------------Sesión guardada----------------------
export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

export function escribirSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    // Almacenamiento no disponible: la sesión dura solo en memoria
  }
  window.dispatchEvent(new CustomEvent('cva:sesion', { detail: sesion }));
}

//----------------------Peticiones--------------------------
async function enviar(ruta, { method, body, token }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${BASE_URL}${ruta}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Intente de nuevo.', 0);
  }
}

// Evita pedir varios tokens nuevos a la vez
let refrescoEnCurso = null;

async function renovarToken() {
  const sesion = leerSesion();
  if (!sesion?.refresh_token) return null;

  refrescoEnCurso ??= enviar('/api/auth/refrescar', {
    method: 'POST',
    body: { refresh_token: sesion.refresh_token }
  })
    .then(async (r) => {
      if (!r.ok) return null;
      const tokens = await r.json();
      const nueva = { ...leerSesion(), ...tokens };
      escribirSesion(nueva);
      return nueva.access_token;
    })
    .finally(() => { refrescoEnCurso = null; });

  return refrescoEnCurso;
}

export async function solicitud(ruta, { method = 'GET', body, auth = false } = {}) {
  let respuesta = await enviar(ruta, {
    method,
    body,
    token: auth ? leerSesion()?.access_token : null
  });

  // Token vencido: se renueva una vez y se reintenta
  if (auth && respuesta.status === 401) {
    const token = await renovarToken();

    if (!token) {
      escribirSesion(null);
      throw new ApiError('Su sesión expiró. Inicie sesión de nuevo.', 401);
    }

    respuesta = await enviar(ruta, { method, body, token });
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    // La cuenta dejó de estar activa mientras tenía la sesión abierta
    if (auth && respuesta.status === 403 && datos.mensaje === 'Tu cuenta no está activa') {
      escribirSesion(null);
    }
    throw new ApiError(datos.mensaje || 'Ocurrió un error inesperado', respuesta.status, datos);
  }

  return datos;
}
