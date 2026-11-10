import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alerta from '../components/Alerta';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { fecha } from '../utils/formato';

const AREAS = [
  { id: 'golf', nombre: 'Cancha de golf', color: 'var(--golf)' },
  { id: 'tenis', nombre: 'Cancha de tenis', color: 'var(--tenis)' },
  { id: 'piscina', nombre: 'Piscina', color: 'var(--piscina)' },
  { id: 'salon', nombre: 'Salón de eventos', color: 'var(--salon)' }
];

function saludo(hora) {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function fechaLarga(f) {
  const texto = f
    .toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(',', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function Inicio() {
  const { usuario } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi
      .perfil()
      .then((d) => setPerfil(d.usuario))
      .catch((err) => setError(err.message));
  }, []);

  const hoy = new Date();
  const nombre = (perfil?.nombre_completo ?? usuario?.nombre_completo ?? '').split(' ')[0];
  const socio = perfil?.socio;
  const membresia = socio?.membresia;

  return (
    <div className="inicio">
      <header className="inicio__encabezado">
        <h1 className="inicio__saludo">{saludo(hoy.getHours())}, {nombre}</h1>
        <p className="inicio__fecha">{fechaLarga(hoy)}</p>
      </header>

      {error && <Alerta>{error}</Alerta>}

      <section className="resumen" aria-label="Resumen de su cuenta" aria-busy={!perfil && !error}>
        <article className="resumen__tarjeta resumen__tarjeta--destacada">
          <p className="resumen__etiqueta">Mi membresía</p>
          <p className="resumen__valor">
            {membresia ? `${membresia.tipo} · ${membresia.estado}` : perfil ? 'Sin membresía' : '…'}
          </p>
          <p className="resumen__detalle">
            {membresia?.fecha_vencimiento ? `Vence el ${fecha(membresia.fecha_vencimiento)}` : ' '}
          </p>
        </article>

        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Número de socio</p>
          <p className="resumen__valor">{socio?.numero_socio ?? (perfil ? '—' : '…')}</p>
          <p className="resumen__detalle">
            {socio?.fecha_afiliacion ? `Socio desde el ${fecha(socio.fecha_afiliacion)}` : ' '}
          </p>
        </article>

        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Invitados por mes</p>
          <p className="resumen__valor">
            {membresia?.max_invitados != null ? `Hasta ${membresia.max_invitados}` : perfil ? '—' : '…'}
          </p>
          <p className="resumen__detalle">Según su tipo de membresía</p>
        </article>

        <article className="resumen__tarjeta">
          <p className="resumen__etiqueta">Mi cuenta</p>
          <p className="resumen__valor">{perfil?.estado ?? '…'}</p>
          <Link to="/perfil" className="enlace">Ver o editar mi perfil</Link>
        </article>
      </section>

      <section className="seccion">
        <h2 className="seccion__titulo">Reserve en un clic</h2>
        <div className="areas">
          {AREAS.map((a) => (
            <Link
              key={a.id}
              to={`/reservas?area=${a.id}`}
              className="areas__boton"
              style={{ background: a.color }}
            >
              {a.nombre}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
