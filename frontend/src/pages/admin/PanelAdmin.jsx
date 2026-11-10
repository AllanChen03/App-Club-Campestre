import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import EstadoCuenta from '../../components/EstadoCuenta';
import { useAuth } from '../../context/AuthContext';
import { ROLES_ADMIN, ROL_SOCIO, nombreRol } from '../../utils/roles';
import { usuariosApi } from '../../api/usuarios';
import { fecha } from '../../utils/formato';

function titularFecha(f) {
  const dia = f.toLocaleDateString('es-CR', { weekday: 'long' });
  const resto = f.toLocaleDateString('es-CR', { day: 'numeric', month: 'long' });
  return `Hoy, ${dia} ${resto}`;
}

export default function PanelAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    usuariosApi
      .listar()
      .then((d) => setUsuarios(d.usuarios))
      .catch((err) => setError(err.message));
  }, []);

  const datos = useMemo(() => {
    if (!usuarios) return null;
    const socios = usuarios.filter((u) => u.roles?.nombre === ROL_SOCIO);
    return {
      activos: socios.filter((u) => u.estado === 'Activo').length,
      suspendidos: socios.filter((u) => u.estado === 'Suspendido').length,
      inactivos: socios.filter((u) => u.estado === 'Inactivo').length,
      admins: usuarios.filter((u) => ROLES_ADMIN.includes(u.roles?.nombre) && u.estado === 'Activo').length,
      atencion: socios
        .filter((u) => u.estado !== 'Activo')
        .sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)))
    };
  }, [usuarios]);

  const abrir = (id) => navigate(`/admin/socios?id=${id}`);
  const valor = (n) => (datos ? n : '…');

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">{titularFecha(new Date())}</h1>
          <p className="inicio__fecha">Vista: {nombreRol(usuario?.rol)}</p>
        </div>
        <Link to="/admin/socios" className="boton boton--oscuro">Ver socios</Link>
      </header>

      {error && <Alerta>{error}</Alerta>}

      <section className="resumen" aria-label="Indicadores de cuentas">
        <Link to="/admin/socios?estado=Activo" className="resumen__tarjeta resumen__tarjeta--enlace">
          <p className="resumen__etiqueta">Socios activos</p>
          <p className="resumen__valor resumen__valor--panel texto-verde">{valor(datos?.activos)}</p>
        </Link>
        <Link to="/admin/socios?estado=Suspendido" className="resumen__tarjeta resumen__tarjeta--enlace">
          <p className="resumen__etiqueta">Socios suspendidos</p>
          <p className="resumen__valor resumen__valor--panel texto-ambar">{valor(datos?.suspendidos)}</p>
        </Link>
        <Link to="/admin/socios?estado=Inactivo" className="resumen__tarjeta resumen__tarjeta--enlace">
          <p className="resumen__etiqueta">Socios inactivos</p>
          <p className="resumen__valor resumen__valor--panel texto-rojo">{valor(datos?.inactivos)}</p>
        </Link>
        <Link to="/admin/administradores" className="resumen__tarjeta resumen__tarjeta--enlace">
          <p className="resumen__etiqueta">Administradores activos</p>
          <p className="resumen__valor resumen__valor--panel">{valor(datos?.admins)}</p>
        </Link>
      </section>

      <section className="tabla-tarjeta">
        <h2 className="seccion__titulo">Cuentas que requieren atención</h2>
        {!datos && !error && <p className="tabla__vacio">Cargando…</p>}
        {datos && datos.atencion.length === 0 && (
          <p className="tabla__vacio">Todas las cuentas de socios están activas.</p>
        )}
        {datos && datos.atencion.length > 0 && (
          <>
            <div className="tabla__scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>N.º socio</th>
                    <th>Correo</th>
                    <th>Cuenta creada</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.atencion.map((u) => (
                    <tr
                      key={u.id_usuario}
                      tabIndex={0}
                      onClick={() => abrir(u.id_usuario)}
                      onKeyDown={(e) => e.key === 'Enter' && abrir(u.id_usuario)}
                    >
                      <td>{u.nombre_completo}</td>
                      <td>{u.numero_socio ?? '—'}</td>
                      <td>{u.correo ?? '—'}</td>
                      <td>{fecha(u.fecha_creacion)}</td>
                      <td><EstadoCuenta estado={u.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tabla__pie">
              {datos.atencion.length} {datos.atencion.length === 1 ? 'cuenta suspendida o inactiva' : 'cuentas suspendidas o inactivas'} · clic en una fila para ver el detalle
            </p>
          </>
        )}
      </section>
    </div>
  );
}
