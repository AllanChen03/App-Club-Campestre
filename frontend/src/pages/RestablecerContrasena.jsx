import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Campo from '../components/Campo';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';

// Supabase vuelve con los datos en el hash:
// #access_token=...&type=recovery   o   #error=...&error_description=...
function leerEnlace() {
  const datos = new URLSearchParams(window.location.hash.slice(1));
  return {
    token: datos.get('access_token'),
    tipo: datos.get('type'),
    error: datos.get('error_description')
  };
}

export default function RestablecerContrasena() {
  const navigate = useNavigate();
  const [enlace] = useState(leerEnlace);

  // Se quita el token de la barra de direcciones una vez leído
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const [contrasena, setContrasena] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [cargando, setCargando] = useState(false);

  const enlaceValido = enlace.token && enlace.tipo === 'recovery';

  async function enviar(e) {
    e.preventDefault();
    const encontrados = {};
    if (contrasena.length < 8 || !/[A-Z]/.test(contrasena) || !/\d/.test(contrasena)) {
      encontrados.contrasena = 'Mínimo 8 caracteres, una mayúscula y un número';
    }
    if (confirmar !== contrasena || !confirmar) encontrados.confirmar = 'Las contraseñas no coinciden';
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    setCargando(true);
    setErrorGeneral('');
    try {
      await authApi.restablecerContrasena(enlace.token, contrasena);
      navigate('/login', {
        replace: true,
        state: { mensaje: 'Su contraseña se actualizó. Ya puede iniciar sesión.' }
      });
    } catch (err) {
      setErrorGeneral(err.message);
    } finally {
      setCargando(false);
    }
  }

  if (!enlaceValido) {
    return (
      <AuthLayout>
        <div className="tarjeta">
          <h2 className="tarjeta__titulo">Enlace no válido</h2>
          <p className="tarjeta__subtitulo">
            {enlace.error
              ? 'El enlace para recuperar la contraseña expiró o ya fue usado.'
              : 'Abra esta página desde el enlace que le enviamos por correo.'}
          </p>
          <Link to="/recuperar-contrasena" className="boton boton--primario">Solicitar un enlace nuevo</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <h2 className="tarjeta__titulo">Cree una nueva contraseña</h2>
        <p className="tarjeta__subtitulo tarjeta__subtitulo--compacto">
          Mínimo 8 caracteres, una mayúscula y un número.
        </p>

        {errorGeneral && <Alerta>{errorGeneral}</Alerta>}

        <Campo
          etiqueta="Nueva contraseña"
          tipo="password"
          placeholder="Nueva contraseña"
          autoComplete="new-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          error={errores.contrasena}
        />
        <Campo
          etiqueta="Confirmar contraseña"
          tipo="password"
          placeholder="Repita la contraseña"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          error={errores.confirmar}
        />

        <button type="submit" className="boton boton--primario" disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </AuthLayout>
  );
}
