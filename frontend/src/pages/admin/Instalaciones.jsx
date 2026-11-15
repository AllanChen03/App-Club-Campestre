import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import Calendario from '../../components/instalaciones/Calendario';
import Ocupacion from '../../components/instalaciones/Ocupacion';
import Reportes from '../../components/instalaciones/Reportes';
import Bloqueos from '../../components/instalaciones/Bloqueos';
import Configuracion from '../../components/instalaciones/Configuracion';
import { instalacionesApi } from '../../api/reservas';
import '../../styles/reservas.css';

const VISTAS = [
  { id: 'calendario', texto: 'Calendario', Componente: Calendario },
  { id: 'ocupacion', texto: 'Ocupación', Componente: Ocupacion },
  { id: 'reportes', texto: 'Reportes', Componente: Reportes },
  { id: 'bloqueos', texto: 'Bloqueos', Componente: Bloqueos },
  { id: 'configuracion', texto: 'Instalaciones y servicios', Componente: Configuracion }
];

export default function Instalaciones() {
  const [params, setParams] = useSearchParams();
  const [instalaciones, setInstalaciones] = useState(null);
  const [error, setError] = useState('');
  const vista = VISTAS.find((v) => v.id === params.get('vista')) ?? VISTAS[0];

  const cargar = useCallback(() => {
    instalacionesApi.listar()
      .then((d) => setInstalaciones(d.instalaciones))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(cargar, [cargar]);

  const irA = (id) => setParams(id === 'calendario' ? {} : { vista: id });
  const { Componente } = vista;

  return (
    <div className="panel">
      <nav className="pestanas-reservas" aria-label="Secciones de instalaciones">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`pestana-reservas ${v.id === vista.id ? 'pestana-reservas--activa' : ''}`}
            aria-current={v.id === vista.id ? 'page' : undefined}
            onClick={() => irA(v.id)}
          >
            {v.texto}
          </button>
        ))}
      </nav>

      {error && <Alerta>{error}</Alerta>}
      {!instalaciones && !error && <p className="cargando">Cargando instalaciones…</p>}
      {instalaciones && (
        <Componente instalaciones={instalaciones} recargarInstalaciones={cargar} irA={irA} />
      )}
    </div>
  );
}
