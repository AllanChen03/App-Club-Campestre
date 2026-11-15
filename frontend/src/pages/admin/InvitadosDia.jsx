import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import { instalacionesApi, invitadosApi } from '../../api/reservas';
import { colorInstalacion, fechaConDia, formatoCedula, hoy, plural } from '../../utils/reservas';
import '../../styles/reservas.css';

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Recepción: invitados esperados en un día, con búsqueda por nombre o cédula
export default function InvitadosDia() {
  const navigate = useNavigate();
  const [fecha, setFecha] = useState(hoy());
  const [visitas, setVisitas] = useState(null);
  const [instalaciones, setInstalaciones] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    instalacionesApi.listar().then((d) => setInstalaciones(d.instalaciones.filter((i) => i.estado === 'Activa'))).catch(() => {});
  }, []);

  useEffect(() => {
    setVisitas(null);
    setError('');
    invitadosApi.delDia(fecha).then((d) => setVisitas(d.visitas)).catch((e) => setError(e.message));
  }, [fecha]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar.trim());
    const qDigitos = buscar.replace(/\D/g, '');
    return (visitas ?? []).filter((v) =>
      (!filtro || (filtro === 'ninguna' ? !v.instalacion : v.instalacion === filtro)) &&
      (!q || normalizar(v.nombre_completo).includes(q) || normalizar(v.socio.nombre_completo).includes(q) ||
        (qDigitos && v.cedula.includes(qDigitos))));
  }, [visitas, buscar, filtro]);

  const sinInstalacion = (visitas ?? []).filter((v) => !v.instalacion).length;
  const esHoy = fecha === hoy();

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Invitados del día</h1>
          <p className="inicio__fecha">
            {fechaConDia(fecha)}
            {visitas && ` · ${plural(visitas.length, 'invitado esperado', 'invitados esperados')}`}
            {' · busque por nombre o cédula en la entrada'}
          </p>
        </div>
      </header>

      {error && <Alerta>{error}</Alerta>}

      <section className="resumen" aria-label="Invitados por instalación">
        {instalaciones.map((i) => {
          const n = (visitas ?? []).filter((v) => v.instalacion === i.nombre).length;
          const elegida = filtro === i.nombre;
          return (
            <button key={i.id_instalacion} type="button"
              className={`resumen__tarjeta resumen__tarjeta--boton ${elegida ? 'resumen__tarjeta--elegida' : ''}`}
              aria-pressed={elegida} onClick={() => setFiltro(elegida ? null : i.nombre)}>
              <p className="resumen__etiqueta">{i.nombre}</p>
              <p className="resumen__valor resumen__valor--panel" style={{ color: colorInstalacion(i.nombre) }}>
                {visitas ? plural(n, 'invitado', 'invitados') : '…'}
              </p>
            </button>
          );
        })}
      </section>

      <div className="filtros">
        <input type="search" className="campo__input filtros__buscar" placeholder="Buscar por nombre del invitado, socio o cédula"
          aria-label="Buscar invitado" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <input type="date" className="campo__input" style={{ width: 'auto', height: 42 }} aria-label="Fecha"
          value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} />
        {!esHoy && <button type="button" className="chip" onClick={() => setFecha(hoy())}>Hoy</button>}
        {sinInstalacion > 0 && (
          <button type="button" className={`chip ${filtro === 'ninguna' ? 'chip--activo' : ''}`}
            onClick={() => setFiltro(filtro === 'ninguna' ? null : 'ninguna')}>
            Sin instalación <span className="chip__numero">{sinInstalacion}</span>
          </button>
        )}
      </div>

      <section className="tabla-tarjeta">
        {!visitas && !error && <p className="tabla__vacio">Cargando…</p>}
        {visitas && visibles.length === 0 && (
          <p className="tabla__vacio">{visitas.length ? 'Ningún invitado coincide con la búsqueda.' : 'No hay invitados esperados este día.'}</p>
        )}
        {visibles.length > 0 && (
          <div className="tabla__scroll">
            <table className="tabla tabla--fija">
              <thead>
                <tr><th>Invitado</th><th>Cédula</th><th>Socio responsable</th><th>Instalación</th><th>Relación</th></tr>
              </thead>
              <tbody>
                {visibles.map((v) => (
                  <tr key={v.id_visita} tabIndex={0} title="Ver socio"
                    onClick={() => navigate(`/admin/socios?id=${v.socio.id_usuario}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/socios?id=${v.socio.id_usuario}`)}>
                    <td>{v.nombre_completo}</td>
                    <td>{formatoCedula(v.cedula)}</td>
                    <td>{v.socio.nombre_completo} <span className="chip__numero">{v.socio.numero_socio}</span></td>
                    <td>{v.instalacion ?? '—'}</td>
                    <td className="tabla__estado">{v.relacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visitas && (
          <p className="tabla__pie">
            {plural(visitas.length, 'invitado esperado', 'invitados esperados')} {esHoy ? 'hoy' : 'ese día'} · mostrando {visibles.length} · clic en una fila para ver al socio
          </p>
        )}
      </section>
    </div>
  );
}
