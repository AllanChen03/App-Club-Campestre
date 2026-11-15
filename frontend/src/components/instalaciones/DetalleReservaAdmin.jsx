import { useEffect, useState } from 'react';
import Modal from '../Modal';
import Alerta from '../Alerta';
import HistorialReserva from '../reservas/HistorialReserva';
import SelectorTurnos, { turnoDisponible } from '../reservas/SelectorTurnos';
import { instalacionesApi, reservasApi } from '../../api/reservas';
import { colones } from '../../utils/formato';
import {
  claseEstado, colorInstalacion, fechaConDia, formatoCedula, hoy, rangoHoras, sumarDias
} from '../../utils/reservas';

// Formulario para que el club cambie fecha, horario o personas de una reserva
function ModificarReserva({ reserva, instalacion, onGuardada, onCancelar }) {
  const [fecha, setFecha] = useState(reserva.fecha_reserva);
  const [personas, setPersonas] = useState(reserva.cantidad_personas);
  const [turnos, setTurnos] = useState(null);
  const [seleccion, setSeleccion] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    setTurnos(null);
    instalacionesApi.disponibilidad(reserva.id_instalacion, fecha, reserva.id_reserva)
      .then((d) => {
        if (!vigente) return;
        setTurnos(d.turnos);
        if (fecha === reserva.fecha_reserva) {
          const desde = d.turnos.findIndex((t) => t.hora_inicio === reserva.hora_inicio);
          const hasta = d.turnos.findIndex((t) => t.hora_fin === reserva.hora_fin);
          setSeleccion(desde >= 0 && hasta >= desde ? { desde, hasta } : null);
        } else {
          setSeleccion(null);
        }
      })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [fecha, reserva]);

  const maximo = instalacion?.max_personas ?? reserva.cantidad_personas;
  const elegidos = seleccion && turnos ? turnos.slice(seleccion.desde, seleccion.hasta + 1) : [];
  const valido = elegidos.length > 0 && elegidos.every((t) => turnoDisponible(t, reserva.tipo_reserva, personas));

  async function guardar() {
    setError('');
    setGuardando(true);
    try {
      const d = await reservasApi.modificar(reserva.id_reserva, {
        fecha_reserva: fecha,
        hora_inicio: elegidos[0].hora_inicio,
        hora_fin: elegidos[elegidos.length - 1].hora_fin,
        cantidad_personas: personas,
        servicios: reserva.servicios.map((s) => ({ id_servicio: s.id_servicio, cantidad: s.cantidad })),
        invitados: reserva.invitados.map((i) => i.id_invitado)
      });
      onGuardada(d.reserva, d.mensaje);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="detalle__seccion">
      <h3 className="detalle__titulo">Modificar reserva</h3>
      {error && <Alerta>{error}</Alerta>}
      <div className="rejilla">
        <div className="campo">
          <label htmlFor="mod-fecha" className="campo__etiqueta">Fecha</label>
          <input id="mod-fecha" type="date" className="campo__input" value={fecha}
            min={hoy()} max={sumarDias(hoy(), 90)} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="mod-personas" className="campo__etiqueta">Personas (máximo {maximo})</label>
          <input id="mod-personas" type="number" className="campo__input" min={1} max={maximo} value={personas}
            onChange={(e) => setPersonas(Math.max(1, Math.min(maximo, Number(e.target.value) || 1)))} />
        </div>
      </div>
      {!turnos ? <p className="campo__ayuda">Cargando turnos…</p> : (
        <SelectorTurnos turnos={turnos} tipo={reserva.tipo_reserva} personas={personas}
          seleccion={seleccion} onCambiar={setSeleccion} />
      )}
      <p className="caja__nota">La reserva mantiene su estado. Si estaba confirmada, el cargo de servicios se recalcula.</p>
      <div className="confirmacion__botones">
        <button type="button" className="boton boton--secundario boton--chico" onClick={onCancelar}>Volver</button>
        <button type="button" className="boton boton--oscuro boton--chico" disabled={!valido || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// Ventana lateral con el detalle de una reserva y las acciones del club
export default function DetalleReservaAdmin({ idReserva, instalaciones, onCerrar, onCambio }) {
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modo, setModo] = useState(null); // null | 'cancelar' | 'modificar'
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    reservasApi.detalle(idReserva).then((d) => setReserva(d.reserva)).catch((e) => setError(e.message));
  }, [idReserva]);

  function actualizar(nueva, mensaje) {
    setReserva(nueva);
    setAviso(mensaje);
    setModo(null);
    onCambio?.();
  }

  async function ejecutar(accion) {
    setError('');
    setAviso('');
    setTrabajando(true);
    try {
      const d = accion === 'confirmar'
        ? await reservasApi.confirmar(idReserva)
        : await reservasApi.cancelar(idReserva, motivo.trim() || null);
      actualizar(d.reserva, d.mensaje);
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  const instalacion = instalaciones.find((i) => i.id_instalacion === reserva?.id_instalacion);

  return (
    <Modal titulo="Detalle de reserva" onCerrar={onCerrar} lateral>
      {!reserva && !error && <p className="cargando">Cargando…</p>}
      {error && <Alerta>{error}</Alerta>}
      {reserva && (
        <>
          <div className="detalle-reserva__titulo detalle__encabezado" style={{ '--color': colorInstalacion(reserva.instalacion) }}>
            <div>
              <h2 className="detalle-reserva__nombre">{reserva.instalacion}</h2>
              <p className="detalle-reserva__codigo">Reserva #{reserva.codigo}</p>
            </div>
            <span className={claseEstado(reserva.estado)}>{reserva.estado}</span>
          </div>

          {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

          <div className="detalle__seccion">
            <dl className="datos datos--dos">
              <div className="dato"><dt>Socio</dt><dd>{reserva.socio?.nombre_completo} · {reserva.socio?.numero_socio}</dd></div>
              <div className="dato"><dt>Teléfono</dt><dd>{reserva.socio?.telefono || '—'}</dd></div>
              <div className="dato"><dt>Fecha</dt><dd>{fechaConDia(reserva.fecha_reserva)}</dd></div>
              <div className="dato"><dt>Horario</dt><dd>{rangoHoras(reserva.hora_inicio, reserva.hora_fin)}</dd></div>
              <div className="dato"><dt>Personas</dt><dd>{reserva.cantidad_personas}</dd></div>
              <div className="dato">
                <dt>Servicios</dt>
                <dd>
                  {reserva.servicios.length
                    ? `${reserva.servicios.map((s) => `${s.nombre}${s.cantidad > 1 ? ` x${s.cantidad}` : ''}`).join(', ')} · ${colones(reserva.total_servicios)}`
                    : 'Ninguno'}
                  {reserva.cargo && ` · cargo ${reserva.cargo.estado.toLowerCase()}`}
                </dd>
              </div>
            </dl>
          </div>

          <div className="detalle__seccion">
            <h3 className="detalle__titulo">Invitados asociados</h3>
            {reserva.invitados.length === 0 ? <p className="tabla__vacio">Sin invitados.</p> : (
              <ul className="linea-tiempo">
                {reserva.invitados.map((i) => (
                  <li key={i.id_visita}>
                    {i.nombre_completo}
                    <span className="linea-tiempo__sub">{i.relacion} · Cédula {formatoCedula(i.cedula)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {reserva.editable && modo === null && (
            <div className="detalle__seccion">
              <div className="detalle__acciones">
                {reserva.estado === 'Pendiente' && (
                  <button type="button" className="boton boton--oscuro boton--chico" disabled={trabajando} onClick={() => ejecutar('confirmar')}>
                    {trabajando ? 'Confirmando…' : 'Confirmar reserva'}
                  </button>
                )}
                <button type="button" className="boton boton--secundario boton--chico" onClick={() => setModo('modificar')}>Modificar</button>
                <button type="button" className="boton boton--peligro boton--chico" onClick={() => setModo('cancelar')}>Cancelar reserva</button>
              </div>
            </div>
          )}

          {modo === 'cancelar' && (
            <div className="detalle__seccion">
              <div className="confirmacion">
                <label htmlFor="motivo" className="campo__etiqueta">Motivo de la cancelación (se le indica al socio)</label>
                <input id="motivo" className="campo__input" maxLength={200} value={motivo}
                  onChange={(e) => setMotivo(e.target.value)} placeholder="Ejemplo: cancha en reparación" />
                <div className="confirmacion__botones">
                  <button type="button" className="boton boton--secundario boton--chico" onClick={() => setModo(null)}>Volver</button>
                  <button type="button" className="boton boton--peligro boton--chico" disabled={trabajando} onClick={() => ejecutar('cancelar')}>
                    {trabajando ? 'Cancelando…' : 'Cancelar reserva'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {modo === 'modificar' && (
            <ModificarReserva reserva={reserva} instalacion={instalacion}
              onGuardada={actualizar} onCancelar={() => setModo(null)} />
          )}

          <div className="detalle__seccion">
            <h3 className="detalle__titulo">Historial</h3>
            <HistorialReserva reserva={reserva} mostrarUsuario />
          </div>
        </>
      )}
    </Modal>
  );
}
