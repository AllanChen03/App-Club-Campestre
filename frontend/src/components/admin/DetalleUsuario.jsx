import { useEffect, useState } from 'react';
import Modal from '../Modal';
import Campo from '../Campo';
import Alerta from '../Alerta';
import { usuariosApi } from '../../api/usuarios';
import { useAuth } from '../../context/AuthContext';
import { fecha } from '../../utils/formato';
import { ROL_GENERAL, ROL_SOCIO, nombreRol } from '../../utils/roles';

const CAMPOS = ['nombre_completo', 'cedula', 'telefono', 'fecha_nacimiento', 'direccion'];

// Estados de la cuenta: a qué acción del backend corresponde cada uno y qué implica
const ESTADOS = {
  Activo: {
    accion: 'activar',
    clase: 'boton--oscuro',
    pregunta: 'Podrá iniciar sesión. Un socio necesita una membresía vigente y no tener cobros pendientes.'
  },
  Suspendido: {
    accion: 'suspender',
    clase: 'boton--aviso',
    pregunta: 'No podrá iniciar sesión ni usar el club hasta que se active de nuevo. Se cancelarán sus reservas e invitados que aún no han llegado.',
    soloSocios: true
  },
  Inactivo: {
    accion: 'desactivar',
    clase: 'boton--peligro',
    pregunta: 'La cuenta quedará dada de baja y no podrá iniciar sesión. Si es socio, se cancelarán sus reservas e invitados que aún no han llegado.'
  }
};

const RESTABLECER = {
  texto: 'Enviar correo para restablecer contraseña',
  pregunta: 'Se enviará un enlace a su correo para que cree una nueva contraseña.'
};

function formulario(u) {
  return Object.fromEntries(CAMPOS.map((c) => [c, String(u[c] ?? '').slice(0, c === 'fecha_nacimiento' ? 10 : undefined)]));
}

function validar(f) {
  const e = {};
  if (!f.nombre_completo.trim()) e.nombre_completo = 'Requerido';
  if (!f.cedula.trim()) e.cedula = 'Requerido';
  if (!/^\d{8}$/.test(f.telefono.trim())) e.telefono = 'Debe tener 8 dígitos';
  if (!f.fecha_nacimiento) e.fecha_nacimiento = 'Requerida';
  if (!f.direccion.trim()) e.direccion = 'Requerida';
  return e;
}

