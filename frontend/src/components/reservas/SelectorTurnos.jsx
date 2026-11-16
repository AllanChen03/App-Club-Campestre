import { hora } from '../../utils/reservas';

export const MAX_TURNOS = 2;

// ¿Se puede elegir este turno para la cantidad de personas indicada?
export function turnoDisponible(turno, tipo, personas = 1) {
  if (turno.estado !== 'Libre') return false;
  return tipo === 'Exclusiva' ? true : turno.cupo >= personas;
}

function textoEstado(turno, tipo, personas) {
  if (turno.estado === 'Pasado') return 'Ya pasó';
  if (turno.estado === 'Bloqueado') return 'Bloqueado';
  if (turno.estado === 'Ocupado') return tipo === 'Exclusiva' ? 'Reservado' : 'Lleno';
  if (tipo === 'Por capacidad') {
    return turno.cupo >= personas ? `${turno.cupo} lugares libres` : `Solo ${turno.cupo} lugares`;
  }
  return 'Disponible';
}

// Cuadrícula de turnos. `seleccion` es { desde, hasta } con índices de turnos.
// Un clic elige un turno; un clic en el turno siguiente o anterior lo amplía a dos.
export default function SelectorTurnos({ turnos, tipo, personas, seleccion, onCambiar }) {
  function elegir(i) {
    if (!seleccion) return onCambiar({ desde: i, hasta: i });

    const { desde, hasta } = seleccion;
    if (desde === hasta && i === desde) return onCambiar(null);

    const unoSolo = desde === hasta;
    if (unoSolo && (i === desde + 1 || i === desde - 1)) {
      return onCambiar({ desde: Math.min(i, desde), hasta: Math.max(i, desde) });
    }
    return onCambiar({ desde: i, hasta: i });
  }

  if (!turnos.length) {
    return <p className="campo__ayuda">Esta instalación no tiene turnos configurados.</p>;
  }

  return (
    <div className="turnos" role="group" aria-label="Turnos disponibles">
      {turnos.map((t, i) => {
        const elegido = seleccion && i >= seleccion.desde && i <= seleccion.hasta;
        const disponible = turnoDisponible(t, tipo, personas);
        return (
          <button
            key={t.hora_inicio}
            type="button"
            className={`turno ${elegido ? 'turno--elegido' : ''} ${t.estado === 'Bloqueado' ? 'turno--bloqueado' : ''}`}
            disabled={!disponible && !elegido}
            aria-pressed={Boolean(elegido)}
            title={t.motivo_bloqueo ?? undefined}
            onClick={() => elegir(i)}
          >
            <span className="turno__hora">{hora(t.hora_inicio)} – {hora(t.hora_fin)}</span>
            <span className="turno__estado">{elegido ? 'Elegido' : textoEstado(t, tipo, personas)}</span>
          </button>
        );
      })}
    </div>
  );
}
