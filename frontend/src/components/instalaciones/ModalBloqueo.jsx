import { useState } from 'react';
import Modal from '../Modal';
import Alerta from '../Alerta';
import Campo from '../Campo';
import { instalacionesApi, reservasApi } from '../../api/reservas';
import { diasEntre, fechaConDia, hora, hoy, marcaLocal, plural, rangoHoras } from '../../utils/reservas';

// Horas en punto del día; se muestran como «8:00 a. m.» para que no se confundan
const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

const MAX_DIAS_REVISION = 62; // lo que permite consultar el listado de reservas

// Bloquea una instalación por mantenimiento o evento privado
// fechaInicial: el día que se está viendo en el calendario (si no, hoy)
export default function ModalBloqueo({ instalaciones, fechaInicial, onCerrar, onCreado }) {
  const dia = fechaInicial && fechaInicial >= hoy() ? fechaInicial : hoy();
  const [form, setForm] = useState({
    id_instalacion: String(instalaciones[0]?.id_instalacion ?? ''),
    fecha_desde: dia,
    hora_desde: '08:00',
    fecha_hasta: dia,
    hora_hasta: '12:00',
    motivo: ''
  });

  // Fecha y hora juntas, en el formato que espera el backend
  const fechaInicio = `${form.fecha_desde}T${form.hora_desde}`;
  const fechaFin = `${form.fecha_hasta}T${form.hora_hasta}`;
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [afectadas, setAfectadas] = useState(null); // null: no se pudo revisar
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setConfirmar(false);
  };

  // Si el inicio pasa después del fin, el fin se mueve al mismo día
  const cambiarDesde = (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, fecha_desde: valor, fecha_hasta: f.fecha_hasta < valor ? valor : f.fecha_hasta }));
    setConfirmar(false);
  };

  // Reservas pendientes o confirmadas que caen dentro del bloqueo
  async function buscarAfectadas() {
    const desde = fechaInicio.slice(0, 10);
    const hasta = fechaFin.slice(0, 10);
    if (diasEntre(desde, hasta) > MAX_DIAS_REVISION) return null;

    const { reservas } = await reservasApi.listar({ desde, hasta, id_instalacion: form.id_instalacion });
    const inicio = `${fechaInicio}:00`;
    const fin = `${fechaFin}:00`;
    return reservas.filter((r) =>
      ['Pendiente', 'Confirmada'].includes(r.estado) &&
      `${r.fecha_reserva}T${r.hora_inicio}` < fin &&
      `${r.fecha_reserva}T${r.hora_fin}` > inicio);
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!form.motivo.trim()) return setError('Escriba el motivo del bloqueo.');
    if (fechaFin <= fechaInicio) return setError('El fin debe ser posterior al inicio.');
    if (!confirmar) {
      setRevisando(true);
      try {
        setAfectadas(await buscarAfectadas());
      } catch {
        setAfectadas(null);
      } finally {
        setRevisando(false);
      }
      return setConfirmar(true);
    }

    setGuardando(true);
    try {
      const d = await instalacionesApi.crearBloqueo({
        id_instalacion: Number(form.id_instalacion),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        motivo: form.motivo.trim()
      });
      onCreado(d);
    } catch (err) {
      setError(err.message);
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  }

  const nombreInstalacion = instalaciones.find((i) => String(i.id_instalacion) === form.id_instalacion)?.nombre ?? '';

  return (
    <Modal titulo="Bloquear horario" onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        <div className="detalle__encabezado">
          <h2 className="tarjeta__titulo">Bloquear horario</h2>
          <p className="perfil__sub">Para mantenimiento o eventos privados. Nadie podrá reservar en ese periodo.</p>
        </div>
        {error && <Alerta>{error}</Alerta>}

        <div className="campo">
          <label htmlFor="bl-instalacion" className="campo__etiqueta">Instalación</label>
          <select id="bl-instalacion" className="campo__select-nativo" value={form.id_instalacion} onChange={cambiar('id_instalacion')}>
            {instalaciones.map((i) => <option key={i.id_instalacion} value={i.id_instalacion}>{i.nombre}</option>)}
          </select>
        </div>
        <div className="rejilla">
          <Campo etiqueta="Desde el día" tipo="date" min={hoy()} value={form.fecha_desde} onChange={cambiarDesde} />
          <div className="campo">
            <label htmlFor="bl-hora-desde" className="campo__etiqueta">A partir de las</label>
            <select id="bl-hora-desde" className="campo__select-nativo" value={form.hora_desde} onChange={cambiar('hora_desde')}>
              {HORAS.map((h) => <option key={h} value={h}>{hora(h)}</option>)}
            </select>
          </div>
          <Campo etiqueta="Hasta el día" tipo="date" min={form.fecha_desde} value={form.fecha_hasta} onChange={cambiar('fecha_hasta')} />
          <div className="campo">
            <label htmlFor="bl-hora-hasta" className="campo__etiqueta">Hasta las</label>
            <select id="bl-hora-hasta" className="campo__select-nativo" value={form.hora_hasta} onChange={cambiar('hora_hasta')}>
              {HORAS.map((h) => <option key={h} value={h}>{hora(h)}</option>)}
            </select>
          </div>
        </div>
        <Campo etiqueta="Motivo" placeholder="Ejemplo: mantenimiento de la piscina" maxLength={200}
          value={form.motivo} onChange={cambiar('motivo')} />

        {confirmar && (
          <Alerta tipo="aviso" titulo="¿Crear el bloqueo?">
            <span style={{ display: 'block' }}>
              {nombreInstalacion} · {marcaLocal(fechaInicio)} a {marcaLocal(fechaFin)}
              {' '}({fechaConDia(fechaInicio.slice(0, 10)).split(' ')[0].toLowerCase()})
            </span>
            {afectadas === null && (
              <span style={{ display: 'block', marginTop: 6 }}>
                Las reservas pendientes o confirmadas en ese periodo se cancelarán y se avisará a los socios.
              </span>
            )}
            {afectadas?.length === 0 && (
              <span style={{ display: 'block', marginTop: 6 }}>No hay reservas en ese periodo; no se cancelará ninguna.</span>
            )}
            {afectadas?.length > 0 && (
              <>
                <span style={{ display: 'block', marginTop: 6 }}>
                  Se {afectadas.length === 1 ? 'cancelará' : 'cancelarán'} {plural(afectadas.length, 'reserva', 'reservas')} y se avisará a los socios:
                </span>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {afectadas.map((r) => (
                    <li key={r.id_reserva}>
                      {r.codigo} · {r.socio?.nombre_completo} · {fechaConDia(r.fecha_reserva)} · {rangoHoras(r.hora_inicio, r.hora_fin)} · {r.estado}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Alerta>
        )}

        <div className="confirmacion__botones">
          <button type="button" className="boton boton--secundario boton--chico" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton boton--oscuro boton--chico" disabled={guardando || revisando}>
            {guardando ? 'Bloqueando…' : revisando ? 'Revisando…' : confirmar ? 'Sí, bloquear' : 'Bloquear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
