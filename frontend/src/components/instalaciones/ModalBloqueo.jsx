import { useState } from 'react';
import Modal from '../Modal';
import Alerta from '../Alerta';
import Campo from '../Campo';
import { instalacionesApi } from '../../api/reservas';
import { hoy } from '../../utils/reservas';

// Bloquea una instalación por mantenimiento o evento privado
export default function ModalBloqueo({ instalaciones, onCerrar, onCreado }) {
  const [form, setForm] = useState({
    id_instalacion: String(instalaciones[0]?.id_instalacion ?? ''),
    fecha_inicio: `${hoy()}T08:00`,
    fecha_fin: `${hoy()}T12:00`,
    motivo: ''
  });
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setConfirmar(false);
  };

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (!form.motivo.trim()) return setError('Escriba el motivo del bloqueo.');
    if (form.fecha_fin <= form.fecha_inicio) return setError('El fin debe ser posterior al inicio.');
    if (!confirmar) return setConfirmar(true);

    setGuardando(true);
    try {
      const d = await instalacionesApi.crearBloqueo({
        id_instalacion: Number(form.id_instalacion),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
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
          <Campo etiqueta="Desde" tipo="datetime-local" step={3600} value={form.fecha_inicio} onChange={cambiar('fecha_inicio')} />
          <Campo etiqueta="Hasta" tipo="datetime-local" step={3600} value={form.fecha_fin} onChange={cambiar('fecha_fin')} />
        </div>
        <Campo etiqueta="Motivo" placeholder="Ejemplo: mantenimiento de la piscina" maxLength={200}
          value={form.motivo} onChange={cambiar('motivo')} />

        {confirmar && (
          <Alerta tipo="aviso" titulo="¿Crear el bloqueo?">
            Las reservas pendientes o confirmadas en ese periodo se cancelarán y se avisará a los socios.
          </Alerta>
        )}

        <div className="confirmacion__botones">
          <button type="button" className="boton boton--secundario boton--chico" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton boton--oscuro boton--chico" disabled={guardando}>
            {guardando ? 'Bloqueando…' : confirmar ? 'Sí, bloquear' : 'Bloquear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
