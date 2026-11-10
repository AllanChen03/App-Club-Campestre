import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { escribirSesion, leerSesion } from '../api/cliente';
import { ROLES_ADMIN } from '../utils/roles';

const AuthContext = createContext(null);

// Pantalla principal según el rol del usuario
export function rutaInicio(usuario) {
  return ROLES_ADMIN.includes(usuario?.rol) ? '/admin' : '/inicio';
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);

  // Se actualiza cuando el cliente renueva el token o la sesión expira
  useEffect(() => {
    const escuchar = (e) => setSesion(e.detail);
    window.addEventListener('cva:sesion', escuchar);
    return () => window.removeEventListener('cva:sesion', escuchar);
  }, []);

  // Guarda la sesión que devuelve POST /api/auth/login
  const guardarSesion = useCallback((datos) => {
    escribirSesion({
      usuario: datos.usuario,
      access_token: datos.access_token,
      refresh_token: datos.refresh_token
    });
  }, []);

  // Actualiza los datos visibles del usuario (por ejemplo, tras editar el perfil)
  const actualizarUsuario = useCallback((cambios) => {
    const actual = leerSesion();
    if (actual) escribirSesion({ ...actual, usuario: { ...actual.usuario, ...cambios } });
  }, []);

  const cerrarSesion = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Aunque falle en el servidor, se limpia la sesión local
    }
    escribirSesion(null);
  }, []);

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      autenticado: Boolean(sesion?.access_token),
      guardarSesion,
      actualizarUsuario,
      cerrarSesion
    }),
    [sesion, guardarSesion, actualizarUsuario, cerrarSesion]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
