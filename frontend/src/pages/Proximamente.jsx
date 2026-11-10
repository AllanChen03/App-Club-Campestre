import { Link } from 'react-router-dom';

export default function Proximamente({ titulo, volver = '/inicio' }) {
  return (
    <div className="inicio">
      <h1 className="inicio__saludo">{titulo}</h1>
      <p className="inicio__fecha">Esta sección estará disponible pronto.</p>
      <Link to={volver} className="enlace enlace--subrayado">Volver al inicio</Link>
    </div>
  );
}
