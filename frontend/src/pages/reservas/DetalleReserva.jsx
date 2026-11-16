import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import HistorialReserva from '../../components/reservas/HistorialReserva';
import { reservasApi } from '../../api/reservas';
import { colones } from '../../utils/formato';
import { colorInstalacion, fechaConDia, plural, rangoHoras } from '../../utils/reservas';
import '../../styles/reservas.css';

export default function DetalleReserva() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [reserva, setReserva] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(location.state?.aviso ?? '');
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    reservasApi.mia(id)
      .then((d) => setReserva(d.reserva))
      .catch((e) => setError(e.message));
  }, [id]);

  async function cancelar() {
    setCancelando(true);
    setError('');
    try {
      const d = await reservasApi.cancelarMia(id);
      setReserva(d.reserva);
      setAviso('Reserva cancelada.');
      setConfirmando(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div>
      <header>
        <h1 className="inicio__saludo">Detalle de reserva</h1>
        <p className="inicio__fecha">
          <Link to="/reservas" className="enlace enlace--subrayado">Volver a mis reservas</Link>
        </p>
      </header>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {error && <Alerta>{error}</Alerta>}
      {!reserva && !error && <p className="cargando">Cargando…</p>}

      {reserva && (
        <div className="reserva-layout" style={{ marginTop: 0 }}>
          <section className="caja">
            <div className="detalle-reserva__titulo" style={{ '--color': colorInstalacion(reserva.instalacion) }}>
              <div>
                <h2 className="detalle-reserva__nombre">{reserva.instalacion}</h2>
                <p className="detalle-reserva__codigo">Reserva #{reserva.codigo}</p>
              </div>
              <span className={`insignia insignia--${reserva.estado.toLowerCase()}`}>{reserva.estado}</span>
            </div>

            <dl className="datos datos--dos">
              <div className="dato"><dt>Fecha</dt><dd>{fechaConDia(reserva.fecha_reserva)}</dd></div>
              <div className="dato"><dt>Horario</dt><dd>{rangoHoras(reserva.hora_inicio, reserva.hora_fin)}</dd></div>
              <div className="dato"><dt>Personas</dt><dd>{reserva.cantidad_personas}</dd></div>
              <div className="dato">
                <dt>Invitados</dt>
                <dd>{reserva.invitados.length ? reserva.invitados.map((i) => i.nombre_completo).join(', ') : 'Ninguno'}</dd>
              </div>
              <div className="dato">
                <dt>Servicios</dt>
                <dd>
                  {reserva.servicios.length
                    ? reserva.servicios.map((s) => `${s.nombre}${s.cantidad > 1 ? ` x${s.cantidad}` : ''}`).join(', ')
                    : 'Ninguno'}
                </dd>
              </div>
              <div className="dato">
                <dt>Total de servicios</dt>
                <dd>
                  {colones(reserva.total_servicios)}
                  {reserva.cargo && ` · cargo ${reserva.cargo.estado.toLowerCase()}`}
                </dd>
              </div>
            </dl>

            {reserva.editable && (
              <>
                <p className="caja__nota" style={{ margin: '20px 0 16px' }}>
                  Puede modificar o cancelar esta reserva hasta que inicie. Le avisaremos por correo con cada cambio.
                </p>

                {confirmando ? (
                  <div className="confirmacion" role="alertdialog" aria-label="Confirmar cancelación">
                    <p>
                      ¿Cancelar la reserva de {reserva.instalacion} del {fechaConDia(reserva.fecha_reserva).toLowerCase()}?
                      {reserva.invitados.length > 0 && ` También se cancelarán las visitas de ${plural(reserva.invitados.length, 'invitado', 'invitados')}.`}
                    </p>
                    <div className="confirmacion__botones">
                      <button type="button" className="boton boton--secundario boton--chico" onClick={() => setConfirmando(false)}>
                        No, mantener
                      </button>
                      <button type="button" className="boton boton--peligro boton--chico" disabled={cancelando} onClick={cancelar}>
                        {cancelando ? 'Cancelando…' : 'Sí, cancelar reserva'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="detalle__acciones">
                    <button type="button" className="boton boton--secundario boton--chico" onClick={() => navigate(`/reservas/${id}/modificar`)}>
                      Modificar
                    </button>
                    <button type="button" className="boton boton--peligro boton--chico" onClick={() => setConfirmando(true)}>
                      Cancelar reserva
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="caja">
            <h2 className="caja__titulo">Historial</h2>
            <HistorialReserva reserva={reserva} />
          </aside>
        </div>
      )}
    </div>
  );
}
