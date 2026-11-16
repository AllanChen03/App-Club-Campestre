import { useCallback, useEffect, useState } from 'react';
import Alerta from '../Alerta';
import { instalacionesApi } from '../../api/reservas';
import { fecha as fechaCorta } from '../../utils/formato';
import { colorInstalacion, fechaConDia, hora, hoy, marcaLocal } from '../../utils/reservas';

const REFRESCO_MS = 60000;

function textoCelda(c) {
  if (c.capacidad) {
    if (c.estado === 'Bloqueado' || c.estado === 'Cerrado') return c.estado;
    return `${c.personas} de ${c.capacidad}`;
  }
  return c.estado;
}

const claseCelda = (estado) =>
  `celda-ocupacion celda-ocupacion--${estado.toLowerCase().replace(/\s+/g, '-')}`;

export default function Ocupacion({ irA }) {
  const [fecha, setFecha] = useState(hoy());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [actualizado, setActualizado] = useState(null);

  const cargar = useCallback(() => {
    instalacionesApi.ocupacion(fecha)
      .then((d) => { setDatos(d); setError(''); setActualizado(new Date()); })
      .catch((e) => setError(e.message));
  }, [fecha]);

  // Se actualiza sola cada minuto cuando se mira el día de hoy
  useEffect(() => {
    setDatos(null);
    cargar();
    if (fecha !== hoy()) return undefined;
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar, fecha]);

  const esHoy = fecha === hoy();
  const horaActual = datos?.hora_actual ? Number(datos.hora_actual.slice(0, 2)) : null;
  const bloqueoAhora = datos?.ahora.find((a) => a.bloqueo);

  return (
    <>
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">{esHoy ? 'Ocupación en tiempo real' : 'Ocupación por franja horaria'}</h1>
          <p className="inicio__fecha">
            {esHoy ? `Hoy ${fechaCorta(fecha)}` : fechaConDia(fecha)}
            {datos?.hora_actual && ` · Ahora ${hora(datos.hora_actual)}`}
            {actualizado && esHoy && ` · Actualizado a las ${actualizado.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' })}`}
          </p>
        </div>
        <button type="button" className="boton boton--oscuro" onClick={() => irA('calendario')}>Ver calendario</button>
      </header>

      {error && <Alerta>{error}</Alerta>}

      <div className="barra-herramientas" style={{ marginTop: 0, marginBottom: 16 }}>
        <div className="campo">
          <label htmlFor="oc-fecha" className="campo__etiqueta" style={{ position: 'absolute', left: -9999 }}>Fecha</label>
          <input id="oc-fecha" type="date" className="campo__input" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        </div>
        {!esHoy && <button type="button" className="chip" onClick={() => setFecha(hoy())}>Volver a hoy</button>}
        <button type="button" className="chip" onClick={cargar}>Actualizar</button>
      </div>

      {esHoy && (
        <section className="resumen" aria-label="Estado actual de cada instalación">
          {(datos?.ahora ?? []).map((a) => (
            <article key={a.id_instalacion} className="resumen__tarjeta">
              <p className="resumen__etiqueta">{a.nombre}</p>
              <p className="resumen__valor resumen__valor--panel" style={{ color: colorInstalacion(a.nombre) }}>
                {a.bloqueo ? 'Bloqueado' : a.texto}
              </p>
            </article>
          ))}
        </section>
      )}

      <section className="tabla-tarjeta">
        {!datos && !error && <p className="tabla__vacio">Cargando…</p>}
        {datos && (
          <div className="tabla__scroll">
            <table className="tabla tabla--sin-clic">
              <thead>
                <tr>
                  <th>Franja horaria</th>
                  {datos.instalaciones.map((i) => <th key={i.id_instalacion}>{i.nombre}</th>)}
                </tr>
              </thead>
              <tbody>
                {datos.franjas.map((f) => {
                  const actual = esHoy && Number(f.hora.slice(0, 2)) === horaActual;
                  return (
                    <tr key={f.hora} className={actual ? 'fila-actual' : undefined}>
                      <td>{hora(f.hora)}{actual && ' · ahora'}</td>
                      {f.instalaciones.map((c) => (
                        <td key={c.id_instalacion} className={claseCelda(c.estado)} title={c.motivo ?? undefined}>
                          {textoCelda(c)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {datos && (
          <p className="tabla__pie">
            {bloqueoAhora
              ? `Ahora ${hora(datos.hora_actual)} · ${bloqueoAhora.nombre} está bloqueado hasta ${marcaLocal(bloqueoAhora.bloqueo.hasta)} (${bloqueoAhora.bloqueo.motivo})`
              : 'Exclusivas: Libre, Pendiente o Reservada · Por capacidad: personas reservadas de la capacidad total'}
          </p>
        )}
      </section>
    </>
  );
}
