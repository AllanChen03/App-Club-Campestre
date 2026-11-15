import { useState } from 'react';
import Modal from '../Modal';
import Alerta from '../Alerta';
import Campo from '../Campo';
import { instalacionesApi } from '../../api/reservas';

const horaCorta = (h) => (h ? String(h).slice(0, 5) : '');

// Crear o editar una instalación (horario, turnos, capacidad y tipo de reserva)
export default function ModalInstalacion({ instalacion, onCerrar, onGuardada }) {
  const editando = Boolean(instalacion);
  const [form, setForm] = useState({
    nombre: instalacion?.nombre ?? '',
    descripcion: instalacion?.descripcion ?? '',
    capacidad: String(instalacion?.capacidad ?? ''),
    hora_apertura: horaCorta(instalacion?.hora_apertura) || '08:00',
    hora_cierre: horaCorta(instalacion?.hora_cierre) || '20:00',
    duracion_reserva: String(instalacion?.duracion_reserva ?? 60),
    tipo_reserva: instalacion?.tipo_reserva ?? 'Exclusiva',
    max_personas_reserva: String(instalacion?.max_personas_reserva ?? 12),
    estado: instalacion?.estado ?? 'Activa'
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const apertura = Number(form.hora_apertura.slice(0, 2));
  const cierre = Number(form.hora_cierre.slice(0, 2));
  const duracion = Number(form.duracion_reserva) / 60;
  const exacto = cierre > apertura && duracion > 0 && (cierre - apertura) % duracion === 0;
  const cantidadTurnos = exacto ? (cierre - apertura) / duracion : 0;

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim()) return setError('Escriba el nombre de la instalación.');
    if (!exacto) return setError('El horario debe dividirse en turnos exactos.');

    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      capacidad: Number(form.capacidad),
      hora_apertura: form.hora_apertura,
      hora_cierre: form.hora_cierre,
      duracion_reserva: Number(form.duracion_reserva),
      tipo_reserva: form.tipo_reserva,
      max_personas_reserva: Number(form.max_personas_reserva),
      estado: form.estado
    };

    setGuardando(true);
    try {
      const d = editando
        ? await instalacionesApi.actualizar(instalacion.id_instalacion, datos)
        : await instalacionesApi.crear(datos);
      onGuardada(d.mensaje);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const horas = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  return (
    <Modal titulo={editando ? 'Editar instalación' : 'Nueva instalación'} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        <div className="detalle__encabezado">
          <h2 className="tarjeta__titulo">{editando ? `Editar ${instalacion.nombre}` : 'Nueva instalación'}</h2>
        </div>
        {error && <Alerta>{error}</Alerta>}

        <Campo etiqueta="Nombre" value={form.nombre} onChange={cambiar('nombre')} maxLength={100} />
        <Campo etiqueta="Descripción (opcional)" value={form.descripcion} onChange={cambiar('descripcion')} maxLength={255} />

        <div className="rejilla">
          <div className="campo">
            <label htmlFor="ins-apertura" className="campo__etiqueta">Abre</label>
            <select id="ins-apertura" className="campo__select-nativo" value={form.hora_apertura} onChange={cambiar('hora_apertura')}>
              {horas.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ins-cierre" className="campo__etiqueta">Cierra</label>
            <select id="ins-cierre" className="campo__select-nativo" value={form.hora_cierre} onChange={cambiar('hora_cierre')}>
              {horas.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ins-duracion" className="campo__etiqueta">Duración de cada turno</label>
            <select id="ins-duracion" className="campo__select-nativo" value={form.duracion_reserva} onChange={cambiar('duracion_reserva')}>
              {[60, 120, 180, 240, 300, 360].map((m) => <option key={m} value={m}>{m / 60} {m === 60 ? 'hora' : 'horas'}</option>)}
            </select>
            <p className={exacto ? 'campo__ayuda' : 'campo__mensaje'}>
              {exacto ? `${cantidadTurnos} turnos por día` : 'No da turnos exactos: ajuste el horario o la duración'}
            </p>
          </div>
          <div className="campo">
            <label htmlFor="ins-tipo" className="campo__etiqueta">Tipo de reserva</label>
            <select id="ins-tipo" className="campo__select-nativo" value={form.tipo_reserva} onChange={cambiar('tipo_reserva')}>
              <option value="Exclusiva">Exclusiva (una reserva por turno)</option>
              <option value="Por capacidad">Por capacidad (compartida)</option>
            </select>
          </div>
          <Campo etiqueta="Capacidad (aforo)" tipo="number" min={1} value={form.capacidad} onChange={cambiar('capacidad')} />
          <Campo etiqueta="Máximo de personas por reserva" tipo="number" min={1} value={form.max_personas_reserva}
            onChange={cambiar('max_personas_reserva')} />
        </div>

        <div className="campo">
          <label htmlFor="ins-estado" className="campo__etiqueta">Estado</label>
          <select id="ins-estado" className="campo__select-nativo" value={form.estado} onChange={cambiar('estado')}>
            <option value="Activa">Activa: los socios pueden reservar</option>
            <option value="Inactiva">Inactiva: no aparece para reservar</option>
          </select>
        </div>

        {editando && (
          <p className="caja__nota">
            Las reservas ya hechas no cambian. Si mueve el horario, revise en el calendario las reservas futuras.
          </p>
        )}

        <div className="confirmacion__botones">
          <button type="button" className="boton boton--secundario boton--chico" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton boton--oscuro boton--chico" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