export default function DetalleUsuario({ id, onCerrar, onCambio, onEliminado }) {
  const { usuario: sesion } = useAuth();
  const [usuario, setUsuario] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // estado destino o 'restablecer'
  const [borrando, setBorrando] = useState(false);
  const [confirmacionNombre, setConfirmacionNombre] = useState('');
  const [historial, setHistorial] = useState(null); // lo que el socio tiene registrado

  useEffect(() => {
    setUsuario(null);
    setError('');
    usuariosApi
      .obtener(id)
      .then(({ usuario: u }) => {
        setUsuario(u);
        setForm(formulario(u));
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const propia = id === sesion?.id_usuario;
  // Solo el administrador general modifica cuentas; los encargados consultan
  const esGeneral = sesion?.rol === ROL_GENERAL;
  const original = usuario && formulario(usuario);
  const cambios = form && original
    ? Object.fromEntries(CAMPOS.filter((c) => form[c].trim() !== original[c]).map((c) => [c, form[c].trim()]))
    : {};

  async function guardar(e) {
    e.preventDefault();
    const encontrados = validar(form);
    setErrores(encontrados);
    if (Object.keys(encontrados).length || !Object.keys(cambios).length) return;

    setOcupado(true);
    setAviso(null);
    try {
      const { usuario: u, mensaje } = await usuariosApi.actualizar(id, cambios);
      const actualizado = { ...usuario, ...u };
      setUsuario(actualizado);
      setForm(formulario(actualizado));
      setAviso({ tipo: 'exito', mensaje });
      onCambio(actualizado);
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function ejecutar(destino) {
    const accion = destino === 'restablecer' ? 'restablecerContrasena' : ESTADOS[destino].accion;
    setOcupado(true);
    setAviso(null);
    try {
      const { usuario: u, mensaje } = await usuariosApi[accion](id);
      if (u) {
        const actualizado = { ...usuario, estado: u.estado };
        setUsuario(actualizado);
        onCambio(actualizado);
      }
      setAviso({ tipo: 'exito', mensaje });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  async function abrirEliminar() {
    setBorrando(true);
    setHistorial(null);
    try {
      const { resumen } = await usuariosApi.historialSocio(id);
      setHistorial(resumen ?? { pagos: 0, reservas: 0, visitas: 0, cargos: 0, invitados: 0 });
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
      setBorrando(false);
    }
  }

  async function eliminar() {
    setOcupado(true);
    setAviso(null);
    try {
      const { mensaje } = await usuariosApi.eliminar(id, confirmacionNombre.trim(), conHistorial);
      onEliminado?.(id, mensaje);
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
      setOcupado(false);
    }
  }

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setErrores((er) => ({ ...er, [campo]: undefined }));
  };

  const membresia = usuario?.socio?.membresia;
  const esSocio = usuario?.roles?.nombre === ROL_SOCIO;
  const nombreCoincide = usuario && confirmacionNombre.trim() === usuario.nombre_completo;
  const conHistorial = Boolean(historial && (historial.pagos || historial.reservas || historial.visitas));
  const listaHistorial = historial ? [
    [historial.reservas, 'reserva', 'reservas'],
    [historial.visitas, 'visita de invitado', 'visitas de invitados'],
    [historial.pagos, 'pago', 'pagos'],
    [historial.cargos, 'cargo', 'cargos'],
    [historial.invitados, 'invitado registrado', 'invitados registrados']
  ].filter(([n]) => n > 0).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`) : [];

  return (
    <Modal titulo="Detalle del usuario" onCerrar={onCerrar} lateral>
      {error && <Alerta>{error}</Alerta>}
      {!usuario && !error && <p className="cargando">Cargando…</p>}

      {usuario && (
        <>
          <header className="detalle__encabezado">
            <h2 className="tarjeta__titulo">{usuario.nombre_completo}</h2>
            <p className="perfil__sub">
              {nombreRol(usuario.roles?.nombre)}
              {usuario.socio?.numero_socio && ` · Socio N.º ${usuario.socio.numero_socio}`} ·{' '}
              <span className={`insignia insignia--${usuario.estado?.toLowerCase()}`}>{usuario.estado}</span>
            </p>
          </header>

          {aviso && <Alerta tipo={aviso.tipo}>{aviso.mensaje}</Alerta>}

          {esGeneral && !propia && (
          <section className="detalle__seccion">
            <h3 className="detalle__titulo">Estado de la cuenta</h3>
            {confirmar ? (
              <div className="confirmacion">
                <p>
                  <strong>
                    {confirmar === 'restablecer'
                      ? `¿Enviar el correo a ${usuario.correo}?`
                      : `¿Cambiar la cuenta de ${usuario.nombre_completo} a ${confirmar}?`}
                  </strong>{' '}
                  {confirmar === 'restablecer' ? RESTABLECER.pregunta : ESTADOS[confirmar].pregunta}
                </p>
                <div className="confirmacion__botones">
                  <button type="button" className="boton boton--secundario boton--chico" onClick={() => setConfirmar(null)} disabled={ocupado}>
                    Cancelar
                  </button>
                  <button type="button"
                    className={`boton boton--chico ${confirmar === 'restablecer' ? 'boton--secundario' : ESTADOS[confirmar].clase}`}
                    onClick={() => ejecutar(confirmar)} disabled={ocupado}>
                    {ocupado ? 'Procesando…' : confirmar === 'restablecer' ? 'Sí, enviar correo' : `Sí, cambiar a ${confirmar}`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="filtros__estados" role="group" aria-label="Estado de la cuenta">
                  {Object.entries(ESTADOS)
                    .filter(([, e]) => !e.soloSocios || esSocio)
                    .map(([nombre]) => (
                      <button
                        key={nombre}
                        type="button"
                        className={`chip ${usuario.estado === nombre ? 'chip--activo' : ''}`}
                        aria-pressed={usuario.estado === nombre}
                        disabled={usuario.estado === nombre}
                        onClick={() => setConfirmar(nombre)}
                      >
                        {nombre}
                      </button>
                    ))}
                </div>
                <p className="caja__nota" style={{ margin: '8px 0 0' }}>
                  Toque un estado para cambiarlo.
                  {esSocio && ' Para activar a un socio no debe tener cobros pendientes.'}
                </p>
                {esSocio && usuario.correo && (
                  <div className="detalle__acciones" style={{ marginTop: 12 }}>
                    <button type="button" className="boton boton--secundario boton--chico" onClick={() => setConfirmar('restablecer')}>
                      {RESTABLECER.texto}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          )}
          {propia && <p className="caja__nota">Esta es su propia cuenta.</p>}

          <section className="detalle__seccion">
            <h3 className="detalle__titulo">Cuenta</h3>
            <dl className="datos datos--dos">
              <div className="dato"><dt>Correo</dt><dd>{usuario.correo ?? '—'}</dd></div>
              <div className="dato"><dt>Cuenta creada</dt><dd>{fecha(usuario.fecha_creacion)}</dd></div>
              <div className="dato"><dt>Último ingreso</dt><dd>{fecha(usuario.ultimo_ingreso)}</dd></div>
              {usuario.socio && (
                <div className="dato"><dt>Socio desde</dt><dd>{fecha(usuario.socio.fecha_afiliacion)}</dd></div>
              )}
            </dl>
          </section>

          {usuario.socio && (
            <section className="detalle__seccion">
              <h3 className="detalle__titulo">Membresía</h3>
              {membresia ? (
                <dl className="datos datos--dos">
                  <div className="dato"><dt>Tipo</dt><dd>{membresia.tipo}</dd></div>
                  <div className="dato"><dt>Estado</dt><dd><span className={`insignia insignia--${membresia.estado?.toLowerCase()}`}>{membresia.estado}</span></dd></div>
                  <div className="dato"><dt>Inicio</dt><dd>{fecha(membresia.fecha_inicio)}</dd></div>
                  <div className="dato"><dt>Vence</dt><dd>{fecha(membresia.fecha_vencimiento)}</dd></div>
                </dl>
              ) : (
                <p className="caja__nota">No tiene membresías registradas.</p>
              )}
            </section>
          )}

          {esGeneral ? (
          <form className="detalle__seccion" onSubmit={guardar} noValidate>
            <h3 className="detalle__titulo">Datos personales</h3>
            <div className="rejilla">
              <Campo etiqueta="Nombre completo" value={form.nombre_completo} onChange={cambiar('nombre_completo')} error={errores.nombre_completo} />
              <Campo etiqueta="Cédula" value={form.cedula} onChange={cambiar('cedula')} error={errores.cedula} />
              <Campo etiqueta="Teléfono" tipo="tel" inputMode="numeric" maxLength={8} value={form.telefono} onChange={cambiar('telefono')} error={errores.telefono} />
              <Campo etiqueta="Fecha de nacimiento" tipo="date" value={form.fecha_nacimiento} onChange={cambiar('fecha_nacimiento')} error={errores.fecha_nacimiento} />
            </div>
            <Campo etiqueta="Dirección" value={form.direccion} onChange={cambiar('direccion')} error={errores.direccion} maxLength={255} />
            <button type="submit" className="boton boton--oscuro" disabled={ocupado || !Object.keys(cambios).length}>
              Guardar cambios
            </button>
          </form>
          ) : (
            <section className="detalle__seccion">
              <h3 className="detalle__titulo">Datos personales</h3>
              <dl className="datos datos--dos">
                <div className="dato"><dt>Cédula</dt><dd>{usuario.cedula}</dd></div>
                <div className="dato"><dt>Teléfono</dt><dd>{usuario.telefono}</dd></div>
                <div className="dato"><dt>Fecha de nacimiento</dt><dd>{fecha(usuario.fecha_nacimiento)}</dd></div>
                <div className="dato"><dt>Dirección</dt><dd>{usuario.direccion}</dd></div>
              </dl>
            </section>
          )}

          {esGeneral && esSocio && (
            <section className="detalle__seccion">
              <h3 className="detalle__titulo">Eliminar socio</h3>
              {!borrando ? (
                <>
                  <p className="caja__nota" style={{ margin: '0 0 12px' }}>
                    Si el socio solo se dio de baja, es mejor marcarlo como Inactivo: así se conservan sus pagos y reservas en los reportes.
                  </p>
                  <button type="button" className="boton boton--peligro boton--chico" onClick={abrirEliminar}>
                    Eliminar socio
                  </button>
                </>
              ) : !historial ? (
                <p className="cargando">Revisando lo que tiene registrado…</p>
              ) : (
                <div className="confirmacion">
                  {conHistorial ? (
                    <>
                      <p>
                        <strong>{usuario.nombre_completo} tiene historial en el club:</strong> {listaHistorial.join(', ')}.
                      </p>
                      <p style={{ marginTop: 8 }}>
                        Se borrará <strong>todo</strong>: la cuenta, la membresía, beneficiarios, invitados, reservas, visitas, cargos y pagos.
                        Sus pagos dejarán de aparecer en Cobros y en los reportes. No se puede deshacer.
                      </p>
                    </>
                  ) : (
                    <p>
                      Esto borra la cuenta de <strong>{usuario.nombre_completo}</strong>, su membresía, beneficiarios{listaHistorial.length ? `, ${listaHistorial.join(', ')}` : ''}. No se puede deshacer.
                    </p>
                  )}
                  <label htmlFor="socio-confirmar" className="campo__etiqueta" style={{ display: 'block', margin: '12px 0 6px' }}>
                    Escriba «{usuario.nombre_completo}» para confirmar
                  </label>
                  <input
                    id="socio-confirmar"
                    className="campo__input"
                    autoComplete="off"
                    value={confirmacionNombre}
                    onChange={(e) => setConfirmacionNombre(e.target.value)}
                  />
                  <div className="confirmacion__botones">
                    <button type="button" className="boton boton--secundario boton--chico"
                      onClick={() => { setBorrando(false); setConfirmacionNombre(''); setHistorial(null); }} disabled={ocupado}>
                      No, volver
                    </button>
                    <button type="button" className="boton boton--peligro boton--chico"
                      disabled={!nombreCoincide || ocupado} onClick={eliminar}>
                      {ocupado ? 'Eliminando…' : conHistorial ? 'Eliminar con todo su historial' : 'Eliminar definitivamente'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </Modal>
  );
}