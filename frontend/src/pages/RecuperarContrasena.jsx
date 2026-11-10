import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import Campo from '../components/Campo';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';

export default function RecuperarContrasena() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setError('Ingrese un correo válido');
      return;
    }
    setError('');
    setCargando(true);
    try {
      const datos = await authApi.recuperarContrasena(correo.trim());
      setEnviado(datos.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <AuthLayout>
      <form className="tarjeta" onSubmit={enviar} noValidate>
        <h2 className="tarjeta__titulo">Recuperar contraseña</h2>
        <p className="tarjeta__subtitulo tarjeta__subtitulo--compacto">
          Escriba el correo de su cuenta y le enviaremos un enlace para crear una nueva contraseña.
        </p>

        {enviado ? (
          <Alerta tipo="exito" titulo="Revise su correo">{enviado}</Alerta>
        ) : (
          <>
            <Campo
              etiqueta="Correo electrónico"
              tipo="email"
              placeholder="nombre@correo.com"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              error={error}
            />
            <button type="submit" className="boton boton--primario" disabled={cargando}>
              {cargando ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </>
        )}

        <p className="tarjeta__pie">
          <Link to="/login" className="enlace enlace--subrayado">Volver a iniciar sesión</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
