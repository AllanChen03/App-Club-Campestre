import { useEffect, useState } from 'react';
import Campo from '../components/Campo';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';
import { fecha, iniciales } from '../utils/formato';

function Dato({ etiqueta, children }) {
  return (
    <div className="dato">
      <dt>{etiqueta}</dt>
      <dd>{children || '—'}</dd>
    </div>
  );
}

export default function Perfil() {
  const [perfil, setPerfil] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [form, setForm] = useState({ telefono: '', direccion: '' });
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    authApi
      .perfil()
      .then(({ usuario }) => {
        setPerfil(usuario);
        setForm({ telefono: usuario.telefono ?? '', direccion: usuario.direccion ?? '' });
      })
      .catch((err) => setErrorCarga(err.message));
  }, []);

  if (errorCarga) return <Alerta>{errorCarga}</Alerta>;
  if (!perfil) return <p className="cargando">Cargando perfil…</p>;

  const sinCambios =
    form.telefono.trim() === (perfil.telefono ?? '') &&
    form.direccion.trim() === (perfil.direccion ?? '');

  function cambiar(campo) {
    return (e) => {
      setForm((f) => ({ ...f, [campo]: e.target.value }));
      setErrores((er) => ({ ...er, [campo]: undefined }));
      setAviso(null);
    };
  }

  async function guardar(e) {
    e.preventDefault();
    const encontrados = {};
    if (!/^\d{8}$/.test(form.telefono.trim())) encontrados.telefono = 'El teléfono debe tener 8 dígitos';
    if (!form.direccion.trim()) encontrados.direccion = 'Ingrese su dirección';
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;

    // Solo se envían los campos que cambiaron
    const cambios = {};
    if (form.telefono.trim() !== perfil.telefono) cambios.telefono = form.telefono.trim();
    if (form.direccion.trim() !== perfil.direccion) cambios.direccion = form.direccion.trim();

    setGuardando(true);
    try {
      const { usuario, mensaje } = await authApi.actualizarPerfil(cambios);
      setPerfil((p) => ({ ...p, ...usuario }));
      setForm({ telefono: usuario.telefono, direccion: usuario.direccion });
      setAviso({ tipo: 'exito', mensaje });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setGuardando(false);
    }
  }

  const socio = perfil.socio;
  const membresia = socio?.membresia;

  return (
    <div className="perfil">
      <header className="perfil__encabezado">
        <span className="perfil__avatar">{iniciales(perfil.nombre_completo)}</span>
        <div>
          <h1 className="inicio__saludo">{perfil.nombre_completo}</h1>
          <p className="perfil__sub">
            {perfil.roles?.nombre} · <span className="insignia insignia--activo">{perfil.estado || 'Activo'}</span>
          </p>
        </div>
      </header>

      <div className="perfil__rejilla">
        <section className="caja">
          <h2 className="caja__titulo">Datos personales</h2>
          <dl className="datos">
            <Dato etiqueta="Nombre completo">{perfil.nombre_completo}</Dato>
            <Dato etiqueta="Cédula">{perfil.cedula}</Dato>
            <Dato etiqueta="Correo electrónico">{perfil.correo}</Dato>
            <Dato etiqueta="Fecha de nacimiento">{fecha(perfil.fecha_nacimiento)}</Dato>
            <Dato etiqueta="Cuenta creada">{fecha(perfil.fecha_creacion)}</Dato>
          </dl>
          <p className="caja__nota">
            Para corregir estos datos, comuníquese con la administración del club.
          </p>
        </section>

        <form className="caja" onSubmit={guardar} noValidate>
          <h2 className="caja__titulo">Datos de contacto</h2>
          {aviso && <Alerta tipo={aviso.tipo}>{aviso.mensaje}</Alerta>}
          <Campo
            etiqueta="Teléfono"
            tipo="tel"
            inputMode="numeric"
            maxLength={8}
            value={form.telefono}
            onChange={cambiar('telefono')}
            error={errores.telefono}
          />
          <Campo
            etiqueta="Dirección"
            value={form.direccion}
            onChange={cambiar('direccion')}
            error={errores.direccion}
            maxLength={255}
          />
          <button type="submit" className="boton boton--oscuro" disabled={guardando || sinCambios}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </form>

        {socio && (
          <section className="caja">
            <h2 className="caja__titulo">Membresía</h2>
            <dl className="datos">
              <Dato etiqueta="Número de socio">{socio.numero_socio}</Dato>
              <Dato etiqueta="Socio desde">{fecha(socio.fecha_afiliacion)}</Dato>
              <Dato etiqueta="Tipo">{membresia?.tipo}</Dato>
              <Dato etiqueta="Vence">{fecha(membresia?.fecha_vencimiento)}</Dato>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}