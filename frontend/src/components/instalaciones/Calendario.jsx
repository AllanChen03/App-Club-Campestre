import { useCallback, useEffect, useMemo, useState } from 'react';
import Alerta from '../Alerta';
import DetalleReservaAdmin from './DetalleReservaAdmin';
import ModalBloqueo from './ModalBloqueo';
import { reservasApi } from '../../api/reservas';
import {
  colorInstalacion, fechaConDia, hoy, lunesDe, nombreDia, nombreMes, plural, rangoHoras, sumarDias
} from '../../utils/reservas';

// Un solo filtro de estado a la vez
const FILTROS_ESTADO = [
  { id: 'vigentes', texto: 'Sin canceladas', incluye: (e) => e !== 'Cancelada' },
  { id: 'pendientes', texto: 'Solo pendientes', incluye: (e) => e === 'Pendiente' },
  { id: 'canceladas', texto: 'Solo canceladas', incluye: (e) => e === 'Cancelada' },
  { id: 'todas', texto: 'Todas', incluye: () => true }
];

function tituloSemana(lunes) {
  const domingo = sumarDias(lunes, 6);
  const [, , d1] = lunes.split('-');
  const [a2, , d2] = domingo.split('-');
  const mes1 = nombreMes(lunes);
  const mes2 = nombreMes(domingo);
  return mes1 === mes2
    ? `Semana del ${+d1} al ${+d2} de ${mes2} de ${a2}`
    : `Semana del ${+d1} de ${mes1} al ${+d2} de ${mes2} de ${a2}`;
}

