import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Campo from '../components/Campo';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';
import { rutaInicio, useAuth } from '../context/AuthContext';

function minutosHasta(fechaIso) {
  return Math.max(1, Math.ceil((new Date(fechaIso) - Date.now()) / 60000));
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { autenticado, usuario, guardarSesion } = useAuth();

  const [correo, setCorreo] = useState(location.state?.correo ?? '');
  const [contrasena, setContrasena] = useState('');
  const [cargando, setCargando] = useState(false);
  // aviso: { tipo: 'error' | 'bloqueo' | 'suspendida' | 'inactiva' | 'exito', mensaje }
  const [aviso, setAviso] = useState(
    location.state?.mensaje ? { tipo: 'exito', mensaje: location.state.mensaje } : null
  );
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null);
  const [, setReloj] = useState(0);

  const bloqueado = bloqueadoHasta && new Date(bloqueadoHasta) > Date.now();

  // Refresca el contador y desbloquea el formulario cuando termina el bloqueo
  useEffect(() => {
    if (!bloqueadoHasta) return;
    const t = setInterval(() => {
      if (new Date(bloqueadoHasta) <= Date.now()) {
        setBloqueadoHasta(null);
        setAviso(null);
      } else {
        setReloj((n) => n + 1);
      }
    }, 10000);
    return () => clearInterval(t);
  }, [bloqueadoHasta]);

  if (autenticado) return <Navigate to={rutaInicio(usuario)} replace />;

  async function enviar(e) {
    e.preventDefault();
    if (bloqueado) return;

    if (!correo.trim() || !contrasena) {
      setAviso({ tipo: 'error', mensaje: 'Ingrese su correo y su contraseña.' });
      return;
    }

    setCargando(true);
    setAviso(null);

    try {
      const datos = await authApi.login(correo.trim(), contrasena);
      guardarSesion(datos);
      navigate(rutaInicio(datos.usuario), { replace: true });
    } catch (err) {
      if (err.status === 429) {
        setBloqueadoHasta(err.datos.bloqueado_hasta);
        setAviso({ tipo: 'bloqueo' });
      } else if (err.status === 403 && err.datos.estado === 'Suspendido') {
        setAviso({ tipo: 'suspendida', mensaje: err.message });
      } else if (err.status === 403) {
        setAviso({ tipo: 'inactiva', mensaje: err.message });
      } else {
        setAviso({ tipo: 'error', mensaje: err.message });
      }
      setContrasena('');
    } finally {
      setCargando(false);
    }
  }

  const minutos = bloqueado ? minutosHasta(bloqueadoHasta) : 0;

  return (
    <AuthLayout>
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <h2 className="tarjeta__titulo">Bienvenido de vuelta</h2>
        <p className="tarjeta__subtitulo">Ingrese con su correo y su contraseña.</p>

        {aviso?.tipo === 'exito' && <Alerta tipo="exito">{aviso.mensaje}</Alerta>}
        {aviso?.tipo === 'error' && <Alerta>{aviso.mensaje}</Alerta>}
        {bloqueado && (
          <Alerta titulo="Acceso bloqueado temporalmente">
            Hubo demasiados intentos fallidos. Intente de nuevo en {minutos}{' '}
            {minutos === 1 ? 'minuto' : 'minutos'} o recupere su contraseña.
          </Alerta>
        )}
        {aviso?.tipo === 'suspendida' && (
          <Alerta tipo="aviso" titulo="Su cuenta está suspendida">
            Comuníquese con la administración del club para reactivarla.
          </Alerta>
        )}
        {aviso?.tipo === 'inactiva' && (
          <Alerta tipo="aviso" titulo="Su cuenta no está activa">{aviso.mensaje}</Alerta>
        )}

        <Campo
          etiqueta="Correo electrónico"
          tipo="email"
          placeholder="nombre@correo.com"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={aviso?.tipo === 'error' ? ' ' : undefined}
          disabled={bloqueado}
        />
        <Campo
          etiqueta="Contraseña"
          tipo="password"
          placeholder="Su contraseña"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={aviso?.tipo === 'error' ? ' ' : undefined}
          disabled={bloqueado}
        />

        <Link to="/recuperar-contrasena" className="enlace enlace--derecha">
          ¿Olvidó su contraseña?
        </Link>

        <button type="submit" className="boton boton--primario" disabled={cargando || bloqueado}>
          {cargando ? 'Ingresando…' : 'Iniciar sesión'}
        </button>

        <p className="tarjeta__pie tarjeta__pie--linea">
          ¿Aún no es socio? <Link to="/registro" className="enlace enlace--subrayado">Crear cuenta</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
