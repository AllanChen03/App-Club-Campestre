import { fechaHora } from '../../utils/reservas';

function textoCambio(h) {
  if (!h.estado_anterior) return h.estado_nuevo === 'Pendiente' ? 'Solicitada' : `Registrada como ${h.estado_nuevo.toLowerCase()}`;
  if (h.estado_anterior === h.estado_nuevo) return 'Modificada';
  if (h.estado_nuevo === 'Pendiente') return 'Modificada, pendiente de confirmar';
  return h.estado_nuevo;
}

// Línea de tiempo con los cambios de estado de una reserva
export default function HistorialReserva({ reserva, mostrarUsuario = false }) {
  const historial = reserva.historial ?? [];
  const abierta = ['Pendiente', 'Confirmada'].includes(reserva.estado);

  return (
    <ul className="linea-tiempo">
      {historial.map((h, i) => (
        <li key={i}>
          {textoCambio(h)}: {fechaHora(h.fecha)}
          {(h.motivo || (mostrarUsuario && h.usuario)) && (
            <span className="linea-tiempo__sub">
              {[h.motivo, mostrarUsuario && h.usuario && `por ${h.usuario}`].filter(Boolean).join(' · ')}
            </span>
          )}
        </li>
      ))}
      {abierta && (
        <li className="linea-tiempo--futuro">
          {reserva.estado === 'Pendiente' ? 'Confirmación del club (pendiente)' : 'Finalizada (pendiente)'}
        </li>
      )}
    </ul>
  );
}
