import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';
import { iniciales } from '../utils/formato';

const ENLACES = [
  { a: '/inicio', texto: 'Inicio' },
  { a: '/reservas', texto: 'Reservas' },
  { a: '/invitados', texto: 'Invitados' },
  { a: '/membresia', texto: 'Membresía' },
  { a: '/estado-cuenta', texto: 'Estado de cuenta' }
];


export default function AppLayout() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function cerrar(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
    }
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  async function salir() {
    await cerrarSesion();
    navigate('/login', { replace: true });
  }


  return (
    <div className="app">
      <header className="barra">
        <Link to="/inicio" className="barra__logo" aria-label="Inicio">
          <Logo />
        </Link>

        <nav className="barra__nav">
          {ENLACES.map((e) => (
            <NavLink key={e.a} to={e.a} className="barra__enlace">
              {e.texto}
            </NavLink>
          ))}
        </nav>

        <div className="barra__acciones">
          <Link to="/reservas" className="boton boton--lima">+ Reservar</Link>
          <div className="usuario" ref={menuRef}>
            <button
              type="button"
              className="usuario__avatar"
              aria-haspopup="menu"
              aria-expanded={menuAbierto}
              onClick={() => setMenuAbierto((v) => !v)}
            >
              {iniciales(usuario?.nombre_completo)}
            </button>
            {menuAbierto && (
              <div className="usuario__menu" role="menu">
                <p className="usuario__nombre">{usuario?.nombre_completo}</p>
                <p className="usuario__rol">{usuario?.rol}</p>
                <Link to="/perfil" role="menuitem" className="usuario__opcion" onClick={() => setMenuAbierto(false)}>
                  Mi perfil
                </Link>
                <button type="button" role="menuitem" className="usuario__salir" onClick={salir}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app__contenido">
        <Outlet />
      </main>
    </div>
  );
}
