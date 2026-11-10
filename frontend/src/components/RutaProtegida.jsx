import { Navigate, Outlet } from 'react-router-dom';
import { rutaInicio, useAuth } from '../context/AuthContext';

// Exige sesión y, si se indican roles, que el usuario tenga uno de ellos.
// Si el rol no corresponde, lo envía a su propia pantalla de inicio.
export default function RutaProtegida({ roles }) {
  const { autenticado, usuario } = useAuth();

  if (!autenticado) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario?.rol)) return <Navigate to={rutaInicio(usuario)} replace />;

  return <Outlet />;
}
