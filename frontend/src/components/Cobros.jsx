import { useEffect, useState, useCallback } from 'react';
import Alerta from '../components/Alerta';
import {
  obtenerEstadoCuentaAPI,
  registrarPagoAPI,
  obtenerMorososAPI,
  obtenerResumenFinancieroAPI
} from '../api/finanzas';
import { notificacionesApi } from '../api/notificaciones';

export default function Cobros() {
  const [pestanaActiva, setPestanaActiva] = useState('estados'); // 'estados', 'morosos', 'registrar'
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Estados dinámicos conectados a la base de datos
  const [resumen, setResumen] = useState({
    facturado: 0,
    pagado: 0,
    pendiente: 0,
    vencido: 0,
    totalCargos: 0
  });
  const [estadosCuenta, setEstadosCuenta] = useState([]);
  const [morosos, setMorosos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Estado para la pestaña Registrar Pago
  const [busquedaSocio, setBusquedaSocio] = useState('');
  const [socioSeleccionado, setSocioSeleccionado] = useState(null);
  const [cargosSocio, setCargosSocio] = useState([]);

  // Calcular periodo actual dinámicamente
  const fechaActual = new Date();
  const mesActual = fechaActual.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  const fechaHoyTexto = fechaActual.toLocaleDateString('es-CR');

  // Función centralizada para cargar/recargar todos los datos reales
  const cargarDatosReales = useCallback(async () => {
    setError('');
    try {
      const [resResumen, resMorosos, resUsuarios] = await Promise.all([
        obtenerResumenFinancieroAPI(),
        obtenerMorososAPI(),
        notificacionesApi.listarUsuarios()
      ]);

      if (resResumen) {
        setResumen(resResumen.resumen || { facturado: 0, pagado: 0, pendiente: 0, vencido: 0, totalCargos: 0 });
        setEstadosCuenta(resResumen.estadosCuenta || []);
      }

      if (Array.isArray(resMorosos)) {
        const hoy = new Date();
        const morososFormateados = resMorosos
          .map((m, index) => {
            const fechaVenc = m.fecha_vencimiento ? new Date(m.fecha_vencimiento) : hoy;
            const diasAtraso = Math.max(1, Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24)));
            return {
              id: m.id_cargo || index,
              socio: m.socios?.usuarios?.nombre_completo || 'Socio sin nombre',
              cedula: m.socios?.usuarios?.cedula || '—',
              desde: m.fecha_vencimiento || '—',
              monto: Number(m.monto) || 0,
              diasAtraso
            };
          })
          .sort((a, b) => b.diasAtraso - a.diasAtraso);

        setMorosos(morososFormateados);
      }

      setUsuarios(resUsuarios || []);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos financieros');
    }
  }, []);

  useEffect(() => {
    cargarDatosReales();
  }, [cargarDatosReales]);

  // Seleccionar socio y consultar sus cargos reales
  const seleccionarSocio = async (usuario) => {
    setSocioSeleccionado(usuario);
    setBusquedaSocio(usuario.nombre_completo);
    setError('');
    try {
      const idConsulta = usuario.id_socio || usuario.id_usuario;
      const res = await obtenerEstadoCuentaAPI(idConsulta);
      const pendientes = (res?.cargos || [])
        .filter((c) => c.estado !== 'Pagado')
        .map((c) => ({
          id: c.id_cargo,
          descripcion: c.concepto || c.descripcion || 'Cargo',
          fechaLimite: c.fecha_vencimiento || '—',
          monto: Number(c.monto) || 0,
          estado: c.estado,
          seleccionado: false
        }));
      setCargosSocio(pendientes);
    } catch (err) {
      setError('Error al consultar el estado de cuenta del socio');
      setCargosSocio([]);
    }
  };

  const toggleCargo = (id) => {
    setCargosSocio((prev) =>
      prev.map((c) => (c.id === id ? { ...c, seleccionado: !c.seleccionado } : c))
    );
  };

  const procesarPago = async () => {
    const itemsPagos = cargosSocio
      .filter((c) => c.seleccionado)
      .map((c) => ({ id_cargo: c.id, monto_aplicado: c.monto }));

    if (!socioSeleccionado) {
      setError('Seleccione un socio primero.');
      return;
    }

    if (itemsPagos.length === 0) {
      setError('Seleccione al menos un cargo para procesar el pago.');
      return;
    }

    setOcupado(true);
    setError('');
    try {
      const monto_total = itemsPagos.reduce((acc, curr) => acc + curr.monto_aplicado, 0);
      await registrarPagoAPI({
        id_socio: socioSeleccionado.id_socio || socioSeleccionado.id_usuario,
        monto_total,
        itemsPagos
      });

      setAviso(`Pago procesado con éxito para ${socioSeleccionado.nombre_completo}`);
      setCargosSocio([]);
      setSocioSeleccionado(null);
      setBusquedaSocio('');
      await cargarDatosReales();
      setTimeout(() => setAviso(''), 4000);
    } catch (err) {
      setError(err.message || 'Error al registrar el pago');
    } finally {
      setOcupado(false);
    }
  };

  // Cálculos dinámicos para la pestaña de Estados de Cuenta y Morosos
  const totalPendienteTabla = estadosCuenta.reduce((acc, item) => acc + item.saldo, 0);

  const totalVencidoMorosos = morosos.reduce((acc, m) => acc + m.monto, 0);
  const morosos1a30 = morosos.filter((m) => m.diasAtraso >= 1 && m.diasAtraso <= 30).length;
  const morosos31a60 = morosos.filter((m) => m.diasAtraso >= 31 && m.diasAtraso <= 60).length;
  const morososMas60 = morosos.filter((m) => m.diasAtraso > 60).length;

  const usuariosFiltrados = usuarios.filter((u) =>
    (u.nombre_completo || '').toLowerCase().includes(busquedaSocio.toLowerCase())
  );

  return (
    <div className="panel">
      <header className="panel__encabezado">
        <div>
          <h1 className="inicio__saludo">Módulo de Cobros</h1>
          <p className="inicio__fecha">Gestión financiera, estados de cuenta y control de morosidad</p>
        </div>
      </header>

      {aviso && <Alerta tipo="exito">{aviso}</Alerta>}
      {error && <Alerta>{error}</Alerta>}

      {/* Pestañas de navegación superiores */}
      <div className="pestanas" style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={() => setPestanaActiva('estados')}
          style={{
            background: 'none',
            border: 'none',
            paddingBottom: '0.75rem',
            cursor: 'pointer',
            fontWeight: pestanaActiva === 'estados' ? 'bold' : 'normal',
            borderBottom: pestanaActiva === 'estados' ? '2px solid #2d5a27' : 'none',
            color: pestanaActiva === 'estados' ? '#2d5a27' : '#6b7280'
          }}
        >
          Estados de cuenta
        </button>
        <button
          type="button"
          onClick={() => setPestanaActiva('morosos')}
          style={{
            background: 'none',
            border: 'none',
            paddingBottom: '0.75rem',
            cursor: 'pointer',
            fontWeight: pestanaActiva === 'morosos' ? 'bold' : 'normal',
            borderBottom: pestanaActiva === 'morosos' ? '2px solid #2d5a27' : 'none',
            color: pestanaActiva === 'morosos' ? '#2d5a27' : '#6b7280'
          }}
        >
          Morosos
        </button>
        <button
          type="button"
          onClick={() => setPestanaActiva('registrar')}
          style={{
            background: 'none',
            border: 'none',
            paddingBottom: '0.75rem',
            cursor: 'pointer',
            fontWeight: pestanaActiva === 'registrar' ? 'bold' : 'normal',
            borderBottom: pestanaActiva === 'registrar' ? '2px solid #2d5a27' : 'none',
            color: pestanaActiva === 'registrar' ? '#2d5a27' : '#6b7280'
          }}
        >
          Registrar pago
        </button>
      </div>

      {/* ================= PESTAÑA 1: ESTADOS DE CUENTA ================= */}
      {pestanaActiva === 'estados' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 className="seccion__titulo" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: '#111827' }}>
              Estados de cuenta
            </h2>
            <button
              type="button"
              onClick={cargarDatosReales}
              style={{
                background: '#1b3b22',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Actualizar estados
            </button>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', textTransform: 'capitalize' }}>
            Periodo: {mesActual} · {resumen.totalCargos} estados registrados al {fechaHoyTexto}
          </p>

          {/* Tarjetas de resumen reales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Facturado</span>
              <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                ₡{resumen.facturado.toLocaleString('es-CR')}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pagado</span>
              <div style={{ color: '#059669', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                ₡{resumen.pagado.toLocaleString('es-CR')}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pendiente</span>
              <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                ₡{resumen.pendiente.toLocaleString('es-CR')}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Vencido</span>
              <div style={{ color: '#dc2626', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                ₡{resumen.vencido.toLocaleString('es-CR')}
              </div>
            </div>
          </div>

          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
            <div className="tabla__scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.875rem' }}>
                    <th style={{ paddingBottom: '0.75rem' }}>Socio</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Detalle</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Vence</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Saldo</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {estadosCuenta.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        No hay estados de cuenta registrados en la base de datos.
                      </td>
                    </tr>
                  ) : (
                    estadosCuenta.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>{item.socio}</td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{item.detalle}</td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{item.vence}</td>
                        <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>
                          ₡{item.saldo.toLocaleString('es-CR')}
                        </td>
                        <td style={{ padding: '1rem 0' }}>
                          <span
                            style={{
                              color: item.estado === 'Al día' ? '#059669' : item.estado === 'Vencido' ? '#dc2626' : '#d97706',
                              fontWeight: '500'
                            }}
                          >
                            {item.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', fontWeight: 'bold', color: '#111827', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
              <span>Total pendiente: ₡{totalPendienteTabla.toLocaleString('es-CR')}</span>
            </div>
          </section>
        </div>
      )}

      {/* ================= PESTAÑA 2: MOROSOS ================= */}
      {pestanaActiva === 'morosos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 className="seccion__titulo" style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0, color: '#111827' }}>
              Morosos
            </h2>
            <button
              type="button"
              onClick={() => setPestanaActiva('registrar')}
              style={{
                background: '#1b3b22',
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Registrar pago
            </button>
          </div>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {morosos.length} cargos con saldo vencido al {fechaHoyTexto} · ordenados por días de atraso
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Total vencido</span>
              <div style={{ color: '#111827', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                ₡{totalVencidoMorosos.toLocaleString('es-CR')}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>1 a 30 días</span>
              <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                {morosos1a30} {morosos1a30 === 1 ? 'cargo' : 'cargos'}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>31 a 60 días</span>
              <div style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                {morosos31a60} {morosos31a60 === 1 ? 'cargo' : 'cargos'}
              </div>
            </div>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
              <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Más de 60 días</span>
              <div style={{ color: '#dc2626', fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.3rem' }}>
                {morososMas60} {morososMas60 === 1 ? 'cargo' : 'cargos'}
              </div>
            </div>
          </div>

          <section style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
            <div className="tabla__scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.875rem' }}>
                    <th style={{ paddingBottom: '0.75rem' }}>Socio</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Cédula</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Desde</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Monto</th>
                    <th style={{ paddingBottom: '0.75rem' }}>Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {morosos.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                        No hay socios morosos registrados.
                      </td>
                    </tr>
                  ) : (
                    morosos.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>{m.socio}</td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{m.cedula}</td>
                        <td style={{ padding: '1rem 0', color: '#4b5563' }}>{m.desde}</td>
                        <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>
                          ₡{m.monto.toLocaleString('es-CR')}
                        </td>
                        <td style={{ padding: '1rem 0', fontWeight: '500', color: m.diasAtraso > 30 ? '#dc2626' : '#d97706' }}>
                          {m.diasAtraso} {m.diasAtraso === 1 ? 'día' : 'días'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '1.5rem', color: '#6b7280', fontSize: '0.875rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
              <span>
                Total vencido registrado — <strong>₡{totalVencidoMorosos.toLocaleString('es-CR')}</strong>
              </span>
            </div>
          </section>
        </div>
      )}

      {/* ================= PESTAÑA 3: REGISTRAR PAGO ================= */}
      {pestanaActiva === 'registrar' && (
        <div>
          <h2 className="seccion__titulo" style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#111827' }}>
            Registrar Pago
          </h2>

          {/* Tarjeta Buscador de Socio */}
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem', fontWeight: '500' }}>
              Buscar socio
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Ingrese nombre o correo del socio"
                value={busquedaSocio}
                onChange={(e) => {
                  setBusquedaSocio(e.target.value);
                  if (socioSeleccionado && e.target.value !== socioSeleccionado.nombre_completo) {
                    setSocioSeleccionado(null);
                  }
                }}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontSize: '1rem', background: '#fff' }}
              />
            </div>

            {/* Lista interactiva de resultados de búsqueda */}
            {busquedaSocio.trim() !== '' && !socioSeleccionado && usuariosFiltrados.length > 0 && (
              <div style={{ marginTop: '0.75rem', border: '1px solid #1b3b22', borderRadius: '0.5rem', background: '#fff', overflow: 'hidden', maxHeight: '180px', overflowY: 'auto' }}>
                {usuariosFiltrados.map((u) => (
                  <div
                    key={u.id_usuario}
                    onClick={() => seleccionarSocio(u)}
                    style={{
                      padding: '0.75rem 1rem',
                      color: '#374151',
                      borderBottom: '1px solid #f3f4f6',
                      cursor: 'pointer'
                    }}
                  >
                    {u.nombre_completo}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Cargos del Socio Seleccionado */}
          {socioSeleccionado && (
            <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#111827' }}>
                Cargos pendientes para: {socioSeleccionado.nombre_completo}
              </h3>

              <div className="tabla__scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontSize: '0.875rem' }}>
                      <th style={{ paddingBottom: '0.75rem', width: '50px' }}></th>
                      <th style={{ paddingBottom: '0.75rem' }}>Descripción</th>
                      <th style={{ paddingBottom: '0.75rem' }}>Fecha Límite</th>
                      <th style={{ paddingBottom: '0.75rem' }}>Monto</th>
                      <th style={{ paddingBottom: '0.75rem' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargosSocio.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>
                          Este socio no tiene cargos pendientes por pagar.
                        </td>
                      </tr>
                    ) : (
                      cargosSocio.map((cargo) => (
                        <tr key={cargo.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '1rem 0', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={cargo.seleccionado}
                              onChange={() => toggleCargo(cargo.id)}
                              style={{ width: '1.2rem', height: '1.2rem', accentColor: '#1b3b22', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>{cargo.descripcion}</td>
                          <td style={{ padding: '1rem 0', color: '#4b5563' }}>{cargo.fechaLimite}</td>
                          <td style={{ padding: '1rem 0', fontWeight: '500', color: '#111827' }}>
                            ₡{cargo.monto.toLocaleString('es-CR')}
                          </td>
                          <td style={{ padding: '1rem 0' }}>
                            <span style={{ color: cargo.estado === 'Vencido' ? '#dc2626' : '#d97706', fontWeight: '500' }}>
                              {cargo.estado}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Botón inferior Procesar Pago */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              disabled={ocupado}
              onClick={procesarPago}
              style={{
                background: '#1b3b22',
                color: '#fff',
                border: 'none',
                padding: '0.875rem 3rem',
                borderRadius: '9999px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              {ocupado ? 'Procesando...' : 'Procesar Pago'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}