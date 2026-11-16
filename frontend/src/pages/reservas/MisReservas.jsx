import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import { reservasApi } from '../../api/reservas';
import {
  ACTIVAS, claseEstado, colorInstalacion, fechaConDia, plural, rangoHoras
} from '../../utils/reservas';
import '../../styles/reservas.css';

const PESTANAS = [
  { id: 'activas', texto: 'Activas', filtro: (r) => ACTIVAS.includes(r.estado) },
  { id: 'finalizadas', texto: 'Finalizadas', filtro: (r) => r.estado === 'Finalizada' },
  { id: 'canceladas', texto: 'Canceladas', filtro: (r) => r.estado === 'Cancelada' }
];

function detalle(r) {
  const partes = [
    fechaConDia(r.fecha_reserva),
    rangoHoras(r.hora_inicio, r.hora_fin),
    plural(r.cantidad_personas, 'persona', 'personas')
  ];
  if (r.servicios.length) partes.push(r.servicios.map((s) => s.nombre).join(', '));
  if (r.invitados.length) partes.push(plural(r.invitados.length, 'invitado', 'invitados'));
  return partes.join(' · ');
}

export default function MisReservas() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [reservas, setReservas] = useState(null);
  const [error, setError] = useState('');
  const aviso = location.state?.aviso;
  const pestana = PESTANAS.find((p) => p.id === params.get('ver')) ?? PESTANAS[0];

  useEffect(() => {
    reservasApi.mias()
      .then((d) => setReservas(d.reservas))
      .catch((e) => setError(e.message));
  }, []);

  const conteo = useMemo(() => Object.fromEntries(
    PESTANAS.map((p) => [p.id, reservas?.filter(p.filtro).length ?? 0])
  ), [reservas]);

  // Activas: la más próxima primero. Historial: la más reciente primero.
  const visibles = useMemo(() => {
    const lista = (reservas ?? []).filter(pestana.filtro);
    return pestana.id === 'activas' ? [...lista].reverse() : lista;
  }, [reservas, pestana]);

  return (
    <div>
      <header className="pagina__encabezado">
        <div>
          <h1 className="inicio__saludo">Mis reservas</h1>
          <p className="inicio__fecha">Consulte, modifique o cancele sus reservas.</p>
        </div>
        <Link to="/reservas/nueva" className="boton boton--oscuro">+ Nueva reserva</Link>
      </header>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {error && <Alerta>{error}</Alerta>}

      <nav className="pestanas-reservas" aria-label="Filtrar reservas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`pestana-reservas ${p.id === pestana.id ? 'pestana-reservas--activa' : ''}`}
            aria-current={p.id === pestana.id ? 'true' : undefined}
            onClick={() => setParams(p.id === 'activas' ? {} : { ver: p.id }, { replace: true })}
          >
            {p.texto} ({conteo[p.id]})
          </button>
        ))}
      </nav>

      {!reservas && !error && <p className="cargando">Cargando reservas…</p>}

      {reservas && visibles.length === 0 && (
        <div className="vacio">
          {pestana.id === 'activas' ? (
            <>
              <p>No tiene reservas activas.</p>
              <Link to="/reservas/nueva" className="boton boton--oscuro">Reservar una instalación</Link>
            </>
          ) : (
            <p>No tiene reservas {pestana.texto.toLowerCase()}.</p>
          )}
        </div>
      )}

      <div className="reservas-lista">
        {visibles.map((r) => (
          <article key={r.id_reserva} className="reserva-item" style={{ '--color': colorInstalacion(r.instalacion) }}>
            <div className="reserva-item__info">
              <p className="reserva-item__titulo">{r.instalacion}</p>
              <p className="reserva-item__detalle">{detalle(r)}</p>
            </div>
            <span className={claseEstado(r.estado)}>{r.estado}</span>
            <div className="reserva-item__acciones">
              {r.editable && (
                <Link to={`/reservas/${r.id_reserva}/modificar`} className="boton boton--secundario boton--chico">
                  Modificar
                </Link>
              )}
              <Link to={`/reservas/${r.id_reserva}`} className="boton boton--oscuro boton--chico">Ver detalle</Link>
            </div>
          </article>
        ))}
      </div>

      {pestana.id === 'activas' && (
        <p className="nota">
          Puede modificar o cancelar una reserva mientras no haya iniciado. Si modifica una reserva confirmada, vuelve a Pendiente.
        </p>
      )}
    </div>
  );
}
