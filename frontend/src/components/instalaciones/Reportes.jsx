import { useEffect, useState } from 'react';
import Alerta from '../Alerta';
import { descargarReporte, instalacionesApi } from '../../api/reservas';
import { fecha as fechaCorta } from '../../utils/formato';
import { hoy, nombreMes, sumarDias } from '../../utils/reservas';

function inicioMes(f) { return `${f.slice(0, 7)}-01`; }
function finMes(f) {
  const d = new Date(`${inicioMes(f)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const PERIODOS = [
  { id: 'mes', texto: 'Este mes', rango: () => [inicioMes(hoy()), finMes(hoy())] },
  { id: 'anterior', texto: 'Mes anterior', rango: () => { const f = sumarDias(inicioMes(hoy()), -1); return [inicioMes(f), f]; } },
  { id: 'semana', texto: 'Últimos 7 días', rango: () => [sumarDias(hoy(), -6), hoy()] },
  { id: 'otro', texto: 'Otro periodo', rango: null }
];

function descripcion(periodo, desde, hasta) {
  if (periodo === 'mes') return `este mes (${nombreMes(desde)} ${desde.slice(0, 4)})`;
  if (periodo === 'anterior') return `mes anterior (${nombreMes(desde)} ${desde.slice(0, 4)})`;
  return `del ${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState('mes');
  const [[desde, hasta], setRango] = useState(PERIODOS[0].rango());
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    if (!desde || !hasta || hasta < desde) return;
    setReporte(null);
    setError('');
    instalacionesApi.reporte(desde, hasta).then(setReporte).catch((e) => setError(e.message));
  }, [desde, hasta]);

  function elegir(p) {
    setPeriodo(p.id);
    if (p.rango) setRango(p.rango());
  }

  async function descargar() {
    setDescargando(true);
    setError('');
    try {
      await descargarReporte(desde, hasta);
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(false);
    }
  }

  const t = reporte?.totales;

  return (
    <>
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Reportes de uso</h1>
          <p className="inicio__fecha">Periodo: {descripcion(periodo, desde, hasta)} · instalaciones con mayor y menor demanda</p>
        </div>
        <button type="button" className="boton boton--oscuro" disabled={!reporte || descargando} onClick={descargar}>
          {descargando ? 'Generando…' : 'Descargar PDF'}
        </button>
      </header>

      <div className="barra-herramientas" style={{ marginTop: 0, marginBottom: 16 }}>
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" className={`chip ${periodo === p.id ? 'chip--activo' : ''}`} onClick={() => elegir(p)}>
            {p.texto}
          </button>
        ))}
        {periodo === 'otro' && (
          <>
            <label className="campo__etiqueta" htmlFor="rep-desde" style={{ margin: 0 }}>Desde</label>
            <input id="rep-desde" type="date" className="campo__input" style={{ width: 'auto', height: 40 }} value={desde}
              onChange={(e) => setRango([e.target.value, hasta])} />
            <label className="campo__etiqueta" htmlFor="rep-hasta" style={{ margin: 0 }}>Hasta</label>
            <input id="rep-hasta" type="date" className="campo__input" style={{ width: 'auto', height: 40 }} value={hasta} min={desde}
              onChange={(e) => setRango([desde, e.target.value])} />
          </>
        )}
      </div>

      {error && <Alerta>{error}</Alerta>}

      <section className="resumen" aria-label="Totales del periodo">
        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Reservas</p>
          <p className="resumen__valor resumen__valor--panel" style={{ color: 'var(--golf)' }}>{t ? t.reservas : '…'}</p>
        </article>
        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Horas reservadas</p>
          <p className="resumen__valor resumen__valor--panel" style={{ color: 'var(--tenis)' }}>{t ? `${t.horas} h` : '…'}</p>
        </article>
        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Ocupación promedio</p>
          <p className="resumen__valor resumen__valor--panel" style={{ color: 'var(--piscina)' }}>{t ? `${t.ocupacion} %` : '…'}</p>
        </article>
        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Cancelaciones</p>
          <p className="resumen__valor resumen__valor--panel" style={{ color: 'var(--salon)' }}>{t ? t.cancelaciones : '…'}</p>
        </article>
      </section>

      <section className="tabla-tarjeta">
        {!reporte && !error && <p className="tabla__vacio">Cargando…</p>}
        {reporte && (
          <div className="tabla__scroll">
            <table className="tabla tabla--sin-clic">
              <thead>
                <tr>
                  <th>Instalación</th>
                  <th className="tabla__num">Reservas</th>
                  <th className="tabla__num">Horas</th>
                  <th className="tabla__num">Ocupación</th>
                  <th className="tabla__num">Cancelaciones</th>
                  <th>Demanda</th>
                </tr>
              </thead>
              <tbody>
                {reporte.instalaciones.map((f) => (
                  <tr key={f.id_instalacion}>
                    <td>{f.nombre}</td>
                    <td className="tabla__num">{f.reservas}</td>
                    <td className="tabla__num">{f.horas} h</td>
                    <td className="tabla__num">{f.ocupacion} %</td>
                    <td className="tabla__num">{f.cancelaciones}</td>
                    <td className={`tabla__estado ${f.demanda === 'Mayor' ? 'texto-verde' : 'texto-ambar'}`}>
                      {f.demanda ? `${f.demanda} demanda` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reporte && (
          <p className="tabla__pie">
            {reporte.mayor_demanda
              ? `Mayor demanda: ${reporte.mayor_demanda}${reporte.menor_demanda ? ` · Menor demanda: ${reporte.menor_demanda}` : ''}`
              : 'No hay reservas en este periodo'}
          </p>
        )}
      </section>
      <p className="nota">
        La ocupación de las instalaciones exclusivas compara las horas reservadas con las horas abiertas.
        En las de capacidad compartida, compara las personas por hora con el aforo. No cuenta reservas canceladas.
      </p>
    </>
  );
}
