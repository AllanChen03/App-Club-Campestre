import { useCallback, useState } from 'react';
import Alerta from '../Alerta';
import ModalInstalacion from './ModalInstalacion';
import { instalacionesApi } from '../../api/reservas';
import { colones } from '../../utils/formato';
import { colorInstalacion, hora, plural } from '../../utils/reservas';

// Servicios adicionales de una instalación: agregar, editar precio y activar/desactivar
function Servicios({ instalacion, onCambio, onError }) {
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '' });
  const [editando, setEditando] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  async function ejecutar(fn) {
    setTrabajando(true);
    onError('');
    try {
      await fn();
      onCambio();
    } catch (e) {
      onError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  function agregar(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim() || nuevo.precio === '') return onError('Escriba el nombre y el precio del servicio.');
    ejecutar(async () => {
      await instalacionesApi.crearServicio(instalacion.id_instalacion, {
        nombre: nuevo.nombre.trim(), precio: Number(nuevo.precio)
      });
      setNuevo({ nombre: '', precio: '' });
    });
  }

  function guardarEdicion(s) {
    ejecutar(async () => {
      await instalacionesApi.actualizarServicio(s.id_servicio, {
        nombre: editando.nombre.trim(), precio: Number(editando.precio)
      });
      setEditando(null);
    });
  }

  return (
    <>
      <table className="servicios-tabla">
        <tbody>
          {instalacion.servicios_adicionales.map((s) => (
            <tr key={s.id_servicio}>
              {editando?.id === s.id_servicio ? (
                <>
                  <td><input className="campo__input" aria-label="Nombre del servicio" value={editando.nombre}
                    onChange={(e) => setEditando((x) => ({ ...x, nombre: e.target.value }))} /></td>
                  <td><input className="campo__input" type="number" min={0} aria-label="Precio" value={editando.precio}
                    onChange={(e) => setEditando((x) => ({ ...x, precio: e.target.value }))} /></td>
                  <td>
                    <span className="detalle__acciones" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="enlace-boton" onClick={() => setEditando(null)}>Cancelar</button>
                      <button type="button" className="boton boton--oscuro boton--chico" disabled={trabajando} onClick={() => guardarEdicion(s)}>Guardar</button>
                    </span>
                  </td>
                </>
              ) : (
                <>
                  <td>
                    {s.nombre}
                    {s.estado === 'Inactivo' && <> <span className="insignia insignia--inactivo">Inactivo</span></>}
                  </td>
                  <td className="tabla__num">{colones(s.precio)}</td>
                  <td>
                    <span className="detalle__acciones" style={{ justifyContent: 'flex-end' }}>
                      <button type="button" className="enlace-boton"
                        onClick={() => setEditando({ id: s.id_servicio, nombre: s.nombre, precio: String(Number(s.precio)) })}>
                        Editar
                      </button>
                      <button type="button" className="enlace-boton" disabled={trabajando}
                        onClick={() => ejecutar(() => instalacionesApi.actualizarServicio(s.id_servicio, {
                          estado: s.estado === 'Activo' ? 'Inactivo' : 'Activo'
                        }))}>
                        {s.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                      </button>
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <form className="formulario-linea" onSubmit={agregar}>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor={`srv-${instalacion.id_instalacion}`}>Nuevo servicio</label>
          <input id={`srv-${instalacion.id_instalacion}`} className="campo__input" placeholder="Ejemplo: alquiler de toalla"
            value={nuevo.nombre} onChange={(e) => setNuevo((x) => ({ ...x, nombre: e.target.value }))} />
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor={`srv-precio-${instalacion.id_instalacion}`}>Precio (₡)</label>
          <input id={`srv-precio-${instalacion.id_instalacion}`} className="campo__input" type="number" min={0}
            value={nuevo.precio} onChange={(e) => setNuevo((x) => ({ ...x, precio: e.target.value }))} />
        </div>
        <button type="submit" className="boton boton--secundario boton--chico" style={{ height: 46 }} disabled={trabajando}>Agregar</button>
      </form>
    </>
  );
}

export default function Configuracion({ instalaciones, recargarInstalaciones }) {
  const [editar, setEditar] = useState(undefined); // undefined: cerrado; null: nueva
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cerrar = useCallback(() => setEditar(undefined), []);

  return (
    <>
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Instalaciones y servicios</h1>
          <p className="inicio__fecha">Horarios, turnos, aforo y servicios adicionales de cada instalación.</p>
        </div>
        <button type="button" className="boton boton--oscuro" onClick={() => setEditar(null)}>+ Nueva instalación</button>
      </header>

      {error && <Alerta>{error}</Alerta>}
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

      <div className="tarjetas-config">
        {instalaciones.map((i) => (
          <section key={i.id_instalacion} className="caja">
            <div className="caja__encabezado">
              <div className="detalle-reserva__titulo" style={{ '--color': colorInstalacion(i.nombre), marginBottom: 0 }}>
                <div>
                  <h2 className="caja__titulo">{i.nombre}</h2>
                  {i.descripcion && <p className="caja__nota" style={{ margin: 0 }}>{i.descripcion}</p>}
                </div>
              </div>
              <button type="button" className="boton boton--secundario boton--chico" onClick={() => setEditar(i)}>Editar</button>
            </div>
            <dl className="datos datos--dos">
              <div className="dato"><dt>Horario</dt><dd>{hora(i.hora_apertura)} a {hora(i.hora_cierre)}</dd></div>
              <div className="dato"><dt>Turnos</dt><dd>De {i.duracion_reserva / 60} {i.duracion_reserva === 60 ? 'hora' : 'horas'}</dd></div>
              <div className="dato"><dt>Tipo</dt><dd>{i.tipo_reserva}</dd></div>
              <div className="dato"><dt>Aforo</dt><dd>{plural(i.capacidad, 'persona', 'personas')} · hasta {i.max_personas} por reserva</dd></div>
              <div className="dato">
                <dt>Estado</dt>
                <dd><span className={`insignia ${i.estado === 'Activa' ? 'insignia--activo' : 'insignia--inactivo'}`}>{i.estado}</span></dd>
              </div>
            </dl>
            <h3 className="detalle__titulo" style={{ marginTop: 18 }}>Servicios adicionales</h3>
            <Servicios instalacion={i} onCambio={recargarInstalaciones} onError={setError} />
          </section>
        ))}
      </div>

      {editar !== undefined && (
        <ModalInstalacion
          instalacion={editar}
          onCerrar={cerrar}
          onGuardada={(mensaje) => { setEditar(undefined); setAviso(mensaje); recargarInstalaciones(); }}
        />
      )}
    </>
  );
}
