import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import EstadoCuenta from '../../components/EstadoCuenta';
import DetalleUsuario from '../../components/admin/DetalleUsuario';
import NuevoAdministrador from '../../components/admin/NuevoAdministrador';
import { usuariosApi } from '../../api/usuarios';
import { useAuth } from '../../context/AuthContext';
import { ROL_GENERAL, ROL_SOCIO, nombreRol } from '../../utils/roles';

const ESTADOS = ['Activo', 'Suspendido', 'Inactivo'];

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Lista de usuarios de un rol, con búsqueda, filtro por estado y detalle
export default function Usuarios({ roles, titulo, descripcion }) {
  const { usuario: sesion } = useAuth();
  const [params, setParams] = useSearchParams();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState(params.get('estado') ?? '');
  const [nuevo, setNuevo] = useState(false);
  const [aviso, setAviso] = useState('');

  const seleccionado = params.get('id');
  const esSocio = roles.includes(ROL_SOCIO);
  const esGeneral = sesion?.rol === ROL_GENERAL;
  const clave = roles.join('|');

  const cargar = useCallback(() => {
    setError('');
    usuariosApi
      .listar()
      .then((d) => setUsuarios(d.usuarios.filter((u) => clave.split('|').includes(u.roles?.nombre))))
      .catch((err) => setError(err.message));
  }, [clave]);

  useEffect(cargar, [cargar]);

  const conteo = useMemo(() => {
    const c = { '': usuarios?.length ?? 0 };
    ESTADOS.forEach((e) => { c[e] = usuarios?.filter((u) => u.estado === e).length ?? 0; });
    return c;
  }, [usuarios]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar.trim());
    return (usuarios ?? []).filter((u) =>
      (!estado || u.estado === estado) &&
      (!q || [u.nombre_completo, u.cedula, u.correo, u.numero_socio, u.telefono].some((v) => normalizar(v).includes(q)))
    );
  }, [usuarios, buscar, estado]);

  function abrir(id) {
    const p = new URLSearchParams(params);
    p.set('id', id);
    setParams(p);
  }

  const cerrar = useCallback(() => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('id');
      return n;
    });
  }, [setParams]);

  const actualizarFila = useCallback((u) => {
    setUsuarios((lista) => lista?.map((x) => (x.id_usuario === u.id_usuario ? { ...x, ...u } : x)));
  }, []);

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">{titulo}</h1>
          <p className="inicio__fecha">{descripcion}</p>
        </div>
        {!esSocio && esGeneral && (
          <button type="button" className="boton boton--oscuro" onClick={() => setNuevo(true)}>
            + Nuevo administrador
          </button>
        )}
      </header>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {error && (
        <Alerta>
          {error}{' '}
          <button type="button" className="enlace-boton" onClick={cargar}>Reintentar</button>
        </Alerta>
      )}

      <div className="filtros">
        <input
          type="search"
          className="campo__input filtros__buscar"
          placeholder={esSocio ? 'Buscar por nombre, cédula, correo o N.º de socio' : 'Buscar por nombre, cédula o correo'}
          aria-label="Buscar"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="filtros__estados" role="group" aria-label="Filtrar por estado">
          {['', ...ESTADOS].map((e) => (
            <button
              key={e || 'todos'}
              type="button"
              className={`chip ${estado === e ? 'chip--activo' : ''}`}
              aria-pressed={estado === e}
              onClick={() => setEstado(e)}
            >
              {e || 'Todos'} <span className="chip__numero">{conteo[e]}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="tabla-tarjeta">
        {!usuarios && !error && <p className="tabla__vacio">Cargando…</p>}
        {usuarios && visibles.length === 0 && (
          <p className="tabla__vacio">No hay usuarios que coincidan con la búsqueda.</p>
        )}
        {visibles.length > 0 && (
          <div className="tabla__scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  {esSocio ? <th>N.º socio</th> : <th>Rol</th>}
                  <th>Cédula</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((u) => (
                  <tr
                    key={u.id_usuario}
                    tabIndex={0}
                    onClick={() => abrir(u.id_usuario)}
                    onKeyDown={(e) => e.key === 'Enter' && abrir(u.id_usuario)}
                  >
                    <td>{u.nombre_completo}</td>
                    {esSocio ? <td>{u.numero_socio ?? '—'}</td> : <td>{nombreRol(u.roles?.nombre)}</td>}
                    <td>{u.cedula}</td>
                    <td>{u.correo ?? '—'}</td>
                    <td>{u.telefono}</td>
                    <td><EstadoCuenta estado={u.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usuarios && (
          <p className="tabla__pie">
            {visibles.length} de {usuarios.length} {usuarios.length === 1 ? 'cuenta' : 'cuentas'} · clic en una fila para ver el detalle
          </p>
        )}
      </section>

      {seleccionado && <DetalleUsuario id={seleccionado} onCerrar={cerrar} onCambio={actualizarFila} />}

      {nuevo && (
        <NuevoAdministrador
          onCerrar={() => setNuevo(false)}
          onCreado={(u) => {
            setNuevo(false);
            setAviso(`Se creó la cuenta de ${u.nombre_completo}.`);
            cargar();
          }}
        />
      )}
    </div>
  );
}
