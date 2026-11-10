import { Navigate } from 'react-router-dom';
import { rutaInicio, useAuth } from '../context/AuthContext';

export default function InicioSegunRol() {
  const { autenticado, usuario } = useAuth();
  return <Navigate to={autenticado ? rutaInicio(usuario) : '/login'} replace />;
}
