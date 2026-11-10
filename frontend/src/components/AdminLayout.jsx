import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { SECCIONES_ADMIN, nombreRol } from '../utils/roles';

export default function AdminLayout() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  // Solo las secciones permitidas para el rol del usuario
  const enlaces = SECCIONES_ADMIN.filter((s) => s.roles.includes(usuario?.rol));

  async function salir() {
    await cerrarSesion();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin">
      <aside className="lateral">
        <NavLink to="/admin" className="lateral__logo" aria-label="Panel">
          <Logo />
        </NavLink>

        <nav className="lateral__nav">
          {enlaces.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta ? `/admin/${s.ruta}` : '/admin'}
              end={!s.ruta}
              className="lateral__enlace"
            >
              {s.texto}
            </NavLink>
          ))}
        </nav>

        <div className="lateral__usuario">
          <NavLink to="/admin/perfil" className="lateral__nombre">{usuario?.nombre_completo}</NavLink>
          <p className="lateral__rol">{nombreRol(usuario?.rol)}</p>
          <button type="button" className="lateral__salir" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin__contenido">
        <Outlet />
      </main>
    </div>
  );
}
