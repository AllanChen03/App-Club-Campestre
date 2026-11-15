import { useCallback, useEffect, useState } from 'react';
import Alerta from '../Alerta';
import ModalBloqueo from './ModalBloqueo';
import { instalacionesApi } from '../../api/reservas';
import { marcaLocal } from '../../utils/reservas';

export default function Bloqueos({ instalaciones }) {
  const [bloqueos, setBloqueos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [creando, setCreando] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargar = useCallback(() => {
    instalacionesApi.bloqueos().then((d) => setBloqueos(d.bloqueos)).catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);

  async function eliminar(b) {
    setEliminando(true);
    setError('');
    try {
      const d = await instalacionesApi.eliminarBloqueo(b.id_bloqueo);
      setAviso(d.mensaje);
      setPorEliminar(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setEliminando(false);
    }
  }

  const cerrar = useCallback(() => setCreando(false), []);

  return (
    <>
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Bloqueos</h1>
          <p className="inicio__fecha">Mantenimientos y eventos privados vigentes o programados.</p>
        </div>
        <button type="button" className="boton boton--oscuro" onClick={() => setCreando(true)}>Bloquear horario</button>
      </header>

      {error && <Alerta>{error}</Alerta>}
      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}

      <section className="tabla-tarjeta">
        {!bloqueos && !error && <p className="tabla__vacio">Cargando…</p>}
        {bloqueos?.length === 0 && <p className="tabla__vacio">No hay bloqueos vigentes ni programados.</p>}
        {bloqueos?.length > 0 && (
          <div className="tabla__scroll">
            <table className="tabla tabla--sin-clic tabla--fija">
              <thead>
                <tr><th>Instalación</th><th>Desde</th><th>Hasta</th><th>Motivo</th><th aria-label="Acciones" /></tr>
              </thead>
              <tbody>
                {bloqueos.map((b) => (
                  <tr key={b.id_bloqueo}>
                    <td>{b.instalacion}</td>
                    <td>{marcaLocal(b.fecha_inicio)}</td>
                    <td>{marcaLocal(b.fecha_fin)}</td>
                    <td style={{ whiteSpace: 'normal' }}>{b.motivo}</td>
                    <td>
                      {porEliminar === b.id_bloqueo ? (
                        <span className="detalle__acciones">
                          <button type="button" className="boton boton--secundario boton--chico" onClick={() => setPorEliminar(null)}>No</button>
                          <button type="button" className="boton boton--peligro boton--chico" disabled={eliminando} onClick={() => eliminar(b)}>
                            Sí, quitar
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="boton boton--secundario boton--chico" onClick={() => setPorEliminar(b.id_bloqueo)}>
                          Quitar bloqueo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="tabla__pie">Al quitar un bloqueo, las reservas que se cancelaron por él no se restauran.</p>
      </section>

      {creando && (
        <ModalBloqueo
          instalaciones={instalaciones.filter((i) => i.estado === 'Activa')}
          onCerrar={cerrar}
          onCreado={(d) => { setCreando(false); setAviso(d.mensaje); cargar(); }}
        />
      )}
    </>
  );
}