export default function Calendario({ instalaciones }) {
  const [lunes, setLunes] = useState(lunesDe(hoy()));
  const [dia, setDia] = useState(hoy());
  const [filtroInst, setFiltroInst] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('vigentes');
  const [reservas, setReservas] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [bloqueando, setBloqueando] = useState(false);

  const cargar = useCallback(() => {
    setError('');
    reservasApi.listar({ desde: lunes, hasta: sumarDias(lunes, 6) })
      .then((d) => setReservas(d.reservas))
      .catch((e) => setError(e.message));
  }, [lunes]);

  useEffect(cargar, [cargar]);

  function moverSemana(dias) {
    setLunes(sumarDias(lunes, dias));
    setDia(null);
    setReservas(null);
  }

  function irAHoy() {
    if (lunes !== lunesDe(hoy())) setReservas(null);
    setLunes(lunesDe(hoy()));
    setDia(hoy());
  }

  const vigentes = useMemo(() => (reservas ?? []).filter((r) => r.estado !== 'Cancelada'), [reservas]);
  const pendientes = vigentes.filter((r) => r.estado === 'Pendiente').length;
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

  const visibles = useMemo(() => (reservas ?? []).filter((r) =>
    FILTROS_ESTADO.find((f) => f.id === filtroEstado).incluye(r.estado) &&
    (!dia || r.fecha_reserva === dia) &&
    (!filtroInst || r.id_instalacion === filtroInst)
  ), [reservas, dia, filtroInst, filtroEstado]);

  const cerrarDetalle = useCallback(() => setAbierta(null), []);
  const cerrarBloqueo = useCallback(() => setBloqueando(false), []);

  const hoyTexto = fechaConDia(hoy()).split(' ')[0].toLowerCase();

  return (
    <>
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Calendario de instalaciones</h1>
          <p className="inicio__fecha">
            {tituloSemana(lunes)} · Hoy: {hoyTexto} {+hoy().slice(8)} · reservas por instalación
          </p>
        </div>
        <button type="button" className="boton boton--oscuro" onClick={() => setBloqueando(true)}>Bloquear horario</button>
      </header>

      {error && <Alerta>{error}</Alerta>}
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

      <section className="resumen" aria-label="Reservas de la semana por instalación">
        {instalaciones.filter((i) => i.estado === 'Activa').map((i) => {
          const n = vigentes.filter((r) => r.id_instalacion === i.id_instalacion).length;
          const elegida = filtroInst === i.id_instalacion;
          return (
            <button
              key={i.id_instalacion}
              type="button"
              className={`resumen__tarjeta resumen__tarjeta--boton ${elegida ? 'resumen__tarjeta--elegida' : ''}`}
              aria-pressed={elegida}
              onClick={() => setFiltroInst(elegida ? null : i.id_instalacion)}
            >
              <p className="resumen__etiqueta">{i.nombre}</p>
              <p className="resumen__valor resumen__valor--panel" style={{ color: colorInstalacion(i.nombre) }}>
                {reservas ? plural(n, 'reserva', 'reservas') : '…'}
              </p>
            </button>
          );
        })}
      </section>

      <div className="barra-herramientas">
        <button type="button" className="boton--icono" aria-label="Semana anterior" onClick={() => moverSemana(-7)}>‹</button>
        <button type="button" className="chip" onClick={irAHoy}>Hoy</button>
        <button type="button" className="boton--icono" aria-label="Semana siguiente" onClick={() => moverSemana(7)}>›</button>
        <div className="dias" role="group" aria-label="Día">
          <button type="button" className={`chip ${!dia ? 'chip--activo' : ''}`} onClick={() => setDia(null)}>Toda la semana</button>
          {dias.map((d) => {
            const n = vigentes.filter((r) => r.fecha_reserva === d).length;
            return (
              <button key={d} type="button" className={`chip ${dia === d ? 'chip--activo' : ''}`} onClick={() => setDia(d)}>
                {nombreDia(d).slice(0, 3)} {+d.slice(8)}
                <span className="chip__numero">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="barra-herramientas" role="radiogroup" aria-label="Estado de las reservas">
        {FILTROS_ESTADO.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filtroEstado === f.id}
            className={`chip ${filtroEstado === f.id ? 'chip--activo' : ''}`}
            onClick={() => setFiltroEstado(f.id)}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <section className="tabla-tarjeta">
        {!reservas && !error && <p className="tabla__vacio">Cargando…</p>}
        {reservas && visibles.length === 0 && (
          <p className="tabla__vacio">No hay reservas {dia ? `el ${fechaConDia(dia).toLowerCase()}` : 'esta semana'} con estos filtros.</p>
        )}
        {visibles.length > 0 && (
          <div className="tabla__scroll">
            <table className="tabla tabla--fija">
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Instalación</th>
                  {!dia && <th>Día</th>}
                  <th>Horario</th>
                  <th className="tabla__num">Personas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r) => (
                  <tr key={r.id_reserva} tabIndex={0}
                    onClick={() => setAbierta(r.id_reserva)}
                    onKeyDown={(e) => e.key === 'Enter' && setAbierta(r.id_reserva)}>
                    <td>{r.socio?.nombre_completo}</td>
                    <td>{r.instalacion}</td>
                    {!dia && <td>{fechaConDia(r.fecha_reserva)}</td>}
                    <td>{rangoHoras(r.hora_inicio, r.hora_fin)}</td>
                    <td className="tabla__num">{r.cantidad_personas}</td>
                    <td className={`tabla__estado ${r.estado === 'Pendiente' ? 'texto-ambar' : r.estado === 'Cancelada' ? '' : 'texto-verde'}`}>
                      {r.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="tabla__pie">
          {dia ? `Reservas del ${fechaConDia(dia).toLowerCase()}` : 'Reservas de la semana'}
          {' · '}
          {pendientes > 0 ? (
            <button type="button" className="enlace-boton" onClick={() => { setFiltroEstado('pendientes'); setDia(null); }}>
              {plural(pendientes, 'solicitud por confirmar', 'solicitudes por confirmar')} esta semana
            </button>
          ) : 'sin solicitudes por confirmar esta semana'}
          {' · clic en una fila para ver el detalle'}
        </p>
      </section>

      {abierta && (
        <DetalleReservaAdmin idReserva={abierta} instalaciones={instalaciones}
          onCerrar={cerrarDetalle} onCambio={cargar} />
      )}

      {bloqueando && (
        <ModalBloqueo
          instalaciones={instalaciones.filter((i) => i.estado === 'Activa')}
          fechaInicial={dia ?? lunes}
          onCerrar={cerrarBloqueo}
          onCreado={(d) => { setBloqueando(false); setAviso(d.mensaje); cargar(); }}
        />
      )}
    </>
  );
}
