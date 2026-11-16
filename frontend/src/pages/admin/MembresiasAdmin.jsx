import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alerta from '../../components/Alerta';
import Campo from '../../components/Campo';
import Modal from '../../components/Modal';
import DetalleMembresiaModal from '../../components/membresias/DetalleMembresiaModal';
import { membresiasApi } from '../../api/membresias';
import { useAuth } from '../../context/AuthContext';
import { fecha } from '../../utils/formato';
import { ROL_GENERAL } from '../../utils/roles';

const ESTADOS_FILTRO = ['Activa', 'Pendiente', 'Vencida', 'Suspendida', 'Sin asignar'];

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fechaMasUnMes() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function MembresiasAdmin() {
  const { usuario: sesion } = useAuth();
  const esGeneral = sesion?.rol === ROL_GENERAL;
  const [params, setParams] = useSearchParams();

  const [vista, setVista] = useState('socios'); // 'socios' | 'tipos'
  const [socios, setSocios] = useState(null);
  const [tipos, setTipos] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState(null);

  const seleccionada = params.get('id');
  const [socioAsignar, setSocioAsignar] = useState(null);
  const [tipoEditar, setTipoEditar] = useState(null);

  const [errorModal, setErrorModal] = useState('');

  const [formAsignar, setFormAsignar] = useState({
    id_tipo_membresia: '',
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_vencimiento: '',
    estado: 'Activa',
    motivo: '',
    generar_cargo: true
  });

  const [formTipo, setFormTipo] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    max_beneficiarios: '0',
    max_invitados: '0'
  });

  const cargarTodo = useCallback(async () => {
    setError('');
    try {
      const [resSocios, resTipos] = await Promise.all([
        membresiasApi.listarSocios(),
        membresiasApi.listarTipos()
      ]);
      setSocios(resSocios.socios ?? []);
      setTipos(resTipos.tipos ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const conteo = useMemo(() => {
    const lista = socios ?? [];
    const c = { '': lista.length };
    ESTADOS_FILTRO.forEach((e) => {
      c[e] = lista.filter((s) => (s.membresia_actual?.estado ?? 'Sin asignar') === e).length;
    });
    return c;
  }, [socios]);

  const visibles = useMemo(() => {
    const q = normalizar(buscar.trim());
    return (socios ?? []).filter((s) => {
      const estActual = s.membresia_actual?.estado ?? 'Sin asignar';
      const coincideEstado = !estadoFiltro || estActual === estadoFiltro;
      const coincideTexto =
        !q ||
        [
          s.usuario?.nombre_completo,
          s.usuario?.cedula,
          s.numero_socio,
          s.membresia_actual?.tipos_membresia?.nombre
        ].some((v) => normalizar(v).includes(q));
      return coincideEstado && coincideTexto;
    });
  }, [socios, buscar, estadoFiltro]);

  function abrirDetalle(idMembresia) {
    const p = new URLSearchParams(params);
    p.set('id', idMembresia);
    setParams(p);
  }

  const cerrarDetalle = useCallback(() => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('id');
      return n;
    });
  }, [setParams]);

function abrirModalAsignar(socio) {
    setErrorModal('');
    setSocioAsignar(socio);
    setFormAsignar({
      id_tipo_membresia: tipos?.[0] ? String(tipos[0].id_tipo_membresia) : '',
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_vencimiento: fechaMasUnMes(),
      estado: 'Activa',
      motivo: '',
      generar_cargo: true
    });
  }

  async function confirmarAsignacion(e) {
    e.preventDefault();
    setErrorModal('');
    setAviso(null);
    try {
      const { mensaje } = await membresiasApi.asignar({
        id_socio: socioAsignar.id_socio,
        ...formAsignar
      });
      setSocioAsignar(null);
      setAviso({ tipo: 'exito', mensaje });
      cargarTodo();
    } catch (err) {
      setErrorModal(err.message);
    }
  }

  function abrirModalTipo(tipo = null) {
    if (tipo) {
      setTipoEditar(tipo);
      setFormTipo({
        nombre: tipo.nombre,
        descripcion: tipo.descripcion ?? '',
        precio: String(tipo.precio),
        max_beneficiarios: String(tipo.max_beneficiarios),
        max_invitados: String(tipo.max_invitados)
      });
    } else {
      setTipoEditar('nuevo');
      setFormTipo({
        nombre: '',
        descripcion: '',
        precio: '',
        max_beneficiarios: '0',
        max_invitados: '0'
      });
    }
  }

  async function guardarTipo(e) {
    e.preventDefault();
    setAviso(null);
    try {
      if (tipoEditar === 'nuevo') {
        const { mensaje } = await membresiasApi.crearTipo(formTipo);
        setAviso({ tipo: 'exito', mensaje });
      } else {
        const { mensaje } = await membresiasApi.actualizarTipo(tipoEditar.id_tipo_membresia, formTipo);
        setAviso({ tipo: 'exito', mensaje });
      }
      setTipoEditar(null);
      cargarTodo();
    } catch (err) {
      setAviso({ tipo: 'error', mensaje: err.message });
    }
  }

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Membresías</h1>
          <p className="inicio__fecha">
            Administre las membresías de los socios, beneficiarios, historial y categorías del club.
          </p>
        </div>

        {vista === 'tipos' && esGeneral && (
          <button type="button" className="boton boton--oscuro" onClick={() => abrirModalTipo(null)}>
            + Nuevo tipo de membresía
          </button>
        )}
      </header>

      {aviso && <Alerta tipo={aviso.tipo}>{aviso.mensaje}</Alerta>}
      {error && (
        <Alerta>
          {error}{' '}
          <button type="button" className="enlace-boton" onClick={cargarTodo}>
            Reintentar
          </button>
        </Alerta>
      )}

      {/* Selector de sección */}
      <div className="filtros">
        <div className="filtros__estados" role="tablist" aria-label="Secciones de membresías">
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'socios'}
            className={`chip ${vista === 'socios' ? 'chip--activo' : ''}`}
            onClick={() => setVista('socios')}
          >
            Membresías de socios <span className="chip__numero">{socios?.length ?? 0}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'tipos'}
            className={`chip ${vista === 'tipos' ? 'chip--activo' : ''}`}
            onClick={() => setVista('tipos')}
          >
            Tipos de membresía <span className="chip__numero">{tipos?.length ?? 0}</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: MEMBRESÍAS DE SOCIOS */}
      {vista === 'socios' && (
        <>
          <div className="filtros">
            <input
              type="search"
              className="campo__input filtros__buscar"
              placeholder="Buscar por nombre, cédula, N.º de socio o tipo"
              aria-label="Buscar"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
            <div className="filtros__estados" role="group" aria-label="Filtrar por estado">
              {['', ...ESTADOS_FILTRO].map((e) => (
                <button
                  key={e || 'todos'}
                  type="button"
                  className={`chip ${estadoFiltro === e ? 'chip--activo' : ''}`}
                  aria-pressed={estadoFiltro === e}
                  onClick={() => setEstadoFiltro(e)}
                >
                  {e || 'Todos'} <span className="chip__numero">{conteo[e]}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="tabla-tarjeta">
            {!socios && !error && <p className="tabla__vacio">Cargando…</p>}
            {socios && visibles.length === 0 && (
              <p className="tabla__vacio">No hay socios que coincidan con la búsqueda.</p>
            )}
            {visibles.length > 0 && (
              <div className="tabla__scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Socio</th>
                      <th>N.º socio</th>
                      <th>Tipo</th>
                      <th>Vencimiento</th>
                      <th>Beneficiarios</th>
                      <th>Estado</th>
                      {esGeneral && <th>Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((s) => {
                      const m = s.membresia_actual;
                      const abrirFila = () => (m ? abrirDetalle(m.id_membresia) : esGeneral && abrirModalAsignar(s));

                      return (
                        <tr
                          key={s.id_socio}
                          tabIndex={0}
                          onClick={abrirFila}
                          onKeyDown={(e) => e.key === 'Enter' && abrirFila()}
                        >
                          <td>{s.usuario?.nombre_completo}</td>
                          <td>{s.numero_socio ?? '—'}</td>
                          <td>{m?.tipos_membresia?.nombre ?? 'Sin asignar'}</td>
                          <td>{m?.fecha_vencimiento ? fecha(m.fecha_vencimiento) : '—'}</td>
                          <td>
                            {m ? `${m.cantidad_beneficiarios} / ${m.tipos_membresia?.max_beneficiarios ?? 0}` : '—'}
                          </td>
                          <td>
                            {m ? (
                              <span className={`insignia insignia--${m.estado?.toLowerCase()}`}>{m.estado}</span>
                            ) : (
                              <span className="insignia insignia--inactivo">Sin asignar</span>
                            )}
                          </td>
                          {esGeneral && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="boton boton--secundario boton--chico"
                                onClick={() => abrirModalAsignar(s)}
                              >
                                {m ? 'Nueva asignación' : 'Asignar'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {socios && (
              <p className="tabla__pie">
                {visibles.length} de {socios.length} {socios.length === 1 ? 'socio' : 'socios'} · clic en una fila para gestionar beneficiarios e historial
              </p>
            )}
          </section>
        </>
      )}

      {/* VISTA 2: CATÁLOGO DE TIPOS DE MEMBRESÍA */}
      {vista === 'tipos' && (
        <section className="tabla-tarjeta">
          {!tipos && !error && <p className="tabla__vacio">Cargando…</p>}
          {tipos && tipos.length === 0 && (
            <p className="tabla__vacio">No hay tipos de membresía registrados.</p>
          )}
          {tipos && tipos.length > 0 && (
            <div className="tabla__scroll">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Cuota mensual</th>
                    <th>Máx. beneficiarios</th>
                    <th>Máx. invitados/mes</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((t) => (
                    <tr
                      key={t.id_tipo_membresia}
                      tabIndex={0}
                      onClick={() => esGeneral && abrirModalTipo(t)}
                      onKeyDown={(e) => e.key === 'Enter' && esGeneral && abrirModalTipo(t)}
                    >
                      <td>{t.nombre}</td>
                      <td>{t.descripcion || '—'}</td>
                      <td>₡{Number(t.precio).toLocaleString('es-CR')}</td>
                      <td>{t.max_beneficiarios}</td>
                      <td>{t.max_invitados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tipos && (
            <p className="tabla__pie">
              {tipos.length} {tipos.length === 1 ? 'categoría registrada' : 'categorías registradas'}
              {esGeneral ? ' · clic en una fila para editar' : ''}
            </p>
          )}
        </section>
      )}

      {/* MODAL LATERAL: GESTIÓN, BENEFICIARIOS E HISTORIAL */}
      {seleccionada && (
        <DetalleMembresiaModal
          idMembresia={seleccionada}
          tipos={tipos ?? []}
          onCerrar={cerrarDetalle}
          onActualizado={cargarTodo}
        />
      )}

      {/* MODAL: ASIGNAR MEMBRESÍA */}
      {socioAsignar && (
        <Modal
          titulo={`Asignar membresía · ${socioAsignar.usuario?.nombre_completo}`}
          onCerrar={() => setSocioAsignar(null)}
        >
          <p className="tarjeta__subtitulo tarjeta__subtitulo--compacto">
            Socio N.º {socioAsignar.numero_socio}. Defina el plan, vigencia y estado inicial.
          </p>
          {errorModal && <Alerta>{errorModal}</Alerta>}
          <form onSubmit={confirmarAsignacion}>
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="asig-tipo">Tipo de membresía</label>
              <select
                id="asig-tipo"
                className="campo__input campo__select"
                value={formAsignar.id_tipo_membresia}
                onChange={(e) => setFormAsignar({ ...formAsignar, id_tipo_membresia: e.target.value })}
              >
                {(tipos ?? []).map((t) => (
                  <option key={t.id_tipo_membresia} value={t.id_tipo_membresia}>
                    {t.nombre} — ₡{Number(t.precio).toLocaleString('es-CR')}/mes
                  </option>
                ))}
              </select>
            </div>

            <div className="rejilla">
              <Campo
                etiqueta="Fecha de inscripción"
                tipo="date"
                value={formAsignar.fecha_inicio}
                onChange={(e) => setFormAsignar({ ...formAsignar, fecha_inicio: e.target.value })}
              />
              <Campo
                etiqueta="Fecha de renovación"
                tipo="date"
                value={formAsignar.fecha_vencimiento}
                onChange={(e) => setFormAsignar({ ...formAsignar, fecha_vencimiento: e.target.value })}
              />
            </div>

            <div className="campo">
              <label className="campo__etiqueta" htmlFor="asig-estado">Estado inicial</label>
              <select
                id="asig-estado"
                className="campo__input campo__select"
                value={formAsignar.estado}
                onChange={(e) => setFormAsignar({ ...formAsignar, estado: e.target.value })}
              >
                <option value="Activa">Activa</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </div>

            <Campo
              etiqueta="Observación para el historial"
              value={formAsignar.motivo}
              onChange={(e) => setFormAsignar({ ...formAsignar, motivo: e.target.value })}
              placeholder="Ej. Alta inicial en administración"
            />

            <label className="check-campo">
              <input
                type="checkbox"
                checked={formAsignar.generar_cargo}
                onChange={(e) => setFormAsignar({ ...formAsignar, generar_cargo: e.target.checked })}
              />
              Generar cargo pendiente en el estado de cuenta
            </label>

            <button type="submit" className="boton boton--primario">
              Confirmar asignación
            </button>
          </form>
        </Modal>
      )}

      {/* MODAL: CREAR / EDITAR TIPO DE MEMBRESÍA */}
      {tipoEditar && (
        <Modal
          titulo={tipoEditar === 'nuevo' ? 'Nuevo tipo de membresía' : `Editar · ${tipoEditar.nombre}`}
          onCerrar={() => setTipoEditar(null)}
        >
          <form onSubmit={guardarTipo}>
            <Campo
              etiqueta="Nombre de categoría"
              placeholder="Individual, Familiar, Corporativa u Honoraria"
              value={formTipo.nombre}
              onChange={(e) => setFormTipo({ ...formTipo, nombre: e.target.value })}
            />
            <Campo
              etiqueta="Descripción y beneficios"
              value={formTipo.descripcion}
              onChange={(e) => setFormTipo({ ...formTipo, descripcion: e.target.value })}
            />
            <div className="rejilla">
              <Campo
                etiqueta="Cuota mensual (₡)"
                tipo="number"
                min="0"
                value={formTipo.precio}
                onChange={(e) => setFormTipo({ ...formTipo, precio: e.target.value })}
              />
              <Campo
                etiqueta="Máx. beneficiarios"
                tipo="number"
                min="0"
                value={formTipo.max_beneficiarios}
                onChange={(e) => setFormTipo({ ...formTipo, max_beneficiarios: e.target.value })}
              />
              <Campo
                etiqueta="Máx. invitados por mes"
                tipo="number"
                min="0"
                value={formTipo.max_invitados}
                onChange={(e) => setFormTipo({ ...formTipo, max_invitados: e.target.value })}
              />
            </div>
            <button type="submit" className="boton boton--primario">
              Guardar categoría
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}